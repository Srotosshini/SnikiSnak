# Changelog

## Phase 5 — Story, sound and feel for the LAN Party (2026-11-24)

- **Screens:**
  - "Click to begin" note, which unlocks audio.
  - Start screen over a live 3D rooftop: Queen Corvina on her tin-can throne, the three smugglers, string lights, the Big House with a cat silhouette crossing a lit window, and a slowly circling camera.
  - Settings tab, and the Esc menu in rooms (Settings, Controls, Leave room).
- **Opening cutscene "The Royal Errand"** (86 s, once before Level 1):
  - Camera shots on the rooftop, a speech bubble for every line, the name cards, and the list unrolling (with Mochi's crayon line).
  - Then the cat silhouette and the title card.
  - Skipped when everyone holds Space for 1 s, with "(n/3)" shown.
- **Level intros:** a tin-can portrait, each line spoken, then the level's tutorial cards.
- **Tutorial cards:** top-left, one at a time, dismissed after 6 s or with Enter, and remembered once seen. The first squeak, stir, sighting and jar also bring up cards.
- **Barks and thought bubbles:**
  - Every in-game bark from Section 3: spotted, jarred, teammate jarred, rescued, grab, hiding, squeak, cat gives up, left behind and idle. Queued barks wait for the cooldowns.
  - Sir Crumbs's thought bubbles on state changes (at most one every 3 s), with a chirp, meow or hiss.
- **Blip voices** from the Section 12 table: text appears letter by letter in time, and long lines are said a little faster to fit their slot.
- **Sound effects:** about 35, all made in code (footsteps, squeak, bell, purr, chirp, meow, hiss, whoosh, pat pat, jars, items, locks, doors, vents, pings, UI). Positional sounds get quieter with distance.
- **Music:** layered calm, tension and chase music made in code, crossfading on the cat's mood, plus the kazoo fanfare, the level-complete jingle and the "Caught!" sting.
- **Results:** the level-complete receipt prints line by line (level, time, item, who made it home), the stars stamp on, and the Crow's line types out. "Caught!" is an ink stamp over a sketch of two jars.
- **Pings** on keys 1–4 at the mouse: Go here, Cat!, Wait, Help, each with a stamp and a sound.
- **Art pass:**
  - Self-hosted fonts and the "boil" wobble on titles.
  - Post-processing: tilt-shift, bloom, colour grade, vignette and grain.
  - Lamp-pool decals with bulbs, fading moon shafts, and 200 dust motes.
  - Low graphics (no post-processing or shadows, pixel ratio 1) in Settings, or `?low=1`.
- `CREDITS.md`.
- **Tests:** every bark, bubble and intro line id has words, and every card exists. Server tests cover barks, cards, bubbles, the cutscene skip and pings (52).

## Phase 4 — Voice chat and LAN (2026-11-24)

- `client/src/net/Voice.ts`: a WebRTC mesh between the 3 browsers.
  - The room relays offers, answers and ICE candidates (`rtc`), and the lower session id makes the offer.
  - It uses Google's public STUN server.
  - A player with no mic still connects and hears everyone.
- **Talking:** push-to-talk on V (the default) or open mic, and M mutes. The first V press asks for the mic if Test mic wasn't used.
- **Routing:** each remote voice goes through its own gain node and filter into the voice bus. The Chrome muted-`<audio>` quirk is handled.
- **Speaking indicator:** an AnalyserNode per stream counts above 0.02 RMS for 100 ms as speaking. It shows as sound waves over the character, a "talking" tag on the portrait, and a bouncing lobby card.
- **Filters:** the jar muffle (700 Hz low-pass on a jarred player's voice) and an optional walkie-talkie band-pass with light distortion.
- **Lobby:** Test mic with a level meter, plus push-to-talk and walkie-talkie checkboxes (saved in the browser). A muted, denied or missing mic shows "(mic off)" to everyone (`mic` message, `micOff` in the state).
- **HUD:** a push-to-talk indicator in the bottom-right corner.
- `client/src/audio/AudioBus.ts`: one AudioContext with music, sfx, blips, voice and ui buses, unlocked by the first click or key press.
- **Test options:** `?fakemic=1` sends a beeping test tone instead of the mic, and `?nomic=1` never asks for the mic.
- `TESTING.md`: step-by-step voice test on 3 laptops on the same Wi-Fi.
- **Tests:** the server relays `rtc` only to `to` and shows the mic state (45 server tests).

## Phase 3 — Lobby, level flow, first abilities (2026-11-24)

- **Screens:**
  - Start screen: name luggage tag, Host a heist, Join with code.
  - Join screen: 4 letter boxes, with error cards.
  - Lobby corkboard: code sticky note with Copy, three character cards to claim, Ready checkbox, the host's level picker and a GO stamp.
- **Server lobby:** role claiming (a taken role is refused; click again to give it back) and ready. GO needs 3 players, 3 roles and everyone ready. The room locks when it leaves the lobby.
- **Level flow:**
  - Intro: title card, then the Crow's tin-can lines.
  - Briefing: up to 20 s, with the camera looking straight down, paw prints along the cat's route and an arrow over the exit.
  - Then playing, then results. Everyone pressing Ready skips ahead. The host's results card has Retry, Next level and Level select.
- **Pip:**
  - Lifts heavy loot: slower, footsteps of radius 4, ×1.3 detection.
  - Picks locks: hold E for 4 s, a click every 0.8 s; progress holds for 2 s, then drains at 10%/s.
- **Kiwi:** cover (hold Q). The nearest teammate within 1.2 tiles is muffled to ×0.4 and hidden when both stand still. Kiwi moves at sneak speed.
- **Mochi:** vents (1.2 s to the paired vent, invisible and silent) and latches (1 s, silent).
- **Doors:** a swinging panel. An open door lets players and the cat through and doesn't block vision.
- **Interaction rule:** one shared function decides "what would E do here?" for both the server and the prompt.
- **Barks:** wrong-role and ability barks (one per character every 4 s, one anywhere every 1.5 s), shown as speech bubbles.
- **HUD basics:** cat face meter, level label, team portraits with status tags and your detection meter, ability cards, prompts with hold progress.
- **Tests:** 114 shared (interaction targets added) and 43 server (abilities, lobby and flow).

## Phase 2 — The cat (2026-11-24)

- **Sir Crumbs** (`server/src/game/CatBrain.ts`): every state from Section 4.5 except HUNT (sleep, stir, patrol, perch, investigate, chase, pounce, catch, search, give up, return).
  - He moves along A* paths and hears noise (walls halve the radius).
  - Each player has a detection meter with every multiplier from Section 4.4, plus the 5 s grooming grace at the start.
  - Bumping into him starts a chase, and he paws at a hide spot he saw you duck into.
- **Hide spots:** standing still or sneaking under a T tile hides you.
- **Jars and rescue:**
  - A caught player is jarred where they stood (moved out of a hide spot if needed), and a carried item drops with a crash.
  - Two friends holding F for 2.5 s free them. One alone gets "Need one more friend!", and progress drains when nobody holds.
  - A jarred player can wobble the jar.
- **Small items:** Kiwi and Pip pick up and put down with E; Mochi can't.
- **Ending a level:**
  - The exit zone, finishing when everyone is home, or "Hold F — Call it a night" with 2 or more.
  - Stars, the lose rule (2 jars, then "Caught!" after 1.5 s), and the host's Retry and Next level buttons.
- **Client:**
  - The cat model with state animations and his vision cone, cut off by walls. The cone is pale yellow when calm, orange when suspicious and red when chasing.
  - "?" and "!" marks, glass jars with a rescue ring, and the gold thimble on the floor or on the carrier's back.
- **HUD:** level label, interaction prompt with hold progress, toasts, detection meter (shows "Hidden"), and the Caught and Level complete cards.
- **Dev mode:** a character you switch away from keeps holding F, so you can test rescues alone.
- **Tests:**
  - Detection, light and hearing maths (shared).
  - 19 simulation tests covering the cat, jars, rescue, items, winning and losing, including the Phase 2 acceptance cases.

## Phase 1 — Walk around together (2026-11-24)

- Level 1 in 3D: plank floor, plaster walls (low south cut-away), cracked squeaky boards, rugs, exit gaps, placeholder furniture boxes, and hide-spot tables with legs and room underneath.
- Toon shading (3-step gradient) and ink outlines (inverted hull); hemisphere light, moon with shadows, lamp and moon point lights.
- The diorama camera: 28° field of view, 55° down from the south, framing the whole room and drifting 25% toward your character.
- Kiwi, Mochi and Pip as primitive toys with procedural animation: breathing, blinking, walk bounce, roll and squash, and a low lean when sneaking.
- Local movement with the shared collision code, Shift to sneak, and `pos` sent 20 times a second.
- The server checks every move (speed limit, walls, no jumping through walls) and sends `correct` to snap back a bad one.
- Remote players are drawn 100 ms in the past, interpolated between snapshots.
- Server-made footsteps and squeaky-board noise, drawn as wobbly ink rings. Footstep rings under 1 tile aren't drawn, so sneaking leaves none.
- Dev mode (`?dev=1`, plus `&level=N`): one browser controls all three characters, backquote switches between them, and the mouse wheel zooms.
- F1 overlay (dev mode or `?debug=1`) shows grid lines, fps, positions and tiles, and recent noise radii.
- Tests: movement and noise rules (shared), plus server tests for corrections, wall checks, footsteps, squeaks and dev mode.

## Phase 0 — Setup (2026-11-24)

- npm workspaces: `shared/`, `server/` (from `npm create colyseus-app@latest`, Colyseus 0.18), `client/` (Vite 8, Three.js r187).
- `shared/`: `tuning.ts` (Section 4.10), `types.ts`, `roles.ts`, `grid.ts` (map parsing, tile rules, circle collision, DDA raycast, 8-direction A*, flood fill, exit zone), all 8 level files with maps copied from PLAN.md, and the Section 5 map validator.
- Tests (`npm test`, Vitest): the map checks for all 8 maps, gating for Levels 4, 5 and 8, a character-for-character comparison with PLAN.md, tests that broken maps are caught, and grid/collision/raycast/A* tests. 79 tests.
- Server: `heist` room with 4-consonant room codes used as the room id, up to 3 players, a host who hands over when they leave, and a 30 s reconnection window. Server tests via `npm run test:server`.
- Client: Vite on HTTPS with the `/colyseus` WebSocket proxy; a blank Three.js scene that creates or joins a room and logs the state.
- `npm run dev` starts both.
