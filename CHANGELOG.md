# Changelog

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
