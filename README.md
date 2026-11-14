# Office Party

Multiplayer party games for a room full of desks. React + TypeScript + Vite,
styled entirely with inline style objects driven by `src/theme` — there are no
stylesheets beyond the font links and the keyframes in `index.html`.

Everyone plays on their own machine. One person **hosts** and gets a room code,
everyone else **joins** with it, and each person names themselves on the way in.
The host owns the room: they pick the settings and start the run. Everything
works with a mouse, a keyboard or a touchscreen.

The room code is a button — clicking it copies the code, and the join screen
takes a paste, so sharing a room is copy in one window and paste in the next.

## Run

```bash
npm install
cp .env.example .env   # points at http://localhost:2567
npm run dev
```

The Colyseus server (`../OfficePartyV2`) must be running: `npm start` there
listens on port 2567.

| Variable | Meaning |
| --- | --- |
| `VITE_SERVER_URL` | The Colyseus server's HTTP(S) origin, e.g. `http://localhost:2567`. |
| `VITE_ROOM_CODE` | Rejoin this room on load instead of showing the title card. Normally empty. |

## Testing locally

**Two tabs are two players.** The stored identity lives in `sessionStorage`, which
is per-tab, so one tab is one person: host in the first, join from the second with
the code, and play both. The room needs `ROOM.MIN_PLAYERS` (2) to start.

Watch the timing when testing by hand: a round resolves as soon as everyone has
reported, and otherwise closes at `targetMs + 4s`. Leave it too long and both
players are recorded as no-shows.

## Structure

```
src/
  shared/       COPY of OfficePartyV2/src/shared — the wire contract and game rules
  types/        client-only view models
  theme/        design tokens + reusable style fragments
  content/      per-game copy, and the avatar catalogue
  network/      Colyseus connection: PartyConnection, RoomView, useRoom / useLiveRound
  selectors/    RoomView -> view models
  games/        the playable surfaces, one folder per game
  hooks/        generic hooks
  components/
    ui/         primitives: BigButton, PushButton, TextField, Pill, Avatar, …
    Arena/      container: stage router (title / host / join / room) + phases
    ArenaLayout/ chrome: stripe, header, notice, pane, scoreboard rail
    TitleScreen/ EntryScreen/   entrance: name yourself, then host or join
    Lobby/ GameReveal/ GamePlay/ RoundResults/ FinalStandings/
    Scoreboard/ ConnectionGate/
```

## Adding a game

The server owns the rules; the client owns the surface. To make a catalogued
game playable, add a module on the server (`shared/games/`, registered in
`server/games/registry.ts`), then here:

1. A component under `src/games/<Game>/` taking `GameSurfaceProps` — the public
   round data, the local time the clock starts, and callbacks to submit a
   result and report display-only progress.
2. A `case` in `src/games/index.tsx` and its id in `src/games/playable.ts`.
3. Reveal copy in `src/content/gameCopy.ts`.

A surface is mounted from the `starting` phase, so it has the server's
`START_LEAD_MS` to build up to the round before the countdown, and only takes
input at `playing`. It never scores anything: it measures its own player and
reports, and the server ranks.

A round is handed over in two beats, both server-scheduled:

| phase | length | screen |
| --- | --- | --- |
| `starting` | `START_LEAD_MS` (4.5s) | the room, counting the round in: 3, 2, 1 |
| `countdown` | `COUNTDOWN_MS` (7.5s) | the game screen: title, its build-up, then "get ready / set / start!" |
| `playing` | until stopped, or `target + 4s` | the game, taking input |

Twelve seconds pass between the last player readying and the clock running,
and that is deliberate: a round throws a lot at you at once — a new screen, a
new game, a target — and the pacing is there so each part can be read before
the next arrives.

Both count-ins are **beat-based, not second-based**: `beatsRemaining` splits a
window into N beats, so "3, 2, 1" always shows three numbers however long the
window is, holding each for longer when the window grows. Lengthening a
count-in is therefore a single constant, with no copy to keep in step.

The round's window splits client-side: the last `ROUND_CUE_MS` (3.6s) is the
start cue, and the game's build-up gets whatever is left (3.9s). So raising
`COUNTDOWN_MS` lengthens the build-up and leaves the cue alone.

`StopTheClock` is the worked example. It spins decoy targets through
`countdown` so the real one lands rather than appearing, then runs the clock —
visible — until the player stops it. It measures with `performance.now()`, so
the number on screen is the number reported, and flags itself `timingSuspect`
if the tab was hidden mid-round.

## Server contract

`src/shared/` is copied verbatim from the server and is the single source of
truth for message shapes, the synced state's shape and the game rules.
Re-copy it whenever the server's changes:

```bash
rsync -a --delete --exclude '*.test.ts' --exclude README.md \
  ../OfficePartyV2/src/shared/ src/shared/
```

Everything that talks to the server lives in `src/network/`. Screens never
touch the Colyseus SDK:

- **Joining.** `client.create('party', …)` hosts and `client.joinById(code, …)`
  joins; the room code is the Colyseus room id. The join options carry
  `PROTOCOL_VERSION`, and an outdated page is refused with
  `PROTOCOL_MISMATCH_CODE`, which `ConnectionGate` shows as "please reload".
- **State.** `PartyConnection` subscribes to the room's synced state and turns
  it into a `RoomView` (`roomView.ts`), the shape the selectors render. Players,
  lobby, round phase, points and live progress all arrive this way, so nothing
  sits a round behind. A view is replaced only when its content changed, and
  React reads it through `useSyncExternalStore`.
- **Messages.** Round data, results, the closing notice and the leaderboard are
  one-off events, folded in by `roundEvents.ts`.
- **Requests.** Every intent is `room.request(...)`; a refusal carries the
  server's `{ code, message }`, shown as a notice until the room next changes.
- **Time.** `PartyConnection` pings the server and keeps a `ClockSync`
  estimate. When a start is scheduled, its local time is fixed once for that
  attempt (games measure their player from it), and `useLiveRound` flips the
  phase to `countdown` and `playing` at exactly those local instants.
- **Reloads.** The seat's `reconnectionToken` is kept in `sessionStorage`. A
  reload resumes it with `client.reconnect`; if the server has let the seat go,
  it joins the same room again. A dropped connection is retried by the SDK
  while the server holds the seat, and `ConnectionGate` says so.

### Avatars

Players pick a face on the way in, and it has to reach everyone else, so it
travels through the synced state like everything else: `PlayerView.avatar`.

What travels is a **seed, never a URL**. The client turns the seed into a
DiceBear image in `src/content/avatars.ts`; the server stores an opaque token
and validates it against `AVATAR.SEED_PATTERN`, so nobody can make the rest of
the room's browsers fetch an address of their choosing. An unrecognised seed
falls back to the player's id, which always renders something.

DiceBear is a third party, so `Avatar` draws the player's initial underneath
the artwork rather than instead of it: an offline room, a blocked request or a
slow response degrades to the letter instead of an empty square.

### Who can do what

Owner-only intents (`lobby:start`, `lobby:setMode`, `competition:skip`,
`competition:skipGame`, `competition:toLobby`, `room:kick`) are refused
server-side for anyone else, so those controls render read-only unless
`room.ownerId` is this player. Everyone else gets a ready button instead; the
owner is held ready by the server.

During a run the owner gets a floating host bar (`HostControls`): **Next game**
abandons the current game (the unfinished round scores nothing) and starts the
next one, or shows the final scores after the last game; **Back to lobby** ends
the run. The owner can also remove a player with the × on their avatar in the
lobby or their scoreboard row. Each of these asks for a second press. A removed
player is disconnected with `KICKED_CODE`, their stored seat is forgotten, and
the title screen tells them why.

Someone who joins mid-run is a spectator until the room returns to the lobby —
they are not in `round.participants`, so they get no play surface and the round
does not wait for them.

## Screens

The layout follows the design canvas (`Party Arena.dc.html`): the title and
entry cards run without chrome, the lobby is a pegboard of floating avatars
beside the rounds and game-pool cards, and a live round takes the whole screen —
no header, no rail — because that is when nothing else matters. The scoreboard
rail is up for the reveal, results and final standings, and marks your own row.

The game pool writes straight through to `lobby:setMode`: selecting everything
playable sends `random`, any subset sends `custom` with those ids. Games the
server has no module for are drawn dashed and cannot be picked, because
`buildCustomPlaylist` rejects them.
