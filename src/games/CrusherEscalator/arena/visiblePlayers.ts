import type { RoundPlayerView } from '../../../types/index.ts'

/**
 * The players who get a lane on screen: this player and their nearest
 * neighbours in the room's order, `count` in all, kept in that order. Near
 * either end of the line it takes more from the other side, so the screen is
 * always full while there are enough runners.
 *
 * Only runners still in the race are picked — `isOut` says who has been
 * swallowed — so as neighbours drop out the next ones along come into view.
 * This player keeps their place while they are in; once they are out, the
 * screen stays centred on where they were. A spectator, who has no place in
 * the line, watches its middle.
 */
export function pickVisiblePlayers(
  players: readonly RoundPlayerView[],
  selfPlayerId: string,
  count: number,
  isOut: (playerId: string) => boolean = () => false,
): RoundPlayerView[] {
  const selfIndex = players.findIndex(({ playerId }) => playerId === selfPlayerId)
  const anchor = selfIndex === -1 ? (players.length - 1) / 2 : selfIndex

  const nearest = players
    .map((player, index) => ({ player, index }))
    .filter(({ player }) => !isOut(player.playerId))
    // Closest first; between two equally close, the one on the left, so the choice never flickers.
    .sort((a, b) => Math.abs(a.index - anchor) - Math.abs(b.index - anchor) || a.index - b.index)
    .slice(0, Math.max(1, count))

  return nearest.sort((a, b) => a.index - b.index).map(({ player }) => player)
}
