import { ErrorCode } from '@colyseus/sdk'
import { PROTOCOL_MISMATCH_CODE, type RequestError } from '../shared/protocol.ts'

export interface JoinFailure {
  message: string
  /** Nothing to retry: the page itself must be reloaded. */
  fatal: boolean
}

const codeOf = (error: unknown): number | undefined =>
  typeof error === 'object' && error !== null ? (error as { code?: number }).code : undefined

/** Turn a failed create, join or reconnect into something to show the player. */
export function describeJoinError(error: unknown): JoinFailure {
  const code = codeOf(error)
  if (code === PROTOCOL_MISMATCH_CODE) {
    return { fatal: true, message: 'This page is out of date. Please reload.' }
  }
  if (code === ErrorCode.MATCHMAKE_INVALID_ROOM_ID) {
    // Covers a full room too: Colyseus locks a room once it is full.
    return { fatal: false, message: 'No open room with that code.' }
  }
  return { fatal: false, message: 'Could not reach the party server.' }
}

/** A refused request carries the server's explanation in `reason`. */
export function describeRequestError(error: unknown): string {
  const reason = (error as { reason?: Partial<RequestError> } | null)?.reason
  return reason?.message ?? 'Something went wrong. Try again.'
}
