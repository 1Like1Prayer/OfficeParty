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
cp .env.example .env   # points at http://localhost:3000/game
npm run dev
```

The backend (`../OfficePartyBE`) must be running: `npm run dev` there listens on
`PORT` from `.env.development` and mounts the game on the `/game` namespace, so
`VITE_SOCKET_URL` includes it.

| Variable | Meaning |
| --- | --- |
| `VITE_SOCKET_URL` | Backend origin **including** `/game`. Empty uses the page origin. |
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
  shared/       COPY of OfficePartyBE/src/shared — the wire contract
  types/        client-only view models
  theme/        design tokens + reusable style fragments
  content/      per-game copy for the reveal screen
  socket/       connection, session, useRoom / useLiveRound / useConnectionStatus
  selectors/    RoomStatePayload -> view models
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
`game/registry.ts`), then here:

1. A component under `src/games/<Game>/` taking `GameSurfaceProps` — the public
   round data, the local time the clock starts, and callbacks to submit a
   result and report display-only progress.
2. A `case` in `src/games/index.tsx` and its id in `src/games/playable.ts`.
3. Reveal copy in `src/content/gameCopy.ts`.

A surface is mounted from the `starting` phase, so it has the server's
`START_LEAD_MS` to build up to the round before the countdown, and only takes
input at `playing`. It never scores anything: it measures its own player and
reports, and the server ranks.

`StopTheClock` is the worked example. During `starting` it spins decoy targets
drawn from the same picker the server uses, so the real one lands rather than
appearing; then the countdown runs against the settled number; then the clock
runs, invisibly, until the player stops it. It measures with `performance.now()`
and flags itself `timingSuspect` if the tab was hidden mid-round.

## Server contract

`src/shared/` is copied verbatim from the backend and is the single source of
truth for message shapes. Re-copy it whenever the backend's changes:

```bash
cp -R ../OfficePartyBE/src/shared/{constants.ts,protocol.ts,games} src/shared/
```

Three things about the protocol shape the client:

**The handshake carries a version.** `PROTOCOL_VERSION` goes in socket.io's `auth`;
a mismatch is refused at the namespace with `protocol:mismatch`, which surfaces
as a `connect_error` rather than a normal event.

**Intents are acknowledged, not broadcast back.** Every client event takes an ack
returning `{ok: true, data}` or `{ok: false, code, message}`. Joining is how a
player learns their own `playerId`, which is kept in `sessionStorage` so a reload
rejoins the same slot — and with it their score and any ownership — rather than
taking a second one.

**`room:state` is not re-sent on every round transition.** Its `round` view and
its `players[].points` are accurate when sent, but the server does not broadcast
state as a round moves ready-check → starting → countdown → playing → results,
nor when a round awards a point. Both would otherwise sit a round behind:

- `useLiveRound` folds `competition:gameStarting`, `round:data`,
  `round:readyState`, `round:startAt` and `round:results` on top of the last
  snapshot's round view. The countdown runs off `startAt`'s own `serverTimeMs`,
  so no clock sync is needed.
- `useRoom` folds `round:results` and `competition:scores` into a live score
  map the scoreboard prefers over the snapshot. Awards only ever go up inside a
  competition, so this can never show less than the snapshot does.

### Who can do what

Owner-only intents (`lobby:start`, `competition:skip`, `lobby:setMode`,
`lobby:setRounds`) are refused server-side for anyone else, so those controls
render read-only unless `room.ownerId` is this player. Everyone else gets a
ready button instead; the owner is held ready by the server.

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
