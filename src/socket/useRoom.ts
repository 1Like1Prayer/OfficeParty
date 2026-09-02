import { useCallback, useEffect, useMemo, useState } from 'react'
import type { RoomState } from '../types/index.ts'
import { ROOM_CODE } from './config.ts'
import { useSocket } from './useSocket.ts'

export interface RoomActions {
  startRun: () => void
  beginGame: () => void
  finishGame: () => void
  nextGame: () => void
  resetRun: () => void
}

export interface UseRoomResult {
  /** Null until the server has sent the first `room:state` snapshot. */
  state: RoomState | null
  error: string | null
  actions: RoomActions
}

/**
 * Mirrors the server-authoritative room state. The client never mutates it —
 * every button emits an intent and waits for the next `room:state`.
 */
export function useRoom(code: string = ROOM_CODE): UseRoomResult {
  const socket = useSocket()
  const [state, setState] = useState<RoomState | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onState = (next: RoomState) => {
      setState(next)
      setError(null)
    }
    const onError = (message: string) => { setError(message) }
    const join = () => { socket.emit('room:join', code) }

    socket.on('room:state', onState)
    socket.on('room:error', onError)
    socket.on('connect', join)
    if (socket.connected) join()

    return () => {
      socket.off('room:state', onState)
      socket.off('room:error', onError)
      socket.off('connect', join)
    }
  }, [socket, code])

  const emit = useCallback(
    (event: keyof RoomIntentMap) => () => { socket.emit(event) },
    [socket],
  )

  const actions = useMemo<RoomActions>(
    () => ({
      startRun: emit('run:start'),
      beginGame: emit('game:begin'),
      finishGame: emit('game:finish'),
      nextGame: emit('game:next'),
      resetRun: emit('run:reset'),
    }),
    [emit],
  )

  return { state, error, actions }
}

/** The no-payload intents, narrowed so `emit` stays type-safe. */
interface RoomIntentMap {
  'run:start': void
  'game:begin': void
  'game:finish': void
  'game:next': void
  'run:reset': void
}
