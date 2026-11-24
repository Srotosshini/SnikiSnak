// Snapshot interpolation for remote players and (later) the cat (PLAN.md Section 9).
//
// Every time the server's state arrives we store a snapshot with the time we
// received it. Remote things are drawn 100 ms in the past, blended between the
// two snapshots around that moment. That hides the uneven gaps between network
// updates, at the cost of a small delay.

export const INTERP_DELAY_MS = 100;
const MAX_SNAPSHOTS = 32;
/** If nothing arrived for this long, the last value is treated as held until just now. */
const HOLD_GAP_MS = 150;

export interface Snapshot {
  t: number;
  x: number;
  z: number;
  facing: number;
  moving: boolean;
  sneaking: boolean;
}

export class Interp {
  private snaps: Snapshot[] = [];

  push(s: Snapshot): void {
    const last = this.snaps[this.snaps.length - 1];
    if (last && s.t <= last.t) return;
    if (last && s.t - last.t > HOLD_GAP_MS) {
      // It stood still: hold the old value until just before this update, so we
      // don't slowly slide across the whole gap.
      this.snaps.push({ ...last, t: s.t - 50 });
    }
    this.snaps.push(s);
    if (this.snaps.length > MAX_SNAPSHOTS) this.snaps.splice(0, this.snaps.length - MAX_SNAPSHOTS);
  }

  /** Jump straight to a value (spawn, teleport). */
  reset(s: Snapshot): void {
    this.snaps = [s];
  }

  /** The interpolated state at time t (usually now - INTERP_DELAY_MS). */
  sample(t: number): Snapshot | null {
    const s = this.snaps;
    if (s.length === 0) return null;
    if (t <= s[0].t) return s[0];
    const last = s[s.length - 1];
    if (t >= last.t) return last;
    let i = s.length - 2;
    while (i > 0 && s[i].t > t) i--;
    const a = s[i], b = s[i + 1];
    const k = (t - a.t) / (b.t - a.t);
    return {
      t,
      x: a.x + (b.x - a.x) * k,
      z: a.z + (b.z - a.z) * k,
      facing: a.facing + angleDiff(a.facing, b.facing) * k,
      moving: k < 0.5 ? a.moving : b.moving,
      sneaking: k < 0.5 ? a.sneaking : b.sneaking,
    };
  }
}

/** Shortest signed difference from angle a to angle b. */
export function angleDiff(a: number, b: number): number {
  return Math.atan2(Math.sin(b - a), Math.cos(b - a));
}
