// Boot and screen router (PLAN.md Section 13).
//
//   https://localhost:5173              start screen: Host a heist / Join with code
//   https://localhost:5173/?join=ABCD   straight into heist ABCD's lobby
//   ?dev=1                              solo dev mode: one browser controls all 3 characters
//   ?dev=1&level=5                      dev mode, starting at that level
//   ?debug=1                            allow the F1 overlay outside dev mode
//   ?name=Ana                           your smuggler name
//   ?server=wss://host:port             a different server
//
// The "Click to begin" note, the 3D rooftop and the opening cutscene arrive in Phase 5.

import "./ui/ui.css";
import "./ui/screens.css";
import { Renderer } from "./render/Renderer";
import { Net, serverUrl, type HeistRoom } from "./net/Net";
import { GameScene } from "./game/GameScene";
import { type Screen, el, savedName } from "./ui/dom";
import { StartScreen } from "./ui/screens/StartScreen";
import { JoinScreen } from "./ui/screens/JoinScreen";
import { LobbyScreen } from "./ui/screens/LobbyScreen";

const params = new URLSearchParams(location.search);
const dev = params.get("dev") === "1";
const debug = dev || params.get("debug") === "1";
const canvas = document.querySelector<HTMLCanvasElement>("#scene")!;
const ui = document.querySelector<HTMLDivElement>("#ui")!;

const renderer = new Renderer(canvas);
if (dev) renderer.enableDevZoom();
const net = new Net(serverUrl(params));

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
  show(new StartScreen(ui, {
    host: (name) => void connect(() => net.host({ name, level: Number(params.get("level")) || undefined })),
    join: (name) => joinScreen(name),
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
  const devCard = dev ? el("div", "card dev-card", ui) : null;

  room.onStateChange((state) => {
    if (!state.players) return;
    if (state.phase === "lobby") {
      scene?.dispose();
      scene = null;
      if (!lobby) lobby = new LobbyScreen(ui, room);
      lobby.update(state);
    } else {
      lobby?.unmount();
      lobby = null;
      if (state.players.size > 0 && (!scene || scene.run !== state.run)) {
        scene?.dispose();
        scene = new GameScene(renderer, room, { debug, uiRoot: ui });
        console.log(`level ${state.level}: ${scene.level.name}`);
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
    devCard?.remove();
    startScreen(`Disconnected (code ${code}).`);
  });
}

// Boot.
const joinCode = params.get("join");
const name = params.get("name") ?? savedName();
if (dev) void connect(() => net.host({ solo: true, level: Number(params.get("level")) || undefined }));
else if (joinCode) void connect(() => net.join(joinCode, { name }));
else startScreen();
