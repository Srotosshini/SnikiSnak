# SnikiSnak — rules for Claude Code

- PLAN.md is the source of truth. Re-read the sections named in each phase prompt before coding.
- Work one phase at a time. Stop at the end of the phase and tell me exactly how to run its acceptance tests.
- TypeScript strict mode. No `any` without a comment explaining why.
- Every gameplay number comes from shared/src/tuning.ts or a level file. Never hard-code tuning numbers in game code.
- The server decides game state. A client sends input and its own position only.
- Shared logic (grid, collision, raycast, A*, detection maths) lives in shared/ and has unit tests.
- The game must always run with primitive placeholder models. GLB models are optional, listed in models.json.
- Allowed libraries: three, the Colyseus packages the template installs, @colyseus/sdk, @colyseus/schema,
  @vitejs/plugin-basic-ssl, @fontsource/*, vitest, concurrently. Ask me before adding anything else.
- UI is plain HTML/CSS in client/src/ui. Follow PLAN.md Section 11: palette colours only, no emoji,
  no gradients, no glassy panels.
- Every line of dialogue lives in client/src/content/script.ts.
- After each phase: run npm test, fix failures, add a short entry to CHANGELOG.md.
- If an installed library's API differs from a snippet in PLAN.md, follow the library's docs and keep the behaviour PLAN.md describes.
- If a design question is unclear, pick the simpler option and write it down in NOTES.md for me.
- I'm new to Three.js and networking: after each phase, explain in plain words which files do what.
