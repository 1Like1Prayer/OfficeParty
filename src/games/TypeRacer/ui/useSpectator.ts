import { useCallback, useEffect, useState } from 'react'
import type { StationView } from '../scene/TypeRacerScene.ts'

/** Long enough to see the watched player's block give way before the camera moves on. */
const MOVE_ON_AFTER_FALL_MS = 1600

interface SpectatorOptions {
  /** The player is out of the race and only watching now. */
  isWatching: boolean
  selfPlayerId: string
  /** Everyone, in seat order round the ring. */
  views: readonly StationView[]
  /** The race's winners once it is decided, else null. */
  winnerIds: readonly string[] | null
}

export interface Spectator {
  /** Whom the camera is watching, or null to circle the ring. */
  watchedId: string | null
  /** How many are still typing, so the screen knows whether there is anyone to switch to. */
  candidateCount: number
  /** On to the next one still typing, round the ring. */
  next: () => void
}

/**
 * Who a player who is out watches. It starts on the leader, moves to the
 * next one round the ring when the watched player falls (after the fall has
 * been seen) or when asked, and once the race is decided it watches the
 * winner. Only players still typing are ever picked.
 */
export function useSpectator({ isWatching, selfPlayerId, views, winnerIds }: SpectatorOptions): Spectator {
  const [chosenId, setChosenId] = useState<string | null>(null)
  const seats = views.map(({ playerId }) => playerId)
  const candidates = views
    .filter(({ playerId, status }) => playerId !== selfPlayerId && status === 'typing')
    .map(({ playerId }) => playerId)
  const candidatesKey = candidates.join('|')

  /** The next one still typing after `fromId`, going round the ring. */
  const after = useCallback(
    (fromId: string | null): string | null => {
      const typing = candidatesKey === '' ? [] : candidatesKey.split('|')
      if (typing.length === 0) return null
      const start = fromId === null ? -1 : seats.indexOf(fromId)
      for (let step = 1; step <= seats.length; step++) {
        const seat = seats[(start + step + seats.length) % seats.length]!
        if (typing.includes(seat)) return seat
      }
      return typing[0]!
    },
    // seats only changes with who is playing, which the candidates follow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [candidatesKey],
  )

  const isDecided = winnerIds !== null
  const isChosenTyping = chosenId !== null && candidates.includes(chosenId)
  const leaderId =
    views
      .filter(({ playerId }) => candidates.includes(playerId))
      .reduce<StationView | null>((best, view) => (best === null || view.fraction > best.fraction ? view : best), null)
      ?.playerId ?? null

  // First pick: the leader. When the watched one falls, the next one round the ring, once their fall has been seen.
  useEffect(() => {
    if (!isWatching || isDecided || isChosenTyping) return
    const isFirst = chosenId === null
    const timer = window.setTimeout(
      () => { setChosenId(isFirst ? leaderId : after(chosenId)) },
      isFirst ? 0 : MOVE_ON_AFTER_FALL_MS,
    )
    return () => { window.clearTimeout(timer) }
  }, [isWatching, isDecided, isChosenTyping, chosenId, leaderId, after])

  const next = useCallback(() => {
    if (!isWatching || isDecided) return
    setChosenId((current) => after(current) ?? current)
  }, [isWatching, isDecided, after])

  const winnerId = winnerIds?.find((id) => id !== selfPlayerId) ?? null
  const watchedId = !isWatching ? null : isDecided ? (winnerId ?? chosenId) : chosenId
  return { watchedId, candidateCount: candidates.length, next }
}
