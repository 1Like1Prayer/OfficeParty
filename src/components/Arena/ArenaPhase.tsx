import { useMemo } from 'react'
import { useCountdown } from '../../hooks/index.ts'
import {
  initialOf,
  playerColor,
  selectChampionLine,
  selectChampionNote,
  selectCurrentGame,
  selectNames,
  selectPlayStatusLine,
  selectResultEyebrow,
  selectResultHeadline,
  selectResultRows,
  selectStandingRows,
  selectStartBlockedLine,
} from '../../selectors/index.ts'
import { JOIN_URL } from '../../socket/config.ts'
import type { RoomActions, UseRoomResult } from '../../socket/index.ts'
import { FinalStandings } from '../FinalStandings/index.ts'
import { GamePlay } from '../GamePlay/index.ts'
import { GameReveal } from '../GameReveal/index.ts'
import { Lobby } from '../Lobby/index.ts'
import { RoundResults } from '../RoundResults/index.ts'

interface ArenaPhaseProps {
  room: NonNullable<UseRoomResult['state']>
  round: UseRoomResult['round']
  results: UseRoomResult['results']
  leaderboard: UseRoomResult['leaderboard']
  progress: UseRoomResult['progress']
  actions: RoomActions
}

/**
 * Maps the room's phase — and inside a competition, the round's — onto the
 * screen that owns it.
 */
export function ArenaPhase({
  room,
  round,
  results,
  leaderboard,
  progress,
  actions,
}: ArenaPhaseProps) {
  const { timingStartsAtLocalMs } = round
  const msLeft = useMemo(
    () =>
      timingStartsAtLocalMs === null
        ? null
        : () => timingStartsAtLocalMs - performance.now(),
    [timingStartsAtLocalMs],
  )
  const countdownMs = useCountdown(round.phase === 'countdown' ? msLeft : null)

  const lights = useMemo(
    () =>
      round.participants.map((playerId) => {
        const name = room.players.find((p) => p.playerId === playerId)?.name ?? '?'
        return {
          id: playerId,
          initial: initialOf(name),
          color: playerColor(playerId),
          active: progress[playerId]?.['running'] === 1,
        }
      }),
    [round.participants, room.players, progress],
  )

  if (room.phase === 'lobby') {
    return (
      <Lobby
        roomCode={room.roomCode}
        joinUrl={JOIN_URL}
        roundsPerGame={room.lobby.roundsPerGame}
        roundsOptions={room.lobby.roundsPerGameOptions}
        minPlayers={room.minPlayers}
        maxPlayers={room.maxPlayers}
        canStart={room.lobby.canStart}
        startNote={selectStartBlockedLine(room)}
        onStart={actions.start}
        onSetRounds={actions.setRoundsPerGame}
      />
    )
  }

  if (room.phase === 'leaderboard') {
    return (
      <FinalStandings
        championLine={leaderboard ? selectChampionLine(room, leaderboard) : 'That’s the run.'}
        championNote={
          leaderboard ? selectChampionNote(room, leaderboard) : 'Counting the last round…'
        }
        rows={leaderboard ? selectStandingRows(room, leaderboard) : []}
        onBackToLobby={actions.skip}
      />
    )
  }

  const game = selectCurrentGame(round)

  switch (round.phase) {
    case 'results':
      return results ? (
        <RoundResults
          eyebrow={selectResultEyebrow(results)}
          headline={selectResultHeadline(room, results)}
          rows={selectResultRows(room, results)}
          // Only a resolved scoring round sits on a timer worth skipping; a
          // tiebreak rolls straight into its next attempt.
          skipLabel={results.isFinal ? 'Skip ahead' : null}
          onSkip={actions.skip}
        />
      ) : null

    case 'countdown':
    case 'playing':
      return game ? (
        <GamePlay
          gameName={game.title}
          statusLine={selectPlayStatusLine(room, round)}
          countdownMs={round.phase === 'countdown' ? (countdownMs ?? 0) : null}
          lights={lights}
        />
      ) : null

    default:
      return game ? (
        <GameReveal
          game={game}
          gameIndex={round.gameIndex}
          totalGames={round.totalGames}
          isTiebreak={round.isTiebreak}
          waitingFor={selectNames(room, round.waitingFor)}
          readyCount={round.ready.length}
          participantCount={round.participants.length}
        />
      ) : null
  }
}
