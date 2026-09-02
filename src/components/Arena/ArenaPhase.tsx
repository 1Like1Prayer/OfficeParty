import {
  selectChampionLine,
  selectChampionNote,
  selectCurrentGame,
  selectIsLastGame,
  selectResultRows,
  selectWinnerLine,
} from '../../selectors/index.ts'
import type { RoomActions } from '../../socket/index.ts'
import type { RoomState } from '../../types/index.ts'
import { FinalStandings } from '../FinalStandings/index.ts'
import { GamePlay } from '../GamePlay/index.ts'
import { GameReveal } from '../GameReveal/index.ts'
import { Lobby } from '../Lobby/index.ts'
import { RoundResults } from '../RoundResults/index.ts'

interface ArenaPhaseProps {
  room: RoomState
  actions: RoomActions
}

/** Maps the server's phase onto the screen that owns it. */
export function ArenaPhase({ room, actions }: ArenaPhaseProps) {
  const game = selectCurrentGame(room)

  switch (room.phase) {
    case 'lobby':
      return (
        <Lobby
          roomCode={room.code}
          gameCount={room.playlist.length}
          onStartRun={actions.startRun}
        />
      )

    case 'reveal':
      return game ? (
        <GameReveal
          game={game}
          gameNumber={room.currentIndex + 1}
          totalGames={room.playlist.length}
          onBeginGame={actions.beginGame}
        />
      ) : null

    case 'playing':
      return game ? <GamePlay gameName={game.name} onFinishGame={actions.finishGame} /> : null

    case 'results':
      return (
        <RoundResults
          gameName={game?.name ?? ''}
          winnerLine={selectWinnerLine(room)}
          rows={selectResultRows(room)}
          nextLabel={selectIsLastGame(room) ? 'Final standings' : 'Next game'}
          onNextGame={actions.nextGame}
        />
      )

    case 'final':
      return (
        <FinalStandings
          championLine={selectChampionLine(room)}
          championNote={selectChampionNote(room)}
          onResetRun={actions.resetRun}
        />
      )
  }
}
