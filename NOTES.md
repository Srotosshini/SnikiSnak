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

## Phase 1

1. **Straight into the level.** There is no lobby yet, so a room starts in the `playing` phase and players walk around Level 1 as soon as they join. Phase 3 adds the lobby and level flow.
2. **Light brightness.** Section 11 says hemisphere intensity 0.6. Current Three.js uses physical light units, where that is almost black on toon materials, so I scaled all light intensities up (constants at the top of `client/src/render/Lights.ts`). The colours are the ones in the plan. The real lighting pass is Phase 5.
3. **Movement check.**
   - Section 9's rule is `maxSpeed × dt × 1.3 + 0.1`. I measure `dt` from the last accepted position, but never less than one tick (messages can arrive in bursts) and never more than 0.15 s. Otherwise a player who stood still for 10 seconds could jump 10 tiles in one message.
   - The straight line of a move also mustn't pass through a solid tile.
4. **Moving or not.** The server decides who is moving from real position changes, so a client can't fake silence. If a client says it stopped, footsteps stop at once.
5. **F1 overlay.** Section 2 says F1 is dev mode only. I also allow it with `?debug=1`, so you can check things in a normal 3-player room.
6. **Dev zoom.** In dev mode the mouse wheel zooms the camera in (it follows your character more closely when zoomed). Not available in normal play.
7. **`owner` field.** `PlayerState` has an extra `owner` field: the session that controls the character. It's the player's own session normally, and the one dev-mode client for all three characters in dev mode.
8. **Mochi's pink.** The palette has no pink, but Section 2 gives Mochi a pink nose. I tinted jam red toward paper.
9. **Debug handle.** With `?debug=1` or `?dev=1`, `window.__sniki` holds the room and scene, for poking at things in the browser console.

## Phase 2

1. **Footsteps barely wake the Level 1 cat.** With the plan's numbers (footstep loudness 0.15, sleep hearing ×0.6, sleep drain 0.05/s), walking only wakes him from within about a tile of his nose. A run of 3–4 squeaks wakes him from across the room. That matches "careless walking next to the basket, or a run of squeaks", but if you want footsteps to matter more, lower `wakeAt` in the Level 1 file or raise `noise.walk` in `tuning.ts`.
2. **Which states react to "?" and "!".**
   - "!" (meter full, or bumping into him) starts a chase from any state except chase, pounce and catch.
   - "?" (meter at 0.35) and loud noise send him to investigate from patrol, perch and return. Section 4.5 lists only patrol and perch, but a returning cat ignoring a player in plain sight felt wrong.
   - While he's investigating, a new "?" or noise moves his target.
3. **Chase distance.** He stops just short of the target (0.8 × the catch range) before pouncing. Otherwise he walks right on top of them and the pounce has no direction. The leap is exactly 1.2 tiles.
4. **"All 3 players".** The win and star rules count everyone in the room, so testing with two tabs still works: both home ends the level at once. With 3 players it is exactly the plan's rule.
5. **Grace period.** For the first 5 s the cat stays where he is (grooming), with no vision or hearing, and detection meters drain.
6. **Starting level.** `?level=N` now works for a normal host too, not only in dev mode, so Level 2 can be tested with three tabs. The level select comes in Phase 3.
7. **Synced state additions.** `CatState.vision` is his current view range (0 = eyes shut), so clients draw the cone exactly as the server sees. `HeistState.run` goes up on every start or restart, so clients rebuild the scene. `HeistState.exitReady` shows the "Call it a night" prompt.
8. **Toasts.** "Need one more friend!" and "Kiwi or Pip can carry this." are UI messages, sent by the server as text. Real dialogue (Crow lines, barks) lives in `client/src/content/script.ts`. The wrong-role barks come in Phase 3.
9. **Placeholders.** The detection "eye" over your head (Section 11) is a simple meter bar in the bottom-left corner for now. The thimble is a small gold cup. Thought bubbles and sounds come in Phase 5.
10. **Dev mode and F.** When you switch characters with backquote, the one you leave keeps holding F. To let go, switch back and tap F.

## Phase 3

1. **Flow timings.** I added `flow: { introTitle: 2.5, introPerLine: 2.8, briefing: 20 }` to `tuning.ts`. The intro lasts as long as the title card plus the Crow's lines. Everyone pressing Ready (or Enter) skips the intro and the briefing.
2. **Dev mode skips the flow.** `?dev=1` goes straight to playing, with no lobby, intro or briefing, for fast testing. A dev character you switch away from keeps holding F and Q (rescue and cover), but lets go of E.
3. **Level select.** The host can pick any level, in the lobby and on the results card. Locking levels until you've cleared the one before, and saving stars, come in Phase 7 as planned.
4. **Kiwi covering counts as sneaking.** She moves at sneak speed, so her own footsteps and the cat's detection treat her as sneaking.
5. **Cover hides only the teammate.** Section 4.3 says "covered by Kiwi, with both standing still", so the covered teammate is hidden, not Kiwi herself.
6. **Reach.** Items, vents and latches work within 1 tile of their centre. A locked door is picked from a tile right next to it (Pip at (11, 6) in Level 4). Standing on the latch, the latch wins over the door next to it.
7. **Latch timing.** "Press E on a latch: 1 s" means one press starts a 1 s action. It's cancelled if Mochi walks away.
8. **Join errors.** Colyseus says "locked" for both a full room and one that has started, so both show "That heist is full or has already started."
9. **Wrong-role messages** are now barks, with the lines from Section 3. Pressing E on a latch as Kiwi or Pip just shows the greyed "Mochi can do this" prompt, because Section 3 has no bark for it.
10. **Odd-shaped furniture.** Groups that aren't rectangles, like Level 3's shelving island with the flour sack touching it, are built tile by tile with no gaps. Named furniture builders come in Phase 8.

## Phase 4

1. **When the mic is asked for.** Only after a click: the lobby's Test mic button, or the first V press in the game. Browsers block the prompt without a click, and Section 10 asks for a Test mic button.
2. **No mic still connects.** A player without a mic still opens the voice connections, so they hear everyone. Until someone's mic is on, the others see "(mic off)" on their card and "mic off" on their portrait.
3. **Dev mode has no voice.** A solo dev room is just you, so voice is off there.
4. **Walkie-talkie filter.** Section 10 says 400–3000 Hz. I used one band-pass filter centred near 1.1 kHz with a wide Q, which covers roughly that range, plus light distortion. It's a setting each player turns on for themselves (lobby checkbox for now; the Settings screen comes in Phase 5).
5. **Saved settings.** Push-to-talk and the walkie-talkie choice are saved in the browser (`snikisnak.voice`). Per-player volume sliders and the mic device picker come with the Settings screen in Phase 5. `Voice.setPeerVolume` already works.
6. **Reconnecting.** If a voice connection fails, it is torn down and set up again from scratch. A player who refreshes the page gets a new session id, and the others connect to them again automatically.
7. **TURN server.** None, as planned. Same Wi-Fi works with STUN alone. If voice fails across different networks, use a Discord call as the backup (see `TESTING.md`).

## Phase 5

1. **All audio is made in code.** There are no sound or music files: the effects, blip voices and the three music layers are synthesized with the Web Audio API. It works offline and is your own handmade audio. Recorded sounds (your squeaks and foley) can replace any effect in Phase 8. Just add them to `CREDITS.md`.
2. **Credits.** `CREDITS.md` follows the Section 16 template except the "Code written with Claude Code" line, per your standing instructions.
3. **Blips that fit.** Section 12's note lengths make long Crow lines take about 9 s, longer than their cutscene slot or the 2.2 s bark bubble. Long lines are spoken a little faster to fit. Short lines sound exactly as the table says.
4. **Cutscene.** I added `flow.cutscene: 86` to `tuning.ts`. It plays once per room, when the heist starts at Level 1; starting at another level skips it. The visuals are simple, as Phase 5 allows: rooftop camera shots, paper overlays and a cat silhouette. Kiwi turning grey only shows in her line's stage direction.
5. **Bark queue.** A bark that hits a cooldown waits up to 5 s instead of being dropped, so "I'm in a jar. Again." still plays after "He SEES me".
6. **Situation cards.** The first squeak, stir, sighting (the cone card) and jar in a run each send a card. Cards you've seen don't show again; Settings has "Reset tutorial cards".
7. **Pings** (keys 1–4) are in, because players without a mic need them. Off-screen ping arrows aren't done yet.
8. **Draw calls.** Level 1 takes about 177 draw calls with post-processing off, under the 300 limit. I didn't merge the furniture meshes yet, since it isn't needed.
9. **Settings** are saved in this browser (`snikisnak.settings`): volumes, Low graphics and mic device. The voice settings stay in `snikisnak.voice`.
10. **Not done yet** (later phases): the off-screen bell and ping markers, per-player voice volume sliders, and room ambiences (only the music plays during levels).
