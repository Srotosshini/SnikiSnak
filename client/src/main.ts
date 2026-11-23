// Boot (Phase 0): draw a blank Three.js scene, join or create a heist room,
// and log the room state so we can see the server and client talking.
//
//   https://localhost:5173              creates a room and shows its code
//   https://localhost:5173/?join=ABCD   joins room ABCD
//   ?name=Ana                           your smuggler name
//   ?server=wss://host:port             a different server

import "./ui/ui.css";
import { Renderer } from "./render/Renderer";
import { Net, serverUrl, type HeistRoom, type HeistView } from "./net/Net";

const params = new URLSearchParams(location.search);
const canvas = document.querySelector<HTMLCanvasElement>("#scene")!;
const ui = document.querySelector<HTMLDivElement>("#ui")!;

new Renderer(canvas);

const card = document.createElement("div");
card.className = "card net-card";
ui.appendChild(card);

function render(room: HeistRoom | null, status: string, isError = false): void {
  card.replaceChildren();
  const h = document.createElement("h1");
  h.textContent = "SnikiSnak";
  card.appendChild(h);

  const s = document.createElement("div");
  s.className = isError ? "status error" : "status";
  s.textContent = status;
  card.appendChild(s);

  // The first state arrives a moment after joining.
  const state: HeistView | undefined = room?.state;
  if (!room || !state?.players) return;

  const code = document.createElement("div");
  code.className = "code";
  code.textContent = state.code || room.roomId;
  card.appendChild(code);

  const list = document.createElement("ul");
  state.players.forEach((p, id) => {
    const li = document.createElement("li");
    const tags = [p.role || "no role", id === state.hostId ? "host" : "", id === room.sessionId ? "you" : ""]
      .filter(Boolean).join(", ");
    li.textContent = `${p.name} (${tags})`;
    if (!p.connected) li.className = "away";
    list.appendChild(li);
  });
  card.appendChild(list);

  const hint = document.createElement("div");
  hint.className = "hint";
  const link = document.createElement("a");
  link.href = `${location.pathname}?join=${room.roomId}`;
  link.target = "_blank";
  link.textContent = "Open another tab in this heist";
  hint.appendChild(link);
  hint.append(` (${state.players.size}/3 players)`);
  card.appendChild(hint);
}

async function boot(): Promise<void> {
  const url = serverUrl(params);
  const net = new Net(url);
  const name = params.get("name") ?? undefined;
  const joinCode = params.get("join");
  render(null, joinCode ? `Joining ${joinCode.toUpperCase()}...` : "Creating a heist...");

  try {
    const room = joinCode ? await net.join(joinCode, { name }) : await net.host({ name });
    console.log(`joined room ${room.roomId} as ${room.sessionId}`);
    render(room, "Connected.");

    room.onStateChange((state) => {
      console.log("state", state.toJSON());
      render(room, "Connected.");
    });
    room.onLeave((code) => {
      console.log("left room", code);
      render(null, `Disconnected (code ${code}).`, true);
    });
  } catch (err) {
    console.error("could not join", err);
    const message = err instanceof Error ? err.message : String(err);
    render(null, `Could not connect to ${url}: ${message}`, true);
  }
}

void boot();
