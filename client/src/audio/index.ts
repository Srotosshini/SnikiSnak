// The game's audio in one place: the mixer, sound effects, blip voices and music.

import { audioBus } from "./AudioBus";
import { Blips } from "./Blips";
import { Music } from "./Music";
import { Sfx } from "./Sfx";
import { onSettings } from "../settings";

export interface GameAudio {
  sfx: Sfx;
  blips: Blips;
  music: Music;
}

let shared: GameAudio | null = null;

export function audio(): GameAudio {
  if (!shared) {
    const bus = audioBus();
    shared = { sfx: new Sfx(bus), blips: new Blips(bus), music: new Music(bus) };
    // Volume sliders (Settings).
    onSettings((s) => {
      bus.setVolume("master", s.volumes.master);
      bus.setVolume("music", s.volumes.music);
      bus.setVolume("sfx", s.volumes.sfx);
      bus.setVolume("ui", s.volumes.sfx);
      bus.setVolume("blips", s.volumes.blips);
      bus.setVolume("voice", s.volumes.voice);
    });
  }
  return shared;
}
