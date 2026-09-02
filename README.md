# Party Arena

Shared-screen client for the Office Party arena. React + TypeScript + Vite, styled
entirely with inline style objects driven by `src/theme` — there are no stylesheets
beyond the font links and three keyframes in `index.html`.

The arena is the big screen in the room. It **creates and owns** the room, shows the
join code, and drives start/skip; phones join with that code and do the playing.

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
| `VITE_ROOM_CODE` | Room to display. Empty (the default) creates a new room on connect. |
| `VITE_DISPLAY_NAME` | Name the arena takes in the player list. |
| `VITE_JOIN_URL` | Join address printed under the room code. |

## Structure

```
src/
  shared/       COPY of OfficePartyBE/src/shared — the wire contract
  types/        arena-only view models
  theme/        design tokens + reusable style fragments
  content/      per-game copy for the reveal screen (rules, input, length)
  socket/       connection, session, useRoom / useLiveRound / useConnectionStatus
  selectors/    RoomStatePayload -> view models
  hooks/        generic hooks
  components/
    ui/         primitives: PushButton, Pill, Avatar, Panel, StripeBar
    Arena/      container: binds room state to layout + phase router
    ArenaLayout/ chrome: stripe, header, notice, phase pane, scoreboard rail
    Lobby/ GameReveal/ GamePlay/ RoundResults/ FinalStandings/
    Scoreboard/ ConnectionGate/
```

## Server contract

`src/shared/` is copied verbatim from the backend and is the single source of
truth for message shapes. Re-copy it whenever the backend's changes:

```bash
cp -R ../OfficePartyBE/src/shared/{constants.ts,protocol.ts,games} src/shared/
```

Three things about the protocol shape the client:

**The handshake carries a version.** `PROTOCOL_VERSION` goes in socket.io's `auth`;
a mismatch is refused at the namespace with `protocol:mismatch`, which surfaces as
a `connect_error` rather than a normal event.

**Intents are acknowledged, not broadcast back.** Every client event takes an ack
returning `{ok: true, data}` or `{ok: false, code, message}`. Joining is how the
arena learns its own `playerId`, which is persisted in `localStorage` so a reload
reclaims the same slot — and with it ownership — instead of taking a second one.

**`room:state` is not re-sent on every round transition.** Its `round` view is
accurate when sent, but the server does not broadcast state as a round moves
ready-check → starting → countdown → playing → results; those are the round
events. `useLiveRound` folds `competition:gameStarting`, `round:data`,
`round:readyState`, `round:startAt` and `round:results` on top of the last
snapshot. The countdown runs off `startAt`'s own `serverTimeMs`, so no clock
sync is needed — the arena displays time, it never measures it.

### The display role

The arena joins with `display: true`. The server marks it a permanent spectator,
so it is never a round participant: it cannot hold up a ready check or a result
timeout, and it does not appear in the standings or the player count. It is still
the room owner, which is what lets it start the run and skip the results screen.
