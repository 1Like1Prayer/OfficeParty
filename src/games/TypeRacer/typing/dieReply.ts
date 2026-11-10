import type { DieRoll } from '../../../shared/games/typeRacer/types.ts'

/** The server's answer to a dice request, checked before it is trusted. */
export function parseDieRoll(raw: unknown): DieRoll | null {
  if (typeof raw !== 'object' || raw === null) return null
  const { face, skulls, isSkull } = raw as Record<string, unknown>
  if (typeof face !== 'number' || typeof skulls !== 'number' || typeof isSkull !== 'boolean') return null
  return { face, skulls, isSkull }
}
