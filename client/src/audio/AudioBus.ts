// One AudioContext and the mixer buses (PLAN.md Section 12, "Setup").
// master → music, sfx, blips (character voices), voice (chat), ui.
// Browsers only start audio after a click or key press, so unlock() is called
// on the first one. Phase 5 adds the volume sliders, music and sounds.

export type BusName = "music" | "sfx" | "blips" | "voice" | "ui";

export class AudioBus {
  readonly ctx: AudioContext;
  readonly master: GainNode;
  private readonly buses: Record<BusName, GainNode>;

  constructor() {
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    const make = (): GainNode => {
      const g = this.ctx.createGain();
      g.connect(this.master);
      return g;
    };
    this.buses = { music: make(), sfx: make(), blips: make(), voice: make(), ui: make() };

    // Unlock on the first click or key press.
    const unlock = (): void => { void this.unlock(); };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
  }

  bus(name: BusName): GainNode {
    return this.buses[name];
  }

  async unlock(): Promise<void> {
    if (this.ctx.state !== "running") await this.ctx.resume().catch(() => undefined);
  }

  setVolume(name: BusName | "master", volume: number): void {
    const node = name === "master" ? this.master : this.buses[name];
    node.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.05);
  }
}

let shared: AudioBus | null = null;

/** The one AudioBus for the page. */
export function audioBus(): AudioBus {
  shared ??= new AudioBus();
  return shared;
}
