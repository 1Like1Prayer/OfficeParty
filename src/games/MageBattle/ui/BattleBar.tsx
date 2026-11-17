import { Avatar } from '../../../components/ui/index.ts'
import type { BattleBar as BattleBarState } from '../../../shared/games/mageBattle/progress.ts'
import { MAGE_BATTLE } from '../../../shared/games/mageBattle/constants.ts'
import { border, color, font } from '../../../theme/index.ts'
import type { RoundPlayerView } from '../../../types/index.ts'
import { FoldedBadge } from '../../ui/FoldedBadge.tsx'
import { reservedLevels, stackMarkers } from '../../ui/stackMarkers.ts'

interface BattleBarProps {
  bar: BattleBarState
  players: readonly RoundPlayerView[]
  selfPlayerId: string
  /** A phone: smaller markers and a thinner track. */
  isCompact?: boolean
}

/** Markers closer than this share of the bar would overlap, so one is raised (see stackMarkers). */
const OVERLAP_FRACTION = 0.06
const SIZES = {
  regular: { LEVEL_HEIGHT: 17, TRACK_HEIGHT: 16, MARKER_SIZE: 26, YOU_MARKER_SIZE: 36 },
  compact: { LEVEL_HEIGHT: 11, TRACK_HEIGHT: 10, MARKER_SIZE: 18, YOU_MARKER_SIZE: 24 },
} as const

/** Green while safe, yellow as the line nears, red with a point or two to spare. */
const dangerColor = (pointsToKnockout: number): string =>
  pointsToKnockout <= 2 ? color.red : pointsToKnockout <= 4 ? color.yellow : color.mint

/**
 * The battle bar: one track for every mage, like Type Racer's race bar, but
 * measuring the gap to the leader. The right end is level with the leader
 * and the left end is the knock-out line, seven points back; each point is
 * one section. As the leader scores, everyone behind slides left.
 */
export function BattleBar({ bar, players, selfPlayerId, isCompact = false }: BattleBarProps) {
  const { LEVEL_HEIGHT, TRACK_HEIGHT, MARKER_SIZE, YOU_MARKER_SIZE } = SIZES[isCompact ? 'compact' : 'regular']
  // Bunched-up mages stack a few high, then fold into a "+N"; the bar keeps the same height throughout.
  const { levels, folded } = stackMarkers(
    bar.markers.map(({ playerId, fractionOfBar }) => ({ id: playerId, fraction: fractionOfBar })),
    selfPlayerId,
    OVERLAP_FRACTION,
  )
  const you = bar.markers.find(({ playerId }) => playerId === selfPlayerId)
  const markerAreaHeight = YOU_MARKER_SIZE + reservedLevels(bar.markers.length) * LEVEL_HEIGHT + 14
  const playerOf = (playerId: string) => players.find((player) => player.playerId === playerId)

  return (
    <div style={{ position: 'relative', height: markerAreaHeight + TRACK_HEIGHT + (isCompact ? 16 : 22), padding: '0 26px' }}>
      {/* The track, filled up to this mage in how safe they are. */}
      <div
        style={{
          position: 'absolute',
          left: 26,
          right: 26,
          bottom: 22,
          height: TRACK_HEIGHT,
          borderRadius: TRACK_HEIGHT,
          border: border.medium,
          background: 'linear-gradient(90deg, rgba(229,56,47,.55), rgba(255,255,255,.85) 35%)',
          overflow: 'hidden',
        }}
      >
        {you && !you.out && (
          <div
            style={{
              height: '100%',
              width: `${you.fractionOfBar * 100}%`,
              background: dangerColor(you.pointsToKnockout),
              transition: 'width 350ms ease-out, background 350ms',
            }}
          />
        )}
      </div>

      {/* The ends, and a tick for every point between: how many points behind the leader. */}
      <div style={{ position: 'absolute', left: 26, right: 26, bottom: 0, top: 0, pointerEvents: 'none' }}>
        {[0, ...bar.checkpoints, 1].map((fraction, index) => {
          const behind = Math.round((1 - fraction) * MAGE_BATTLE.ELIMINATION_GAP)
          const label = index === 0 ? '☠ OUT' : behind === 0 ? 'LEAD' : `−${behind}`
          const isEnd = index === 0 || behind === 0
          return (
            <div
              key={index}
              style={{
                position: 'absolute',
                left: `${fraction * 100}%`,
                bottom: 2,
                transform: 'translateX(-50%)',
                display: 'flex',
                flexDirection: 'column-reverse',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <div
                style={{
                  fontFamily: font.display,
                  fontWeight: 700,
                  fontSize: isEnd ? 12 : 10,
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                  color: index === 0 ? '#FF7A72' : color.cream,
                  textShadow: `0 1px 0 ${color.ink}`,
                }}
              >
                {label}
              </div>
              <div style={{ width: isEnd ? 3 : 2, height: TRACK_HEIGHT + (isEnd ? 12 : 4), background: color.ink, opacity: 0.85 }} />
            </div>
          )
        })}
      </div>

      {/* The mages. */}
      <div style={{ position: 'absolute', left: 26, right: 26, bottom: 22, top: 0 }}>
        {bar.markers.map((marker) => {
          const player = playerOf(marker.playerId)
          const level = levels.get(marker.playerId)
          if (player === undefined || level === undefined) return null
          const isYou = marker.playerId === selfPlayerId
          const size = isYou ? YOU_MARKER_SIZE : MARKER_SIZE
          const hidden = folded.get(marker.playerId) ?? []
          const hiddenNames = hidden.map((id) => playerOf(id)?.name).filter((name) => name !== undefined)
          const isLeader = !marker.out && marker.behindLeader === 0 && marker.margin > 0
          return (
            <div
              key={marker.playerId}
              title={[`${player.name}: ${marker.score}`, ...hiddenNames].join(', ')}
              style={{
                position: 'absolute',
                left: `${marker.fractionOfBar * 100}%`,
                bottom: TRACK_HEIGHT - 2 + level * LEVEL_HEIGHT,
                transform: 'translateX(-50%)',
                transition: 'left 450ms cubic-bezier(.22,.61,.36,1), bottom 300ms ease-out',
                zIndex: isYou ? 3 : 1,
                filter: marker.out ? 'grayscale(1)' : undefined,
                opacity: marker.out ? 0.7 : 1,
              }}
            >
              <div
                style={{
                  borderRadius: '50%',
                  border: `${isYou ? 4 : 3}px solid ${isYou ? color.yellow : color.ink}`,
                  boxShadow: isYou ? `0 0 0 3px ${color.ink}, 0 0 16px ${color.yellow}` : undefined,
                  lineHeight: 0,
                }}
              >
                <Avatar initial={player.initial} background={player.color} seed={player.avatar} size={size} outlined />
              </div>
              {hidden.length > 0 && <FoldedBadge count={hidden.length} isCompact={isCompact} />}
              {(marker.out || isLeader) && (
                <div style={{ position: 'absolute', right: -6, top: -8, fontSize: 16, lineHeight: 1, filter: 'drop-shadow(0 1px 0 rgba(0,0,0,.6))' }}>
                  {marker.out ? '☠' : '👑'}
                </div>
              )}
              {isYou && (
                <div
                  style={{
                    position: 'absolute',
                    top: isCompact ? -13 : -18,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontFamily: font.display,
                    fontWeight: 700,
                    fontSize: isCompact ? 10 : 12,
                    color: color.yellow,
                    textShadow: `0 1px 0 ${color.ink}`,
                  }}
                >
                  YOU
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
