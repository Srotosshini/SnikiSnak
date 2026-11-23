# SnikiSnak — Full Game Plan & Build Spec (Web)

Nov 23, 2026 · @Srotosshini

## 0. How to use this plan with Claude Code

Build SnikiSnak as a browser game in 9 phases (Phase 0 to Phase 8). Give Claude Code one phase at a time, and play-test after each one before you move on. Everything Claude Code needs is in this doc: rules, numbers, maps, script, file layout and acceptance tests.

1. Export this doc as Markdown and save it as `PLAN.md` in a new empty folder called `snikisnak/`.
2. Open that folder in Claude Code. Paste the **Kickoff prompt** from Section 15. It tells Claude Code to read the whole plan, write `CLAUDE.md`, and do Phase 0 only.
3. After each phase, run that phase's acceptance tests (Section 14). Commit to git, then paste the next phase prompt.
4. When something feels too hard or too easy, change the numbers in `shared/src/tuning.ts`. Don't rewrite code to tune.
5. If a library's current docs disagree with a code snippet here, follow the docs and keep the behaviour this plan describes.

**Deadlines this plan is built around**

| Date | Milestone | Must be playable |
| --- | --- | --- |
| asap | Class check-in | Phase 0–1: three players move around Level 1 together in the browser |
| &#32;Nov 24 | LAN Party | Phase 0–5: lobby, voice chat, cutscene, Levels 1–4 with the cat |
| Tue Dec 8 | Final presentation | Phase 0–8: all 8 levels, art pass, audio, ending |

**Words used in this plan**

- **Tile**: one grid square. One tile = 1 world unit in Three.js. A character is about 0.6 units tall.
- **Server**: the Colyseus Node.js process. It owns the truth: cat, items, doors, jars, win and lose.
- **Host**: the player who created the room. Only the host can start a level or pick the next one.
- **Role**: Kiwi (chameleon), Mochi (hamster) or Pip (raccoon). Each player has exactly one role.
- **Jarred**: caught by the cat and trapped under an upside-down glass jar.

## 1. The game at a glance

SnikiSnak (Midnight Sneaky Snack) is a 3-player online co-op stealth heist in the browser. Three tiny smugglers sneak through a sleeping human house to fetch Queen Crow's shopping list while dodging Sir Crumbs, the house cat. There are 8 levels. Level 1 is only "escape the room alive", and each later level adds one new idea.

**One-line pitch:** *Three snack smugglers, one giant house, one very fluffy guard. Talk, hide, and don't get jarred.*

**Design pillars** (every feature must serve at least one)

1. **Nobody can do it alone.** Each role has a weakness that a teammate covers. Rescue needs two people.
2. **Tiny animals, giant house.** A miniature diorama look: huge furniture, warm lamp pools, cold moonlight.
3. **Tension you can read.** You can always see the cat's vision cone and hear its collar bell. Getting caught is funny, not cruel.
4. **Talk to win.** Voice chat plus quick pings. Levels are built so that one player must call out timing to another.
5. **Handmade, not generated.** Paper-and-marker UI, wobbly outlines, silly blip voices, real jokes.

**Core loop for one level**

1. **Briefing** (up to 20 s): the camera shows the whole room from above, the Crow's list item glows, and players ping a plan. Everyone presses Ready to skip.
2. **Sneak**: move, hide, use role abilities, avoid the cat.
3. **Grab**: pick up the level's list item (Level 1 has none).
4. **Get out**: carry the item to the exit with at least 2 players.
5. **Results**: stars stamped onto a receipt, a Crow one-liner, then the host picks Next.

**Win and lose rules**

- **Win**: the item is carried into the exit zone, and either all 3 players are in the zone (level ends at once), or at least 2 are in the zone and they all hold **F** for 1.5 s ("Call it a night"). That leaves the third player behind.
- **Lose**: 2 players are jarred at the same moment. A rescue is now impossible, so the "Caught!" card shows and the level restarts. There are no lives.
- **Rescue**: a jarred player is freed when the other two both hold **F** next to the jar for 2.5 s.

**Stars per level**

| Stars | Condition |
| --- | --- |
| 1 | Level cleared |
| 2 | Cleared with all 3 players in the exit |
| 3 | All 3 in the exit, and nobody was jarred during the level |

**Format:** exactly 3 players online, desktop browser (Chrome, Edge or Firefox), keyboard and mouse. Dev mode lets one person control all three. A level takes 3–6 minutes, and a full run takes about 40 minutes.

## 2. Characters, roles and controls

Every role has two strengths and one weakness, and each weakness is fixed by a different teammate: Kiwi needs Mochi's food, Mochi needs Pip's reach, and Pip needs Kiwi's cover. All three move at the same speed, so no role is "the fast one".

|  | Kiwi (chameleon) | Mochi (hamster) | Pip (raccoon) |
| --- | --- | --- | --- |
| Personality | Anxious, polite, over-prepared. Turns grey when scared (cosmetic). | Chaotic, fearless, always thinking about snacks. Talks fast. | Cocky "professional". Secretly soft. Owes the Queen one bottle cap. |
| Strength 1 | **Blend**: eat food to change colour; invisible when still on a matching surface | **Vents and latches**: crawls through vents; unlatches doors from the inside | **Pick locks**: opens locked doors (noisy clicks) |
| Strength 2 | **Cover** (hold Q): makes the nearest teammate quieter and hidden | **Chew wires**: lights out for 25 s | **Lift**: carries heavy loot; boosts a teammate onto a ledge |
| Weakness | Colour fades after 20 s | Too small to reach ledges or carry list items | Loud footsteps while carrying heavy loot |
| Fixed by | Mochi brings food in cheek pouches | Pip boosts and carries | Kiwi covers |
| Colour | Leaf green `#7cc26b` | Cream `#f2d1a0`, pink nose | Grey `#8a8f99`, black mask |

### Kiwi — the chameleon

- **Blend (passive).** Press E on a food item to eat it. Kiwi's body colour becomes the food's colour for 20 s, then flashes for the last 3 s and returns to leaf green. Food: strawberry = red, cheese = yellow, blueberry = blue. Leaf green already matches green rugs, with no food needed.
- **Blend rules.** Standing still for 0.3 s on a surface of the same colour makes Kiwi invisible to the cat. Sneaking across a matching surface multiplies the cat's detection rate by 0.25. Walking normally breaks the blend.
- **Cover (hold Q).** The nearest teammate within 1.2 tiles is covered. A covered teammate's noise is multiplied by 0.4, and if both stand still they count as hidden. Kiwi moves at sneak speed while covering. Kiwi covers one teammate at a time.
- Kiwi can carry small list items. A blended Kiwi tints the item she carries too ("It's also blue now. Don't ask.").

### Mochi — the hamster

- **Vents.** Press E on a vent to crawl to its paired vent in 1.2 s. Inside a vent Mochi is invisible and silent.
- **Latches.** Press E on a latch to open its door from the inside: silent, 1 s.
- **Chew wire.** Hold E on a wire for 2 s to cause lights out for 25 s. Each wire works once per level.
- **Cheek pouch.** Mochi picks up food silently and holds up to 3. Press E on Kiwi to hand her one, and she eats it at once.
- **Weakness.** Mochi can't pick up list items or heavy items and can't reach ledges. If Pip boosts Mochi onto a ledge, Mochi can only push the item off. It falls with a loud crash (noise radius 5).

### Pip — the raccoon

- **Pick lock.** Hold E on a locked door for 4 s. Every 0.8 s it makes a click (noise radius 5). Letting go keeps the progress for 2 s, then it drains at 10% per second.
- **Lift.** Press E on a heavy item to carry it. Press E again to put it down gently (silent), or get caught and drop it with a crash.
- **Boost.** Pip and a teammate stand next to a ledge and both hold F for 2 s. The teammate pops up onto the ledge. Kiwi on a ledge picks up the item quietly and hops down with it. Mochi on a ledge pushes it off.
- **Weakness.** While carrying heavy loot, Pip's footsteps have noise radius 4 (6 with the Golden Croissant) and he moves slower.

### What everyone can do

Move, sneak, hide under furniture, pick up and drop small list items (not Mochi), rescue a jarred teammate, call it a night, ping, and talk.

### Controls

| Key | Action |
| --- | --- |
| W A S D or arrows | Move, relative to the camera. The character faces where it moves. |
| Shift (hold) | Sneak: half speed, much quieter |
| E | Interact with whatever the prompt shows: pick up, drop, eat, give food, vent, latch, chew, pick lock, lift, ride the Roomba, hop down |
| Q (hold) | Cover (Kiwi only) |
| F (hold) | Team action: rescue, boost, call it a night |
| 1 2 3 4 | Ping at the mouse cursor: 1 "Go here", 2 "Cat!", 3 "Wait", 4 "Help" |
| V (hold) | Push-to-talk |
| M | Mute or unmute your mic |
| Tab (hold) | Show the shopping list and team status |
| Esc | Menu (the game keeps running online) |
| F1 | Debug overlay (dev mode only) |
| Backquote \` | Switch which character you control (dev mode only) |

**Interaction prompt.** A hand-lettered label floats over the nearest target, for example "E — Pick lock". If your role can't do it, the label is greyed out with the right role's face and the text "Pip can do this".

**Movement speeds** (tiles per second): walk 3.6, sneak 1.8, carrying heavy 2.4 (sneaking 1.4), carrying the Golden Croissant 1.6 (sneaking 1.2), Kiwi while covering 1.8.

## 3. Story and full script

Queen Corvina, a crow who hoards shiny things, sends three snack smugglers into the Big House to fetch her shopping list, item by item, ending with the Golden Croissant. Sir Crumbs the cat never speaks; he only shows hand-drawn thought bubbles.

**Writing rules** (keep these if you add lines):

- Most lines are 12 words or fewer. No line needs more than 2 speech bubbles.
- The joke comes from the character, not from internet references or memes.
- Friendly teasing, never mean. Fine for all ages.
- Store every line as data in `client/src/content/script.ts`, as `{ id, who, text, emote? }`, so the blip voice (Section 12) can read it.

### Cast

| Character | Who they are | Voice blips |
| --- | --- | --- |
| Queen Corvina | Crow queen on a tin-can throne, wears a bottle-cap crown. Dramatic, vain, secretly fond of the team. | Low-mid, slow, regal; a short "caw" on exclamations |
| Kiwi | Chameleon | Mid pitch, slight wobble |
| Mochi | Hamster | High, fast, bouncy |
| Pip | Raccoon | Low, gravelly, laid back |
| Sir Crumbs | Huge fluffy orange tabby with a bell collar. Smug. | No speech. Purrs, meows, the bell |

### Opening cutscene: "The Royal Errand" (about 90 s)

Plays once after the lobby, before Level 1. It can be skipped when all players hold Space for 1 s. Setting: a rooftop at midnight, string lights, a throne of tin cans, the Big House in the background.

1. *Wide shot, slow push in on the throne. Wind, distant crickets. A tiny kazoo fanfare.*
2. **CROW:** "Ahem. AHEM."
3. **CROW:** "Kneel before Her Most Shiny Majesty, Queen Corvina, Keeper of Ninety-Nine Bottle Caps!"
4. **PIP:** "Ninety-eight. I still owe you one."
5. **CROW:** "...Ninety-eight and a HALF. Silence."
6. *Freeze-frame name cards, hand-lettered, one per smuggler: "KIWI — Professional Worrier", "MOCHI — Will Eat That", "PIP — 'Professional'".*
7. **CROW:** "Smugglers. Tonight the Big House sleeps. The humans snore. The pantry is FULL."
8. **CROW:** "And I... am peckish."
9. *The list unrolls like a receipt: off the throne, across the roof, over the edge. 3 s of paper sound, then a tiny "plip" far below.*
10. **KIWI:** "That's a very long list."
11. **CROW:** "It's a CURATED list."
12. **MOCHI:** "Is 'snacks for Mochi' on there?"
13. **CROW:** "No."
14. *Mochi scribbles on the list with a crayon stub.* **MOCHI:** "...Now it is."
15. *Camera swings to the house. Car headlights sweep a window and reveal the silhouette of an enormous fluffy cat. Bell jingle, low purr. The music drops to one low note.*
16. **CROW:** "Be warned. The house has a guard. Sir Crumbs."
17. **CROW:** "He has never lost a mouse."
18. *Kiwi turns grey.* **KIWI:** "I'm a chameleon."
19. **CROW:** "He has never lost a chameleon either. Probably."
20. **PIP:** "Relax. I'm a professional." *(reads the list)* "Item one: 'Get in. Don't get eaten.' Easy."
21. **CROW:** "And above all... bring me... THE GOLDEN CROISSANT."
22. **MOCHI:** "Which item is that?"
23. **CROW:** "Item eight. READ the list."
24. **CROW:** "Now go! And if you get caught... I have never met you."
25. *The three slide down a drainpipe: Pip smoothly, Mochi tumbling, Kiwi clinging. Hand-drawn title card: "SnikiSnak — Midnight Sneaky Snack".*

### The Royal Shopping List

Shown as a long paper receipt on Tab and on the level-select screen. Finished items get crossed out with an animated marker stroke.

```
THE ROYAL SHOPPING LIST
(by order of Her Most Shiny Majesty)

1. Get in. Don't get eaten.
2. One silver thimble (for my crown collection)
3. A jar of honey. The BIG one.
4. The golden pen nib from the study
5. The blue button. Only the blue one.
6. One sparkly sock. Just one. Socks come in ones.
7. The music-box key (under the bed, probably)
8. THE GOLDEN CROISSANT
9. snacks for mochi        <- wobbly crayon handwriting
```

### Level intros (tin-can telephone)

Before each briefing, the Crow calls through a tin-can telephone. Show a small portrait of the Crow inside a can, then the replies. After the lines, show that level's tutorial cards one at a time (Section 6 and Section 7).

| Level | Lines |
| --- | --- |
| 1 Mudroom | CROW: "Item one. Get in, don't get eaten. Sir Crumbs naps by the boots." PIP: "Easy. Cats sleep, like, twenty hours a day." KIWI: "So he's awake for four of them. Which four?" |
| 2 Hallway | CROW: "A silver thimble, on the sewing basket. Sir Crumbs walks this hallway at night." MOCHI: "Fast or slow?" CROW: "Smugly." |
| 3 Pantry | CROW: "Honey. The big jar with the bee on it." PIP: "Heavy loot. My specialty." KIWI: "Your specialty is being loud." PIP: "While carrying heavy loot. Yes." |
| 4 Study | CROW: "The golden pen nib. The study is locked. Humans lock what they love." MOCHI: "I love snacks and I never lock them." CROW: "That's why you never have any." |
| 5 Living Room | CROW: "The blue button fell on the blue rug, right in front of Sir Crumbs's cushion." KIWI: "Right in front of him?" CROW: "He's watching TV. The TV is off. He's watching the dark." |
| 6 Laundry | CROW: "One sparkly sock, on top of the dryer, under the big lamp." PIP: "The lamp's a problem." MOCHI: *(crunch)* "What lamp?" |
| 7 Bedroom | CROW: "The music-box key is under the bed. Also, Sir Crumbs is awake. And annoyed." KIWI: "Annoyed at what?" CROW: "You. Soon." MOCHI: "Is that a robot? Can I ride the robot?" |
| 8 Kitchen | CROW: "This is it. The Golden Croissant, in the breadbox. Two buttons open it." PIP: "And then I carry it?" CROW: "Gently. Lovingly. Like it's a croissant." KIWI: "It IS a croissant." CROW: "Then you understand." |

### In-game barks

A bark is a short speech bubble over a character's head, shown for 2.2 s with blip voice. The server picks a random variant and broadcasts it. Limits: one bark per character every 4 s, and at most one bark anywhere every 1.5 s.

| Event | Kiwi | Mochi | Pip |
| --- | --- | --- | --- |
| Spotted ("!" on you) | "He sees me. He SEES me." / "I'm a lamp. Just a lamp." | "Cute AND scary!" / "Run now, snack later!" | "Okay. Plan B." / "This is fine. Professionally." |
| Jarred | "I'm in a jar. Again." | "It's roomy in here!" | "I meant to do that." |
| Teammate jarred | "Hold on, we're coming!" | "I'll save you! Who's helping me save you?" | "Nobody panic. I'm panicking a little." |
| Rescued | "Thank you thank you thank you." | "Freedom! Snacks?" | "Took you long enough. ...Thanks." |
| Anyone grabs the item | "Got it. Can we go home now?" | "I can't carry it, but I believe in it." | "Smooth. Like butter." |
| Lights out | "It's dark. I don't like dark." | "Crunch. Oops. You're welcome." | "Now we're talking." |
| Hiding | "I am a shoe. I am a shoe." | "Hidey hole!" | "Blending in. Kind of." |
| Squeaky board | "Sorry! Sorry, floor." | "Was that me? That was me." | "That board had it coming." |
| Cat gives up | "Is he gone? He's gone. Is he?" | "Bye, kitty!" | "Lost him." |
| Calling it a night without someone | "I'm so sorry, I'll bring you a raisin." | "I'm leaving you my imaginary snacks." | "We'll come back for you. Probably tomorrow." |
| Idle 20 s | "Does anyone else hear the fridge humming?" | "Are we there yet?" | "I could do this in my sleep. Not literally." |

**Ability barks:** Kiwi blended: "Just a rug. Nothing to see." / "I'm blue now. Emotionally too." Pip starts a lock: "Click... click... come on, sweetheart." Mochi enters a vent: "Into the tube!" / "Smells like dust and adventure." Mochi rides the Roomba: "WHEEE—" *(whispers)* "wheee."

**Wrong-role barks** (when E is pressed on something your role can't use):

| Who | Target | Line |
| --- | --- | --- |
| Mochi | List item or heavy item | "Too big. My arms are decorative." |
| Mochi | Locked door | "I tried licking it. Didn't work." |
| Kiwi | Locked door | "I don't do locks. I do worrying." |
| Kiwi | Heavy item | "I can lift exactly zero of that." |
| Kiwi | Vent | "Vents are for hamsters and regret." |
| Pip | Vent | "My shoulders say no." |
| Pip | Wire | "I'm not chewing that. I have standards." |

### Sir Crumbs's thought bubbles

Show one when the cat changes state (at most one every 3 s), with a matching purr, chirp or meow.

| Cat state | Bubble text |
| --- | --- |
| Sleeping | "zzz" / rarely "...tuna..." |
| Stirring | "hm?" |
| Investigating | "what was that" / "a snack?" |
| Spotted | "!!" |
| Chasing | "mine mine mine" |
| Searching | "i know you're here" |
| Giving up | "...probably nothing" / "eh. nap." |
| Caught someone | "for the collection." |
| Lights out | "who turned off the moon" |
| Roomba bump (Level 7) | "THE ENEMY" |
| Croissant lifted (Level 8) | "...do i smell BUTTER" |

### Results lines (Crow)

- 3 stars: "Flawless. I'm adding you to my collection. Of favourites."
- 2 stars: "Everyone home! Mostly in one piece."
- 1 star: "You left one behind? Bold. Fetch them later."
- Caught: "Two in jars? I have never met you."

### Ending cutscene: "The Croissant Ceremony" (about 60 s)

1. *The rooftop at dawn, pink sky. The three drag the Golden Croissant up the drainpipe.*
2. **CROW:** "The Golden Croissant... it's... warm."
3. **PIP:** "It got sat on a little."
4. **CROW:** "Silence. Perfection." *(takes a tiny bite; crumbs fall; music sting)*
5. **CROW:** "Now. Item nine." *(squints)* "'snacks for mochi'?"
6. *Mochi looks innocent. Long pause.*
7. **CROW:** "...Fine. Royal decree. Snacks for EVERYONE."
8. *Cheers. Kiwi cycles through every colour at once.*
9. *Cut to the kitchen. Sir Crumbs stares at the empty breadbox. Bubble: "...next time." Bell jingle.*
10. *Credits scroll on a long receipt. Mid-credits:* **PIP** *(handing over a bottle cap)*: "Ninety-nine. We're even." **CROW:** "...Ninety-nine and a half."

## 4. Core systems

The server runs every rule below at 20 ticks per second. All numbers live in `shared/src/tuning.ts` (the code block at the end of this section), and each level can override the cat's numbers. The client only draws what the server decides, plus its own player's movement.

### 4.1 World and grid

- Each level is an ASCII map (Section 5 has the legend). Tile `(x, y)` covers world X from x to x+1 and world Z from y to y+1. Tile centre = `(x + 0.5, y + 0.5)`. Y is up.
- Players are circles with radius 0.25. The cat is a circle with radius 0.45 (its model looks bigger).
- Solid for everyone: `#` wall, `B` big furniture, `^` ledge, `W` wire outlet, a closed `D` door, a closed `C` breadbox.
- `T` hide spots are walkable for players but not for the cat.
- Collision: move on X, resolve against solid tiles, then move on Z and resolve again (circle against tile box). The same function in `shared/` runs on client and server.

### 4.2 Noise

Every noise is an event `{ x, z, radius, loudness, kind }`. The server creates noise events from authoritative positions, so clients can't cheat. Each noise is broadcast so clients draw a hand-drawn ink ring that grows to the radius and fades in 0.6 s. Footstep rings with radius under 1 are not drawn.

| Source | Radius (tiles) | Loudness | Notes |
| --- | --- | --- | --- |
| Footstep, walking | 2.5 | 0.15 | Every 0.38 s while moving |
| Footstep, sneaking | 0.8 | 0.05 | Every 0.5 s |
| Footstep, Pip with heavy loot | 4.0 (2.5 sneaking) | 0.25 |  |
| Footstep, Pip with croissant | 6.0 (4.0 sneaking) | 0.35 |  |
| Squeaky board `~` (on entering it) | 7.0 (4.0 sneaking) | 0.8 |  |
| Lock-pick click | 5.0 | 0.3 | Every 0.8 s while picking |
| Item crash (dropped when caught, pushed off a ledge) | 5.0 | 0.8 |  |
| Jar breaks on rescue | 3.0 | 0.4 | Rescuing is a small risk |
| Jar wobble (jarred player presses E, 3 s cooldown) | 2.0 | 0.2 | A decoy |
| Wire chew starts | 3.0 | 0.2 |  |
| Roomba bump (Level 7) | 7.0 | 0.7 |  |

- Every noise a covered player makes (footsteps, squeaks, lock clicks) has its radius and loudness multiplied by 0.4.
- **Hearing.** The cat hears a noise if its distance d is at most `radius × hearingMult`. If a wall tile (#) lies on the straight line between them, the radius is halved. Doors and furniture don't muffle sound. Alert gain = `loudness × (1 − d / effectiveRadius)`.

### 4.3 Being hidden

A player is **hidden** (the cat can't see them at all) when any of these is true:

1. Inside a `T` tile and either sneaking or standing still.
2. Kiwi, standing still for 0.3 s on a surface matching her current colour.
3. Covered by Kiwi, with both standing still.
4. Inside a vent, or on a ledge.

**Entering a hide spot in front of the cat.** If the cat's detection of you is 0.35 or more as you enter a `T` tile, the cat remembers it. In Levels 1–6 it walks over, paws at the spot for 2 s ("pat pat" sound) and leaves: hide spots are safe. In Levels 7–8 it swipes, and catches you if you are still within 1.5 tiles of the edge it is standing at.

### 4.4 Cat vision and detection

- **Vision cone:** a field-of-view angle and range set per level. Line of sight uses a grid raycast (DDA). Walls, furniture, ledges, wires, closed doors and the closed breadbox block it; `T` tiles don't.
- **Light.** Tiles inside a lit lamp pool count as bright. Tiles outside every pool count as dark. During lights out, everything is dark and the range drops to `darkRange`.
- **Detection meter**, one per player, from 0 to 1. While the player is visible and not hidden it rises each second by:

```
rate = 1.6 * (1 - 0.7 * distance / range)
     * (sneaking ? 0.5 : 1) * (standing still ? 0.6 : 1)
     * (bright ? 1.5 : dark ? 0.6 : 1)
     * (heavy loot ? 1.3 : croissant ? 1.6 : 1)
     * (Kiwi sneaking on a matching colour ? 0.25 : 1)
```

- When not visible, the meter drains at 0.35 per second.
- At 0.35 a "?" appears over the cat, and it turns and investigates that player's position. At 1.0 a "!" appears and it chases. Bumping into the cat (closer than 0.9 tiles) starts a chase at once.
- The vision cone is always drawn on the floor so players can read it. It is pale yellow when the cat is calm, orange while any detection meter is above 0.35, and red when chasing.

### 4.5 Cat behaviour (state machine)

Each level sets a **base mode**: `sleep`, `patrol` or `perch`. All movement uses A\* on the tile grid with 8 directions; the cat cannot enter `T` tiles, vents, or closed doors.

&#91;embedded content: cat behaviour · 4 moods, 10 states\]

The cone colour tells players which mood the cat is in; the table below gives every state's exact rule.

| State | What the cat does | Leaves this state when |
| --- | --- | --- |
| SLEEP | Curled up, eyes shut, no vision. Noise alert gain is multiplied by 0.6. Alert drains 0.05/s. | Alert ≥ `wakeAt` → STIR |
| STIR (2 s) | Sits up, ears up, turns toward the last noise. Vision on at 0.6× range. | After 2 s: alert ≥ 0.7 → INVESTIGATE; otherwise back to its base mode |
| PATROL | Walks the waypoint loop 1→2→3…→1 at walk speed. Pauses 1.5 s at each waypoint, looking left and right. | Alert ≥ 0.4 or a "?" → INVESTIGATE; "!" → CHASE |
| PERCH | Sits at its start tile. Its head sweeps ±60° on a 6 s cycle. | Alert ≥ 0.4 or "?" → INVESTIGATE; "!" → CHASE |
| INVESTIGATE | Walks to the noise or sighting point at 1.2× walk speed, then turns slowly in a full circle for 3 s. | Done → RETURN; "!" → CHASE |
| CHASE | Runs at chase speed toward the target's current position. Re-plans the path every 0.25 s. | Line of sight lost for 1.5 s → SEARCH; chasing longer than `giveUpAfter` → GIVE\_UP; within 0.6 tiles for 0.2 s → POUNCE |
| POUNCE | Crouches and wiggles for 0.35 s (the dodge window), then leaps 1.2 tiles forward. | Target within 0.9 tiles on landing → CATCH; otherwise → CHASE |
| CATCH | Puts a jar over the target where it stood. Sits and admires it for 2.5 s. Can't catch anyone for 4 s afterwards. | → RETURN |
| SEARCH | Walks to the last known position and looks around for 4 s. In Levels 7–8 it also swipes into the 2 nearest hide-spot groups. | → RETURN; "!" → CHASE |
| GIVE\_UP | Sits for 1.5 s with a thought bubble. | → RETURN |
| RETURN | Walks back to the nearest waypoint, its perch, or its bed. Alert is set to 0.3. | Arrived → base mode |
| HUNT (Level 8 only) | After the croissant is lifted: every 4 s it paths toward the carrier's position plus a random offset of up to 2 tiles ("do i smell BUTTER"). | "!" → CHASE; after a chase or search it goes back to HUNT, never to patrol |

The cat ignores jarred players and players on ledges. Alert drains 0.08 per second in every awake state. Every level starts with a 5 s grace period: the cat grooms itself, with no vision and no hearing, so players can leave the spawn.

### 4.6 Jars and rescue

- **Caught:** the player becomes jarred where they stood. If that spot is inside a `T` tile, the jar moves to the nearest walkable tile outside it. A carried item drops next to the jar.
- **While jarred:** you can't move. You can look around, talk (your voice sounds muffled, Section 10), ping, and press E to wobble the jar.
- **Rescue:** the two free players stand within 1.3 tiles of the jar and both hold F. Progress fills over 2.5 s while both hold. With only one holding, it doesn't fill and shows "Need one more friend!". With nobody holding, it drains at 0.5 per second.
- When progress completes, the jar pops with a glass tinkle (noise radius 3). The freed player can't be caught for 2 s.
- **Lose:** as soon as 2 players are jarred, wait 1.5 s (so the moment reads), then show the "Caught!" card. The host restarts the level.

### 4.7 Items

| Kind | Map symbol | Who can carry | Effect while carried |
| --- | --- | --- | --- |
| Small list item | `$` (on floor), `^` (on a ledge) | Kiwi, Pip | Shown on the carrier's back. No extra noise. |
| Heavy item | `H` | Pip | Slower, noisy footsteps, 1.3× detection |
| Golden Croissant | `C` (inside the breadbox) | Pip | Slowest, very noisy, 1.6× detection, starts the HUNT state |
| Food | `r` `y` `b` | Mochi (pouch, up to 3); Kiwi eats it on the spot | Respawns 25 s after it is taken |

- Press E to pick up or put down gently (silent). Mochi pressing E on a list item gets a wrong-role bark.
- The item counts as delivered while its position, carried or on the floor, is inside the exit zone.

### 4.8 Doors, vents, wires, ledges, plates, Roomba

- **Doors:** neighbouring `D` tiles form one door. A latch `l` opens the door next to it. An open door is walkable and doesn't block vision. Doors stay open.
- **Vents:** `V` tiles pair up in reading order (left to right, top to bottom): 1st with 2nd, 3rd with 4th.
- **Lights out:** a global timer. Lamps turn off, the cat's range becomes `darkRange`, and its hearing is multiplied by 1.5. Characters' eyes glow faintly, and the cat's eyes glow yellow so players can still find it. At the end the lamps flicker back on over 1 s.
- **Ledges:** a `^` tile holds the item. Pip stands on a walkable tile next to it, a teammate stands within 1.2 tiles of Pip, and both hold F for 2 s. Kiwi on the ledge takes the item quietly; Mochi pushes it off (it lands on Pip's tile with a crash). Press E to hop down.
- **Pressure plates** (Level 8): a plate `P` is pressed while a free player stands on it. When every plate is pressed within the same 1.0 s, the breadbox opens for good. Its `C` tiles become floor, and the croissant appears in the middle.
- **Roomba** (Level 7): starts on `O`. It drives straight at 1.2 tiles/s. When it hits something solid, a hide spot or a player, it bumps (noise radius 7), turns a random 90–180° and carries on. It shoves a player it touches 0.8 tiles away. Press E next to it to ride it: your footsteps are silent, you can't steer, and you press E to hop off.

### 4.9 Exit, stars and tutorial cards

- **Exit zone:** the `E` tiles plus every walkable tile within 1.5 tiles of an `E` tile.
- **Finishing:** when the item rule is met and all 3 free players are in the zone, finish after 0.5 s. When 2 are in the zone, show "Hold F — Call it a night"; both must hold F for 1.5 s.
- **Stars:** see Section 1. The server tracks `anyoneJarredThisLevel`.
- **Tutorial cards:** a small taped paper card in the top-left corner. It appears during the level intro and again the first time its situation happens (for example the first squeak). It hides after 6 s or on Enter. Seen cards are saved in `localStorage` and not shown again unless the player resets them in Settings.

### 4.10 `shared/src/tuning.ts`

```ts
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
} as const;
```

## 5. Level progression and map legend

The cat is in every level, and each level teaches exactly one new idea on top of the last. Level 1 is only "get out alive" (as the professor asked), and Level 8 combines everything into a co-op puzzle.

| Level | Room | List item | New idea | Cat | Who matters most |
| --- | --- | --- | --- | --- | --- |
| 1 | The Mudroom | none: escape | Move, sneak, noise, squeaky boards, hide spots | Sleeping in the middle | Everyone equally |
| 2 | The Hallway | Silver thimble | Patrolling cat with a vision cone; carrying an item; jar rescue | Patrols a loop | Everyone equally |
| 3 | The Pantry | Honey jar (heavy) | Pip lifts heavy loot (noisy); Kiwi covers him | Patrols a loop | Pip + Kiwi |
| 4 | The Study | Golden pen nib | Locked door: Pip picks it (loud) or Mochi vents and unlatches it (quiet) | Patrols the locked side | Pip or Mochi |
| 5 | The Living Room | Blue button | Kiwi blends on coloured rugs; Mochi fetches blueberries through a vent | Perched, sweeping its gaze | Kiwi + Mochi, Pip picks the exit lock |
| 6 | The Laundry Room | Sparkly sock (on a ledge) | Mochi chews wires for lights out; Pip boosts a teammate onto a ledge | Patrols under a bright lamp | All three in sequence |
| 7 | The Bedroom | Music-box key (under the bed) | The Roomba; the cat now checks hide spots | Patrols, faster | Everyone; ride the Roomba |
| 8 | The Kitchen | THE GOLDEN CROISSANT | Pressure plates; a 3-stage co-op puzzle; the cat hunts the croissant | Patrols, then hunts | All three, constantly |

### Cat settings per level

These go in each level's data file as `cat: { … }` and override `TUNING`.

| Level | Base mode | Walk (tiles/s) | Chase (tiles/s) | View range lit / dark (tiles) | Field of view | Hearing × | Gives up after (s) | Wakes at alert | Checks hide spots |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | sleep | 1.6 | 3.8 | 5 / 2.5 | 100° | 1.0 | 4 | 0.35 | no |
| 2 | patrol | 1.8 | 4.0 | 6 / 2.5 | 90° | 1.0 | 5 | — | no |
| 3 | patrol | 1.8 | 4.0 | 6 / 2.5 | 90° | 1.0 | 5 | — | no |
| 4 | patrol | 2.0 | 4.0 | 6 / 2.5 | 90° | 1.0 | 5 | — | no |
| 5 | perch | 2.0 | 4.0 | 7 / 2.5 | 70° | 1.0 | 5 | — | no |
| 6 | patrol | 2.0 | 4.2 | 6 / 2.5 | 90° | 1.0 | 6 | — | no |
| 7 | patrol | 2.2 | 4.4 | 6.5 / 2.5 | 90° | 1.2 | 6 | — | yes |
| 8 | patrol, then hunt | 2.2 | 4.4 | 6.5 / 2.5 | 90° | 1.2 | 7 | — | yes |

### Map legend

Every map is a rectangle of characters, one character per tile. Row 0 is the top (north) and column 0 is the left (west).

| Symbol | Meaning | Players walk | Cat walks | Blocks vision |
| --- | --- | --- | --- | --- |
| `#` | Wall | no | no | yes |
| `.` | Floor | yes | yes | no |
| `S` | Player spawn (exactly 3) | yes | yes | no |
| `E` | Exit gap on the outer wall (cat flap, gap under a door) | yes | no | no |
| `Z` | Cat start (exactly 1). In sleep mode it is the cat's bed; in perch mode its perch. | yes | yes | no |
| `1`–`9` | Cat patrol waypoints, visited in number order, then back to 1 | yes | yes | no |
| `B` | Big furniture: couch, cabinet, bed frame, boxes | no | no | yes |
| `T` | Hide spot you can crawl under: table, bench, shoe rack, under the bed | yes | no | no |
| `~` | Squeaky floorboard | yes | yes | no |
| `^` | Ledge on top of furniture, holding the list item | no | no | yes |
| `D` | Locked door (neighbouring `D` tiles are one door) | when open | when open | when closed |
| `l` | Latch for the neighbouring door (Mochi) | yes | yes | no |
| `V` | Vent opening (Mochi); paired in reading order | yes | yes | no |
| `W` | Wire and wall outlet (Mochi chews) | no | no | yes |
| `$` | Small list item on the floor | yes | yes | no |
| `H` | Heavy list item (Pip lifts) | yes | yes | no |
| `C` | Breadbox holding the Golden Croissant (2×2) | when open | when open | when closed |
| `P` | Pressure plate | yes | yes | no |
| `R` `Y` `U` `N` | Rug: red, yellow, blue, green | yes | yes | no |
| `r` `y` `b` | Food: strawberry (red), cheese (yellow), blueberry (blue) | yes | yes | no |
| `O` | Roomba dock | yes | yes | no |

**Map checks.** All 8 maps below have been run through a validator. Port it as a unit test in `shared/test/levels.test.ts`, and fail the build if a map breaks it:

1. Every row has the same width.
2. Exactly 3 `S` and exactly 1 `Z`; an even number of `V`.
3. The outer border is only `#` and `E`, and every `E` is on the border.
4. With doors open and vents usable, every spawn can reach an exit, and every `$ H ^ P W C l` is reachable or next to a reachable tile.
5. The cat can reach every waypoint from `Z`.
6. Gating works as intended: in Levels 4 and 8 the far room can only be reached through the door or the vent, and in Level 5 the blueberry closet only through the vent.

## 6. Levels 1–4

Levels 1–4 must be finished for the LAN Party on Nov 27. Each level below gives the map (copy it exactly into its level file), what each furniture block is, the lights, the cat's route, the intended solution and the tutorial cards. Positions are written as (column, row).

### Level 1 — The Mudroom (20×11)

**Goal:** get all three out through the cat flap alive. No item. **New:** move, sneak, noise, squeaky boards, hide spots.

```
####################
#S...BB......TTT...#
#....BB......TTT...#
#S..~~..........~..#
#...~~.....B....~~.E
#.........Z.......~E
#S..~~.....B....~~.#
#...~~..........~..#
#....BB...TT.......#
#....BB...TT....BB.#
####################
```

- **Furniture:** boot pile (5–6, 1–2); shoe bench you can hide under (13–15, 1–2); the two sides of Sir Crumbs's basket (11, 4) and (11, 6) with the cat asleep between them at (10, 5); laundry basket (5–6, 8–9); low stool to hide under (10–11, 8–9); watering can (16–17, 9).
- **Exit:** cat flap in the back door at (19, 4–5).
- **Lights:** a warm night-light by the basket, radius 2.5 tiles (the cat area is bright); cool moonlight from a window above the shoe bench, centred (14, 3), radius 3. The exit corner is dark.
- **Cat:** asleep at (10, 5). It wakes at alert 0.35. Its tail swishes and it snores softly so players notice it at once.
- **Intended route:** take the top row past the shoe bench, then come down column 18, (18, 3) → (18, 4) → (19, 4), stepping around the ring of squeaky boards by the exit. The bottom route works too. Careless walking next to the basket, or a run of squeaks, wakes him.
- **Tutorial cards:** "WASD to move. Hold Shift to sneak: slower, much quieter." / "Cracked boards squeak. Step around them." / "Crawl under furniture to hide." / "Get all three of you to the cat flap." First time the cat stirs: "He's stirring! Freeze, or hide." First jar: "Jarred! The other two hold F next to the jar."

### Level 2 — The Hallway (22×14)

**Goal:** bring the silver thimble to the exit. **New:** a patrolling cat with a vision cone, carrying an item, jar rescue.

```
######################
#.....T......BB....$.#
#..........1.......2.#
#..........Z.........#
#..BBBBBBB..BBBBBBB..#
#..BBBBBBB..BBBBBBB.~#
#..BBBBBBB..BBBBBBB.~#
#.........T..........E
#.~~.......4.......3.E
#....................#
#S....BB....TT....BB.#
#S....BB....TT....BB.#
#S...................#
######################
```

- **Furniture:** two long sideboards (3–9 and 12–18, rows 4–6) that block the cat's view; umbrella stand to hide in (6, 1); sewing basket (13–14, 1) with the thimble beside it on the floor at (19, 1); hall chair to hide under (10, 7); bench to hide under (12–13, 10–11); shoe cabinet (6–7, 10–11); big plant pot (18–19, 10–11).
- **Exit:** gap under the front door at (21, 7–8).
- **Lights:** a warm lamp on the right sideboard, centred (19, 4), radius 2.5 (the thimble corner is bright); moonlight from a window at the left, centred (3, 8), radius 3.
- **Cat:** starts at (11, 3) and patrols 1 (11, 2) → 2 (19, 2) → 3 (19, 8) → 4 (11, 8) → 1, a loop around the right sideboard. The left half of the room is safe ground for learning how the cone moves.
- **Intended route:** watch from the left until the cat heads down the right side, cross the top corridor and grab the thimble while it walks the bottom. Then wait for it to go up the middle gap, and slip down column 19 to the exit. Column 20 has squeaky boards at rows 5–6.
- **Tutorial cards:** "The yellow cone is what Sir Crumbs sees. Orange means suspicious." / "Press E on the thimble to pick it up." / "Caught? The other two hold F at the jar together." / "Someone has to carry the thimble out."

### Level 3 — The Pantry (24×14)

**Goal:** carry the big honey jar to the exit. **New:** Pip lifts heavy loot and gets loud; Kiwi covers him.

```
########################
#S.....BBBBBB.......H..#
#S...1.........BB....2.#
#S.............BB......#
#..TT....BBBBBBBB...~~.#
#..TT....BBBBBBBB...~~.#
#........BBBBBBBB......#
#.~~.....BBBBBBBB....T.#
#.~~.................T.#
#.....4..........Z..3..#
#..BB..................#
#..BB.....TTT.........BE
#.........TTT..........E
########################
```

- **Furniture:** low jar shelf along the wall (7–12, 1); flour sack (15–16, 2–3); the big shelving island (9–16, 4–7); step stool to hide under (3–4, 4–5); crate to hide under (21, 7–8); small table to hide under (10–12, 11–12); potato sack (3–4, 10–11); mop bucket (22, 11). The honey jar is at (20, 1).
- **Exit:** mouse hole in the skirting board at (23, 11–12).
- **Lights:** a warm bare bulb over the honey corner, centred (20, 2), radius 3 (bright); moonlight from a small window, centred (11, 12), radius 2.5.
- **Cat:** starts at (17, 9) and patrols 1 (5, 2) → 2 (21, 2) → 3 (20, 9) → 4 (6, 9) → 1, a big loop around the island that passes the honey and the exit.
- **Intended route:** Mochi is the lookout and calls the timing. Kiwi and Pip reach the honey while the cat is on the far side. Pip lifts it, Kiwi holds Q beside him, and they sneak down column 22 together (the squeaky boards are at 20–21, rows 4–5). At row 10 they step left around the bucket to (21, 12) and out. **Pro tip:** Mochi can step on the squeaky boards at (2–3, 7–8) on purpose to pull the cat to the left side.
- **Tutorial cards:** "Only Pip can lift the honey. Heavy loot means loud footsteps." / "Kiwi: hold Q next to Pip to cover him. He gets much quieter." / "Noise somewhere else pulls the cat away."

### Level 4 — The Study (26×14)

**Goal:** get the golden pen nib from the locked study and leave through the study's exit. **New:** a locked door with two solutions: Pip picks the lock (loud), or Mochi crawls through the vent and opens the latch from inside (quiet).

```
##########################
#S....BB....#..1.......2.#
#S....BB....#............#
#S..........#.....$......#
#..T........#..BB....~~..#
#..T....V...#..BB....~~..#
#...........Dl......T....#
#..BB.......#.......T....E
#..BB....~~.#..V.........E
#........~~.#..........3.#
#.TT........#...BB.......#
#.TT........#.4.BB.......#
#...........#.....Z......#
##########################
```

- **Left room (corridor side, no cat):** hat stand (6–7, 1–2); coat rack to hide in (3, 4–5); vent at (8, 5); filing boxes (3–4, 7–8); bench to hide under (2–3, 10–11).
- **Wall and door:** wall at column 12; the locked study door at (12, 6); the latch on the study side at (13, 6).
- **Study (right room):** desk (15–16, 4–5) with the pen nib dropped beside it at (18, 3); desk chair to hide under (20, 6–7); vent at (15, 8); armchair (16–17, 10–11).
- **Exit:** gap under the study's garden door at (25, 7–8).
- **Lights:** a warm desk lamp, centred (17, 3), radius 3 (the nib is bright); moonlight from the garden door, centred (23, 7), radius 3. The left room is dim.
- **Cat:** in the study. It starts at (18, 12) and patrols 1 (15, 1) → 2 (23, 1) → 3 (23, 9) → 4 (14, 11) → 1. The leg from 4 to 1 walks up past the latch and the door.
- **Quiet solution:** Mochi vents from (8, 5) to (15, 8), waits for the cat to pass on its way to waypoint 1, sneaks to (13, 6) and opens the latch (1 s). The door swings open.
- **Loud solution:** Pip picks the lock from (11, 6) (4 s, a click every 0.8 s). If the cat is walking up its 4→1 leg it hears the clicks. With Kiwi covering Pip, the clicks are much quieter.
- **Then:** someone who can carry (Kiwi or Pip) grabs the nib in the lamp light, and everyone meets at the garden door.
- **Tutorial cards:** "Locked! Pip can pick it: hold E. It clicks." / "Or Mochi takes the vent and opens the latch from the other side. Silent." / "Kiwi's cover muffles lock clicks too."

## 7. Levels 5–8

Levels 5–8 are for the final on Dec 8. They mix earlier ideas, and Level 8 needs every role at once. Same format as Section 6.

### Level 5 — The Living Room (26×15)

**Goal:** take the blue button from the middle of the blue rug, right under Sir Crumbs's nose. **New:** Kiwi blends on coloured rugs; Mochi fetches the right food through a vent.

```
##########################
#bb.#....BBBBBBBBBB......#
#.V.#....BBBBBBBBBB....T.#
####...........Z.......T.#
#T.......................#
#T...RRRR...UUUU...YYYY..#
#....RRRR...UUUU...YYYY.DE
#....RRRR...UU$U...YYYY.DE
#....RRRR...UUUU...YYYY..#
#........................#
#S...TT.....BB.....TT..y.#
#S...TT.....BB.....TT....#
#S..r.V..................#
#........................#
##########################
```

- **Closet:** a walled closet (1–3, 1–2) holds the blueberries at (1, 1) and (2, 1). The only way in is the vent at (2, 2), paired with the vent at (6, 12) by the spawn.
- **Furniture:** the long couch (9–18, 1–2); Sir Crumbs's perch on the cushion edge at (15, 3); side table to hide under (23, 2–3); magazine rack to hide in (1, 4–5); two coffee tables to hide under (5–6 and 19–20, rows 10–11); TV cabinet (12–13, 10–11).
- **Rugs:** red (5–8, 5–8), blue (12–15, 5–8) with the button at (14, 7), yellow (19–22, 5–8).
- **Food:** strawberry (4, 12), cheese (23, 10), blueberries in the closet.
- **Exit:** the porch pet door at (25, 6–7), hooked shut by the locked door at (24, 6–7).
- **Lights:** a warm floor lamp, centred (22, 3), radius 3 (bright); moonlight from the big window over the blue rug, centred (13, 7), radius 3.
- **Cat:** perched at (15, 3), facing south, sweeping ±60° every 6 s (range 7, field of view 70°). The blue rug is always within reach of the sweep; the red and yellow rugs are at its edges.
- **Intended solution:**
  1. Mochi vents into the closet, fills the pouch with blueberries and vents back.
  2. Mochi hands Kiwi a blueberry. Kiwi turns blue for 20 s.
  3. Kiwi moves onto the blue rug while the sweep points away and freezes when it swings back (still + matching = invisible). She picks up the button, which turns blue too.
  4. Off the rug she is visible again, so she times the sweep, or Mochi brings cheese so she can stop on the yellow rug on the way to the exit.
  5. Meanwhile Pip picks the hook on the pet door. It's out of the cat's range, but it takes time.
- **Tutorial cards:** "Kiwi: eat food to change colour. Stand still on the same colour and you're invisible." / "The blueberries are in the closet. Only Mochi fits through the vent." / "Mochi: press E on Kiwi to hand her food." / "The pet door is hooked shut. Pip can pick it."

### Level 6 — The Laundry Room (26×14)

**Goal:** get the sparkly sock from the top of the washing machine and leave. **New:** Mochi chews a wire for lights out; Pip boosts a teammate onto a ledge.

```
##########################
#S.......BBBB^BBBB.....W.#
#S.......................#
#S.......................#
#.......1...........2....#
#....TT.....~~.....TT....#
#....TT.....~~.....TT....#
#........................#
#..BBBB....Z.......BBBB..#
#..BBBB............BBBB..#
#....4.............3.....#
#..........NNNN.........TE
#.W........NNNN.........TE
##########################
```

- **Furniture:** dryer (9–12, 1), washing machine (14–17, 1), and between them a tall machine whose top is the ledge at (13, 1) with the sock on it. The boost spot is (13, 2). Laundry baskets to hide in (5–6 and 19–20, rows 5–6); squeaky boards (12–13, 5–6); sink cabinet (3–6, 8–9); detergent shelf (19–22, 8–9); green bath mat (11–14, 11–12), where Kiwi blends without food; hamper to hide under (24, 11–12).
- **Wires:** behind the washer (23, 1) and a lamp cord (2, 12).
- **Exit:** the gap around the dryer hose at (25, 11–12).
- **Lights:** a bright work lamp over the machines, centred (13, 2), radius 4; a small warm night-light, centred (3, 11), radius 2; moonlight from a high window, centred (20, 12), radius 2.5.
- **Cat:** starts at (11, 8) and patrols 1 (8, 4) → 2 (20, 4) → 3 (19, 10) → 4 (5, 10) → 1. Its top leg runs two tiles below the boost spot, inside the work lamp's light.
- **Intended solution:**
  1. Mochi sneaks to a wire and chews it: lights out for 25 s. The cat can barely see (range 2.5) but hears 1.5× better.
  2. In the dark, Pip and Kiwi reach (13, 2) and both hold F. Kiwi pops up, takes the sock quietly and hops down.
  3. Everyone sneaks to the exit. If it takes too long, Mochi still has the second wire.
  4. Funny alternative: Pip boosts Mochi, who pushes the sock off with a crash that brings the cat running.
- **Tutorial cards:** "Mochi: hold E on a wire for lights out. The cat can barely see, but hears better." / "Pip and a friend: both hold F at the machine to boost." / "Kiwi takes the sock quietly. Mochi... pushes it off."

### Level 7 — The Bedroom (26×15)

**Goal:** take the music-box key from under the bed. **New:** the Roomba; the cat is faster and now checks hide spots it saw you enter.

```
##########################
#........BBBBBBBB........#
#..TT....BTTTTTTB........#
#..TT....TTTTTTTT...~~...#
#........BTTT$TTB...~~...#
#....~~..BTTTTTTB........#
#....~~..BBBTTBBB........#
#..1.......Z.........2...#
#..~~.......~~.........TTE
#..~~.......~~...BB....TTE
#S...............BB...~~.#
#S...4....YYYY.......3~~.#
#S........YYYY...O.......#
#....y...................#
##########################
```

- **The bed:** a frame (9–16, 1–6) with a big dark space under it (the `T` tiles inside). You can crawl in from the left side (9, 3), the right side (16, 3) or the foot (12–13, 6). The key is in the middle at (13, 4).
- **Furniture:** armchair to hide under (2–3, 2–3); toy chest (17–18, 9–10); desk to hide under by the exit (23–24, 8–9); yellow rug (10–13, 11–12) with cheese at (5, 13) for Kiwi; Roomba dock at (17, 12).
- **Exit:** the gap under the bedroom door at (25, 8–9).
- **Lights:** a warm bedside lamp, centred (17, 2), radius 3 (bright); moonlight over the yellow rug, centred (11, 12), radius 3. Under the bed is dark.
- **Cat:** starts at (11, 7) and patrols 1 (3, 7) → 2 (21, 7) → 3 (21, 11) → 4 (5, 11) → 1. Row 7 runs right past the foot of the bed. When it searches, it swipes into the bed openings.
- **Roomba:** wanders from its dock (Section 4.8). In this level Sir Crumbs walks over to investigate every Roomba bump.
- **Intended solution:** watch the Roomba. When it bumps on the far side and the cat goes to glare at it, crawl under the bed from the side the cat isn't facing. Grab the key and leave by a different opening. Going under the bed while the cat watches is the mistake: it will swipe in. Ride the Roomba for a silent trip, but its own bumps still bring the cat.
- **Tutorial cards:** "The Roomba bumps loudly, and Sir Crumbs HATES it. Use that." / "Press E next to the Roomba to ride it. You're silent; it isn't." / "Careful: Sir Crumbs now checks hide spots he saw you enter."

### Level 8 — The Kitchen (28×16)

**Goal:** open the breadbox, carry the Golden Croissant back through the pantry and out of the window you came in by. **New:** pressure plates, a three-stage co-op puzzle, and a cat that hunts by smell.

```
############################
#S.....#.........UUUU.....W#
#S..T..#..1......UUPU......#
#S..T..#.........UUUU...2..#
#......Dl..................#
#..V...#.......BBBB.b......#
#......#.......BBBB........#
#..BB..#.......BBBB.....Z..#
#..BB..#.......BBBB........#
#......#...................#
#.TT...#..4.............3..#
E......#..V.......~~.......#
E......#..........~~...CC..#
#......#..P.....TT.....CC..#
#......#........TT.........#
############################
```

- **Pantry (left, columns 1–6):** the spawn; sack to hide behind (4, 2–3); crates (3–4, 7–8); low shelf to hide under (2–3, 10); vent at (3, 5). The exit is the open pantry window at (0, 11–12).
- **Wall and door:** wall at column 7; locked door at (7, 4); latch on the kitchen side at (8, 4); kitchen vent at (10, 11).
- **Kitchen:** the island (15–18, 5–8) under a hanging lamp; blue sink mat (17–20, 1–3) with tap-pad A at (19, 2); blueberries in a bowl at (20, 5); tap-pad B by the stove at (10, 13); squeaky boards (18–19, 11–12); kitchen table to hide under (16–17, 13–14); the breadbox (23–24, 12–13); the coffee-maker wire at (26, 1).
- **Lights:** a bright hanging lamp, centred (16.5, 6.5), radius 3.5; a warm under-cabinet light over the breadbox, centred (23.5, 11), radius 2.5 (bright); moonlight over the sink mat, centred (18, 1), radius 3. The pantry is dim.
- **Cat:** starts at (24, 7) and patrols 1 (10, 2) → 2 (24, 3) → 3 (24, 10) → 4 (10, 10) → 1. When the croissant is lifted it switches to HUNT for the rest of the level. This level overrides `huntEvery` to 5 s and the random offset to 3 tiles.
- **Stage 1 — Get in.** Mochi vents from (3, 5) to (10, 11) and opens the latch at (8, 4), or Pip picks the door from (6, 4) with Kiwi covering him.
- **Stage 2 — Open the breadbox.** Both tap-pads must be pressed within the same second. Pad A sits on the blue mat in the open, so Kiwi eats a blueberry from (20, 5) and stands blended on it. Pad B is by the stove, near the vent and the table, for Mochi or Pip. Someone counts down on voice: "3, 2, 1, now!" The lid opens with a loud *ding* (noise radius 6, loudness 0.5), so the cat comes to look. Scatter, hide, and come back.
- **Stage 3 — Lift and run.** Pip lifts the croissant ("...do i smell BUTTER"). Kiwi covers him, which brings his footstep noise from radius 6 down to 2.4. Mochi chews the coffee-maker wire for 25 s of lights out, ideally at the moment of the lift. The run from the breadbox through the door to the window is about 29 tiles: roughly 18 s walking or 24 s sneaking with the croissant. It just fits inside one lights-out if nobody hesitates.
- **Tutorial cards:** "Two tap-pads open the breadbox. Both must be pressed in the same second." / "Lifting the croissant wakes up Sir Crumbs's nose. He follows the smell." / "Plan it: lights out, cover, careful steps."
- **After the level:** play the ending cutscene "The Croissant Ceremony", then the credits.

## 8. Technical architecture

One repository with three npm workspaces: `shared/` (rules, numbers, maps), `server/` (Colyseus, authoritative game logic) and `client/` (Vite, TypeScript, Three.js, HTML UI). The server and client both import `shared/`, so collision, grid parsing and tuning can never disagree.

&#91;embedded content: architecture · 3 browsers, 1 server, shared rules\]

Game traffic goes through the server; voice goes straight between browsers.

### Stack

| Part | Choice | Why |
| --- | --- | --- |
| Language | TypeScript everywhere | One language, shared types |
| Client build | Vite (vanilla-ts template) | Fast dev server, easy HTTPS, proxies WebSockets |
| 3D | Three.js (latest) with `three/examples/jsm` post-processing | Full control of the toon look |
| UI | Plain HTML and CSS over the canvas, no framework | Hand-drawn styling is easier in CSS; less to learn |
| Multiplayer | Colyseus server and the `@colyseus/sdk` client | Rooms, state sync and reconnection are built in |
| Voice | Browser WebRTC, signalled through the Colyseus room | No extra server |
| Audio | Web Audio API, Three.js `PositionalAudio` for the cat | Procedural blip voices, music layers |
| Tests | Vitest | Map validator, grid, detection maths |
| Node | Current LTS (22 or newer) |  |

Colyseus changed its packages recently: the browser client is now `@colyseus/sdk` (it replaced `colyseus.js`), `@colyseus/schema` is at 4.x, and new servers are created with `npm create colyseus-app@latest`. Version 0.18 is out. Use whatever the template installs, and follow its file layout ([Colyseus docs](https://docs.colyseus.io/), [0.17 migration notes](https://docs.colyseus.io/migrating/0.17)).

### Folder structure

```
snikisnak/
  PLAN.md                    this document
  CLAUDE.md                  rules for Claude Code (Section 15)
  package.json               npm workspaces: shared, server, client; "dev" runs both
  shared/
    src/
      tuning.ts              all numbers (Section 4.10)
      types.ts               Role, ItemKind, CatStateName, message payloads
      roles.ts               who may do what (one table, used by server + client prompts)
      grid.ts                ASCII -> Grid, tile queries, collision, raycast, A*
      rules/noise.ts         pure functions: hearing, alert gain
      rules/detection.ts     pure functions: visibility, detection rate
      levels/index.ts        LEVELS array, in order
      levels/l1_mudroom.ts ... l8_kitchen.ts
    test/
      levels.test.ts         the map checks from Section 5
      grid.test.ts
  server/                    made by: npm create colyseus-app@latest server
    src/
      (template entry + config files, keep as generated)
      rooms/HeistRoom.ts     lobby, phases, messages
      rooms/schema/HeistState.ts
      game/Simulation.ts     the tick: runs systems in a fixed order
      game/CatBrain.ts       state machine (Section 4.5)
      game/Interactions.ts   E / F actions, role checks, holds
      game/LevelRuntime.ts   doors, items, food, plates, lights-out, vents from a LevelDef
      game/Roomba.ts
  client/
    index.html
    vite.config.ts           HTTPS + WebSocket proxy (Section 10)
    public/
      models/                GLB files (Section 11)
      audio/sfx/ audio/music/
      textures/              paper, gradient ramps, hand-drawn icons
    src/
      main.ts                boot, screen router
      net/Net.ts             Colyseus connection, room events
      net/Interp.ts          snapshot interpolation for remote entities
      net/Voice.ts           WebRTC mesh + push-to-talk
      game/GameScene.ts      owns the Three.js scene for a level
      game/LevelBuilder.ts   map -> meshes (floor, walls, furniture, rugs)
      game/LocalController.ts  input, local movement, sends position
      game/Characters.ts     three smugglers, procedural animation
      game/CatView.ts        cat model, cone, eyes, bubbles
      game/Props.ts          items, doors, vents, jars, food, Roomba
      render/Renderer.ts     renderer, camera rig
      render/Post.ts         tilt-shift, bloom, colour grade, vignette, grain
      render/Toon.ts         toon materials + outline helper
      render/Lights.ts       lamp pools, moon, lights-out
      render/Effects.ts      noise rings, dust motes, footprints, pings
      audio/AudioBus.ts      buses: music, sfx, voice, ui
      audio/Blips.ts         animalese voices
      audio/Music.ts         layered music
      audio/Sfx.ts
      ui/screens/*.ts        one file per screen (Section 13)
      ui/ui.css              paper look, fonts
      ui/paper.ts            SVG filters: wobble, paper grain
      content/script.ts      every line of dialogue (Section 3)
      content/cutscenes.ts   cutscene timelines
      content/cards.ts       tutorial cards
      dev/DevPanel.ts        F1 overlay
```

### Level data format

Each level is a TypeScript file in `shared/src/levels/`. The map is parsed by `grid.ts`. `B` and `T` tiles are grouped into rectangles (connected areas) automatically, and `props` gives each group a model by its top-left tile. Groups without an entry get a plain rounded box in a warm colour.

```ts
export interface LightDef { x: number; z: number; radius: number; kind: "lamp" | "moon"; }
// lamp = bright tiles, warm, turns off during lights out. moon = normal light, cool.
// Tiles outside every light count as dark.

export interface LevelDef {
  id: number; key: string; name: string;
  listItem: { kind: "small" | "heavy" | "ledge" | "croissant"; name: string; model: string } | null;
  map: string[];
  cat: { mode: "sleep" | "patrol" | "perch"; walk: number; chase: number; range: number;
         darkRange: number; fov: number; hearing: number; giveUpAfter: number;
         wakeAt?: number; checksHides: boolean; huntEvery?: number; huntOffset?: number; };
  lights: LightDef[];
  props: Record<string, string>;   // "x,y" of a B/T group's top-left tile -> model name
  intro: string[];                 // line ids from content/script.ts
  cards: string[];                 // tutorial card ids
  music: "calm" | "tense";         // which calm layer to start on
}
```

A complete example, Level 1:

```ts
export const L1: LevelDef = {
  id: 1, key: "mudroom", name: "The Mudroom", listItem: null,
  map: [
    "####################",
    "#S...BB......TTT...#",
    "#....BB......TTT...#",
    "#S..~~..........~..#",
    "#...~~.....B....~~.E",
    "#.........Z.......~E",
    "#S..~~.....B....~~.#",
    "#...~~..........~..#",
    "#....BB...TT.......#",
    "#....BB...TT....BB.#",
    "####################",
  ],
  cat: { mode: "sleep", walk: 1.6, chase: 3.8, range: 5, darkRange: 2.5, fov: 100,
         hearing: 1.0, giveUpAfter: 4, wakeAt: 0.35, checksHides: false },
  lights: [ { x: 10.5, z: 5.5, radius: 2.5, kind: "lamp" },
            { x: 14.5, z: 3.5, radius: 3, kind: "moon" } ],
  props: { "5,1": "boot_pile", "13,1": "shoe_bench", "11,4": "basket_side",
           "11,6": "basket_side", "5,8": "laundry_basket", "10,8": "stool",
           "16,9": "watering_can" },
  intro: ["l1_crow_1", "l1_pip_1", "l1_kiwi_1"],
  cards: ["move_sneak", "squeak", "hide", "goal_escape"],
  music: "calm",
};
```

**Coordinates.** In a map, x is the column and y is the row. Tile (x, y) has its centre at world `(x + 0.5, 0, y + 0.5)`. Light positions in level files are in world units.

### Scripts and URL options

| Command | Does |
| --- | --- |
| `npm run dev` | Starts the server (port 2567) and the Vite client (port 5173, HTTPS) together |
| `npm test` | Runs Vitest in `shared/` (map checks, grid, detection) |
| `npm run build` | Builds the client into `client/dist` |
| `npm start` | Production: the server serves `client/dist` and the game on one port |

| URL option | Does |
| --- | --- |
| `?dev=1` | Solo dev mode: one browser controls all 3 characters (backquote switches) |
| `?level=5` | With `dev=1`, skip the menus and start at that level |
| `?nomic=1` | Skip the microphone prompt |
| `?server=wss://host:port` | Connect to a different server |

**Saved on the host's browser** (`localStorage`): highest unlocked level, best stars per level, settings (volumes, push-to-talk or open mic, mic device), seen tutorial cards, player name.

## 9. Networking and multiplayer

The server is the referee: it owns the cat, items, doors, jars, noise, detection, win and lose. Each client owns only its own character's movement, which the server checks before accepting. Everything else on a client is a drawing of the server's state.

### Room and room codes

- One room type, `heist`, with `maxClients = 3`.
- **Host:** `client.create("heist", { name })`. The room makes a 4-letter code from consonants only (`BCDFGHJKLMNPQRSTVWXZ`, so it can't spell words) and shows it in the lobby.
- **Join:** `client.joinById(code, { name })`. Set `this.roomId = code` in `onCreate`. If the installed Colyseus version doesn't allow a custom room id, keep a `Map<code, roomId>` on the server, add `GET /code/:code` that returns the room id, and join with that.
- Lock the room (`this.lock()`) when it leaves the lobby phase. If the host leaves, the next player becomes host.
- **Reconnection:** keep a leaving player's state for 30 s and allow them back, using the reconnection API of the installed version (0.17 added automatic reconnection on the client). While disconnected the character is frozen, and the cat ignores it.

### Phases

`lobby` → `cutscene` (first run only) → `intro` (tin-can call + cards) → `briefing` (up to 20 s) → `playing` → `caught` or `complete` → the next level's `intro`, or `ending` after Level 8. The host chooses Retry, Next or Level Select from the `caught` and `complete` screens.

### Synced state (`server/src/rooms/schema/HeistState.ts`)

Keep the synced state small: only what clients draw. Everything else stays in plain server objects.

```ts
export class PlayerState extends Schema {
  @type("string") id = "";            // sessionId
  @type("string") name = "";
  @type("string") role = "";          // "kiwi" | "mochi" | "pip" | ""
  @type("boolean") ready = false;
  @type("boolean") connected = true;
  @type("number") x = 0; @type("number") z = 0; @type("number") facing = 0;
  @type("boolean") moving = false; @type("boolean") sneaking = false;
  @type("boolean") hidden = false;    // computed by the server
  @type("number") seen = 0;           // this player's detection meter, 0..1
  @type("boolean") jarred = false; @type("number") rescue = 0;
  @type("string") carrying = "";      // item id
  @type("string") color = "green"; @type("number") colorLeft = 0;   // Kiwi
  @type(["string"]) pouch = new ArraySchema<string>();              // Mochi
  @type("string") mode = "";          // "" | vent | ledge | roomba | covering | covered
  @type("string") holdKind = "";      // what the current hold is doing
  @type("number") hold = 0; @type("boolean") micOff = false;           // its progress, 0..1
}
export class CatState extends Schema {
  @type("number") x = 0; @type("number") z = 0; @type("number") facing = 0;
  @type("number") headYaw = 0;        // perch sweep and look-around
  @type("string") state = "SLEEP";
  @type("number") alert = 0;
  @type("string") targetId = "";
  @type("string") bubble = ""; @type("number") bubbleSeq = 0;
}
export class ItemState extends Schema {
  @type("string") id = ""; @type("string") kind = "";
  @type("number") x = 0; @type("number") z = 0;
  @type("string") carriedBy = ""; @type("boolean") onLedge = false;
  @type("boolean") visible = true;    // false while inside the closed breadbox
}
export class DoorState extends Schema { @type("string") id = ""; @type("boolean") open = false; @type("number") pick = 0; }
export class FoodState extends Schema { @type("string") id = ""; @type("string") kind = ""; @type("number") x = 0; @type("number") z = 0; @type("boolean") available = true; }
export class PlateState extends Schema { @type("string") id = ""; @type("boolean") pressed = false; }
export class RoombaState extends Schema { @type("number") x = 0; @type("number") z = 0; @type("number") facing = 0; @type("string") riderId = ""; }
export class HeistState extends Schema {
  @type("string") phase = "lobby";
  @type("number") level = 1;
  @type("string") hostId = ""; @type("string") code = "";
  @type("number") timer = 0;          // briefing countdown, level clock
  @type("number") lightsOut = 0;      // seconds left
  @type("boolean") breadboxOpen = false;
  @type("number") exitHold = 0;
  @type("boolean") anyoneJarred = false;
  @type("number") stars = 0;
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type(CatState) cat = new CatState();
  @type({ map: ItemState }) items = new MapSchema<ItemState>();
  @type({ map: DoorState }) doors = new MapSchema<DoorState>();
  @type({ map: FoodState }) food = new MapSchema<FoodState>();
  @type({ map: PlateState }) plates = new MapSchema<PlateState>();
  @type(RoombaState) roomba = new RoombaState();
}
```

### Messages

| Client → server | Payload | When |
| --- | --- | --- |
| `role` | `{ role }` | Lobby: claim a role (server refuses if taken) |
| `ready` | `{ ready }` | Lobby |
| `start` | `{}` | Host, when all 3 have roles and are ready |
| `skip` | `{ holding }` | Holding Space during a cutscene |
| `pos` | `{ x, z, facing, moving, sneaking, seq, who? }` | 20 times a second while playing (`who` only in dev mode) |
| `interact` | `{}` | E pressed: the server picks the nearest valid target within 1 tile |
| `hold` | `{ key: "E" \| "F" \| "Q", down }` | Key down and key up for hold actions |
| `ping` | `{ kind, x, z }` | Keys 1–4 |
| `rtc` | `{ to, data }` | WebRTC signalling (Section 10) |
| `mic` | `{ muted }` | Mic muted, denied or missing: others show a crossed-out mic icon (speaking itself is detected locally, Section 10) |
| `next` / `retry` / `select` | `{ level? }` | Host only, on result screens |

| Server → clients | Payload | Purpose |
| --- | --- | --- |
| `noise` | `{ x, z, radius, kind }` | Draw an ink ring, play a sound |
| `bark` | `{ who, lineId }` | Speech bubble + blips |
| `toast` | `{ text }` | To one client: wrong-role messages, "Need one more friend!" |
| `sfx` | `{ name, x?, z? }` | One-shot sounds (door opens, jar pops, ding) |
| `ping` | `{ from, kind, x, z }` | Show the marker |
| `rtc` | `{ from, data }` | Relayed signalling |
| `correct` | `{ x, z }` | To one client whose move was rejected: snap back |
| `card` | `{ cardId }` | Show a tutorial card |
| `complete` | `{ stars, leftBehind: string[] }` | Level won |
| `caught` | `{}` | Level lost |

### Movement authority

- The local client moves its own character every frame using the shared collision code and sends `pos` 20 times a second.
- The server accepts a `pos` only if the distance from the last accepted position is at most `maxSpeed × dt × 1.3 + 0.1`, and the position isn't inside a solid tile. Otherwise it keeps the old position and sends `correct`.
- The server ignores `pos` from players who are jarred, in a vent, on a ledge or on the Roomba; it moves those itself.
- Remote players and the cat are drawn 100 ms in the past, interpolated between the two snapshots around that time (`net/Interp.ts`). This hides network jitter.

### Server tick order (`game/Simulation.ts`, 20 Hz)

1. Apply accepted positions. Advance vent travel and Roomba riders.
2. Hold actions (lock pick, chew, latch, boost, rescue, call it a night), with role checks.
3. Status: hidden, covered, blended, Kiwi's colour timer, lights-out timer, food respawn.
4. Noise: footsteps from distance moved, squeaks from entering `~` tiles, and queued action noises. Broadcast them.
5. Roomba movement and bumps.
6. Cat: vision and detection meters, hearing, state machine, then movement along its A\* path.
7. Catch check: create jars.
8. Pressure plates and the breadbox.
9. Win and lose check; stars.
10. Barks: take queued events, apply cooldowns, broadcast.

### Dev mode

`?dev=1` creates a room with `{ solo: true }`. The server adds 3 players, all owned by that one client. The client sends `pos` with `who` for the character it is controlling, and backquote switches between them. The other two stand still where you left them, so you can test rescues and boosts alone. F1 shows the debug overlay: grid lines, the cat's state and alert, every detection meter, noise radii, A\* path, hide/blend status per player, and frames per second.

## 10. Voice chat

Voice runs peer-to-peer over WebRTC between the 3 browsers (3 connections), and the Colyseus room relays the setup messages. Push-to-talk on V is the default. The game still works without a microphone: pings and barks carry the basics.

### How it connects

1. In the lobby, after a player picks a role, ask for the microphone with a **Test mic** button and a level meter. Use `getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })`.
2. For each pair of players, the one whose session id sorts lower makes the offer. This fixed rule avoids both sides offering at once.
3. Offers, answers and ICE candidates travel as `rtc` messages `{ to, data }`. The server forwards each one only to `to`, adding `from`.
4. ICE servers: `[{ urls: "stun:stun.l.google.com:19302" }]`. On the same Wi-Fi this is enough. Some home routers block direct connections between different networks; if voice fails across networks, add a TURN server or fall back to a Discord call.
5. If the mic is denied or missing, show a crossed-out mic icon on that player's card and carry on.

### Talking and listening

- **Push-to-talk:** the local audio track stays `enabled = false` until V is held. Settings offers **Open mic** instead. M mutes either way.
- **Routing each remote voice:** `MediaStreamAudioSourceNode` → a per-player `GainNode` (volume slider in Settings) → an optional filter → the voice bus → speakers.
- **Chrome quirk:** a remote WebRTC stream can stay silent in Web Audio unless it is also attached to a muted `<audio>` element. Do both: `audio.srcObject = stream; audio.muted = true; audio.play()`.
- **Speaking indicator:** each client measures every stream with an `AnalyserNode`. A level above 0.02 RMS for 100 ms counts as speaking: little hand-drawn sound waves wiggle over that character's head, and their lobby card bounces. No network message is needed for this.
- **Jar muffle (fun):** while a player is jarred, put a 700 Hz low-pass filter on their voice for everyone else. They sound like they're stuck in a jar.
- **Walkie-talkie filter (option):** a 400–3000 Hz band-pass plus light distortion, toggled in Settings.
- Voice is global, not by distance, so teammates can always coordinate.

### `client/src/net/Voice.ts`

```ts
export class Voice {
  init(room: Room, deviceId?: string): Promise<void>;  // mic + listen for "rtc"
  connectTo(peerId: string): void;                   // lower id sends the offer
  setPushToTalk(down: boolean): void;
  setMuted(muted: boolean): void;
  setPeerVolume(peerId: string, volume: number): void;
  setPeerJarred(peerId: string, jarred: boolean): void;
  onSpeaking(cb: (peerId: string, on: boolean) => void): void;
  dispose(): void;
}
```

### HTTPS: needed for the microphone

Browsers only allow the microphone on `localhost` or on HTTPS pages. At the LAN Party the other laptops open the host laptop by its IP address, so the dev server must use HTTPS. The game socket must then go through the same HTTPS address, or the browser blocks it as mixed content.

In `client/vite.config.ts`, use the `@vitejs/plugin-basic-ssl` plugin and proxy the Colyseus server through the Vite server:

```ts
import { defineConfig } from "vite";
import basicSsl from "@vitejs/plugin-basic-ssl";

export default defineConfig({
  plugins: [basicSsl()],
  server: {
    host: true, port: 5173,
    proxy: {
      "/colyseus": {
        target: "http://localhost:2567", ws: true, changeOrigin: true,
        rewrite: (p) => p.replace(/^\/colyseus/, ""),
      },
    },
  },
});
```

The client connects with `new Client(location.origin + "/colyseus")` in development. Players open `https://<host laptop IP>:5173` and accept the self-signed certificate warning once. In production the server serves the built client itself, so the client connects with `new Client(location.origin)`. Deploy to any host that provides HTTPS and WebSockets.

## 11. Art direction

The target look is **a handmade miniature diorama lit by a night-light**: tiny toy-like animals in a giant house, warm lamp pools against cold moonlight, a tilt-shift blur that makes the room feel like a dollhouse, and paper-and-marker UI on top. Cute but grounded: real house objects at real scale, soft shadows, no cartoon bounce on the furniture.

### How to avoid the "AI-generated" look

1. **One palette, used strictly** (below). No rainbow gradients, neon glows, chrome or glass panels.
2. **Visible imperfection.** Slightly uneven outlines, a gentle "boil" wobble on titles, hand-lettered text, paper grain.
3. **One light story per room.** A warm lamp and a cold window, placed on purpose. Each level's lights are listed in Sections 6 and 7.
4. **Your own hand where it shows most.** Draw the title logo, the three lobby portraits and the UI icons yourself on paper or in a drawing app, then scan or export them as PNG or SVG. This is the strongest anti-AI signal.
5. **Real textures.** Photograph real paper, cardboard, felt and masking tape under even light and use them for UI cards and the floor rugs.
6. **No emoji, no stock icon sets, no generic sparkle particles.**

### Palette

| Use | Hex |
| --- | --- |
| Ink: outlines, UI text | `#2b1d16` |
| Midnight: ambient light, deep shadow | `#1d2340` |
| Moonlight | `#9db4ff` |
| Lamp glow | `#ffb66b` |
| Paper | `#f3e7cf` |
| Masking tape | `#e8d9a8` |
| Floor wood / dark wood | `#8a5a3b` / `#5e3b26` |
| Wall plaster | `#c9b8a6` |
| Jam red: danger, red rug, strawberry | `#d9534f` |
| Cheese yellow | `#f2c14e` |
| Blueberry blue | `#4a6fd1` |
| Leaf green: Kiwi, green rug | `#7cc26b` |
| Mochi cream | `#f2d1a0` |
| Pip grey | `#8a8f99` |
| Sir Crumbs orange | `#e8893a` |
| Crow black / violet sheen | `#1a1a24` / `#6b5b95` |
| Gold: list items, croissant | `#e8b923` |

### Camera and scale

- **Camera:** perspective, field of view 28°, looking down at about 55° from the south. It frames the whole room with a 1-tile margin, so the team can always see each other and the cat. It drifts gently toward the local player: target = room centre blended 25% toward the player. Small shake when someone is caught.
- **Walls:** the south wall (nearest the camera) is a low cut-away 0.4 units tall; the other walls are 3 units tall.
- **Scale:** 1 tile is about 30 cm of real house. Kiwi is 0.5 long, Mochi 0.35 tall, Pip 0.7 tall. Sir Crumbs is a giant: 1.2 tall at the shoulder and 2.2 long. A couch is 2.5 tall. Hide-spot furniture always has visible legs and open space underneath, so players can read that they fit.

### Shading and lighting

- **Toon shading:** `MeshToonMaterial` with a 3-step gradient map (a 3×1 `DataTexture` with nearest filtering: 0.45, 0.75, 1.0).
- **Outlines:** inverted hull. Each character, the cat and every prop gets a copy of its mesh with back faces only, an ink-coloured basic material, and its vertices pushed out along the normals by 0.025. Floors and walls have no outline.
- **Floor:** a canvas-generated plank texture (plank lines plus fine grain noise) in the wood colours. Rugs: canvas textures with simple stripes or dots in their colour.
- **Lights:** a hemisphere light (sky `#6f86c9`, ground `#2a2233`, intensity 0.6); one moon directional light (`#9db4ff`) with a 2048 soft shadow map; up to 4 lamp point lights per level (no shadows). Each lamp also gets a light-pool decal on the floor: an additive plane with a radial gradient, sized to its radius. Blob shadows sit under every character.
- **Lights out:** lamps flicker and fade to 0 over 0.3 s, ambient drops to 0.35, and the cat's eyes and the smugglers' eyes glow softly.

### Post-processing (`render/Post.ts`)

In order: RenderPass → tilt-shift (two blur passes, sharp band across the middle 40% of the screen, blur growing toward the top and bottom) → UnrealBloomPass (strength 0.35, radius 0.4, threshold 0.85, so only lamps and eyes glow) → colour grade (shadows lifted toward midnight blue, highlights warmed, saturation 0.95) → vignette 0.35 and animated film grain 0.04 → OutputPass. A **Low graphics** setting turns off tilt-shift, bloom and shadows.

### Effects (`render/Effects.ts`)

- **Cat vision cone:** a fan-shaped floor decal with a sketchy edge texture. Pale yellow, orange or red by state (Section 4.4). It is cut off by walls (use the raycast results to build the fan).
- **"?" and "!":** hand-drawn sprites over the cat that pop in with a quick scale bounce.
- **Noise rings:** ink circles that grow and fade.
- **Dust motes:** about 200 slowly drifting points, visible only inside light pools and moon shafts.
- **Moon shafts:** soft additive cones from each window at 8% opacity.
- **Pings:** hand-drawn stamps (arrow, exclamation, hand, "?") that drop onto the floor with a bounce and fade after 4 s.
- **Jar:** a transparent toon material at 35% opacity, a white rim outline and one highlight streak sprite.
- **Detection over your head:** a small hand-drawn eye that fills as the cat's meter for you rises. Only your own is shown big; teammates' are small.

### Procedural animation (no rigging needed)

The characters can be single static meshes. All motion is done in code:

- **Idle:** breathing (height scale 1 ± 0.03 at 1.2 Hz) and a blink every 3–6 s.
- **Walk:** bounce `|sin(t·ω)| × 0.06`, side-to-side roll of ±6°, and a tiny squash on each footfall (height 0.92, width 1.04, for 0.06 s). ω follows speed.
- **Sneak:** body lowered (height 0.85), leaning forward 10°, slower bounce.
- **Character touches:** Kiwi's eyes turn to look at the cat wherever it is, and her body colour blends smoothly between colours. Mochi's cheeks grow with each food in the pouch (scale 1 + 0.15 per item). Pip's tail swishes, and his carried loot wobbles.
- **Sir Crumbs:** slow breathing and a curled tail asleep; head bob and tail up when walking; stretched body when chasing; crouch and wiggle before a pounce; bell jingle when he moves.
- **Queen Corvina:** head tilts, hops, and a wobbling crown.

### Models: two routes

**Route A — Tripo AI (recommended for the characters).** Make static low-poly GLBs and animate them in code as above. Add a style ending to every prompt: *"stylized low-poly game character, chunky toy proportions, flat matte hand-painted colours, simple shapes, neutral pose, centred"*.

- **Kiwi:** a tiny cute chameleon on four legs, curled tail, big round turret eyes, leaf-green body with a cream belly, a small satchel.
- **Mochi:** a round chubby hamster standing upright, cream and white fur, pink nose and ears, big cheeks, a tiny backpack.
- **Pip:** a small raccoon standing upright, grey fur, black eye mask, ringed tail, a tiny striped scarf.
- **Sir Crumbs:** a huge fluffy orange tabby house cat, chubby, smug half-closed eyes, red collar with a gold bell.
- **Queen Corvina:** a black crow with a bottle-cap crown and a tiny red velvet cape, standing proudly.
- **Props:** honey jar, silver thimble, golden pen nib, blue button, sparkly sock, music-box key, Golden Croissant.

Export GLB at no more than 8,000 triangles per character and 3,000 per prop, with 1024 px textures. Generated textures often look noisy and "AI". Either swap the materials for flat palette toon materials in Three.js, or posterize the texture to a few colours in the shader. If you compress GLBs with Draco or Meshopt, register the matching decoder in `GLTFLoader`. List every model in `client/public/models/models.json` as `{ "kiwi": { "file": "kiwi.glb", "height": 0.5, "yaw": 0 } }`, so the loader scales each model to its height, sets its pivot at its feet and turns it to face +Z.

**Route B — primitives (placeholders from day 1, and all furniture).** Claude Code builds each character from spheres, capsules and cones with toon materials and outlines. For example, Mochi is a squashed sphere, two cheek spheres, two ear discs and two dot eyes. These toy placeholders are cute on their own. The game must be fully playable with them through Phase 5, and switching to GLBs only means editing `models.json`. Furniture is always procedural: each name in a level's `props` maps to a builder function (`boot_pile`, `shoe_bench`, `couch`, `bed`, `washer` and so on) that makes a low-poly rounded shape.

### UI look

- **Cards:** paper rectangles with slightly torn edges, held by strips of masking tape, each tilted a random −2° to 2°.
- **Ink:** 2.5 px outlines in the ink colour. Titles and buttons "boil": an SVG `feTurbulence` + `feDisplacementMap` filter whose seed changes every 120 ms (8 frames per second).
- **Fonts:** self-host with `@fontsource` packages so the LAN Party works offline. Logo: your hand-drawn title. Headings: Caveat Brush. Body and HUD: Shantell Sans. The shopping-list receipt: Courier Prime.
- **Buttons:** paper tabs that grow 4% and tilt 1° on hover, with a soft paper "pap" sound when pressed.

## 12. Audio direction

Sound does half the stealth work: the cat's collar bell tells you where he is, footsteps tell you how loud you are, and the music rises as he gets suspicious. Characters "talk" in procedural blip voices, so every line in Section 3 is voiced with no recording.

### Setup (`audio/AudioBus.ts`)

- One `AudioContext`, unlocked by the first click on the start screen ("Click to begin").
- Buses: master → music, sfx, blips (character voices), voice chat, ui. Each has a volume slider in Settings.
- Put the Three.js `AudioListener` on the **local player**, not the camera, so getting close to the cat makes his bell louder.
- Positional sounds (`PositionalAudio`, refDistance 2, rolloff 1.5): the cat's bell, purr and footsteps; the Roomba's motor; lamp hum.

### Blip voices (`audio/Blips.ts`)

For each letter in a line, play one short tone. The letter picks the pitch: `semitone = charCode % range`, added to the character's base note. Text appears in the bubble letter by letter in time with the blips.

| Speaker | Base | Range (semitones) | Wave | Note length | Gap | Extra |
| --- | --- | --- | --- | --- | --- | --- |
| Kiwi | 330 Hz | 7 | triangle | 55 ms | 25 ms | 6 Hz vibrato, ±15 cents (nervous wobble) |
| Mochi | 620 Hz | 9 | square, low gain | 38 ms | 15 ms | Fast and bouncy |
| Pip | 165 Hz | 5 | sawtooth | 70 ms | 30 ms | Each note dips slightly in pitch (laid back) |
| Queen Corvina | 220 Hz | 6 | sawtooth + triangle | 80 ms | 35 ms | A "caw" sample on every "!" |

- Envelope: 5 ms attack, fade to zero by the end of the note. Gain 0.12. Low-pass between 1200 Hz (Pip) and 3500 Hz (Mochi).
- Pauses: space 60 ms, comma 150 ms, full stop, "!" or "?" 250 ms.
- A word in CAPITALS is shouted: 3 semitones higher and 30% louder.
- **Upgrade if there's time:** record yourself saying a few syllables per character ("ba", "pi", "mo") and play random pitched syllables instead of tones. Your own voice makes it unmistakably handmade.

### Sound effects

| Group | Sounds |
| --- | --- |
| Movement | Soft taps on wood per character (Pip heavier), squeaky board, vent scurry (metallic patter), boost "hup", ledge hop |
| Sir Crumbs | Bell jingle while he moves (looped, positional), sleeping purr, chirp on "?", meow and hiss on "!", pounce whoosh, the "pat pat" paw at a hide spot |
| Jars | Glass clink when caught, pop and tinkle when rescued, a dull thump for a wobble |
| Items | Pick-up pop, gentle put-down, crash and clang when dropped, Kiwi's munch, Mochi's "mmf" when stuffing cheeks |
| Doors and wires | Lock-pick click, latch clack, door creak, wire crunch with an electric fizz, lights-off thunk, lights-back hum |
| Level 7–8 | Roomba motor hum and bump thud, pressure-plate click, breadbox ding |
| Pings | Four distinct short blips: go, cat, wait, help |
| UI | Paper "pap" on buttons, card flip, marker scribble when a list item is crossed out, ink stamp for each star |
| Ambience | Wind and crickets (rooftop), clock tick (study), dryer hum (laundry), fridge hum (kitchen) |
| Cutscenes | Kazoo royal fanfare, paper unrolling, the far-away "plip" |

**Where to get them:** Kenney's audio packs (CC0) for UI and impacts; freesound.org filtered to CC0 for cat sounds, the bell, creaks and the Roomba; jsfxr / sfxr.me for blips and pings; and your own recordings for squeaks and foley (crinkled paper, a tapped pencil, a jar lid). Log every file in `CREDITS.md` with author, licence and link.

### Music (`audio/Music.ts`)

Three loops in the same key and tempo start together and crossfade:

| Layer | Sound | Plays when |
| --- | --- | --- |
| Calm | Pizzicato strings, soft upright bass, light brushes | Always |
| Tension | Low strings or clarinet, ticking percussion | Cat alert or any detection meter above 0.35 |
| Chase | Drums and brass stabs | The cat is chasing |

- Ramp gains with `setTargetAtTime(target, now, 0.5)`.
- During lights out, send all music through a 600 Hz low-pass with extra reverb; open it again over 1 s when the lights return.
- One-shots: a "Caught!" sting, a level-complete jingle (kazoo + glockenspiel), and the royal kazoo theme for cutscenes.
- **Sources:** compose the stems yourself in a free tool, or use CC0 / CC-BY loops. Kevin MacLeod's incompetech music is CC-BY and needs a credit; check each track's page for its licence. If you only find single tracks, fake the layers: one track for calm, plus a percussion loop that fades in for tension.

### Accessibility

- Every spoken line also appears as text in its bubble.
- When the cat is within 6 tiles but off-screen or behind furniture, a small bell icon at the screen edge points toward him.

## 13. Screens and UI flow

Players go: Click to begin → Start → Host or Join → Lobby → opening cutscene (first time) → for each level: intro → briefing → play → results → after Level 8, the ending and credits. Each screen is a plain HTML/CSS class in `client/src/ui/screens/` with `mount(root)` and `unmount()`, switched by a tiny router.

| Screen | What's on it | Notes |
| --- | --- | --- |
| **Click to begin** | A paper note taped to dark wood: "Click to begin". Faint crickets. | This click unlocks audio |
| **Start** | A live 3D scene: the moonlit rooftop and the Crow's throne, the three smugglers idling on the roof edge, the camera slowly circling. The hand-drawn logo. A luggage tag for "Your smuggler name". Paper tabs: Host a heist, Join with code, Settings, Credits. | Small touches: Kiwi changes colour now and then; Mochi steals a crumb; a cat silhouette crosses a lit window with a bell jingle |
| **Join** | A ticket with 4 letter boxes for the room code | Paper error cards: "No heist with that code", "That heist is full", "Already started" |
| **Lobby** | A corkboard: the room code on a sticky note with a Copy button; three character index cards (portrait, name, two strengths, one weakness); each claimed card shows its player's name pinned under it; Test mic meter; push-to-talk / open mic toggle; a hand-drawn Ready checkbox; the host's level picker (the shopping-list receipt: finished levels crossed out with their stars, locked ones smudged) and a "GO!" stamp button | Start needs 3 players, 3 roles, all ready |
| **Cutscene** | Paper-strip letterbox bars, speech bubbles, "Hold Space to skip (1/3)" | Skip when all players hold Space |
| **Level intro** | The tin-can phone panel with the Crow's lines, then a title card ("Level 3 — The Pantry" and the list line), then the tutorial cards |  |
| **Briefing** | The camera rises to look almost straight down. The item glows gold, the cat's route shows as dotted paw prints between its waypoints, and the exit has a hand-drawn arrow. A kitchen-timer countdown from 20. A Ready button per player. Pings work. | All ready → play |
| **Play (HUD)** | See the HUD list below |  |
| **Menu (Esc)** | Settings, Controls, Leave room | The game keeps running |
| **Caught** | A big ink "CAUGHT!" stamp over a sketch of two jars, the Crow's line | Host: Retry or Level select. Others: "Waiting for the host..." |
| **Level complete** | A receipt prints line by line: level, time, the item, who made it home. Stars stamp on one at a time. The Crow's line. | Host: Next, Retry, Level select |
| **Settings** | Five volume sliders drawn as pencil lines (master, music, sound, voices, voice chat), mic device, push-to-talk or open mic, walkie-talkie filter, low graphics, reset tutorial cards, controls list |  |
| **Credits** | A long receipt that scrolls: "Game by Maliha Nahiyan Srotosshini", made for CGDD, Fall 2026, then tools (Three.js, Colyseus, Tripo AI, Claude Code) and every asset from `CREDITS.md` | Also after the ending |

### HUD during play

- **Top left:** the tutorial card slot.
- **Top centre:** the Sir Crumbs meter: a hand-drawn cat face whose eyes open wider as alert rises (asleep, half open, wide, angry), with his latest thought bubble beside it.
- **Top right:** the level name and the list item on a receipt scrap, crossed out when it reaches the exit.
- **Bottom left:** three teammate portraits, yours bigger. Status icons on each: hidden (a leaf), jarred (a jar), carrying (the item), talking (sound waves), mic muted. Kiwi's colour timer is a ring around her portrait; Mochi's pouch shows as dots.
- **Bottom centre:** the interaction prompt ("E — Pick lock") with a hold-progress ring.
- **Bottom right:** your two ability cards with their keys, and the push-to-talk indicator.
- **In the world:** rescue progress rings over jars, the "Call it a night" bar at the exit, "Need one more friend!" toasts, your detection eye, speech and thought bubbles.
- **Lights out:** the screen edges darken and a chalk timer shows "LIGHTS OUT 0:25".
- **Off-screen markers:** arrows at the screen edge for pings and for the cat's bell.

## 14. Build phases and schedule

Nine phases, each ending with something you can play. Phases 0–5 (Nov 23–27) get Levels 1–4, the lobby and voice ready for the LAN Party. Phases 6–8 (Nov 28–Dec 7) add Levels 5–8, the ending and the full art and audio pass before the Dec 8 final. Don't start a phase until the previous phase's acceptance tests pass.

&#91;embedded content: build schedule · 9 phases, 3 deadlines\]

The first five days are the crunch: six phases before the LAN Party. The ten days after it are calmer and add Levels 5–8.

### Phase 0 — Setup (Mon Nov 23, about 2 hours)

- Root `package.json` with npm workspaces; `shared/`, `server/` (from `npm create colyseus-app@latest`), `client/` (Vite vanilla-ts).
- `shared/`: `tuning.ts`, `types.ts`, `roles.ts`, `grid.ts` (parse, tile queries, collision, raycast, A\*), all 8 level files copied from Sections 6–7, and the map tests.
- `npm run dev` starts both; Vite on HTTPS with the `/colyseus` proxy (Section 10).
- A blank Three.js scene that joins a `heist` room and logs the state.

**Accept when:** `npm test` passes all map checks for all 8 maps; `https://localhost:5173` logs "joined room" with a code; two tabs show two players in the state.

### Phase 1 — Walk around together (Nov 23–24)

- `LevelBuilder` turns the Level 1 map into floor, walls, rugs and placeholder furniture boxes. Basic toon material, outlines, the diorama camera.
- Three primitive "toy" characters (Route B). Local movement with shared collision, sneaking, `pos` sync, interpolation.
- Dev mode (`?dev=1`) and auto-assigned roles for now.
- Server-made footstep noise, squeaky boards, ink rings. F1 overlay with grid lines.

**Accept when:** three tabs (or dev mode) walk around Level 1; nobody passes through walls or furniture; players can walk under `T` furniture; remote movement looks smooth; noise rings appear, big on squeaky boards. **This is the Nov 24 class demo.**

### Phase 2 — The cat (Nov 24–25)

- `CatBrain`: every state in Section 4.5 except HUNT, A\* movement, vision cone decal, detection meters, hearing, the 5 s grace.
- Jars, rescue, lose rule, exit zone, call it a night, stars. Small items: pick up, carry, drop.
- Levels 1 and 2 fully playable.

**Accept when:** in Level 1 the cat wakes from careless walking or several squeaks; in Level 2 it follows its waypoints; the cone turns orange then red; a caught player is jarred where they stood; the other two free them in 2.5 s; two jars show "Caught!"; the level is won with 2 (holding F) or 3 players.

### Phase 3 — Lobby, level flow, first abilities (Nov 25–26)

- Real lobby: codes, role claiming, ready, host start. Level flow: intro → briefing → play → results → next.
- Pip: lift heavy loot (slow, noisy), pick locks. Kiwi: cover. Mochi: vents, latches. Doors.
- Role checks on the server and wrong-role barks. Basic HUD.
- Levels 3 and 4 playable.

**Accept when:** three players join by code and can't take the same role; in Level 3, Pip's carry noise shrinks when Kiwi covers; in Level 4 both the lock and the vent-and-latch open the door.

### Phase 4 — Voice chat and LAN (Thu Nov 26)

- `Voice.ts`: mesh, push-to-talk, mute, speaking indicators, jar muffle, mic test in the lobby.
- Test on 2–3 laptops on the same Wi-Fi using `https://<host IP>:5173`.

**Accept when:** three machines hear each other with push-to-talk; a jarred player sounds muffled; the game still works when the mic is denied.

### Phase 5 — Story, sound and feel for the LAN Party (Nov 26–27 morning)

- Start screen, opening cutscene (simple visuals are fine), level intros, tutorial cards, barks, cat bubbles, blip voices.
- Core sound effects, music (layers, or one track for now), results and caught screens.
- First art pass: palette, lamp pools, moonlight, post-processing, Low graphics toggle.

**Accept when:** three players can play from the start screen through Level 4 without dev tools, at 30 fps or better on a school laptop with Low graphics. **LAN Party: Fri Nov 27** (checklist in Section 16).

### Phase 6 — Levels 5–6 (Nov 28–Dec 1)

- Kiwi's blend, food, Mochi's pouch and hand-off, the perched cat.
- Wires and lights out; Pip's boost and ledges.

**Accept when:** Kiwi is invisible when still on a matching rug; her colour flashes and fades at 20 s; Mochi hands her food; lights out lasts 25 s and shrinks the cone; a boosted Kiwi takes the sock quietly while a boosted Mochi pushes it off with a crash.

### Phase 7 — Levels 7–8 and the ending (Dec 1–4)

- Roomba (with riding), the cat checking hide spots, HUNT, pressure plates, the breadbox, the croissant.
- Ending cutscene, credits, saved stars and unlocked levels.

**Accept when:** in Level 7 the cat investigates Roomba bumps and swipes into a hide spot it saw you enter; all three stages of Level 8 can be completed; the ending plays; stars survive a page refresh.

### Phase 8 — Art, audio, balance and deploy (Dec 4–7)

- Swap in Tripo GLBs; polish procedural animation; furniture builders for every level's `props`; your hand-drawn logo, portraits and icons.
- All sound effects and music; balance by changing tuning numbers only, with friends playing.
- Fix bugs; deploy to an HTTPS host; record a backup gameplay video for the presentation.

**Accept when:** three people who haven't seen the game finish Levels 1–4 without help; play-testers clear each level in under 6 minutes; the console shows no errors; the deployed link works from three different networks, or the LAN setup is ready as a fallback. **Final presentation: Tue Dec 8.**

### If you fall behind, cut in this order

1. Riding the Roomba (keep it as a hazard only).
2. Walkie-talkie filter and jar muffle.
3. Recorded voice syllables (keep the tone blips).
4. Music layers (use one track, with the low-pass during lights out).
5. Tripo models (keep the primitive toys).
6. Level 7 (move its music-box key into Level 6's room and ship 7 levels).
7. Animated opening cutscene (use still comic panels with speech bubbles).

**Never cut:** the cat, jars and rescue, voice chat (or a Discord fallback), Levels 1–4, and Level 8's croissant.

## 15. Prompts for Claude Code

Paste these one at a time. Each phase prompt points Claude Code at the right sections of `PLAN.md` and asks it to stop when the phase is done, so you can test and commit before moving on.

### 15.1 `CLAUDE.md` (Claude Code writes this in the kickoff)

```markdown
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
```

### 15.2 Kickoff prompt

```
Read PLAN.md completely. It is the full design and build plan for my browser game SnikiSnak.

1. Create CLAUDE.md with exactly the rules in PLAN.md Section 15.1.
2. Then do Phase 0 only (PLAN.md Section 14), using Sections 5, 6, 7, 8 and 10.
   Copy all 8 level maps character for character from Sections 6 and 7, and write the map
   checks from Section 5 as Vitest tests.
3. Show me your plan for Phase 0 before you write code.
4. When Phase 0 passes its acceptance test, stop and tell me how to run it.
```

### 15.3 Phase prompts

| Phase | Prompt to paste |
| --- | --- |
| 1 | "Do Phase 1 from PLAN.md Section 14. Use Sections 4.1, 4.2, 8, 9 (movement authority, interpolation, dev mode) and 11 (camera, toon shading, outlines, Route B characters). Level 1 only. Stop when its acceptance tests pass." |
| 2 | "Do Phase 2. Implement the cat exactly as Sections 4.3–4.6 and 4.9 describe, with the per-level settings in Section 5. Add unit tests for detection and hearing maths. Make Levels 1 and 2 fully playable. Stop when the acceptance tests pass." |
| 3 | "Do Phase 3. Lobby and room codes from Section 9, level flow and phases, the abilities in Section 2 for Pip (lift, lock), Kiwi (cover) and Mochi (vents, latches), doors from 4.8, wrong-role barks from Section 3, and the HUD basics from Section 13. Levels 3 and 4." |
| 4 | "Do Phase 4: voice chat exactly as Section 10 describes, including the Vite HTTPS proxy, push-to-talk, mute, the speaking indicator and the jar muffle. Then give me step-by-step instructions to test it on 3 laptops on the same Wi-Fi." |
| 5 | "Do Phase 5: start screen, opening cutscene and level intros (Section 3), tutorial cards, barks and cat bubbles, blip voices and music (Section 12), results and caught screens (Section 13), and the first art pass (Section 11 palette, lights, post-processing, Low graphics). I need Levels 1–4 playable from the start screen for my LAN Party." |
| 6 | "Do Phase 6: Kiwi's blend and food, Mochi's pouch, the perched cat, wires and lights out, Pip's boost and ledges. Levels 5 and 6 from Section 7." |
| 7 | "Do Phase 7: Roomba with riding, the cat checking hide spots, HUNT, pressure plates, breadbox and croissant (Sections 4.5, 4.8 and Section 7), the ending cutscene and credits, saved stars and level select." |
| 8 | "Do Phase 8 step by step. First load the GLBs I put in client/public/models through models.json. Then build furniture for every name in the levels' props. Then wire every sound in Section 12. Show me what's left after each step." |

### 15.4 Handy follow-up prompts

- **A bug:** "In Level 2 the cat sees me through the right sideboard. Write a failing test for the raycast through B tiles first, then fix it."
- **Tuning:** "Level 3 is too hard: Pip gets caught every time. Suggest changes to tuning numbers or the Level 3 file only, explain each one, and don't touch other code."
- **Art:** "Write the furniture builder for `shoe_bench`: a low wooden bench with 4 legs and room underneath, toon material from the palette, outline, 3 tiles wide."
- **A model:** "I added kiwi.glb to client/public/models. Add it to models.json at height 0.5, facing +Z, and keep the primitive version as a fallback if loading fails."
- **Learning:** "Explain how a player's movement travels from my keyboard to the other two screens, file by file, like I'm new to networking."

## 16. Testing, LAN Party runbook and credits

Test every level against the same checklist, rehearse the LAN setup the night before, and keep a credits file from day one so the final build is clean.

### Level playtest checklist

Run this after building each level, and again after any tuning change.

- [ ] The intended solution works, start to finish.
- [ ] A careless team gets caught at least once.
- [ ] A first-time team clears it in 3–6 minutes.
- [ ] From Level 3 on, every role does something that matters.
- [ ] No softlocks: a dropped item always lands on a walkable tile; the cat can't stand in the exit gap; a door can't trap someone.
- [ ] 2 stars and 3 stars are both possible.
- [ ] The cat's cone, "?" and "!" are readable on a laptop screen from a normal sitting distance.

### Technical checks

- [ ] Refreshing a tab mid-level reconnects that player within 30 s.
- [ ] If the host leaves, another player becomes host and can continue.
- [ ] Still playable with 150 ms of added latency (browser dev tools network throttling).
- [ ] 30 fps or better with Low graphics on the weakest laptop you have. Merge static furniture into few meshes per level, and check `renderer.info` for under 300 draw calls.
- [ ] Nothing loads from the internet: fonts, models and sounds are all in the project, so it works offline on a LAN.
- [ ] `npm test` passes; the browser console shows no errors in a full run.

### LAN Party runbook (Fri Nov 27)

**The night before**

1. Pull the latest code, run `npm ci` and `npm test`, then play Levels 1–4 in three tabs.
2. Charge the host laptop and bring its charger.
3. Set up a Discord or phone call as a voice backup.
4. Write the steps below on a card.

**At the party**

1. Connect the host laptop to the party Wi-Fi and find its IP address (on Windows: `ipconfig`, the IPv4 Address line).
2. Run `npm run dev`. If Windows asks, allow Node.js through the firewall on private networks.
3. Each player opens `https://<host IP>:5173` and accepts the certificate warning once (Advanced, then Continue).
4. The host creates the room and reads the code out loud. Everyone picks a role and tests their mic. Headphones stop echo.
5. Start at Level 1. Keep a notebook: where people got stuck, what made them laugh, every bug. This is the to-do list for Phases 6–8.

| Problem | Fix |
| --- | --- |
| Others can't open the page | Same Wi-Fi? Firewall allowed? Some venue Wi-Fi blocks laptops from seeing each other: switch everyone to a phone hotspot |
| No microphone prompt | The page must be HTTPS. Check the address bar's lock or site settings: the mic may be blocked |
| Echo or feedback | Headphones, or push-to-talk only |
| Laggy | Turn on Low graphics, close other tabs, plug in the charger |
| Cat frozen, nobody moves | The server probably crashed: read the terminal, restart `npm run dev`, rejoin with a new code |

### `CREDITS.md` template

```markdown
# Credits

Game by Maliha Nahiyan Srotosshini — design, writing, art direction, code direction.
Made for CGDD, Fall 2026.

Built with Three.js (MIT), Colyseus (MIT) and Vite (MIT).
3D characters made with Tripo AI and edited by the author.
Code written with Claude Code.

| File | Author | Licence | Link |
| --- | --- | --- | --- |
| audio/sfx/squeak_01.ogg | Self-recorded | — | — |
| audio/sfx/bell_jingle.ogg | (name) | CC0 | (freesound link) |
| audio/music/calm.ogg | (name) | CC-BY 4.0 | (link) |
```

### Sources

- [Colyseus documentation](https://docs.colyseus.io/)
- [Colyseus: migrating to 0.17](https://docs.colyseus.io/migrating/0.17)
