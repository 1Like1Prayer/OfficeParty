# Sound effects map

Every sound in the game, where it is heard, and what is still missing.

Every sound is a **file** under `src/assets/audio/sfx/`: one-shots as **.mp3** (32 kHz, 96 kbps mono; the gulls 128 kbps stereo), loops as **.wav** (so they come round without a gap; the deep ones at 16 kHz). About 2.3 MB in all. The game plays those files; pitch, volume, ducking, gating and the channel are still applied at playback, so a sound can follow the game (danger, points, distance). How to replace or regenerate them is in the project README, under *Sound effects*.

```
src/assets/audio/sfx/
  shared/ui/ shared/flow/ shared/ambience/      the shared sounds
  games/<game>/                                  each game's own
                                                 click.mp3 — one take; key.v1.mp3, key.v2.mp3 … — several, one picked at random; sea.wav — a loop

src/audio/sfx/
  core/      engine.ts (loads and plays the files, channels, unlock, ducking), library.ts (finds the files),
             sound.ts (`sound(id)`, `loopSound(id)`), hooks.ts
  shared/    ui.ts, flow.ts, ambience.ts — how each shared sound is played
  games/     one file per game
  recipes/   the synth code each file was rendered from (dev tool; never shipped)
  index.ts   `sfx` — sfx.ui.click(), sfx.typeRacer.key(), …

tools/sfx/render.html   renders every recipe to a file (see the README)
```

A sound's **id** is its file path without the extension: `sfx.ui.click` plays `shared/ui/click.mp3`. The table rows below are named by their call in `sfx`; the file is the same name in that group's folder (wrapped sounds: `startsInTick`, `cueBeep`, `tick`, `step`, `logRoll`, `tileTouch`, `landSoft`/`landHard`, `cast` + `sparkle`, `digit0`–`digit9`; loops: `shared/ambience/sea`, `shared/ambience/wind`, `games/crusherEscalator/blackHole`, `games/crusherEscalator/escalator`, `games/mageBattle/beam`).

**Legend**

| Mark | Meaning |
| --- | --- |
| ✅ | Done |
| ⬜ | Missing |
| 🎙️ | Would sound much better as a real recording (voices, real-world textures). The current file is a synth stand-in, or there is none yet. |

Columns: **Made** = its file exists. **Wired** = it plays in the game.

**Channels.** Every sound plays on the **effects** channel unless it is marked *(ambience)*. Ambience is the world around a game, so turning it down loses nothing a player needs to hear. Loops that tell players something (the black hole's hunger, the beams' clash) stay on effects. To put a loop on the ambience channel, give it as `loopSound(id, 'ambience')`; for a one-shot sound, pass `channel: 'ambience'` in its defaults.

---

## Engine and settings

| Feature | Status | Where |
| --- | --- | --- |
| One shared `AudioContext`, unlocked on the first click, tap or key | ✅ | `core/engine.ts`, started in `main.tsx` |
| Every file fetched and decoded once in the background as the page loads, shared sounds first (about 2.3 MB in all) | ✅ | `core/engine.ts`, `core/library.ts` |
| Plays in every current browser (.mp3 and .wav, not .ogg, which Safari only gained in 18.4) | ✅ | |
| The silence an MP3 encoder pads the start with is skipped (up to 40 ms), so clicks stay immediate | ✅ | `core/engine.ts` (`leadIn`) |
| Sound files are never inlined into the page's script, however small | ✅ | `vite.config.ts` (`assetsInlineLimit`) |
| Several takes of a sound, one picked at random each play | ✅ | `name.v1.mp3`, `name.v2.mp3`, … |
| Loops saved crossfaded end-to-start, so they repeat without a seam; started from a random point | ✅ | `recipes/render.ts`, `core/engine.ts` |
| A sound asked for that has no file warns once in the console (dev only) | ✅ | `core/engine.ts` |
| Two channels, **effects** and **ambience**, each with its own volume and mute, separate from the music and saved in the browser | ✅ | `core/engine.ts` (`office-party.sfx`) |
| A slider and mute for each channel in the music panel; letting go of a slider plays a sample | ✅ | `MusicControl.tsx` → `SoundChannels` |
| Music ducks under big sounds | ✅ | `backgroundMusic.duck()`, set by `duck` on a sound |
| Limiter on the output, so overlapping sounds never clip | ✅ | `core/engine.ts` |
| Random pitch variation on repeated sounds | ✅ | `vary` option |
| Rate limit (`gate`) so a crowd of events doesn't become a din | ✅ | `gate` / `minGapMs` options |
| Loops (drones, sea, wind) with live level and pitch (playback rate) | ✅ | `sfxEngine.loop()`, `useLoop()` |
| Other players' events quieter than your own | ✅ | Per call site (`volume`) |
| Replacing any sound with a real recording | ✅ | Save it as .mp3 or .wav under the same name (see the README) |
| Small files: one-shots as .mp3, deep loops at 16 kHz | ✅ | 2.3 MB, down from 7.6 MB of .wav |
| Reveal-screen demos stay silent | ✅ | On purpose: the demos don't use the game scenes |

---

## Shared — UI (`shared/ui.ts`)

| Sound | Made | Wired | Heard when / where |
| --- | :-: | :-: | --- |
| `click` | ✅ | ✅ | Any `PushButton` / `BigButton` (`silent` prop skips it), the Back buttons (`LobbyHeader`, `EntryCard`) |
| `toggle` | ✅ | ✅ | Game chips and "select all" (`GamePoolCard`), avatar picks, kick confirm (`ConfirmButton`), SFX mute |
| `key` | ✅ | ✅ | Typing in `TextField` (name) and `CodeBoxes` (room code) |
| `playerJoin` | ✅ | ✅ | Someone appears in the lobby (`Lobby`) |
| `playerLeave` | ✅ | ✅ | Someone leaves or is kicked (`Lobby`) |
| `ready` / `unready` | ✅ | ✅ | "I'm ready" in the lobby and in the game's ready check |
| `copy` | ✅ | ✅ | Room code copied (`RoomCodeButton`) |
| `error` | ✅ | ✅ | Server refusal notice (`ArenaNotice`), copy failed |
| `disconnect` / `reconnect` | ✅ | ✅ | `ConnectionGate` status changes |
| `hover` | ✅ | ✅ | Mouse moving onto any button (`useHover` hook, plus the entry screens' BACK); not on touch, not on disabled buttons |

## Shared — game flow (`shared/flow.ts`)

| Sound | Made | Wired | Heard when / where |
| --- | :-: | :-: | --- |
| `whoosh` | ✅ | ✅ | Every screen change (`ScreenTransition`) |
| `reveal` | ✅ | ✅ | Next game announced (`GameReveal`) |
| `tiebreak` | ✅ | ✅ | A tiebreak announced (`GameReveal`) |
| `startsInTick` | ✅ | ✅ | "Game begins in 3, 2, 1" (`StartsIn`) |
| `cueBeep` / `go` | ✅ | ✅ | GET READY, SET, START! (`ArenaPhase`; TV games in `TvCircleScene`) |
| `swoosh` | ✅ | ✅ | TV intro camera gliding in (`TvCircleScene`) |
| `tvOn` | ✅ | ⬜ | Meant for the TV screens switching on in the intro |
| `drumroll` + `resultsSting` | ✅ | ✅ | Round results (`RoundResults`) |
| `youWon` | ✅ | ✅ | Your row is 1st in the results; you are the last climber in Crusher Escalator |
| `youLost` | ✅ | ⬜ | A sad trombone; decide where (last place? knocked out first?) |
| `scoreTick` | ✅ | ✅ | Your own points go up (`ScoreboardRow`) |
| `eliminated` | ✅ | ✅ | Another player knocked out (Crusher Escalator) |
| `fanfare` + `confetti` | ✅ | ✅ | Champion of the night (`FinalStandings`) |
| Applause / crowd cheer 🎙️ | ⬜ | ⬜ | Champion screen, game wins |

---

## Stop the Clock (`games/stopTheClock.ts`, hook: `StopTheClock/useClockSounds.ts`)

| Sound | Made | Wired | Heard when |
| --- | :-: | :-: | --- |
| `rollClack` | ✅ | ✅ | Each number flicking past in the target roll |
| `rollLand` | ✅ | ✅ | The roll lands on the target |
| `tick` | ✅ | ✅ | Stopwatch running. **Goes silent with the clock on blind targets**, so ears can't count what eyes can't see |
| `stop` | ✅ | ✅ | STOP pressed (button, Space or Enter) |
| `otherLockedIn` | ✅ | ✅ | Another player stops |
| `bullseye` | ✅ | ✅ | You were closest on this target |
| `womp` | ✅ | ✅ | You were furthest |

## Cube Counter (`games/cubeCounter.ts`)

| Sound | Made | Wired | Heard when |
| --- | :-: | :-: | --- |
| `flash` | ✅ | ✅ | Blocks flash up (camera shutter) |
| `hide` | ✅ | ✅ | Blocks vanish and answering starts |
| `digit` | ✅ | ✅ | Each digit typed (phone-keypad tones) |
| `tick` | ✅ | ✅ | Last 3 seconds to answer |
| `correct` / `wrong` / `timeout` | ✅ | ✅ | Answer checked |
| `nextBlip` | ✅ | ✅ | "Next puzzle" card |
| `hop` | ✅ | ⬜ | The three cubes hopping on the intro card (drawn in `tvShow.ts`; needs its timing) |

## Crusher Escalator (`games/crusherEscalator.ts`)

| Sound | Made | Wired | Heard when |
| --- | :-: | :-: | --- |
| `step` | ✅ | ✅ | Correct arrow; pitch climbs with your streak |
| `wrong` | ✅ | ✅ | Wrong arrow (metal clank) |
| `blackHoleLoop` | ✅ | ✅ | Whole race; louder and higher as anyone nears the edge |
| `escalatorLoop` *(ambience)* | ✅ | ✅ | Machinery hum while you climb |
| `gapNarrows` | ✅ | ✅ | "CRUSHED AT n BEHIND" shrinks |
| `swallowed` | ✅ | ✅ | You fall into the black hole |
| Others swallowed | ✅ | ✅ | `flow.eliminated`, quieter |
| Win | ✅ | ✅ | `flow.youWon` |
| Heartbeat when **you** are close to the edge | ⬜ | ⬜ | Build from your own `slipFraction` |
| Scream as you fall 🎙️ | ⬜ | ⬜ | |

## Type Racer Roulette (`games/typeRacer.ts`; wired in `typing/useSceneSync.ts`, `scene/FrontDie.ts`, `scene/Station.ts`)

| Sound | Made | Wired | Heard when |
| --- | :-: | :-: | --- |
| `key` 🎙️ | ✅ | ✅ | Each correct key (your own only) |
| `lineDone` 🎙️ | ✅ | ✅ | Carriage bell and return |
| `jam` | ✅ | ✅ | Wrong key / strike |
| `newSheet` | ✅ | ✅ | New paragraph |
| `creak` | ✅ | ✅ | Second strike: the board strains |
| `diceShake` | ✅ | ✅ | Third strike: die picked up |
| `diceThrow` / `diceLand` | ✅ | ✅ | Die thrown and lands (`FrontDie`) |
| `safe` / `skull` | ✅ | ✅ | Roll result |
| `crack` + `splash` 🎙️ | ✅ | ✅ | Block crumbles; full for you, quieter for others (`Station`) |
| `timerTick` | ✅ | ✅ | Last 5 seconds of a paragraph |
| `win` | ✅ | ✅ | All paragraphs typed / last survivor |
| `seaLoop` *(ambience)* | ✅ | ✅ | Waves under the boards, whole round |
| `ambience.seagulls` *(ambience)* | ✅ | ✅ | Over the sea every 6–14 s, panned left or right, sometimes answered by a second gull (`shared/ambience.ts`) |
| Other players' typing | — | — | Left silent on purpose (eight typewriters is noise) |

## Log Dodge (`games/logDodge.ts`)

| Sound | Made | Wired | Heard when |
| --- | :-: | :-: | --- |
| `seaLoop` *(ambience)* | ✅ | ✅ | Sea waves, whole round (no treadmill or wind sound, on purpose) |
| `ambience.seagulls` *(ambience)* | ✅ | ✅ | Gulls every 7–16 s while the round runs |
| `logRoll` | ✅ | ✅ | 0.7 s before each log arrives; higher for head-height logs |
| `jump` / `duck` | ✅ | ✅ | Your own moves |
| `hit` + `lifeLost` | ✅ | ✅ | A log hits you |
| `knockedOut` | ✅ | ✅ | Third hit: thrown off the back, splash |
| `win` | ✅ | ✅ | Last one standing |
| "Oof" / yell voices 🎙️ | ⬜ | ⬜ | Layer on `hit` / `knockedOut` |
| Other players' hits | ⬜ | ⬜ | Could reuse `hit` at low volume |

## Minefield (`games/minefield.ts`; blasts and sonar in `scene/MinefieldScene.ts`)

| Sound | Made | Wired | Heard when |
| --- | :-: | :-: | --- |
| `footstep` | ✅ | ✅ | Your runner moving |
| `sonar` | ✅ | ✅ | Anyone's scan; quieter the further away |
| `sonarReady` | ✅ | ✅ | Your sonar has recharged |
| `mineRevealed` | ✅ | ✅ | A mine pops up from a scan |
| `explosion` | ✅ | ✅ | Any mine; volume and music duck depend on distance |
| `earRing` | ✅ | ✅ | A blast right beside you |
| `out` | ✅ | ✅ | Second blast: you're out |
| `finish` | ✅ | ✅ | You cross the line |
| Blast-protection shimmer | ⬜ | ⬜ | While `isProtected` blinks |
| Proximity "geiger" clicks | ⬜ | ⬜ | **Design call:** it would give away hidden mines |
| Crowd cheer at the finish 🎙️ | ⬜ | ⬜ | |

## Hex Drop (`games/hexDrop.ts`; wired in `HexDropGame.ts`)

| Sound | Made | Wired | Heard when |
| --- | :-: | :-: | --- |
| `tileTouch` | ✅ | ✅ | Stepping on a new tile; lower on each floor down |
| `tileWarning` | ✅ | ✅ | The tile under you has under 1 s left |
| `tileDrop` | ✅ | ✅ | Any tile dropping (louder for ones you touched) |
| `jump` / `land` | ✅ | ✅ | Jump; soft landing, or hard after dropping a floor |
| `falling` | ✅ | ✅ | Falling fast through a gap |
| `out` | ✅ | ✅ | You fall through the bottom floor |
| `rivalOut` | ✅ | ✅ | Someone else falls out |
| `win` | ✅ | ✅ | Last one standing |
| "Aaah" falling scream 🎙️ | ⬜ | ⬜ | |

## Mage Battle (`games/mageBattle.ts`; wired in `MageBattleGame.ts`, `scene/MageBattleScene.ts`)

| Sound | Made | Wired | Heard when |
| --- | :-: | :-: | --- |
| `cast` | ✅ | ✅ | A spell lands; bigger for more points (sparkles at 3+); others' quieter |
| `fizzle` | ✅ | ✅ | A miss or an unpressed spin; others' quieter |
| `spent` | ✅ | ✅ | Pressing again in a spin already used |
| `beamFire` | ✅ | ✅ | Each mage's beam firing at the start |
| `beamLoop` | ✅ | ✅ | Electric hum that swells with the clash's power |
| `windLoop` *(ambience)* | ✅ | ✅ | Wind round the stones |
| `knockedOut` | ✅ | ✅ | A mage drops 7 behind (yours full, others quieter) |
| `win` | ✅ | ✅ | Last mage standing |
| Dial needle whoosh per spin | ⬜ | ⬜ | Pitch could follow dial speed |
| Charge-up hum before the beam fires | ⬜ | ⬜ | `Mage.setCharge` |

---

## Still to do

- [ ] Record or source the 🎙️ sounds and drop them in as .mp3: typewriter keys and bell, splash, wood crack, voices (oof, scream, aaah), crowd cheer (Kenney.nl and Freesound CC0 are good sources)
- [ ] Wire `flow.tvOn` into the TV intro
- [ ] Decide where `flow.youLost` plays, then wire it
- [ ] Cube Counter intro `hop` (timed to `tvShow.ts`)
- [ ] Crusher Escalator heartbeat near the edge
- [ ] Log Dodge: others' hits
- [ ] Minefield blast-protection shimmer; decide on the geiger clicks
- [ ] Mage Battle dial whoosh and charge-up hum
- [ ] Listen to everything in a real 4–8 player game and tune the volumes

## Replacing or regenerating a sound

See **Sound effects** in the project README: dropping in a recording, and re-rendering every file from the recipes (needs `npm run dev` and ffmpeg).

## Adding a sound

1. Write its recipe in `recipes/shared/…` or `recipes/games/<game>.ts`: `name: oneShot((v) => { tone(v, …); noise(v, …) })`, or `loop(builder, seconds)` for a loop (`LOW_RATE` for a deep one). Re-render. (Or skip the recipe and drop in a recording.)
2. Add it to the group's runtime file: `name: sound('games/<game>/name', defaults)`.
3. Call it where the event happens: `sfx.<group>.<name>()`. For other players' events, pass a lower `volume` and a `gate`.
4. Add a row here.
