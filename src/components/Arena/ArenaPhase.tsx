import { useCallback, useMemo } from 'react'
import { GameSurface } from '../../games/index.tsx'
import { hasSurface } from '../../games/playable.ts'
import { beatsRemaining, useCountdown } from '../../hooks/index.ts'
import {
  selectChampionLine,
  selectChampionNote,
  selectCurrentGame,
  selectFloaters,
  selectLobbyEmptyLine,
  selectNames,
  selectPlayStatusLine,
  selectPoolChips,
  selectResultEyebrow,
  selectResultHeadline,
  selectResultRows,
  selectSelectedGames,
  selectSetupSummary,
  selectStartBlockedLine,
  selectToggleAllLabel,
} from '../../selectors/index.ts'
import { cueFrom } from '../GamePlay/cue.ts'
import { START_BEATS } from '../GameReveal/StartsIn.tsx'
import { SELF_TIMED } from '../../shared/constants.ts'
import type { GameId } from '../../shared/games/catalog.ts'
import type { RoomActions, UseRoomResult } from '../../socket/index.ts'
import { FinalStandings } from '../FinalStandings/index.ts'
import { GamePlay } from '../GamePlay/index.ts'
import { GameReveal } from '../GameReveal/index.ts'
import { Lobby } from '../Lobby/index.ts'
import { RoundResults } from '../RoundResults/index.ts'

interface ArenaPhaseProps {
  room: NonNullable<UseRoomResult['state']>
  /** This player's id — the whole screen is shaped by which player it is. */
  playerId: string | null
  round: UseRoomResult['round']
  results: UseRoomResult['results']
  leaderboard: UseRoomResult['leaderboard']
  actions: RoomActions
}

/**
 * Maps the room's phase — and inside a competition, the round's — onto the
 * screen that owns it, from this player's point of view.
 */
export function ArenaPhase({
  room,
  playerId,
  round,
  results,
  leaderboard,
  actions,
}: ArenaPhaseProps) {
  const me = room.players.find((player) => player.playerId === playerId)
  // Every owner-only intent is refused server-side; this stops the screen
  // offering buttons that would only come back as an error.
  const isOwner = playerId !== null && room.ownerId === playerId
  const isParticipant = playerId !== null && round.participants.includes(playerId)
  const hasReadied = playerId !== null && round.ready.includes(playerId)

  // The server schedules the round to take over at `startAt`, then start
  // timing COUNTDOWN_MS later. The room counts down to the first of those; the
  // game screen owns everything after it.
  const { timingStartsAtLocalMs } = round
  const takesOverAtLocalMs =
    timingStartsAtLocalMs === null ? null : timingStartsAtLocalMs - SELF_TIMED.COUNTDOWN_MS
  const msToTakeover = useMemo(
    () =>
      takesOverAtLocalMs === null ? null : () => takesOverAtLocalMs - performance.now(),
    [takesOverAtLocalMs],
  )
  const startsInBeats = beatsRemaining(
    useCountdown(round.phase === 'starting' ? msToTakeover : null),
    SELF_TIMED.START_LEAD_MS,
    START_BEATS,
  )

  // Inside the round's own window: the game builds up first, then the last
  // ROUND_CUE_MS is the get-ready / set / start count.
  const msToPlay = useMemo(
    () =>
      timingStartsAtLocalMs === null
        ? null
        : () => timingStartsAtLocalMs - performance.now(),
    [timingStartsAtLocalMs],
  )
  const cueBeats = cueFrom(useCountdown(round.phase === 'countdown' ? msToPlay : null))

  const selected = selectSelectedGames(room)
  const playable = room.lobby.playableGames

  const setPool = (ids: GameId[]) => {
    // Everything playable is exactly what random mode draws from, so say so
    // rather than pinning a custom playlist that means the same thing.
    if (ids.length === playable.length) actions.setPlaylist('random')
    else actions.setPlaylist('custom', ids)
  }

  const toggleGame = (id: string) => {
    const gameId = id as GameId
    if (!playable.includes(gameId)) return
    setPool(
      selected.includes(gameId)
        ? selected.filter((value) => value !== gameId)
        : playable.filter((value) => selected.includes(value) || value === gameId),
    )
  }

  const { submitResult, reportProgress } = actions
  const onSubmit = useCallback((result: unknown) => { submitResult(result) }, [submitResult])
  const onProgress = useCallback(
    (value: unknown) => { reportProgress(value) },
    [reportProgress],
  )

  if (room.phase === 'lobby') {
    return (
      <Lobby
        roomCode={room.roomCode}
        floaters={selectFloaters(room)}
        emptyLine={selectLobbyEmptyLine(room)}
        setupSummary={selectSetupSummary(room)}
        chips={selectPoolChips(room)}
        toggleAllLabel={selectToggleAllLabel(room)}
        canStart={room.lobby.canStart && isOwner}
        isOwner={isOwner}
        isReady={me?.ready === true}
        startNote={selectStartBlockedLine(room, isOwner)}
        onStart={actions.start}
        onSetReady={actions.setReady}
        onToggleGame={toggleGame}
        onToggleAll={() => { setPool(selected.length >= playable.length ? [] : playable) }}
        onBack={actions.goToTitle}
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
        // The server returns the room to the lobby on its own timer anyway.
        onBackToLobby={isOwner ? actions.skip : null}
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
          rows={selectResultRows(room, results, playerId)}
          // Only a resolved scoring round sits on a timer worth skipping; a
          // tiebreak rolls straight into its next attempt.
          skipLabel={results.isFinal && isOwner ? 'Skip ahead' : null}
          onSkip={actions.skip}
        />
      ) : null

    // The game screen takes over at `countdown`: it introduces itself, spins
    // its target, and starts taking input at `playing`.
    case 'countdown':
    case 'playing': {
      if (!game) return null
      const showSurface =
        isParticipant && hasSurface(game.id) && timingStartsAtLocalMs !== null

      return (
        <GamePlay
          gameName={game.title}
          statusLine={selectPlayStatusLine(room, round, isParticipant)}
          cueBeats={round.phase === 'countdown' ? cueBeats : null}
        >
          {showSurface && (
            <GameSurface
              gameId={game.id}
              phase={
                round.phase === 'playing'
                  ? 'playing'
                  : cueBeats === null
                    ? 'building'
                    : 'cueing'
              }
              data={round.data}
              timingStartsAtLocalMs={timingStartsAtLocalMs}
              submitted={false}
              onSubmit={onSubmit}
              onProgress={onProgress}
            />
          )}
        </GamePlay>
      )
    }

    default:
      return game ? (
        <GameReveal
          game={game}
          isTiebreak={round.isTiebreak}
          waitingFor={selectNames(room, round.waitingFor)}
          readyCount={round.ready.length}
          participantCount={round.participants.length}
          onReady={isParticipant && !hasReadied ? actions.readyForRound : null}
          isReady={hasReadied}
          isSpectator={!isParticipant}
          startsInBeats={startsInBeats}
        />
      ) : null
  }
}
