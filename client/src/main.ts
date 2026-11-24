// Boot and screen router (PLAN.md Section 13).
//
//   https://localhost:5173              "Click to begin", then the start screen: Host a heist / Join with code
//   https://localhost:5173/?join=ABCD   straight into heist ABCD's lobby
//   ?dev=1                              solo dev mode: one browser controls all 3 characters
//   ?dev=1&level=5                      dev mode, starting at that level
//   ?debug=1                            allow the F1 overlay outside dev mode
//   ?name=Ana                           your smuggler name
//   ?server=wss://host:port             a different server
//   ?nomic=1                            never ask for the microphone
//   ?fakemic=1                          send a beeping test tone instead of the mic (testing voice chat)
//   ?low=1                              start with Low graphics on
//
// Behind the start screen, lobby and opening cutscene is the 3D rooftop
// (game/Rooftop.ts). Esc opens the menu in a room.

import "@fontsource/caveat-brush";
import "@fontsource/shantell-sans/400.css";
import "@fontsource/shantell-sans/700.css";
import "@fontsource/courier-prime";
import "./ui/ui.css";
import "./ui/screens.css";
import "./ui/phase5.css";
import { Renderer } from "./render/Renderer";
import { Net, serverUrl, type HeistRoom } from "./net/Net";
import { GameScene } from "./game/GameScene";
import { type Screen, el, savedName } from "./ui/dom";
import { StartScreen } from "./ui/screens/StartScreen";
import { JoinScreen } from "./ui/screens/JoinScreen";
import { LobbyScreen } from "./ui/screens/LobbyScreen";
import { LOCAL_PEER, Voice, loadVoiceSettings } from "./net/Voice";
import { audioBus } from "./audio/AudioBus";
import { audio } from "./audio";
import { Rooftop } from "./game/Rooftop";
import { ClickToBegin } from "./ui/screens/ClickToBegin";
import { SettingsScreen } from "./ui/screens/SettingsScreen";
import { CutsceneOverlay } from "./ui/CutsceneOverlay";
import { Menu } from "./ui/Menu";
import { onSettings, settings } from "./settings";

const params = new URLSearchParams(location.search);
const dev = params.get("dev") === "1";
const debug = dev || params.get("debug") === "1";
const canvas = document.querySelector<HTMLCanvasElement>("#scene")!;
const ui = document.querySelector<HTMLDivElement>("#ui")!;

const renderer = new Renderer(canvas);
if (dev) renderer.enableDevZoom();
const net = new Net(serverUrl(params));
const rooftop = new Rooftop();
onSettings((s) => renderer.setLowGraphics(s.lowGraphics));

// The boil: a new noise seed every 120 ms (8 frames per second).
const boilNoise = document.getElementById("boil-noise");
window.setInterval(() => boilNoise?.setAttribute("seed", String(1 + Math.floor(Math.random() * 100))), 120);

// A soft paper "pap" on every paper button.
document.addEventListener("click", (e) => {
  if (e.target instanceof HTMLElement && e.target.closest(".paper-button")) audio().sfx.play("pap", undefined, 1, "ui");
});

let screen: Screen | null = null;
function show(next: Screen | null): void {
  screen?.unmount();
  screen = next;
}

/** Turn a join error into one of the paper error cards. */
function joinError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/not found/i.test(msg)) return "No heist with that code.";
  if (/locked|full/i.test(msg)) return "That heist is full or has already started.";
  return `Couldn't connect: ${msg}`;
}

function startScreen(error = ""): void {
  rooftop.attach(renderer);
  rooftop.setShot("orbit");
  show(new StartScreen(ui, {
    host: (name) => void connect(() => net.host({ name, level: Number(params.get("level")) || undefined })),
    join: (name) => joinScreen(name),
    settings: () => { const ss = new SettingsScreen(ui, null, () => ss.unmount()); },
  }, error));
}

function joinScreen(name: string): void {
  const js = new JoinScreen(ui, {
    join: async (code) => {
      try {
        const room = await net.join(code, { name });
        enter(room);
      } catch (err) {
        js.showError(joinError(err));
      }
    },
    back: () => startScreen(),
  });
  show(js);
}

async function connect(make: () => Promise<HeistRoom>): Promise<void> {
  try {
    enter(await make());
  } catch (err) {
    console.error("could not connect", err);
    startScreen(joinError(err));
  }
}

/** In a room: show the lobby or the game, following the server's phase. */
function enter(room: HeistRoom): void {
  console.log(`joined room ${room.roomId} as ${room.sessionId}`);
  show(null);
  let lobby: LobbyScreen | null = null;
  let scene: GameScene | null = null;
  let cutscene: CutsceneOverlay | null = null;
  const menu = new Menu(ui, null, () => void room.leave());
  const devCard = dev ? el("div", "card dev-card", ui) : null;
  const voice = dev ? null : startVoice(room);
  menu.voice = voice;
  if (debug) Object.assign(window, { __voice: voice });
  const voiceState = (): "talking" | "idle" | "muted" | "nomic" | "off" =>
    !voice ? "off" : !voice.hasMic ? "nomic" : voice.isMuted ? "muted" : voice.isTalking ? "talking" : "idle";
  voice?.onSpeaking((peerId, on) => {
    lobby?.setSpeaking(peerId, on);
    scene?.setTalking(peerId === LOCAL_PEER ? room.sessionId : peerId, on);
  });
  voice?.onChange(() => scene?.setVoiceState(voiceState(), voice.settings.pushToTalk));

  room.onStateChange((state) => {
    if (!state.players) return;
    if (voice) {
      // One voice connection to each other player; jarred players sound muffled.
      const ids: string[] = [];
      state.players.forEach((p) => { ids.push(p.owner); if (p.owner !== room.sessionId) voice.setPeerJarred(p.owner, p.jarred); });
      voice.syncPeers(ids);
    }
    if (state.phase === "cutscene") {
      lobby?.unmount();
      lobby = null;
      rooftop.attach(renderer);
      if (!cutscene) cutscene = new CutsceneOverlay(ui, rooftop, audio(), (holding) => room.send("skip", { holding }));
      cutscene.update(state.timer, state.skipping, state.players.size);
      return;
    }
    if (cutscene) { cutscene.dispose(); cutscene = null; }
    if (state.phase === "lobby") {
      scene?.dispose();
      scene = null;
      rooftop.attach(renderer);
      rooftop.setShot("orbit");
      if (!lobby) lobby = new LobbyScreen(ui, room, voice);
      lobby.update(state);
    } else {
      lobby?.unmount();
      lobby = null;
      rooftop.detach();
      if (state.players.size > 0 && (!scene || scene.run !== state.run)) {
        scene?.dispose();
        scene = new GameScene(renderer, room, { debug, uiRoot: ui });
        console.log(`level ${state.level}: ${scene.level.name}`);
        scene.setVoiceState(voiceState(), voice?.settings.pushToTalk ?? true);
        // Handy in the browser console while debugging: __sniki.room.state
        if (debug) Object.assign(window, { __sniki: { room, scene, renderer } });
      } else {
        scene?.sync(state);
      }
    }
    if (devCard) devCard.textContent = `Dev mode ${state.code}: \` switch, E use, F hold, Q cover, F1 debug, wheel zoom`;
  });

  room.onLeave((code) => {
    console.log("left room", code);
    scene?.dispose();
    lobby?.unmount();
    cutscene?.dispose();
    menu.dispose();
    devCard?.remove();
    voice?.dispose();
    startScreen(code === 4000 || code === 1000 ? "" : `Disconnected (code ${code}).`);
  });
}

/** Voice chat for a room: push-to-talk on V, M mutes (Section 10). */
function startVoice(room: HeistRoom): Voice {
  const voice = new Voice(audioBus());
  voice.settings = loadVoiceSettings();
  void voice.init(room);
  if (params.get("fakemic") === "1") voice.useStream(fakeMic());
  else if (params.get("nomic") === "1") voice.skipMic();

  const typing = (e: KeyboardEvent): boolean =>
    e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement;
  const onKey = (e: KeyboardEvent, down: boolean): void => {
    if (typing(e) || e.repeat) return;
    if (e.code === "KeyV") {
      // The first V asks for the mic if the lobby's Test mic wasn't used.
      if (down && !voice.hasMic && !voice.micError) void voice.askMic(settings().micDevice || undefined);
      voice.setPushToTalk(down);
    }
    if (down && e.code === "KeyM") voice.setMuted(!voice.isMuted);
  };
  const keyDown = (e: KeyboardEvent): void => onKey(e, true);
  const keyUp = (e: KeyboardEvent): void => onKey(e, false);
  window.addEventListener("keydown", keyDown);
  window.addEventListener("keyup", keyUp);
  window.addEventListener("blur", () => voice.setPushToTalk(false));
  room.onLeave(() => {
    window.removeEventListener("keydown", keyDown);
    window.removeEventListener("keyup", keyUp);
  });
  return voice;
}

/** A test tone that beeps on and off, standing in for a microphone. */
function fakeMic(): MediaStream {
  const bus = audioBus();
  const ctx = bus.ctx;
  const osc = ctx.createOscillator();
  osc.frequency.value = 330 + Math.random() * 200;
  const gate = ctx.createGain();
  gate.gain.value = 0;
  const dest = ctx.createMediaStreamDestination();
  osc.connect(gate).connect(dest);
  osc.start();
  window.setInterval(() => {
    const on = gate.gain.value < 0.1;
    gate.gain.setValueAtTime(on ? 0.3 : 0, ctx.currentTime);
  }, 700);
  return dest.stream;
}

// Boot. Dev mode goes straight in; otherwise "Click to begin" unlocks audio first.
const joinCode = params.get("join");
const name = params.get("name") ?? savedName();
if (dev) {
  void connect(() => net.host({ solo: true, level: Number(params.get("level")) || undefined }));
} else {
  rooftop.attach(renderer);
  const begin = new ClickToBegin(ui, () => {
    void audioBus().unlock().then(() => {
      audio().music.start();
      audio().music.fanfare();
    });
    begin.unmount();
    if (joinCode) void connect(() => net.join(joinCode, { name }));
    else startScreen();
  });
}
