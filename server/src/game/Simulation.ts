// The server tick (PLAN.md Section 9, "Server tick order"). Runs at TUNING.tickHz.
//
//  1. Apply accepted positions; advance vent travel; carried items follow.
//  2. Hold actions: lock picking, latches, cover, rescue (call it a night is in step 9).
//  3. Status: who is hidden; ducking into a hide spot in front of the cat.
//  4. Noise: footsteps, squeaky boards and queued action noises.
//  6. The cat: hearing, vision, state machine, movement.
//  7. Catch: put a jar over whoever he caught.
//  9. Win and lose.
// 10. Barks: rate-limited speech bubbles.
// Steps 5 (Roomba) and 8 (plates) arrive in Phase 7.

import {
  type AbilityBark, type Carry, type Grid, type LevelDef, type NoiseEvent, type Role, type Tile,
  type Vec2, type BarkEvent, ABILITY_BARKS, CAT_BUBBLES, EVENT_BARKS, SITUATION_CARDS, StepTimer, TUNING,
  WRONG_ROLE_BARKS, charAt, circleOverlapsSolid, pick,
  covered, exitZone, footstepNoise, hiddenInHideSpot, inHideSpot, inZone, interactTarget,
  isMoveAllowed, isWalkableForPlayer, parseMap, playerSolid, raycast, squeakNoise, tileCenter,
  worldToTile,
} from "@snikisnak/shared";
import { type HeistState, type PlayerState, CatState, DoorState, ItemState } from "../rooms/schema/HeistState.js";
import { type CatTarget, CatBrain } from "./CatBrain.js";

/** A position update a client sent with its `pos` message. */
export interface PosInput {
  x: number; z: number; facing: number; moving: boolean; sneaking: boolean; seq: number;
}

/** Things the simulation tells the room about. */
export interface SimEvents {
  noise(n: NoiseEvent): void;
  /** A short message for one player's screen. */
  toast(playerId: string, text: string): void;
  sfx(name: string, at?: Vec2): void;
  bark(who: Role, lineId: string): void;
  /** A tutorial card, the first time its situation happens. */
  card(cardId: string): void;
  complete(stars: number, leftBehind: string[], home: string[], time: number): void;
  caught(): void;
}

/** A timed action a player started with E. */
type Action =
  | { kind: "pick"; doorId: string }
  | { kind: "latch"; doorId: string; latch: Tile; t: number };

/** Server-only data about each player (not synced). */
interface PlayerRuntime {
  /** Last accepted position and when it was accepted (seconds, sim clock). */
  x: number; z: number; acceptedAt: number;
  /** Newest accepted input, applied on the next tick. */
  pending: PosInput | null;
  /** Sim time of the last tick the player actually moved. */
  lastMovedAt: number;
  tileX: number; tileY: number;
  steps: StepTimer;
  lastCorrectionAt: number;
  holdE: boolean;
  holdF: boolean;
  holdQ: boolean;
  action: Action | null;
  /** Crawling through a vent: where to, and how long until arrival. */
  vent: { to: Tile; left: number } | null;
  wobbleReadyAt: number;
  invulnerableUntil: number;
  wasInHide: boolean;
  /** Already told "Need one more friend!" during this hold. */
  toldNeedFriend: boolean;
  /** Id of the Kiwi covering this player, if any. */
  coveredBy: string;
  wasHidden: boolean;
  /** Sim time of the last move (for the idle bark). */
  idleSince: number;
}

interface DoorRuntime { lastHeldAt: number; clickIn: number; }

export type PosResult = { ok: true } | { ok: false; x: number; z: number; notify: boolean };

/** How long after the last real movement a player still counts as moving. */
const MOVING_GRACE = 0.12;
/** Don't send more than one correction per player in this many seconds. */
const CORRECTION_COOLDOWN = 0.2;
/** Positions are checked against walls with a slightly smaller circle, to forgive rounding. */
const SOLID_CHECK_SLACK = 0.02;
/** The longest gap (seconds) the movement check credits; 3 ticks keeps any single jump well under a wall's thickness. */
const MAX_MOVE_DT = 0.15;
/** Section 4.6: a jarred player can wobble the jar every 3 s. */
const WOBBLE_COOLDOWN = 3;
/** How long a queued bark may wait for the cooldowns before it is dropped. */
const BARK_MAX_WAIT = TUNING.bark.perCharacter + 1;

export const TOASTS = {
  needFriend: "Need one more friend!",
} as const;

export class Simulation {
  readonly grid: Grid;
  readonly brain: CatBrain;
  /** Ids of open doors (and later the breadbox). */
  readonly open = new Set<string>();
  time = 0;
  finished = false;
  private readonly runtimes = new Map<string, PlayerRuntime>();
  private readonly doorRuntimes = new Map<string, DoorRuntime>();
  private zone: Set<number>;
  private readonly queuedNoise: NoiseEvent[] = [];
  private allHomeFor = 0;
  private loseFor = 0;
  private readonly barkAt = new Map<string, number>();
  private lastBarkAt = -Infinity;
  /** Barks waiting for the cooldowns (Section 9, tick step 10). */
  private barkQueue: Array<{ who: Role; lineId: string; at: number }> = [];
  private prevCatState = "";
  private lastBubbleAt = -Infinity;
  private readonly cardsShown = new Set<string>();

  constructor(
    private readonly state: HeistState,
    readonly level: LevelDef,
    private readonly events: SimEvents,
  ) {
    this.grid = parseMap(level.map);
    this.zone = exitZone(this.grid, this.open);
    if (!this.grid.catStart) throw new Error(`Level ${level.id} has no cat start`);
    this.brain = new CatBrain(this.grid, level.cat, level.lights, this.grid.waypoints.map((w) => w.tile), this.grid.catStart);

    state.cat = new CatState();
    this.syncCat();
    state.items.clear();
    const kind = level.listItem?.kind;
    const tiles = kind === "small" ? this.grid.smallItems : kind === "heavy" ? this.grid.heavyItems : [];
    tiles.forEach((t, i) => {
      const c = tileCenter(t);
      const id = i === 0 ? "item" : `item${i}`;
      state.items.set(id, new ItemState().assign({ id, kind: kind ?? "small", x: c.x, z: c.z }));
    });
    state.doors.clear();
    for (const d of this.grid.doors) {
      state.doors.set(d.id, new DoorState().assign({ id: d.id }));
      this.doorRuntimes.set(d.id, { lastHeldAt: -Infinity, clickIn: 0 });
    }
  }

  addPlayer(p: PlayerState): void {
    const t = worldToTile(p.x, p.z);
    this.runtimes.set(p.id, {
      x: p.x, z: p.z, acceptedAt: this.time, pending: null, lastMovedAt: -Infinity,
      tileX: t.x, tileY: t.y, steps: new StepTimer(), lastCorrectionAt: -Infinity,
      holdE: false, holdF: false, holdQ: false, action: null, vent: null,
      wobbleReadyAt: 0, invulnerableUntil: 0, wasInHide: false, toldNeedFriend: false, coveredBy: "",
      wasHidden: false, idleSince: this.time,
    });
  }

  removePlayer(id: string): void {
    this.runtimes.delete(id);
    this.state.items.forEach((item) => { if (item.carriedBy === id) item.carriedBy = ""; });
  }

  /** What a player carries, as far as speed, noise and detection care. */
  carryOf(p: PlayerState): Carry {
    const item = p.carrying ? this.state.items.get(p.carrying) : undefined;
    return item?.kind === "heavy" ? "heavy" : item?.kind === "croissant" ? "croissant" : "none";
  }

  // -------------------------------------------------------------------------
  // Messages from players
  // -------------------------------------------------------------------------

  /** Check a `pos` message. Accepted input is applied on the next tick. */
  receivePos(id: string, input: PosInput): PosResult {
    const rt = this.runtimes.get(id);
    const p = this.state.players.get(id);
    if (!rt || !p) return { ok: false, x: 0, z: 0, notify: false };
    // The server moves jarred players and players in vents itself.
    if (p.jarred || p.mode === "vent") return { ok: false, x: rt.x, z: rt.z, notify: false };

    const valid = [input.x, input.z, input.facing].every(Number.isFinite);
    // Time since the last accepted position, at least one tick (messages can
    // arrive in bursts) and at most a few ticks (so standing still for a while
    // doesn't allow one long jump).
    const dt = Math.min(Math.max(this.time - rt.acceptedAt, 1 / TUNING.tickHz), MAX_MOVE_DT);
    const solid = playerSolid(this.grid, this.open);
    const allowed = valid
      && isMoveAllowed(rt, input, dt, this.carryOf(p))
      && !circleOverlapsSolid(input.x, input.z, TUNING.player.radius - SOLID_CHECK_SLACK, solid)
      && !raycast(rt.x, rt.z, input.x, input.z, solid).hit;

    if (!allowed) {
      const notify = this.time - rt.lastCorrectionAt >= CORRECTION_COOLDOWN;
      if (notify) rt.lastCorrectionAt = this.time;
      return { ok: false, x: rt.x, z: rt.z, notify };
    }
    rt.x = input.x; rt.z = input.z; rt.acceptedAt = this.time;
    rt.pending = { ...input };
    return { ok: true };
  }

  /** E pressed: wobble the jar, put down what you carry, or use the nearest thing. */
  interact(id: string): void {
    const p = this.state.players.get(id);
    const rt = this.runtimes.get(id);
    if (!p || !rt || this.finished || p.mode === "vent") return;
    const role = p.role as Role;

    if (p.jarred) {
      if (this.time >= rt.wobbleReadyAt) {
        rt.wobbleReadyAt = this.time + WOBBLE_COOLDOWN;
        this.queueNoise(p, TUNING.noise.wobble, "wobble");
      }
      return;
    }

    if (p.carrying) {
      // Put it down gently: silent.
      const item = this.state.items.get(p.carrying);
      if (item) { item.carriedBy = ""; item.x = p.x; item.z = p.z; this.events.sfx("putdown", p); }
      p.carrying = "";
      return;
    }

    const target = interactTarget(this.grid, this.open, this.state.items.values(), role, p);
    if (!target) return;
    if (!target.allowed) {
      const line = WRONG_ROLE_BARKS[role]?.[target.action];
      if (line) this.bark(role, line);
      return;
    }

    switch (target.kind) {
      case "item": {
        const item = this.state.items.get(target.id);
        if (item) {
          item.carriedBy = p.id;
          p.carrying = item.id;
          this.events.sfx("pickup", item);
          if (item.id === "item") this.eventBark(role, "grab");
        }
        break;
      }
      case "vent":
        if (target.ventTo) {
          p.mode = "vent";
          p.moving = false;
          rt.vent = { to: target.ventTo, left: TUNING.mochi.ventTime };
          rt.action = null;
          this.abilityBark(role, "ventEnter");
          this.events.sfx("ventScurry", p);
        }
        break;
      case "latch":
        if (target.doorId) rt.action = { kind: "latch", doorId: target.doorId, latch: worldToTile(target.at.x, target.at.z), t: 0 };
        break;
      case "door":
        rt.action = { kind: "pick", doorId: target.id };
        this.abilityBark(role, "lockStart");
        break;
    }
  }

  setHold(id: string, key: string, down: boolean): void {
    const rt = this.runtimes.get(id);
    if (!rt) return;
    if (key === "F") {
      rt.holdF = down;
      if (!down) rt.toldNeedFriend = false;
    } else if (key === "E") {
      rt.holdE = down;
    } else if (key === "Q") {
      rt.holdQ = down;
    }
  }

  // -------------------------------------------------------------------------
  // The tick
  // -------------------------------------------------------------------------

  tick(dt: number): void {
    if (this.finished) return;
    this.time += dt;
    const players = [...this.state.players.values()];

    // 1. Positions, vents, carried items.
    for (const p of players) {
      const rt = this.runtimes.get(p.id);
      if (!rt) continue;
      this.applyPosition(p, rt);
      if (rt.vent) this.advanceVent(p, rt, dt);
    }
    this.state.items.forEach((item) => {
      const carrier = item.carriedBy ? this.state.players.get(item.carriedBy) : undefined;
      if (carrier) { item.x = carrier.x; item.z = carrier.z; }
    });

    // 2. Holds.
    for (const p of players) {
      p.holdKind = "";
      p.hold = 0;
      if (p.mode === "covering" || p.mode === "covered") p.mode = "";
      const rt = this.runtimes.get(p.id);
      if (rt) rt.coveredBy = "";
    }
    this.updateCover(players); // first: cover muffles lock clicks this same tick
    this.updateLocks(players, dt);
    this.updateLatches(players, dt);
    this.updateRescues(players, dt);

    // 3. Status.
    for (const p of players) {
      const rt = this.runtimes.get(p.id);
      if (!rt) continue;
      p.hidden = this.isHidden(p, rt);
      const inHide = !p.jarred && inHideSpot(this.grid, p);
      if (p.hidden && !rt.wasHidden && inHide) this.eventBark(p.role as Role, "hiding");
      rt.wasHidden = p.hidden;
      if (this.isMoving(rt) || p.jarred) rt.idleSince = this.time;
      else if (this.time - rt.idleSince >= TUNING.flow.idleBark) { rt.idleSince = this.time; this.eventBark(p.role as Role, "idle"); }
      if (inHide && !rt.wasInHide && p.seen >= TUNING.detect.question) {
        // Ducked into a hide spot while he was looking: he'll come and paw at it.
        this.brain.rememberHide(tileCenter(worldToTile(p.x, p.z)));
      }
      rt.wasInHide = inHide;
    }

    // 4. Noise.
    for (const p of players) {
      const rt = this.runtimes.get(p.id);
      if (rt && !p.jarred && p.mode !== "vent") this.makeMovementNoise(p, rt, dt);
    }
    for (const n of this.queuedNoise.splice(0)) {
      this.events.noise(n);
      this.brain.hear(n);
    }

    // 6. The cat.
    const targets: CatTarget[] = players.map((p) => {
      const rt = this.runtimes.get(p.id);
      return {
        id: p.id, x: p.x, z: p.z, hidden: p.hidden,
        sneaking: p.sneaking || p.mode === "covering",
        moving: this.isMoving(rt),
        ignored: p.jarred || !p.connected || p.mode === "vent",
        invulnerable: this.time < (rt?.invulnerableUntil ?? 0),
        carry: this.carryOf(p),
      };
    });
    this.brain.open = this.open;
    const ev = this.brain.tick(dt, targets);
    for (const p of players) p.seen = this.brain.meters.get(p.id) ?? 0;
    if (ev.pat) this.events.sfx("patpat", ev.pat);
    this.catMoments(players);
    this.syncCat();

    // 7. Catch.
    if (ev.caught) {
      const victim = this.state.players.get(ev.caught);
      if (victim) this.putInJar(victim);
    }

    // 9. Win and lose.
    this.checkEnd(players, dt);

    // 10. Barks.
    this.processBarks();
  }

  private isMoving(rt: PlayerRuntime | undefined): boolean {
    return !!rt && this.time - rt.lastMovedAt <= MOVING_GRACE;
  }

  /** Section 4.3: hide spots, Kiwi's cover, vents. (Blend and ledges come in Phase 6.) */
  private isHidden(p: PlayerState, rt: PlayerRuntime): boolean {
    if (p.jarred || !p.connected) return false;
    if (p.mode === "vent") return true;
    const moving = this.isMoving(rt);
    if (hiddenInHideSpot(this.grid, p, p.sneaking, moving)) return true;
    if (rt.coveredBy) {
      const kiwiRt = this.runtimes.get(rt.coveredBy);
      if (!moving && !this.isMoving(kiwiRt)) return true;
    }
    return false;
  }

  private applyPosition(p: PlayerState, rt: PlayerRuntime): void {
    const input = rt.pending;
    if (!input) return;
    rt.pending = null;
    if (p.jarred || p.mode === "vent") return;
    if (input.x !== p.x || input.z !== p.z) rt.lastMovedAt = this.time;
    // The client says it stopped: no more footsteps, even within the grace time
    // (otherwise letting go of Shift and the arrow key together makes one loud step).
    if (!input.moving) rt.lastMovedAt = -Infinity;
    p.x = input.x;
    p.z = input.z;
    p.facing = input.facing;
    p.moving = input.moving;
    p.sneaking = input.sneaking;
  }

  /** Mochi crawls to the paired vent in TUNING.mochi.ventTime seconds, invisible and silent. */
  private advanceVent(p: PlayerState, rt: PlayerRuntime, dt: number): void {
    if (!rt.vent) return;
    rt.vent.left -= dt;
    if (rt.vent.left > 0) return;
    const c = tileCenter(rt.vent.to);
    p.x = c.x; p.z = c.z;
    p.mode = "";
    rt.x = c.x; rt.z = c.z; rt.acceptedAt = this.time;
    rt.tileX = rt.vent.to.x; rt.tileY = rt.vent.to.y;
    rt.lastMovedAt = -Infinity;
    rt.vent = null;
    this.events.sfx("ventScurry", c);
  }

  /** Footsteps from distance moved, squeaks from entering ~ tiles. Cover makes them smaller. */
  private makeMovementNoise(p: PlayerState, rt: PlayerRuntime, dt: number): void {
    const isCovered = rt.coveredBy !== "";
    // Kiwi moves at sneak speed while covering, so her steps are sneaking steps.
    const sneaking = p.sneaking || p.mode === "covering";
    if (rt.steps.update(dt, this.isMoving(rt), sneaking)) {
      const n = covered(footstepNoise(sneaking, this.carryOf(p)), isCovered);
      this.queuedNoise.push({ x: p.x, z: p.z, ...n, kind: "step" });
    }
    const t = worldToTile(p.x, p.z);
    if (t.x !== rt.tileX || t.y !== rt.tileY) {
      rt.tileX = t.x; rt.tileY = t.y;
      if (charAt(this.grid, t.x, t.y) === "~") {
        const n = covered(squeakNoise(sneaking), isCovered);
        this.queuedNoise.push({ x: t.x + 0.5, z: t.y + 0.5, ...n, kind: "squeak" });
        this.eventBark(p.role as Role, "squeak");
        this.situationCard(SITUATION_CARDS.squeak);
      }
    }
  }

  private queueNoise(at: Vec2, [radius, loudness]: readonly [number, number], kind: NoiseEvent["kind"], isCovered = false): void {
    const n = covered({ radius, loudness }, isCovered);
    this.queuedNoise.push({ x: at.x, z: at.z, ...n, kind });
  }

  // -------------------------------------------------------------------------
  // Doors: lock picking (Pip) and latches (Mochi) (Sections 2 and 4.8)
  // -------------------------------------------------------------------------

  /** Is the player still standing where they can work on this door? */
  private stillAt(p: PlayerState, kind: "door" | "latch", doorId: string): boolean {
    const t = interactTarget(this.grid, this.open, [], p.role as Role, p);
    if (!t) return false;
    return kind === "door" ? t.kind === "door" && t.id === doorId : t.kind === "latch" && t.doorId === doorId;
  }

  private updateLocks(players: PlayerState[], dt: number): void {
    this.state.doors.forEach((door) => {
      if (door.open) return;
      const drt = this.doorRuntimes.get(door.id);
      if (!drt) return;
      const pickers = players.filter((p) => {
        const rt = this.runtimes.get(p.id);
        return rt?.action?.kind === "pick" && rt.action.doorId === door.id && rt.holdE
          && !p.jarred && p.mode !== "vent" && this.stillAt(p, "door", door.id);
      });

      if (pickers.length) {
        drt.lastHeldAt = this.time;
        door.pick = Math.min(1, door.pick + dt / TUNING.pip.pickTime);
        // A click every 0.8 s while picking (quieter if Kiwi covers the picker).
        drt.clickIn -= dt;
        if (drt.clickIn <= 0) {
          drt.clickIn += TUNING.pip.clickEvery;
          const picker = pickers[0];
          const isCovered = this.runtimes.get(picker.id)?.coveredBy !== "";
          this.queueNoise(picker, TUNING.noise.lockClick, "lockClick", isCovered);
        }
        for (const p of pickers) { p.holdKind = "pick"; p.hold = door.pick; }
        if (door.pick >= 1) this.openDoor(door.id);
      } else {
        drt.clickIn = 0;
        // Letting go keeps the progress for 2 s, then it drains at 10% per second.
        if (this.time - drt.lastHeldAt > TUNING.pip.pickHold) {
          door.pick = Math.max(0, door.pick - TUNING.pip.pickDrain * dt);
        }
      }
    });
  }

  private updateLatches(players: PlayerState[], dt: number): void {
    for (const p of players) {
      const rt = this.runtimes.get(p.id);
      const action = rt?.action;
      if (!rt || action?.kind !== "latch") continue;
      const door = this.state.doors.get(action.doorId);
      if (!door || door.open || p.jarred || !this.stillAt(p, "latch", action.doorId)) { rt.action = null; continue; }
      action.t += dt;
      p.holdKind = "latch";
      p.hold = Math.min(1, action.t / TUNING.mochi.latchTime);
      if (action.t >= TUNING.mochi.latchTime) {
        rt.action = null;
        this.openDoor(action.doorId, true);
      }
    }
  }

  openDoor(id: string, quiet = false): void {
    const door = this.state.doors.get(id);
    if (!door || door.open) return;
    door.open = true;
    door.pick = 1;
    this.open.add(id);
    this.zone = exitZone(this.grid, this.open);
    const tiles = this.grid.doors.find((d) => d.id === id)?.tiles ?? [];
    const at = tiles.length ? tileCenter(tiles[0]) : undefined;
    this.events.sfx(quiet ? "latchClack" : "doorCreak", at);
    for (const rt of this.runtimes.values()) {
      if ((rt.action?.kind === "pick" || rt.action?.kind === "latch") && rt.action.doorId === id) rt.action = null;
    }
  }

  // -------------------------------------------------------------------------
  // Kiwi's cover (Section 2)
  // -------------------------------------------------------------------------

  private updateCover(players: PlayerState[]): void {
    const free = (p: PlayerState): boolean => !p.jarred && p.connected && p.mode !== "vent";
    for (const kiwi of players) {
      const rt = this.runtimes.get(kiwi.id);
      if (!rt?.holdQ || kiwi.role !== "kiwi" || !free(kiwi)) continue;
      kiwi.mode = "covering";
      // The nearest teammate within 1.2 tiles; one at a time.
      let best: PlayerState | null = null, bestD: number = TUNING.kiwi.coverRange;
      for (const p of players) {
        if (p.id === kiwi.id || !free(p)) continue;
        const d = Math.hypot(p.x - kiwi.x, p.z - kiwi.z);
        if (d <= bestD) { bestD = d; best = p; }
      }
      if (best) {
        best.mode = "covered";
        const brt = this.runtimes.get(best.id);
        if (brt) brt.coveredBy = kiwi.id;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Jars and rescue (Section 4.6)
  // -------------------------------------------------------------------------

  private putInJar(p: PlayerState): void {
    const rt = this.runtimes.get(p.id);
    let spot: Vec2 = { x: p.x, z: p.z };
    // A jar can't sit inside a hide spot: move it to the nearest walkable tile outside.
    if (inHideSpot(this.grid, spot)) spot = this.nearestOpenTile(spot, (x, y) => charAt(this.grid, x, y) !== "T");
    p.x = spot.x; p.z = spot.z;
    p.jarred = true;
    p.moving = false;
    p.hidden = false;
    p.rescue = 0;
    p.mode = "";
    this.state.anyoneJarred = true;
    if (rt) { rt.x = spot.x; rt.z = spot.z; rt.pending = null; rt.lastMovedAt = -Infinity; rt.action = null; }

    // A carried item drops next to the jar, with a crash.
    if (p.carrying) {
      const item = this.state.items.get(p.carrying);
      if (item) {
        const drop = this.dropSpotNear(spot);
        item.carriedBy = ""; item.x = drop.x; item.z = drop.z;
        this.queueNoise(drop, TUNING.noise.crash, "crash");
      }
      p.carrying = "";
    }
    this.events.sfx("jarClink", spot);
    this.eventBark(p.role as Role, "jarred");
    const friends = [...this.state.players.values()].filter((o) => o.id !== p.id && !o.jarred && o.connected);
    if (friends.length) this.eventBark(pick(friends).role as Role, "teammateJarred");
    this.situationCard(SITUATION_CARDS.jarred);
  }

  private updateRescues(players: PlayerState[], dt: number): void {
    const free = players.filter((p) => !p.jarred && p.connected && p.mode !== "vent");
    for (const jarred of players.filter((p) => p.jarred)) {
      const helpers = free.filter((p) => this.runtimes.get(p.id)?.holdF
        && Math.hypot(p.x - jarred.x, p.z - jarred.z) <= TUNING.rescue.range);
      if (helpers.length >= 2) {
        jarred.rescue = Math.min(1, jarred.rescue + dt / TUNING.rescue.time);
      } else if (helpers.length === 0) {
        jarred.rescue = Math.max(0, jarred.rescue - TUNING.rescue.drain * dt);
      } else {
        const rt = this.runtimes.get(helpers[0].id);
        if (rt && !rt.toldNeedFriend) { rt.toldNeedFriend = true; this.events.toast(helpers[0].id, TOASTS.needFriend); }
      }
      for (const h of helpers) { h.holdKind = "rescue"; h.hold = jarred.rescue; }

      if (jarred.rescue >= 1) {
        jarred.jarred = false;
        jarred.rescue = 0;
        const rt = this.runtimes.get(jarred.id);
        if (rt) { rt.invulnerableUntil = this.time + TUNING.rescue.invuln; rt.acceptedAt = this.time; }
        this.queueNoise(jarred, TUNING.noise.jarBreak, "jarBreak");
        this.events.sfx("jarPop", { x: jarred.x, z: jarred.z });
        this.eventBark(jarred.role as Role, "rescued");
      }
    }
  }

  /** Centre of the nearest player-walkable tile that passes `ok`. */
  private nearestOpenTile(from: Vec2, ok: (x: number, y: number) => boolean): Vec2 {
    let best = from, bestD = Infinity;
    for (let y = 0; y < this.grid.height; y++) {
      for (let x = 0; x < this.grid.width; x++) {
        if (!isWalkableForPlayer(this.grid, x, y, this.open) || !ok(x, y)) continue;
        const d = Math.hypot(x + 0.5 - from.x, y + 0.5 - from.z);
        if (d < bestD) { bestD = d; best = { x: x + 0.5, z: y + 0.5 }; }
      }
    }
    return best;
  }

  /** A walkable spot about half a tile from the jar for a dropped item. */
  private dropSpotNear(at: Vec2): Vec2 {
    const solid = playerSolid(this.grid, this.open);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const p = { x: at.x + Math.sin(a) * 0.5, z: at.z + Math.cos(a) * 0.5 };
      if (!circleOverlapsSolid(p.x, p.z, 0.15, solid)) return p;
    }
    return { ...at };
  }

  // -------------------------------------------------------------------------
  // Barks (Section 3): one per character every 4 s, one anywhere every 1.5 s.
  // -------------------------------------------------------------------------

  /** Queue a bark; it plays when the cooldowns allow (one per character every 4 s, one anywhere every 1.5 s). */
  bark(who: Role, lineId: string): void {
    // One waiting bark per character is enough; a newer one replaces it.
    this.barkQueue = this.barkQueue.filter((b) => b.who !== who);
    this.barkQueue.push({ who, lineId, at: this.time });
    this.processBarks();
  }

  private processBarks(): void {
    // A bark that has waited longer than the per-character cooldown plus a moment is no longer news.
    this.barkQueue = this.barkQueue.filter((b) => this.time - b.at <= BARK_MAX_WAIT);
    if (this.time - this.lastBarkAt < TUNING.bark.global) return;
    const i = this.barkQueue.findIndex((b) => this.time - (this.barkAt.get(b.who) ?? -Infinity) >= TUNING.bark.perCharacter);
    if (i < 0) return;
    const [b] = this.barkQueue.splice(i, 1);
    this.barkAt.set(b.who, this.time);
    this.lastBarkAt = this.time;
    this.events.bark(b.who, b.lineId);
  }

  private eventBark(who: Role, event: BarkEvent): void {
    const lines = EVENT_BARKS[event]?.[who];
    if (lines?.length) this.bark(who, pick(lines));
  }

  /** Send a tutorial card the first time its situation happens in this run. */
  private situationCard(cardId: string): void {
    if (this.cardsShown.has(cardId)) return;
    this.cardsShown.add(cardId);
    this.events.card(cardId);
  }

  /** Thought bubbles and barks when the cat changes state (Section 3). */
  private catMoments(players: PlayerState[]): void {
    const state = this.brain.state;
    if (state === this.prevCatState) return;
    const prev = this.prevCatState;
    this.prevCatState = state;
    const lines = CAT_BUBBLES[state];
    if (lines && this.time - this.lastBubbleAt >= TUNING.flow.catBubbleEvery) {
      this.lastBubbleAt = this.time;
      this.state.cat.bubble = pick(lines);
      this.state.cat.bubbleSeq += 1;
    }
    if (state === "STIR") this.situationCard(SITUATION_CARDS.stir);
    if (state === "INVESTIGATE" || state === "CHASE") this.situationCard(SITUATION_CARDS.spotted);
    if (state === "CHASE") {
      const target = this.state.players.get(this.brain.targetId);
      if (target) this.eventBark(target.role as Role, "spotted");
    }
    if (state === "GIVE_UP" || (prev === "SEARCH" && state === "RETURN")) {
      const free = players.filter((p) => !p.jarred && p.connected);
      if (free.length) this.eventBark(pick(free).role as Role, "catGivesUp");
    }
  }

  private abilityBark(who: Role, event: AbilityBark): void {
    const lines = (ABILITY_BARKS[event] as Partial<Record<Role, readonly string[]>>)[who];
    if (lines?.length) this.bark(who, lines[Math.floor(Math.random() * lines.length)]);
  }

  // -------------------------------------------------------------------------
  // Exit, stars, win and lose (Sections 1, 4.6 and 4.9)
  // -------------------------------------------------------------------------

  private itemDelivered(): boolean {
    if (!this.level.listItem) return true; // Level 1: just escape
    const item = this.state.items.get("item");
    // Item kinds that aren't in the game yet don't block the exit.
    if (!item) return true;
    return inZone(this.grid, this.zone, item.x, item.z);
  }

  private checkEnd(players: PlayerState[], dt: number): void {
    // Lose: 2 players jarred at the same moment means no rescue is possible.
    const jarred = players.filter((p) => p.jarred).length;
    if (jarred >= 2) {
      this.state.exitReady = false;
      this.loseFor += dt;
      if (this.loseFor >= TUNING.loseDelay) {
        this.finished = true;
        this.events.caught();
      }
      return;
    }
    this.loseFor = 0;

    const free = players.filter((p) => !p.jarred && p.connected && p.mode !== "vent");
    const home = free.filter((p) => inZone(this.grid, this.zone, p.x, p.z));
    const itemOk = this.itemDelivered();
    const everyoneHome = itemOk && players.length > 0 && home.length === players.length;

    if (everyoneHome) {
      this.state.exitReady = false;
      this.state.exitHold = 0;
      this.allHomeFor += dt;
      if (this.allHomeFor >= TUNING.exit.allHomeDelay) this.finish(players, home);
      return;
    }
    this.allHomeFor = 0;

    // Two or more home: they can all hold F to call it a night.
    const ready = itemOk && home.length >= 2;
    this.state.exitReady = ready;
    if (!ready) { this.state.exitHold = 0; return; }
    const allHolding = home.every((p) => this.runtimes.get(p.id)?.holdF);
    this.state.exitHold = allHolding ? Math.min(1, this.state.exitHold + dt / TUNING.exit.callItANight) : 0;
    for (const p of home) {
      if (this.runtimes.get(p.id)?.holdF && p.holdKind === "") { p.holdKind = "exit"; p.hold = this.state.exitHold; }
    }
    if (this.state.exitHold >= 1) this.finish(players, home);
  }

  private finish(players: PlayerState[], home: PlayerState[]): void {
    this.finished = true;
    const allHome = home.length === players.length;
    const stars = allHome ? (this.state.anyoneJarred ? 2 : 3) : 1;
    this.state.stars = stars;
    const leftBehind = players.filter((p) => !home.includes(p)).map((p) => p.name);
    if (leftBehind.length && home.length) {
      const lines = EVENT_BARKS.leftBehind[home[0].role as Role];
      if (lines?.length) this.events.bark(home[0].role as Role, pick(lines));
    }
    this.events.complete(stars, leftBehind, home.map((p) => p.name), this.time);
  }

  private syncCat(): void {
    const c = this.state.cat;
    const b = this.brain;
    c.x = b.x; c.z = b.z;
    c.facing = b.facing;
    c.headYaw = b.headYaw;
    c.state = b.state;
    c.alert = b.alert;
    c.targetId = b.targetId;
    c.vision = b.visionRange();
  }
}
