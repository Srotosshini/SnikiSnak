# Changelog

## Phase 0 — Setup (2026-11-24)

- npm workspaces: `shared/`, `server/` (from `npm create colyseus-app@latest`, Colyseus 0.18), `client/` (Vite 8, Three.js r187).
- `shared/`: `tuning.ts` (Section 4.10), `types.ts`, `roles.ts`, `grid.ts` (map parsing, tile rules, circle collision, DDA raycast, 8-direction A*, flood fill, exit zone), all 8 level files with maps copied from PLAN.md, and the Section 5 map validator.
- Tests (`npm test`, Vitest): the map checks for all 8 maps, gating for Levels 4, 5 and 8, a character-for-character comparison with PLAN.md, tests that broken maps are caught, and grid/collision/raycast/A* tests. 79 tests.
- Server: `heist` room with 4-consonant room codes used as the room id, up to 3 players, a host who hands over when they leave, and a 30 s reconnection window. Server tests via `npm run test:server`.
- Client: Vite on HTTPS with the `/colyseus` WebSocket proxy; a blank Three.js scene that creates or joins a room and logs the state.
- `npm run dev` starts both.
