// Every gameplay number in SnikiSnak lives here (PLAN.md Section 4.10).
// Tune the game by changing these numbers, not by rewriting code.
// Pairs like `walk: [2.5, 0.15]` are [radius in tiles, loudness 0..1].

export const TUNING = {
  tickHz: 20,
  player: { radius: 0.25, walk: 3.6, sneak: 1.8, heavyWalk: 2.4, heavySneak: 1.4,
            croissantWalk: 1.6, croissantSneak: 1.2, interactRange: 1.0 },
  noise: {
    stepEvery: 0.38, sneakStepEvery: 0.5,
    walk: [2.5, 0.15], sneak: [0.8, 0.05], heavy: [4.0, 0.25], heavySneak: [2.5, 0.2],
    croissant: [6.0, 0.35], croissantSneak: [4.0, 0.3],
    squeak: [7.0, 0.8], squeakSneak: [4.0, 0.5],
    lockClick: [5.0, 0.3], crash: [5.0, 0.8], jarBreak: [3.0, 0.4],
    wobble: [2.0, 0.2], chew: [3.0, 0.2], roomba: [7.0, 0.7], breadboxDing: [6.0, 0.5],
    coverMult: 0.4, wallMult: 0.5,
  },
  detect: { base: 1.6, distFalloff: 0.7, drain: 0.35, question: 0.35, alarm: 1.0,
            sneak: 0.5, still: 0.6, bright: 1.5, dark: 0.6, heavy: 1.3, croissant: 1.6,
            blendMoving: 0.25, touchRange: 0.9 },
  cat: { radius: 0.45, catchRange: 0.6, pounceWindup: 0.35, pounceDist: 1.2,
         pounceHit: 0.9, catchCooldown: 4, admire: 2.5, stir: 2, investigateLook: 3,
         searchLook: 4, loseSight: 1.5, giveUpSit: 1.5, waypointPause: 1.5,
         alertDrain: 0.08, sleepDrain: 0.05, sleepHearing: 0.6, investigateAt: 0.4,
         huntEvery: 4, huntOffset: 2, graceStart: 5, repath: 0.25 },
  rescue: { range: 1.3, time: 2.5, drain: 0.5, invuln: 2 },
  kiwi: { colorTime: 20, flashLast: 3, stillToBlend: 0.3, coverRange: 1.2 },
  mochi: { ventTime: 1.2, latchTime: 1, chewTime: 2, pouchMax: 3 },
  pip: { pickTime: 4, clickEvery: 0.8, pickHold: 2, pickDrain: 0.1, boostTime: 2,
         boostRange: 1.2 },
  lightsOut: { time: 25, hearingMult: 1.5 },
  food: { respawn: 25 },
  roomba: { speed: 1.2, shove: 0.8 },
  exit: { zoneRange: 1.5, callItANight: 1.5, allHomeDelay: 0.5 },
  plates: { window: 1.0 },
  loseDelay: 1.5,
  bark: { perCharacter: 4, global: 1.5, show: 2.2 },
  // Level flow (Sections 1 and 9): the tin-can intro shows a title card, then
  // the Crow's lines; the briefing lasts up to 20 s. Added in Phase 3.
  flow: { introTitle: 2.5, introPerLine: 2.8, briefing: 20 },
} as const;

export type Tuning = typeof TUNING;
