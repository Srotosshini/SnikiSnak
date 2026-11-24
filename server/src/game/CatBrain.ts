// Sir Crumbs's brain (PLAN.md Section 4.5). Runs on the server, once per tick.
//
// Each tick:
//   1. hearing: noises raise his alert,
//   2. vision: each visible player's detection meter rises, hidden ones drain,
//   3. the state machine decides what to do,
//   4. he walks along an A* path on the tile grid.
//
// HUNT (Level 8) and swiping into hide spots (Levels 7-8) come in Phase 7.

import {
  type Carry, type CatSettings, type CatStateName, type Grid, type LightDef, type NoiseEvent,
  type OpenSet, type Tile, type Vec2, ALL_CLOSED, TUNING, canSee, detectionRate, findPath,
  hasLineOfSight, hearingGain, isWalkableForCat, lightAt, moveCircle, tileCenter, updateMeter,
  worldToTile,
} from "@snikisnak/shared";

/** What the cat needs to know about each player. */
export interface CatTarget {
  id: string;
  x: number;
  z: number;
  moving: boolean;
  sneaking: boolean;
  hidden: boolean;
  /** Jarred, disconnected, in a vent or on a ledge: the cat ignores them. */
  ignored: boolean;
  invulnerable: boolean;
  carry: Carry;
}

export interface CatEvents {
  /** The player the cat caught this tick. */
  caught?: string;
  /** The cat pawed at a hide spot ("pat pat"). */
  pat?: Vec2;
}

const TURN_RATE = 8;               // radians per second
const ARRIVE_DIST = 0.12;
const POUNCE_LEAP_TIME = 0.2;      // seconds the leap itself takes
const PAW_TIME = 2;                // Section 4.3: paws at a hide spot for 2 s
/** How far he turns his head when looking left and right. */
const PATROL_LOOK = (50 * Math.PI) / 180;
const PERCH_SWEEP = (60 * Math.PI) / 180;
const PERCH_CYCLE = 6;
const STIR_RANGE_MULT = 0.6;
const STIR_INVESTIGATE_ALERT = 0.7;
const INVESTIGATE_SPEED_MULT = 1.2;

function angleTo(from: Vec2, to: Vec2): number {
  return Math.atan2(to.x - from.x, to.z - from.z);
}

function wrapAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

export class CatBrain {
  x: number;
  z: number;
  facing = 0;
  headYaw = 0;
  state: CatStateName;
  alert = 0;
  targetId = "";
  readonly meters = new Map<string, number>();
  open: OpenSet = ALL_CLOSED;
  lightsOut = false;

  private grace: number = TUNING.cat.graceStart;
  private time = 0;
  private stateTime = 0;
  private readonly home: Vec2;
  private readonly waypoints: Vec2[];
  private waypointIndex = 0;
  private pauseLeft = 0;

  private path: Tile[] = [];
  private pathGoal: Tile | null = null;
  private repathIn = 0;
  private goal: Vec2 | null = null;
  private arrived = false;

  private heard: NoiseEvent[] = [];
  private lastNoise: Vec2 | null = null;
  private lastKnown: Vec2 | null = null;
  private losLost = 0;
  private chaseTime = 0;
  private closeFor = 0;
  private catchCooldown = 0;
  private pounceDir: Vec2 = { x: 0, z: 1 };
  private leapLeft = 0;
  private pawAt: Vec2 | null = null;
  private patSent = false;

  constructor(
    private readonly grid: Grid,
    private readonly settings: CatSettings,
    private readonly lights: readonly LightDef[],
    waypoints: readonly Tile[],
    start: Tile,
  ) {
    const c = tileCenter(start);
    this.x = c.x;
    this.z = c.z;
    this.home = c;
    this.waypoints = waypoints.map(tileCenter);
    this.state = this.baseState();
  }

  get position(): Vec2 { return { x: this.x, z: this.z }; }
  get look(): number { return this.facing + this.headYaw; }
  get grooming(): boolean { return this.grace > 0; }

  /** Current view range in tiles; 0 when his eyes are shut. */
  visionRange(): number {
    if (this.grace > 0 || this.state === "SLEEP") return 0;
    const range = this.lightsOut ? this.settings.darkRange : this.settings.range;
    return this.state === "STIR" ? range * STIR_RANGE_MULT : range;
  }

  /** Queue a noise; it's heard on the next tick. */
  hear(noise: NoiseEvent): void {
    this.heard.push(noise);
  }

  /** A player ducked into a hide spot while he was suspicious of them (Section 4.3). */
  rememberHide(spot: Vec2): void {
    const s = this.state;
    if (s === "SLEEP" || s === "POUNCE" || s === "CATCH" || s === "GIVE_UP" || this.grace > 0) return;
    this.pawAt = spot;
    this.patSent = false;
    this.enter("INVESTIGATE");
    this.goal = spot;
  }

  tick(dt: number, players: readonly CatTarget[]): CatEvents {
    const events: CatEvents = {};
    this.time += dt;
    this.stateTime += dt;
    this.catchCooldown = Math.max(0, this.catchCooldown - dt);

    // Every level starts with 5 s of grooming: no vision, no hearing.
    if (this.grace > 0) {
      this.grace -= dt;
      this.heard = [];
      for (const p of players) this.meters.set(p.id, updateMeter(this.meters.get(p.id) ?? 0, false, 0, dt));
      return events;
    }

    const heardSomething = this.listen();
    this.alert = Math.max(0, this.alert - (this.state === "SLEEP" ? TUNING.cat.sleepDrain : TUNING.cat.alertDrain) * dt);

    const { question, alarm } = this.watch(dt, players);

    // "!" (or bumping into him) starts a chase from any calm state.
    if (alarm && this.state !== "CHASE" && this.state !== "POUNCE" && this.state !== "CATCH") {
      this.startChase(alarm);
    }

    switch (this.state) {
      case "SLEEP":
        if (this.alert >= (this.settings.wakeAt ?? 0.35)) {
          this.enter("STIR");
          if (this.lastNoise) this.facing = angleTo(this, this.lastNoise);
        }
        break;

      case "STIR":
        if (this.stateTime >= TUNING.cat.stir) {
          if (question) this.startInvestigate(question);
          else if (this.alert >= STIR_INVESTIGATE_ALERT && this.lastNoise) this.startInvestigate(this.lastNoise);
          else this.enterBase();
        }
        break;

      case "PATROL":
      case "PERCH":
      case "RETURN":
        if (question) this.startInvestigate(question);
        else if (this.alert >= TUNING.cat.investigateAt && heardSomething && this.lastNoise) this.startInvestigate(this.lastNoise);
        break;

      case "INVESTIGATE":
        // Keep following whatever made him suspicious.
        if (question && !this.pawAt) this.retarget(question);
        else if (heardSomething && this.lastNoise && this.alert >= TUNING.cat.investigateAt && !this.pawAt) this.retarget(this.lastNoise);
        break;

      default:
        break;
    }

    this.behave(dt, players, events);
    return events;
  }

  // -------------------------------------------------------------------------

  /** Hearing: returns true if any noise was heard this tick. */
  private listen(): boolean {
    let best = 0;
    for (const n of this.heard) {
      let gain = hearingGain(this.grid, this, n, this.settings.hearing * (this.lightsOut ? TUNING.lightsOut.hearingMult : 1));
      if (this.state === "SLEEP") gain *= TUNING.cat.sleepHearing;
      if (gain <= 0) continue;
      this.alert = Math.min(1, this.alert + gain);
      if (gain > best) { best = gain; this.lastNoise = { x: n.x, z: n.z }; }
    }
    this.heard = [];
    return best > 0;
  }

  /** Vision: update every detection meter. Returns who is suspicious ("?") and who is spotted ("!"). */
  private watch(dt: number, players: readonly CatTarget[]): { question: Vec2 | null; alarm: string | null } {
    const range = this.visionRange();
    const viewer = { x: this.x, z: this.z, look: this.look };
    let question: Vec2 | null = null, questionLevel = 0;
    let alarm: string | null = null;

    for (const p of players) {
      let meter = this.meters.get(p.id) ?? 0;
      const visible = range > 0 && !p.hidden && !p.ignored && canSee(this.grid, viewer, this.settings.fov, range, p, this.open);
      const rate = visible ? detectionRate({
        distance: Math.hypot(p.x - this.x, p.z - this.z),
        range,
        sneaking: p.sneaking,
        still: !p.moving,
        light: lightAt(this.lights, p.x, p.z, this.lightsOut),
        carry: p.carry,
      }) : 0;
      meter = updateMeter(meter, visible, rate, dt);

      // Bumping into the cat starts a chase at once (even if he was asleep).
      const touching = !p.hidden && !p.ignored && Math.hypot(p.x - this.x, p.z - this.z) < TUNING.detect.touchRange;
      if (touching) meter = 1;
      this.meters.set(p.id, meter);

      if (p.ignored) continue;
      if (meter >= TUNING.detect.alarm && (visible || touching) && !alarm) alarm = p.id;
      else if (meter >= TUNING.detect.question && visible && meter > questionLevel) {
        question = { x: p.x, z: p.z };
        questionLevel = meter;
      }
    }
    return { question, alarm };
  }

  private baseState(): CatStateName {
    return this.settings.mode === "sleep" ? "SLEEP" : this.settings.mode === "perch" ? "PERCH" : "PATROL";
  }

  private enter(state: CatStateName): void {
    this.state = state;
    this.stateTime = 0;
    this.path = [];
    this.pathGoal = null;
    this.arrived = false;
    if (state !== "CHASE" && state !== "POUNCE") this.targetId = state === "CATCH" ? this.targetId : "";
  }

  private enterBase(): void {
    this.enter(this.baseState());
    this.pauseLeft = 0;
  }

  private startInvestigate(point: Vec2): void {
    this.pawAt = null;
    this.enter("INVESTIGATE");
    this.goal = { ...point };
  }

  private retarget(point: Vec2): void {
    this.goal = { ...point };
    this.arrived = false;
    this.stateTime = 0;
  }

  private startChase(id: string): void {
    this.pawAt = null;
    this.enter("CHASE");
    this.targetId = id;
    this.losLost = 0;
    this.chaseTime = 0;
    this.closeFor = 0;
  }

  private startReturn(): void {
    this.pawAt = null;
    this.enter("RETURN");
    this.alert = 0.3;
    if (this.settings.mode === "patrol" && this.waypoints.length) {
      let best = 0, bestD = Infinity;
      this.waypoints.forEach((w, i) => {
        const d = Math.hypot(w.x - this.x, w.z - this.z);
        if (d < bestD) { bestD = d; best = i; }
      });
      this.waypointIndex = best;
      this.goal = this.waypoints[best];
    } else {
      this.goal = this.home;
    }
  }

  /** What each state does this tick. */
  private behave(dt: number, players: readonly CatTarget[], events: CatEvents): void {
    const walk = this.settings.walk;
    this.headYaw *= Math.max(0, 1 - dt * 4); // relax the head unless a state moves it

    switch (this.state) {
      case "SLEEP":
      case "STIR":
        break;

      case "PERCH":
        if (Math.hypot(this.home.x - this.x, this.home.z - this.z) > ARRIVE_DIST * 2) {
          this.startReturn();
          break;
        }
        this.headYaw = PERCH_SWEEP * Math.sin((this.time * Math.PI * 2) / PERCH_CYCLE);
        break;

      case "PATROL": {
        if (!this.waypoints.length) break;
        if (this.pauseLeft > 0) {
          this.pauseLeft -= dt;
          // Look left and right while pausing.
          this.headYaw = PATROL_LOOK * Math.sin(((TUNING.cat.waypointPause - this.pauseLeft) / TUNING.cat.waypointPause) * Math.PI * 2);
          if (this.pauseLeft <= 0) {
            this.waypointIndex = (this.waypointIndex + 1) % this.waypoints.length;
            this.path = [];
          }
          break;
        }
        if (this.moveTo(this.waypoints[this.waypointIndex], walk, dt, false)) this.pauseLeft = TUNING.cat.waypointPause;
        break;
      }

      case "INVESTIGATE": {
        if (!this.goal) { this.startReturn(); break; }
        if (!this.arrived) {
          this.arrived = this.moveTo(this.goal, walk * INVESTIGATE_SPEED_MULT, dt, false);
          if (this.arrived) this.stateTime = 0;
          break;
        }
        if (this.pawAt) {
          // Paw at the hide spot for 2 s, then leave: hide spots are safe in Levels 1-6.
          this.turnToward(angleTo(this, this.pawAt), dt);
          if (!this.patSent) { events.pat = { ...this.pawAt }; this.patSent = true; }
          if (this.stateTime >= PAW_TIME) this.startReturn();
        } else {
          // Turn slowly in a full circle.
          this.facing = wrapAngle(this.facing + ((Math.PI * 2) / TUNING.cat.investigateLook) * dt);
          if (this.stateTime >= TUNING.cat.investigateLook) this.startReturn();
        }
        break;
      }

      case "CHASE": {
        const target = players.find((p) => p.id === this.targetId);
        if (!target || target.ignored) { this.startReturn(); break; }
        const visible = !target.hidden && hasLineOfSight(this.grid, this, target, this.open);
        if (visible) { this.lastKnown = { x: target.x, z: target.z }; this.losLost = 0; }
        else this.losLost += dt;
        this.chaseTime += dt;
        if (this.losLost >= TUNING.cat.loseSight) { this.startSearch(); break; }
        if (this.chaseTime > this.settings.giveUpAfter) { this.enter("GIVE_UP"); break; }

        const d = Math.hypot(target.x - this.x, target.z - this.z);
        this.closeFor = visible && d <= TUNING.cat.catchRange ? this.closeFor + dt : 0;
        if (this.closeFor >= 0.2) {
          this.enter("POUNCE");
          this.targetId = target.id;
          break;
        }
        // Close in, but stop just short of the target so the pounce has somewhere to go.
        if (visible && d <= TUNING.cat.catchRange * 0.8) this.turnToward(angleTo(this, target), dt);
        else if (this.lastKnown) this.moveTo(this.lastKnown, this.settings.chase, dt, true);
        break;
      }

      case "POUNCE": {
        const target = players.find((p) => p.id === this.targetId);
        if (this.stateTime < TUNING.cat.pounceWindup) {
          // Crouch and wiggle: the dodge window. Aim at the target.
          if (target) {
            const far = Math.hypot(target.x - this.x, target.z - this.z) > 1e-3;
            const a = far ? angleTo(this, target) : this.facing;
            this.facing = a;
            this.pounceDir = { x: Math.sin(a), z: Math.cos(a) };
          }
          this.leapLeft = TUNING.cat.pounceDist;
          break;
        }
        if (this.leapLeft > 0) {
          // The leap: exactly TUNING.cat.pounceDist tiles, over about POUNCE_LEAP_TIME seconds.
          const step = Math.min(this.leapLeft, (TUNING.cat.pounceDist / POUNCE_LEAP_TIME) * dt);
          this.leapLeft -= step;
          const p = moveCircle(this, this.pounceDir.x * step, this.pounceDir.z * step, TUNING.cat.radius, this.catSolid);
          this.x = p.x; this.z = p.z;
          if (this.leapLeft > 1e-6) break;
        }
        // Landed.
        const hit = target && !target.ignored && !target.hidden && !target.invulnerable
          && this.catchCooldown <= 0
          && Math.hypot(target.x - this.x, target.z - this.z) <= TUNING.cat.pounceHit;
        if (hit && target) {
          events.caught = target.id;
          this.enter("CATCH");
          this.targetId = target.id;
          this.catchCooldown = TUNING.cat.catchCooldown;
          this.meters.set(target.id, 0);
        } else {
          const keep = { time: this.chaseTime, id: this.targetId };
          this.startChase(keep.id);
          this.chaseTime = keep.time;
        }
        break;
      }

      case "CATCH":
        if (this.stateTime >= TUNING.cat.admire) this.startReturn();
        break;

      case "SEARCH": {
        if (!this.arrived && this.goal) {
          this.arrived = this.moveTo(this.goal, walk, dt, false);
          if (this.arrived) this.stateTime = 0;
          break;
        }
        this.headYaw = PATROL_LOOK * 1.4 * Math.sin((this.stateTime / TUNING.cat.searchLook) * Math.PI * 4);
        if (this.stateTime >= TUNING.cat.searchLook || !this.goal) this.startReturn();
        break;
      }

      case "GIVE_UP":
        if (this.stateTime >= TUNING.cat.giveUpSit) this.startReturn();
        break;

      case "RETURN":
        if (!this.goal || this.moveTo(this.goal, walk, dt, false)) this.enterBase();
        break;

      case "HUNT":
        break;
    }
  }

  private startSearch(): void {
    const where = this.lastKnown;
    this.enter("SEARCH");
    this.goal = where ? { ...where } : null;
  }

  private readonly catSolid = (x: number, y: number): boolean => !isWalkableForCat(this.grid, x, y, this.open);
  private readonly catPass = (x: number, y: number): boolean => isWalkableForCat(this.grid, x, y, this.open);

  private turnToward(angle: number, dt: number): void {
    const diff = wrapAngle(angle - this.facing);
    const step = TURN_RATE * dt;
    this.facing = wrapAngle(this.facing + Math.max(-step, Math.min(step, diff)));
  }

  /** The nearest tile the cat can stand on to a point (the point's own tile if possible). */
  private catTileNear(p: Vec2): Tile | null {
    const t = worldToTile(p.x, p.z);
    if (this.catPass(t.x, t.y)) return t;
    let best: Tile | null = null, bestD = Infinity;
    for (let y = 0; y < this.grid.height; y++) {
      for (let x = 0; x < this.grid.width; x++) {
        if (!this.catPass(x, y)) continue;
        const d = Math.hypot(x + 0.5 - p.x, y + 0.5 - p.z);
        if (d < bestD) { bestD = d; best = { x, y }; }
      }
    }
    return best;
  }

  /**
   * Walk toward a point along an A* path. Returns true on arrival.
   * `chasing` re-plans every TUNING.cat.repath seconds and steers straight at
   * the point once in its tile.
   */
  private moveTo(point: Vec2, speed: number, dt: number, chasing: boolean): boolean {
    const goalTile = this.catTileNear(point);
    if (!goalTile) return true;
    const reachable = goalTile.x === worldToTile(point.x, point.z).x && goalTile.y === worldToTile(point.x, point.z).y;
    const dest = reachable ? point : tileCenter(goalTile);

    this.repathIn -= dt;
    const goalChanged = !this.pathGoal || this.pathGoal.x !== goalTile.x || this.pathGoal.y !== goalTile.y;
    if (goalChanged || (chasing && this.repathIn <= 0)) {
      const here = worldToTile(this.x, this.z);
      const start = this.catPass(here.x, here.y) ? here : this.catTileNear(this) ?? here;
      this.path = findPath(this.grid, start, goalTile, this.catPass) ?? [];
      this.pathGoal = goalTile;
      this.repathIn = TUNING.cat.repath;
    }

    let budget = speed * dt;
    for (let guard = 0; guard < 4 && budget > 1e-6; guard++) {
      const next = this.path.length ? tileCenter(this.path[0]) : dest;
      const dx = next.x - this.x, dz = next.z - this.z;
      const dist = Math.hypot(dx, dz);
      if (dist < ARRIVE_DIST) {
        if (this.path.length) { this.path.shift(); continue; }
        return true;
      }
      const step = Math.min(dist, budget);
      const p = moveCircle(this, (dx / dist) * step, (dz / dist) * step, TUNING.cat.radius, this.catSolid);
      const moved = Math.hypot(p.x - this.x, p.z - this.z);
      this.x = p.x; this.z = p.z;
      this.turnToward(Math.atan2(dx, dz), dt);
      budget -= step;
      if (moved < step * 0.2) break; // blocked; try again next tick
    }
    const last = this.path.length ? null : dest;
    return last !== null && Math.hypot(last.x - this.x, last.z - this.z) < ARRIVE_DIST;
  }
}
