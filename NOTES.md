# Notes for Maliha

Decisions made where PLAN.md was unclear or the libraries changed. Each one picks the simpler option; change any of them if you disagree.

## Phase 0

1. **Colyseus 0.18 and schema 5.** The template installed Colyseus 0.18 with `@colyseus/schema` 5. Schema 5 defines state with `schema({ name: t.string() })` instead of the `@type(...)` decorators in Section 9, and rooms list their message handlers in a `messages = { ... }` object. The fields and their meaning are unchanged.
2. **Can the cat walk on vent tiles (V)?** The map legend says yes, but Section 4.5 says the cat "cannot enter ... vents". I followed the legend, since the map data and tests are built on it. Flip it in `isWalkableForCat` in `shared/src/grid.ts` if you want the cat kept off vents.
3. **Light positions.** Sections 6 and 7 give light centres as tile coordinates, for example "(14, 3)". Level files use world units, so I added 0.5 to both numbers, which matches the Level 1 example in Section 8 (14.5, 3.5). Level 8's "(16.5, 6.5)" becomes (17, 7).
4. **Furniture group keys.** `props` keys are the top-left corner of each group's bounding box. Two maps group differently from the furniture list:
   - Level 3: the flour sack touches the shelving island, so they are one group, `"9,2"`.
   - Level 7: the bed frame splits into three groups (`"9,1"` headboard, `"9,4"` and `"14,4"` sides), because you can crawl in from the left, right and foot.
   A test checks that every `props` key matches a real group.
5. **Intro and card ids.** Only Level 1's ids are given in PLAN.md. For the other levels I named intro lines by speaker (`l3_crow_1`, `l3_pip_1`, `l3_kiwi_1`, `l3_pip_2`) and gave the cards short names (`heavy_loot`, `cover`, `distract`). The text itself comes in Phase 5 (`client/src/content/`).
6. **Map check 4.** "Next to a reachable tile" means one of the 4 orthogonal neighbours, not diagonals. The breadbox counts as closed for this check, so it only has to be next to a reachable tile.
7. **Roles in Phase 0.** Players get the first free role automatically (Kiwi, Mochi, Pip). Claiming roles and locking the room when it leaves the lobby come in Phase 3, along with the phases.
8. **Ports.** In development the game server always uses port 2567, because the Vite proxy points there. `npm start` (production) uses the host's `PORT` variable if it has one.
9. **`PLAIN_HTTP=1`.** The built-in test browser here won't accept Vite's self-signed certificate, so `client/vite.config.ts` can also serve plain HTTP (`PLAIN_HTTP=1`, with `CLIENT_PORT` to change the port). Normal `npm run dev` still uses HTTPS on 5173, as PLAN.md says.
10. **Packages beyond the allowed list.** No new libraries, but there is tooling the stack implies:
    - `vite`, `typescript` (pinned to 5.9, because 7.x is the new native compiler and the Colyseus template targets 5), `@types/node` and `@types/three`.
    - The template's own tools: `tsx`, `mocha`, `express` and `@colyseus/testing`.
    Say so if you want any of these handled differently.
11. **Credits.** The `CREDITS.md` template in Section 16 includes "Code written with Claude Code". Your standing instructions say never to credit Claude, so I'll leave that line out when we write credits.
12. **Tests.** `npm test` runs the shared Vitest suite, as Section 8 says. The server's room tests (mocha, from the template) run with `npm run test:server`.
