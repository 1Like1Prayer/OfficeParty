# Party Arena

Shared-screen client for the Office Party arena. React + TypeScript + Vite, styled
entirely with inline style objects driven by `src/theme` — there are no stylesheets
beyond the font links and three keyframes in `index.html`.

## Run

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env` and point `VITE_SOCKET_URL` at the socket.io backend.

## Structure

```
src/
  types/        shared types (game, player, room, socket contract, view models)
  theme/        design tokens + reusable style fragments
  socket/       socket.io connection, useRoom / useConnectionStatus hooks
  selectors/    RoomState -> view models (labels, scoreboard, results, playlist)
  hooks/        generic hooks
  components/
    ui/         primitives: PushButton, Pill, Avatar, Panel, StripeBar
    Arena/      container: binds room state to layout + phase router
    ArenaLayout/ chrome: stripe, header, phase pane, scoreboard rail
    Lobby/ GameReveal/ GamePlay/ RoundResults/ FinalStandings/
    Scoreboard/ ConnectionGate/
```

Each component tree owns its folder and re-exports through `index.ts`. Types shared
across trees live in `src/types` only.

## Server contract

The server is authoritative: the client emits intents and re-renders whatever
`room:state` says. Nothing is mutated locally.

Client to server (`ClientToServerEvents`):

| Event | Payload | Meaning |
| --- | --- | --- |
| `room:join` | `code: string` | Subscribe this screen to a room |
| `run:start` | – | Lobby: begin the run |
| `game:begin` | – | Reveal: everyone is ready |
| `game:finish` | – | Playing: score the round |
| `game:next` | – | Results: advance, or finish the run |
| `run:reset` | – | Final: play again |

Server to client (`ServerToClientEvents`):

| Event | Payload |
| --- | --- |
| `room:state` | `RoomState` — code, phase, currentIndex, playlist, players |
| `room:error` | `string` |

See `src/types/socket.ts` and `src/types/room.ts`; both files are safe to share
with the Node backend verbatim.
