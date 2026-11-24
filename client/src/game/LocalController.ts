// Keyboard input and local movement (PLAN.md Sections 2 and 9).
//
// The client moves its own character every frame with the same collision code
// as the server (shared/grid.ts), then sends its position 20 times a second.
// The server checks each position; if it rejects one, it sends `correct` and we
// snap back. E sends `interact` and a hold (for picking locks); F and Q send
// holds on key down and key up.
// In dev mode one client owns all three characters and backquote switches
// which one the keyboard controls. A character you switch away from keeps
// holding F and Q, so you can test rescues and cover alone.

import {
  type Carry, type ClientMessages, type Grid, type HoldKey, type OpenSet, type Role,
  type ServerMessages, TUNING, facingFor, inputToDirection, movePlayer, moveSpeed,
} from "@snikisnak/shared";

export interface OwnedCharacter {
  id: string;
  role: Role;
  x: number;
  z: number;
  facing: number;
  moving: boolean;
  sneaking: boolean;
  /** Jarred or in a vent: can't move; the server owns the position. */
  frozen: boolean;
  carry: Carry;
  holding: Set<HoldKey>;
}

export interface MessageSender {
  send(type: string, msg?: unknown): void;
}

const MOVE_KEYS = {
  up: ["KeyW", "ArrowUp"],
  down: ["KeyS", "ArrowDown"],
  left: ["KeyA", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
  sneak: ["ShiftLeft", "ShiftRight"],
} as const;

const HOLD_KEYS: Record<string, HoldKey> = { KeyE: "E", KeyF: "F", KeyQ: "Q" };

export class LocalController {
  readonly owned = new Map<string, OwnedCharacter>();
  controlled: string;
  /** False during the intro and briefing: no moving yet. */
  enabled = true;
  private readonly keys = new Set<string>();
  private sendTimer = 0;
  private seq = 0;
  private dirty = true;
  private readonly sendEvery = 1 / TUNING.tickHz;
  private readonly listeners: Array<[string, (e: Event) => void, EventTarget]> = [];

  constructor(
    private readonly grid: Grid,
    private readonly net: MessageSender,
    owned: Array<Pick<OwnedCharacter, "id" | "role" | "x" | "z" | "facing">>,
    private readonly solo: boolean,
    private readonly openDoors: () => OpenSet,
    private readonly onSwitch: (id: string) => void = () => undefined,
  ) {
    for (const c of owned) {
      this.owned.set(c.id, { ...c, moving: false, sneaking: false, frozen: false, carry: "none", holding: new Set() });
    }
    this.controlled = owned[0]?.id ?? "";

    this.listen(window, "keydown", (e) => this.onKey(e as KeyboardEvent, true));
    this.listen(window, "keyup", (e) => this.onKey(e as KeyboardEvent, false));
    this.listen(window, "blur", () => this.releaseAll());
  }

  get current(): OwnedCharacter | undefined {
    return this.owned.get(this.controlled);
  }

  private listen(target: EventTarget, type: string, fn: (e: Event) => void): void {
    target.addEventListener(type, fn);
    this.listeners.push([type, fn, target]);
  }

  private held(codes: readonly string[]): boolean {
    return codes.some((c) => this.keys.has(c));
  }

  private onKey(e: KeyboardEvent, down: boolean): void {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
    if (down) this.keys.add(e.code); else this.keys.delete(e.code);
    if (e.code.startsWith("Arrow")) e.preventDefault();
    if (e.repeat || !this.enabled) return;

    if (down && e.code === "Backquote" && this.solo) this.switchCharacter();
    if (down && e.code === "KeyE") this.send("interact", {});
    const hold = HOLD_KEYS[e.code];
    if (hold) this.setHold(hold, down);
  }

  private setHold(key: HoldKey, down: boolean): void {
    const me = this.current;
    if (!me) return;
    if (down === me.holding.has(key)) return;
    if (down) me.holding.add(key); else me.holding.delete(key);
    this.send("hold", { key, down } satisfies Omit<ClientMessages["hold"], "who">);
  }

  private releaseAll(): void {
    this.keys.clear();
    const me = this.current;
    if (me) for (const k of [...me.holding]) this.setHold(k, false);
  }

  /** Send a message about the controlled character (adds `who` in dev mode). */
  private send(type: string, msg: Record<string, unknown>, who = this.controlled): void {
    this.net.send(type, this.solo ? { ...msg, who } : msg);
  }

  /** Dev mode: control the next character. The one we leave stands still (and keeps holding F and Q). */
  switchCharacter(): void {
    const ids = [...this.owned.keys()];
    if (ids.length < 2) return;
    const prev = this.current;
    if (prev) {
      if (prev.moving) { prev.moving = false; this.sendPos(prev); }
      // Keep holding F and Q (so you can test rescues and cover alone), but let go of E.
      if (prev.holding.has("E")) this.setHold("E", false);
    }
    this.controlled = ids[(ids.indexOf(this.controlled) + 1) % ids.length];
    this.dirty = true;
    this.onSwitch(this.controlled);
  }

  /** The server says this character is jarred or in a vent (or not): freeze it at the server's position. */
  setFrozen(id: string, frozen: boolean, x: number, z: number): void {
    const c = this.owned.get(id);
    if (!c) return;
    // While frozen, and on the moment it ends (a vent trip lands somewhere new), follow the server.
    if (frozen || c.frozen) { c.x = x; c.z = z; c.moving = false; }
    if (c.frozen && !frozen) this.dirty = true;
    c.frozen = frozen;
  }

  setCarry(id: string, carry: Carry): void {
    const c = this.owned.get(id);
    if (c) c.carry = carry;
  }

  update(dt: number): void {
    const me = this.current;
    if (!me || me.frozen || !this.enabled) return;
    const dir = inputToDirection(
      this.held(MOVE_KEYS.up), this.held(MOVE_KEYS.down), this.held(MOVE_KEYS.left), this.held(MOVE_KEYS.right),
    );
    const sneaking = this.held(MOVE_KEYS.sneak);
    // Kiwi moves at sneak speed while covering (holding Q).
    const covering = me.role === "kiwi" && me.holding.has("Q");
    const wasMoving = me.moving, wasSneaking = me.sneaking;

    if (dir) {
      const step = moveSpeed({ sneaking, carry: me.carry, covering }) * dt;
      const next = movePlayer(this.grid, me, dir.x * step, dir.z * step, this.openDoors());
      me.moving = Math.hypot(next.x - me.x, next.z - me.z) > 1e-4;
      me.x = next.x;
      me.z = next.z;
      me.facing = facingFor(dir);
    } else {
      me.moving = false;
    }
    me.sneaking = sneaking;
    if (me.moving || me.moving !== wasMoving || me.sneaking !== wasSneaking) this.dirty = true;

    this.sendTimer += dt;
    if (this.sendTimer >= this.sendEvery) {
      this.sendTimer %= this.sendEvery;
      if (this.dirty) {
        this.sendPos(me);
        this.dirty = false;
      }
    }
  }

  private sendPos(c: OwnedCharacter): void {
    const msg: ClientMessages["pos"] = {
      x: c.x, z: c.z, facing: c.facing, moving: c.moving, sneaking: c.sneaking, seq: ++this.seq,
    };
    if (this.solo) msg.who = c.id;
    this.net.send("pos", msg);
  }

  /** The server rejected a move: snap back to where it says we are. */
  onCorrect(msg: ServerMessages["correct"]): void {
    const c = this.owned.get(msg.who ?? this.controlled);
    if (!c) return;
    c.x = msg.x;
    c.z = msg.z;
  }

  dispose(): void {
    this.releaseAll();
    for (const [type, fn, target] of this.listeners) target.removeEventListener(type, fn);
  }
}
