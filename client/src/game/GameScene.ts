// Owns the Three.js scene for one run of a level (PLAN.md Section 8).
//
// - builds the room from the level map (with its doors, vents and latches),
// - makes a character for every player in the room state,
// - moves the characters this client controls with LocalController,
// - draws everyone else (and the cat) 100 ms in the past with Interp,
// - draws items, jars, the cat's cone, noise rings, barks and the HUD,
// - shows the intro and the briefing (top-down camera, paw prints, exit arrow),
// - plays the sounds and music, tutorial cards and pings.
// A new GameScene is made every time a level starts or restarts.

import * as THREE from "three";
import {
  type Carry, type Grid, type LevelDef, type OpenSet, type Role, type ServerMessages, ROLES, TUNING,
  exitZone, findPath, getLevel, inZone, interactTarget, isWalkableForCat, moveSpeed, parseMap,
} from "@snikisnak/shared";
import type { HeistRoom, HeistView, PlayerView } from "../net/Net";
import { INTERP_DELAY_MS, Interp } from "../net/Interp";
import type { Renderer } from "../render/Renderer";
import { LightRig } from "../render/Lights";
import { Effects } from "../render/Effects";
import { PALETTE } from "../render/palette";
import { toonMesh } from "../render/Toon";
import { type DoorView, buildLevel } from "./LevelBuilder";
import { CHARACTER_SCALE, Character } from "./Characters";
import { CatView } from "./CatView";
import { ItemView, JarView, ProgressRing } from "./Props";
import { LocalController } from "./LocalController";
import { type DebugPlayer, DevPanel } from "../dev/DevPanel";
import { type CatMood, Hud, type Prompt, type TeamMember } from "../ui/Hud";
import { Bubbles } from "../ui/Bubbles";
import { FlowOverlay } from "../ui/FlowOverlay";
import { CHARACTERS } from "../content/characters";
import { hasLine, line } from "../content/script";
import { audio, type GameAudio } from "../audio";
import { Cards } from "../ui/Cards";
import { Pings } from "./Pings";

interface Entity {
  id: string;
  character: Character;
  interp: Interp;
  owned: boolean;
  jar: JarView | null;
}

/** How high an item sits on each character's back, and where a speech bubble goes. */
const BACK_HEIGHT: Record<Role, number> = { kiwi: 0.3 * CHARACTER_SCALE, mochi: 0.32 * CHARACTER_SCALE, pip: 0.5 * CHARACTER_SCALE };
const HEAD_HEIGHT: Record<Role, number> = { kiwi: 0.6 * CHARACTER_SCALE, mochi: 0.6 * CHARACTER_SCALE, pip: 0.95 * CHARACTER_SCALE };

export interface GameSceneOptions {
  /** Show the F1 overlay (dev mode or ?debug=1). */
  debug: boolean;
  uiRoot: HTMLElement;
}

export class GameScene {
  readonly level: LevelDef;
  readonly grid: Grid;
  readonly run: number;
  private readonly root = new THREE.Group();
  private readonly entities = new Map<string, Entity>();
  private readonly items = new Map<string, ItemView>();
  private readonly effects = new Effects();
  private readonly cat: CatView;
  private readonly doors: Map<string, DoorView>;
  private readonly doorRings = new Map<string, ProgressRing>();
  private readonly briefingExtras = new THREE.Group();
  private zone: Set<number>;
  private zoneKey = "";
  private readonly controller: LocalController;
  private readonly hud: Hud;
  private readonly bubbles: Bubbles;
  private readonly flow: FlowOverlay;
  private readonly dev: DevPanel | null;
  private readonly removeFrame: () => void;
  private readonly unsubscribe: Array<() => void> = [];
  private leftBehind: string[] = [];
  private home: string[] = [];
  private finishTime = 0;
  private readonly sound: GameAudio = audio();
  private readonly lights: LightRig;
  private readonly cards: Cards;
  private readonly pings = new Pings();
  private catBubbleSeq = 0;
  private lastCatPos: { x: number; z: number } | null = null;
  private cardsShownForIntro = false;
  private mouse = { x: 0, y: 0 };
  private readonly onMouse = (e: MouseEvent): void => { this.mouse = { x: e.clientX, y: e.clientY }; };
  private readonly onPingKey = (e: KeyboardEvent): void => this.pingKey(e);
  /** Player ids currently talking on voice chat. */
  private readonly talking = new Set<string>();
  private t = 0;

  constructor(private readonly renderer: Renderer, private readonly room: HeistRoom, opts: GameSceneOptions) {
    const state = room.state;
    this.run = state.run;
    this.level = getLevel(state.level);
    this.grid = parseMap(this.level.map);
    this.zone = exitZone(this.grid);

    const built = buildLevel(this.level, this.grid);
    this.doors = built.doors;
    for (const [id, door] of this.doors) {
      const ring = new ProgressRing(PALETTE.cheese, 0.25, 0.34);
      ring.mesh.position.copy(door.centre);
      this.root.add(ring.mesh);
      this.doorRings.set(id, ring);
    }
    this.cat = new CatView(this.grid, this.level.cat.fov);
    this.buildBriefingExtras();
    this.lights = new LightRig(this.level.lights, built.width, built.depth);
    this.root.add(built.root, this.lights.root, this.effects.root, this.cat.root, this.briefingExtras, this.pings.root);
    renderer.scene.add(this.root);
    renderer.frameRoom(built.width, built.depth);

    // Characters this client controls: just its own, or all three in dev mode.
    const owned: PlayerView[] = [];
    state.players.forEach((p) => { if (p.owner === room.sessionId) owned.push(p); });
    owned.sort((a, b) => ROLES.indexOf(a.role as Role) - ROLES.indexOf(b.role as Role));
    this.controller = new LocalController(
      this.grid, room,
      owned.map((p) => ({ id: p.id, role: p.role as Role, x: p.x, z: p.z, facing: p.facing })),
      state.solo, () => this.openDoors(), (id) => this.markLocal(id),
    );

    this.hud = new Hud(opts.uiRoot, (a) => room.send(a.type, a.type === "select" ? { level: a.level } : {}), this.sound);
    this.hud.setLevel(`Level ${this.level.id} — ${this.level.name}`, this.level.listItem?.name ?? null);
    this.bubbles = new Bubbles(opts.uiRoot, this.sound.blips);
    this.cards = new Cards(opts.uiRoot, this.sound);
    this.flow = new FlowOverlay(opts.uiRoot, this.level, () => { this.sound.sfx.play("pap", undefined, 1, "ui"); room.send("ready", { ready: true }); },
      this.sound, () => this.showIntroCards());
    this.catBubbleSeq = state.cat.bubbleSeq;
    window.addEventListener("mousemove", this.onMouse);
    window.addEventListener("keydown", this.onPingKey);
    this.sound.music.start();

    this.sync(state);
    this.markLocal(this.controller.controlled);
    this.unsubscribe.push(
      room.onMessage("noise", (m: ServerMessages["noise"]) => {
        this.effects.noiseRing(m.x, m.z, m.radius, m.kind);
        this.dev?.logNoise(m.kind, m.radius);
        this.noiseSound(m);
      }),
      room.onMessage("correct", (m: ServerMessages["correct"]) => this.controller.onCorrect(m)),
      room.onMessage("toast", (m: ServerMessages["toast"]) => this.hud.toast(m.text)),
      room.onMessage("bark", (m: ServerMessages["bark"]) => this.showBark(m.who, m.lineId)),
      room.onMessage("complete", (m: ServerMessages["complete"]) => {
        this.leftBehind = m.leftBehind;
        this.home = m.home ?? [];
        this.finishTime = m.time ?? 0;
        this.sound.music.jingle();
      }),
      room.onMessage("caught", () => { this.sound.music.sting(); }),
      room.onMessage("sfx", (m: ServerMessages["sfx"]) => {
        this.sound.sfx.play(m.name, m.x !== undefined && m.z !== undefined ? { x: m.x, z: m.z } : undefined);
      }),
      room.onMessage("card", (m: ServerMessages["card"]) => this.cards.show([m.cardId])),
      room.onMessage("ping", (m: ServerMessages["ping"]) => {
        this.pings.add(m.kind, m.x, m.z);
        this.sound.sfx.play(`ping${m.kind}`, { x: m.x, z: m.z }, 1, "ui");
      }),
    );

    this.dev = opts.debug ? new DevPanel(this.grid, opts.uiRoot, () => this.debugInfo()) : null;
    if (this.dev) this.root.add(this.dev.root);

    this.removeFrame = renderer.addFrameCallback((dt) => this.frame(dt));
  }

  private openDoors(): OpenSet {
    const open = new Set<string>();
    this.room.state.doors?.forEach((d, id) => { if (d.open) open.add(id); });
    return open;
  }

  private carryOf(p: PlayerView): Carry {
    const item = p.carrying ? this.room.state.items.get(p.carrying) : undefined;
    return item?.kind === "heavy" ? "heavy" : item?.kind === "croissant" ? "croissant" : "none";
  }

  /** Called on every state patch: add/remove characters and items, record snapshots. */
  sync(state: HeistView): void {
    const now = performance.now();
    const seen = new Set<string>();
    state.players.forEach((p, id) => {
      seen.add(id);
      let e = this.entities.get(id);
      if (!e) {
        if (!ROLES.includes(p.role as Role)) return;
        const character = new Character(p.role as Role);
        e = { id, character, interp: new Interp(), owned: p.owner === this.room.sessionId, jar: null };
        e.interp.reset({ t: now, x: p.x, z: p.z, facing: p.facing, moving: p.moving, sneaking: p.sneaking });
        character.setPose(p.x, p.z, p.facing);
        this.root.add(character.root);
        this.entities.set(id, e);
      }
      const inVent = p.mode === "vent";
      if (e.owned) {
        this.controller.setFrozen(id, p.jarred || inVent, p.x, p.z);
        this.controller.setCarry(id, this.carryOf(p));
      } else {
        e.interp.push({ t: now, x: p.x, z: p.z, facing: p.facing, moving: p.moving, sneaking: p.sneaking });
        if (inVent) e.interp.reset({ t: now, x: p.x, z: p.z, facing: p.facing, moving: false, sneaking: false });
      }
      e.character.root.visible = !inVent;

      if (p.jarred && !e.jar) { e.jar = new JarView(); this.root.add(e.jar.root); }
      if (!p.jarred && e.jar) { e.jar.root.removeFromParent(); e.jar = null; }
    });
    for (const [id, e] of this.entities) {
      if (!seen.has(id)) {
        e.character.dispose();
        e.jar?.root.removeFromParent();
        this.entities.delete(id);
      }
    }

    state.items.forEach((_item, id) => {
      if (!this.items.has(id)) {
        const view = new ItemView(id, this.level.listItem?.model ?? "box");
        this.root.add(view.root);
        this.items.set(id, view);
      }
    });
    state.doors?.forEach((d, id) => this.doors.get(id)?.setOpen(d.open));

    this.cat.push(state.cat, now);
  }

  private markLocal(id: string): void {
    for (const e of this.entities.values()) e.character.setLocal(e.id === id);
  }

  /** Voice chat speaking indicator: sound waves over that character's head. */
  setTalking(playerId: string, on: boolean): void {
    if (on) this.talking.add(playerId); else this.talking.delete(playerId);
    const e = this.entities.get(playerId);
    if (e) this.bubbles.setTalking(e.character.root, HEAD_HEIGHT[e.character.role], on);
  }

  /** The push-to-talk indicator in the bottom-right corner. */
  setVoiceState(state: "talking" | "idle" | "muted" | "nomic" | "off", pushToTalk: boolean): void {
    this.hud.setVoice(state, pushToTalk);
  }

  /** The id of the character this client controls (for its own speaking indicator). */
  get controlledId(): string {
    return this.controller.controlled;
  }

  private showBark(who: Role, lineId: string): void {
    if (!hasLine(lineId)) return;
    const e = [...this.entities.values()].find((x) => x.character.role === who);
    if (e) this.bubbles.say(e.character.root, HEAD_HEIGHT[who], CHARACTERS[who].name, line(lineId).text, who);
  }

  /** The level's tutorial cards, after the intro lines (or when the intro is skipped). */
  private showIntroCards(): void {
    if (this.cardsShownForIntro) return;
    this.cardsShownForIntro = true;
    this.cards.show(this.level.cards);
  }

  /** The sound of a server noise: footsteps, squeaks, lock clicks, crashes. */
  private noiseSound(m: ServerMessages["noise"]): void {
    const at = { x: m.x, z: m.z };
    switch (m.kind) {
      case "step": this.sound.sfx.play(m.radius >= 4 ? "stepHeavy" : "step", at, m.radius < 1 ? 0.4 : 0.8); break;
      case "squeak": this.sound.sfx.play("squeak", at); break;
      case "lockClick": this.sound.sfx.play("lockClick", at); break;
      case "crash": this.sound.sfx.play("crash", at); break;
      case "wobble": this.sound.sfx.play("wobble", at); break;
      default: break;
    }
  }

  /** Keys 1-4: ping at the mouse cursor. */
  private pingKey(e: KeyboardEvent): void {
    if (e.repeat || !["Digit1", "Digit2", "Digit3", "Digit4"].includes(e.code)) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
    const phase = this.room.state.phase;
    if (phase !== "playing" && phase !== "briefing") return;
    const p = this.pings.floorPoint(this.mouse.x, this.mouse.y, this.renderer.camera);
    if (!p) return;
    const msg: Record<string, unknown> = { kind: Number(e.code.slice(5)), x: p.x, z: p.z };
    if (this.room.state.solo) msg.who = this.controller.controlled;
    this.room.send("ping", msg);
  }

  /** Thought bubbles, the collar bell, the purr and the music follow the cat. */
  private catAudio(dt: number, suspicious: boolean): void {
    const c = this.room.state.cat;
    if (c.bubbleSeq !== this.catBubbleSeq) {
      this.catBubbleSeq = c.bubbleSeq;
      if (c.bubble && hasLine(c.bubble)) this.bubbles.think(this.cat.anchor, 2.4, line(c.bubble).text);
      const at = { x: c.x, z: c.z };
      if (c.state === "STIR" || c.state === "INVESTIGATE" || c.state === "SEARCH") this.sound.sfx.play("chirp", at);
      if (c.state === "CHASE") { this.sound.sfx.play("meow", at); this.sound.sfx.play("hiss", at, 0.6); }
      if (c.state === "POUNCE") this.sound.sfx.play("whoosh", at);
    }
    const pos = this.cat.position;
    const moved = this.lastCatPos ? Math.hypot(pos.x - this.lastCatPos.x, pos.z - this.lastCatPos.z) / Math.max(dt, 1e-3) : 0;
    this.lastCatPos = { x: pos.x, z: pos.z };
    const playing = this.room.state.phase === "playing";
    this.sound.sfx.updateCat(playing ? { x: pos.x, z: pos.z } : null, moved > 0.3, c.state === "SLEEP");
    const chasing = c.state === "CHASE" || c.state === "POUNCE";
    const tense = suspicious || c.state === "INVESTIGATE" || c.state === "SEARCH" || c.state === "STIR";
    this.sound.music.setIntensity(playing && tense, playing && chasing);
  }

  /** Briefing only: paw prints along the cat's patrol route, and an arrow over the exit. */
  private buildBriefingExtras(): void {
    this.briefingExtras.visible = false;
    const wps = this.grid.waypoints.map((w) => w.tile);
    const pass = (x: number, y: number): boolean => isWalkableForCat(this.grid, x, y);
    const pawMat = new THREE.MeshBasicMaterial({ color: PALETTE.ink, transparent: true, opacity: 0.55, depthWrite: false });
    const pad = new THREE.CircleGeometry(0.07, 10);
    for (let i = 0; i < wps.length && wps.length > 1; i++) {
      const path = findPath(this.grid, wps[i], wps[(i + 1) % wps.length], pass) ?? [];
      let prev = wps[i];
      path.forEach((tile, j) => {
        const a = Math.atan2(tile.x - prev.x, tile.y - prev.y);
        const side = j % 2 ? 1 : -1;
        const print = new THREE.Mesh(pad, pawMat);
        print.rotation.x = -Math.PI / 2;
        print.position.set(tile.x + 0.5 + Math.cos(a) * 0.12 * side, 0.02, tile.y + 0.5 - Math.sin(a) * 0.12 * side);
        this.briefingExtras.add(print);
        prev = tile;
      });
    }
    const exit = this.grid.exits[0];
    if (exit) {
      const arrow = toonMesh(new THREE.ConeGeometry(0.25, 0.5, 4), PALETTE.gold);
      arrow.rotation.x = Math.PI; // point down at the exit
      arrow.position.set(exit.x + 0.5, 1.2, exit.y + 0.5);
      arrow.name = "exit-arrow";
      this.briefingExtras.add(arrow);
    }
  }

  private frame(dt: number): void {
    const state = this.room.state;
    this.t += dt;
    const playing = state.phase === "playing";
    this.controller.enabled = playing;
    this.controller.update(dt);
    const renderAt = performance.now() - INTERP_DELAY_MS;
    const open = this.openDoors();
    const key = [...open].join();
    if (key !== this.zoneKey) { this.zoneKey = key; this.zone = exitZone(this.grid, open); }

    for (const e of this.entities.values()) {
      const p = state.players.get(e.id);
      const own = e.owned ? this.controller.owned.get(e.id) : undefined;
      const pose = own ?? e.interp.sample(renderAt);
      if (!pose || !p) continue;
      e.character.setPose(pose.x, pose.z, pose.facing);
      e.character.update(dt, {
        moving: pose.moving && !p.jarred,
        sneaking: pose.sneaking || p.mode === "covering",
        speed: moveSpeed({ sneaking: pose.sneaking, carry: this.carryOf(p), covering: p.mode === "covering" }),
      });
      e.jar?.update(pose.x, pose.z, p.rescue, this.renderer.camera);
    }

    this.items.forEach((view, id) => {
      const item = state.items.get(id);
      if (!item) return;
      const carrier = item.carriedBy ? this.entities.get(item.carriedBy) : undefined;
      if (carrier) {
        view.onBack(carrier.character.root, BACK_HEIGHT[carrier.character.role], item.kind !== "small");
      } else {
        if (view.root.parent !== this.root) this.root.add(view.root);
        view.onFloor(item.x, item.z, dt);
      }
      view.root.visible = item.visible;
    });

    for (const door of this.doors.values()) door.update(dt);
    state.doors?.forEach((d, id) => this.doorRings.get(id)?.update(d.open ? 0 : d.pick, this.renderer.camera));

    let suspicious = false;
    state.players.forEach((p) => { if (p.seen >= TUNING.detect.question) suspicious = true; });
    this.cat.open = open;
    this.cat.update(dt, suspicious);
    this.catAudio(dt, suspicious);
    this.lights.update(dt);
    this.pings.update(dt);
    if (state.phase !== "intro" && state.phase !== "cutscene") this.showIntroCards();

    // Briefing: look straight down, show the route and the exit.
    const briefing = state.phase === "briefing";
    this.renderer.setTopDown(briefing);
    this.briefingExtras.visible = briefing;
    const arrow = this.briefingExtras.getObjectByName("exit-arrow");
    if (arrow) arrow.position.y = 1.2 + Math.sin(this.t * 3) * 0.15;

    const me = this.controller.current;
    this.sound.sfx.setListener(me ? { x: me.x, z: me.z } : null);
    this.renderer.follow(playing ? me?.x ?? null : null, playing ? me?.z ?? null : null);
    this.effects.update(dt);
    this.updateHud(state, open, suspicious);
    this.bubbles.update(this.renderer.camera);
    this.dev?.update(dt);
  }

  private updateHud(state: HeistView, open: OpenSet, suspicious: boolean): void {
    const me = state.players.get(this.controller.controlled);
    const own = this.controller.current;
    const playing = state.phase === "playing";
    this.hud.setPlaying(playing);
    this.hud.setPrompt(playing && me && own ? this.promptFor(state, me, own, open) : null);

    const c = state.cat;
    const chasing = c.state === "CHASE" || c.state === "POUNCE";
    const curious = suspicious || c.state === "INVESTIGATE" || c.state === "STIR" || c.state === "SEARCH";
    const mood: CatMood = c.state === "SLEEP" ? "asleep" : chasing ? "angry" : curious ? "suspicious" : "calm";
    const words: Record<CatMood, string> = { asleep: "asleep", calm: "on patrol", suspicious: "suspicious", angry: "chasing!" };
    this.hud.setCat(mood, c.vision === 0 && c.state !== "SLEEP" ? "grooming" : words[mood]);

    const team: TeamMember[] = [];
    state.players.forEach((p) => {
      if (!ROLES.includes(p.role as Role)) return;
      const status: string[] = [];
      if (!p.connected) status.push("away");
      if (p.jarred) status.push("jarred");
      if (p.mode === "vent") status.push("in vent");
      if (p.hidden && p.mode !== "vent") status.push("hidden");
      if (p.mode === "covering") status.push("covering");
      if (p.mode === "covered") status.push("covered");
      if (p.carrying) status.push("carrying");
      if (this.talking.has(p.id)) status.push("talking");
      if (p.micOff) status.push("mic off");
      team.push({ role: p.role as Role, name: p.name, me: p.id === this.controller.controlled, seen: p.seen, status });
    });
    this.hud.setTeam(team);
    this.hud.setAbilities((me?.role as Role) ?? "");

    const item = state.items.get("item");
    this.hud.setItemDone(!!item && inZone(this.grid, this.zone, item.x, item.z));

    let ready = 0;
    state.players.forEach((p) => { if (p.ready) ready++; });
    const anyMine = [...this.controller.owned.keys()].some((id) => state.players.get(id)?.ready);
    this.flow.update(state.phase, state.timer, ready, state.players.size, anyMine);

    const over = state.phase === "caught" || state.phase === "complete";
    this.hud.showResult(over ? {
      kind: state.phase === "caught" ? "caught" : "complete",
      stars: state.stars,
      leftBehind: this.leftBehind,
      home: this.home,
      time: this.finishTime,
      isHost: state.hostId === this.room.sessionId,
      level: state.level,
      levelName: this.level.name,
      item: this.level.listItem?.name ?? null,
    } : null);
  }

  /** What E, F or Q would do right now, for the prompt at the bottom of the screen. */
  private promptFor(state: HeistView, me: PlayerView, pos: { x: number; z: number }, open: OpenSet): Prompt | null {
    if (me.jarred) return { text: "Jarred! E — Wobble the jar", progress: me.rescue > 0 ? me.rescue : undefined };
    if (me.mode === "vent") return { text: "Crawling through the vent..." };
    if (me.holdKind === "pick") return { text: "Picking the lock... keep holding E", progress: me.hold };
    if (me.holdKind === "latch") return { text: "Opening the latch...", progress: me.hold };

    let friend: PlayerView | null = null;
    state.players.forEach((p) => {
      if (p.id !== me.id && p.jarred && Math.hypot(p.x - pos.x, p.z - pos.z) <= TUNING.rescue.range) friend = p;
    });
    const jarred = friend as PlayerView | null;
    if (jarred) return { text: `Hold F — Free ${jarred.name}`, progress: jarred.rescue };

    if (state.exitReady && inZone(this.grid, this.zone, pos.x, pos.z)) {
      return { text: "Hold F — Call it a night", progress: state.exitHold };
    }
    if (me.carrying) return { text: "E — Put down" };

    const items: Array<{ id: string; kind: string; x: number; z: number; carriedBy: string; onLedge: boolean; visible: boolean }> = [];
    state.items.forEach((i) => items.push(i));
    const target = interactTarget(this.grid, open, items, me.role as Role, pos);
    if (!target) return me.mode === "covering" ? { text: "Covering..." } : null;
    if (!target.allowed) {
      const names = target.canBeDoneBy.map((r) => CHARACTERS[r].name).join(" or ");
      return { text: `${names} can do this`, disabled: true };
    }
    const itemName = (this.level.listItem?.name ?? "it").replace(/^(One|A|The) /i, "the ");
    switch (target.kind) {
      case "item": return { text: target.action === "pickUpSmall" ? `E — Pick up ${itemName}` : `E — Lift ${itemName}` };
      case "vent": return { text: "E — Crawl into the vent" };
      case "latch": return { text: "E — Open the latch" };
      case "door": return { text: "Hold E — Pick the lock" };
    }
  }

  private debugInfo(): { code: string; players: DebugPlayer[]; extra: string[] } {
    const players: DebugPlayer[] = [];
    const s = this.room.state;
    s.players.forEach((p) => {
      const own = this.controller.owned.get(p.id);
      players.push({
        id: p.id, name: p.name, role: p.role,
        x: own?.x ?? p.x, z: own?.z ?? p.z,
        moving: own?.moving ?? p.moving, sneaking: own?.sneaking ?? p.sneaking,
        controlled: p.id === this.controller.controlled,
        seen: p.seen, hidden: p.hidden, jarred: p.jarred,
      });
    });
    const c = s.cat;
    const extra = [
      `phase ${s.phase}  cat ${c.state} alert ${c.alert.toFixed(2)} at (${c.x.toFixed(1)}, ${c.z.toFixed(1)}) vision ${c.vision.toFixed(1)}${c.targetId ? ` target ${c.targetId}` : ""}`,
    ];
    return { code: s.code, players, extra };
  }

  dispose(): void {
    window.removeEventListener("mousemove", this.onMouse);
    window.removeEventListener("keydown", this.onPingKey);
    this.cards.dispose();
    this.sound.sfx.stopPurr();
    this.sound.music.setIntensity(false, false);
    this.removeFrame();
    for (const off of this.unsubscribe) off();
    this.controller.dispose();
    this.dev?.dispose();
    this.hud.dispose();
    this.bubbles.dispose();
    this.flow.dispose();
    this.renderer.setTopDown(false);
    for (const e of this.entities.values()) e.character.dispose();
    this.root.removeFromParent();
  }
}
