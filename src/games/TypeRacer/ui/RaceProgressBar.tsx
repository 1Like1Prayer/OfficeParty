import { Avatar } from '../../../components/ui/index.ts'
import { border, color, font } from '../../../theme/index.ts'
import type { RoundPlayerView } from '../../../types/index.ts'

export interface BarRunner {
  player: RoundPlayerView
  /** How far along the whole race, 0 to 1. */
  fraction: number
  status: 'typing' | 'finished' | 'out'
  isYou: boolean
}

interface RaceProgressBarProps {
  runners: readonly BarRunner[]
  /** Where each paragraph ends, as a fraction of the bar. The last is 1. */
  checkpoints: readonly number[]
}

/** Markers closer than this share of the bar would overlap, so one is raised. */
const OVERLAP_FRACTION = 0.04
const LEVEL_HEIGHT = 17
const TRACK_HEIGHT = 16
const MARKER_SIZE = 26
const YOU_MARKER_SIZE = 36

/** Raises markers that would sit on top of a neighbour, the fewest levels it takes. */
function assignLevels(runners: readonly BarRunner[]): Map<string, number> {
  const levels = new Map<string, number>()
  const lastFractionAtLevel: number[] = []

  for (const runner of [...runners].sort((a, b) => a.fraction - b.fraction)) {
    let level = lastFractionAtLevel.findIndex(
      (last) => runner.fraction - last >= OVERLAP_FRACTION,
    )
    if (level === -1) level = lastFractionAtLevel.length
    lastFractionAtLevel[level] = runner.fraction
    levels.set(runner.player.playerId, level)
  }
  return levels
}

const STATUS_BADGE: Record<BarRunner['status'], string | null> = {
  typing: null,
  finished: '★',
  out: '☠',
}

/**
 * One bar for the whole race, with every player on it. Its sections are as long
 * as the paragraphs they stand for, so a short paragraph's checkpoint comes
 * earlier. Players who are out stay where they fell, greyed with a skull.
 */
export function RaceProgressBar({ runners, checkpoints }: RaceProgressBarProps) {
  const levels = assignLevels(runners)
  const you = runners.find((runner) => runner.isYou)
  const tallest = Math.max(0, ...levels.values())
  const markerAreaHeight = YOU_MARKER_SIZE + tallest * LEVEL_HEIGHT + 14

  return (
    <div
      style={{
        position: 'relative',
        height: markerAreaHeight + TRACK_HEIGHT + 22,
        padding: '0 22px',
      }}
    >
      {/* The track. */}
      <div
        style={{
          position: 'absolute',
          left: 22,
          right: 22,
          bottom: 22,
          height: TRACK_HEIGHT,
          borderRadius: TRACK_HEIGHT,
          border: border.medium,
          background: 'rgba(255,255,255,0.85)',
          overflow: 'hidden',
        }}
      >
        {you && (
          <div
            style={{
              height: '100%',
              width: `${you.fraction * 100}%`,
              background: color.mint,
              transition: 'width 350ms ease-out',
            }}
          />
        )}
      </div>

      {/* Checkpoints: the end of each paragraph. */}
      <div style={{ position: 'absolute', left: 22, right: 22, bottom: 0, top: 0 }}>
        {checkpoints.map((fraction, index) => {
          const isFinish = index === checkpoints.length - 1
          return (
            <div
              key={index}
              style={{
                position: 'absolute',
                left: `${fraction * 100}%`,
                bottom: 14,
                transform: 'translateX(-50%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                pointerEvents: 'none',
              }}
            >
              <div
                style={{
                  width: 3,
                  height: TRACK_HEIGHT + 14,
                  background: color.ink,
                  opacity: 0.85,
                }}
              />
              <div
                style={{
                  fontFamily: font.display,
                  fontWeight: 700,
                  fontSize: 12,
                  lineHeight: 1,
                  color: color.cream,
                  textShadow: `0 1px 0 ${color.ink}`,
                }}
              >
                {isFinish ? 'FINISH' : index + 1}
              </div>
            </div>
          )
        })}
      </div>

      {/* The players. */}
      <div style={{ position: 'absolute', left: 22, right: 22, bottom: 22, top: 0 }}>
        {runners.map((runner) => {
          const size = runner.isYou ? YOU_MARKER_SIZE : MARKER_SIZE
          const level = levels.get(runner.player.playerId) ?? 0
          const badge = STATUS_BADGE[runner.status]
          return (
            <div
              key={runner.player.playerId}
              title={runner.player.name}
              style={{
                position: 'absolute',
                left: `${runner.fraction * 100}%`,
                bottom: TRACK_HEIGHT - 2 + level * LEVEL_HEIGHT,
                transform: 'translateX(-50%)',
                transition: 'left 450ms cubic-bezier(.22,.61,.36,1), bottom 300ms ease-out',
                zIndex: runner.isYou ? 3 : 1,
                filter: runner.status === 'out' ? 'grayscale(1)' : undefined,
                opacity: runner.status === 'out' ? 0.7 : 1,
              }}
            >
              <div
                style={{
                  borderRadius: '50%',
                  border: `${runner.isYou ? 4 : 3}px solid ${runner.isYou ? color.yellow : color.ink}`,
                  boxShadow: runner.isYou ? `0 0 0 3px ${color.ink}, 0 0 16px ${color.yellow}` : undefined,
                  lineHeight: 0,
                }}
              >
                <Avatar
                  initial={runner.player.initial}
                  background={runner.player.color}
                  seed={runner.player.avatar}
                  size={size}
                  outlined
                />
              </div>
              {badge !== null && (
                <div
                  style={{
                    position: 'absolute',
                    right: -6,
                    top: -8,
                    fontSize: 16,
                    lineHeight: 1,
                    filter: 'drop-shadow(0 1px 0 rgba(0,0,0,.6))',
                  }}
                >
                  {badge}
                </div>
              )}
              {runner.isYou && (
                <div
                  style={{
                    position: 'absolute',
                    top: -18,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontFamily: font.display,
                    fontWeight: 700,
                    fontSize: 12,
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
