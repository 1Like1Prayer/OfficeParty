import type { ReactNode } from 'react'
import { useMediaQuery } from '../../hooks/index.ts'
import { border, color, fluid, font, sharedStyles } from '../../theme/index.ts'
import { STAGE_HEIGHT } from './stageSize.ts'

/**
 * Shared pieces of the looping reveal-screen demos: the card with its step
 * tabs, the striped stage the round plays on, and a standings row. Each game's
 * demo supplies its own timeline (see `demoLoop.ts`) and stage content.
 */

/** Below this the step tabs drop their number badge so the labels fit. */
const TIGHT = '(max-width: 380px)'

interface DemoCardProps {
  steps: readonly string[]
  step: number
  progress: number
  ariaLabel: string
  /** One line under the stage for the rule the loop cannot show. */
  footnote: ReactNode
  children: ReactNode
}

export function DemoCard({ steps, step, progress, ariaLabel, footnote, children }: DemoCardProps) {
  const tight = useMediaQuery(TIGHT)

  return (
    <div
      style={{
        background: color.white,
        border: border.medium,
        borderRadius: 18,
        padding: fluid(12, 16),
        display: 'flex',
        flexDirection: 'column',
        gap: fluid(10, 14),
        // Fills the reveal screen's column, as wide as the title and ready
        // check around it; its stage and contents grow to match.
        width: '100%',
      }}
      role="img"
      aria-label={ariaLabel}
    >
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`, gap: fluid(6, 8) }}>
        {steps.map((label, index) => (
          <StepTab
            key={label}
            index={index}
            label={label}
            active={index === step}
            done={index < step}
            progress={index === step ? progress : 0}
            showBadge={!tight}
          />
        ))}
      </div>

      <div
        style={{
          position: 'relative',
          height: STAGE_HEIGHT,
          // Its contents size themselves from its height (see `stageSize`).
          containerType: 'size',
          borderRadius: 12,
          border: border.thin,
          overflow: 'hidden',
          backgroundImage: `repeating-linear-gradient(45deg,${color.white} 0 10px,#FFF8E8 10px 20px)`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: fluid(8, 10),
          padding: 12,
          textAlign: 'center',
        }}
      >
        {children}
      </div>

      <div style={{ fontSize: fluid(13, 16), fontWeight: 700, color: color.muted, lineHeight: 1.4 }}>
        {footnote}
      </div>
    </div>
  )
}

interface StepTabProps {
  index: number
  label: string
  active: boolean
  done: boolean
  progress: number
  showBadge: boolean
}

function StepTab({ index, label, active, done, progress, showBadge }: StepTabProps) {
  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 10,
        border: border.thin,
        background: active ? color.yellowSoft : color.white,
        color: active || done ? color.ink : color.mutedSoft,
        padding: `${fluid(5, 7)} ${fluid(6, 10)}`,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontWeight: 900,
        fontSize: fluid(10, 13),
        letterSpacing: '0.06em',
        lineHeight: 1.15,
        transition: 'background .2s ease, color .2s ease',
      }}
    >
      {showBadge && (
        <span
          style={{
            flexShrink: 0,
            width: fluid(16, 20),
            height: fluid(16, 20),
            borderRadius: 999,
            background: active ? color.pink : done ? color.ink : color.white,
            color: active || done ? color.white : color.mutedSoft,
            border: border.thin,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: fluid(9, 11),
          }}
        >
          {done ? '✓' : index + 1}
        </span>
      )}
      <span style={{ minWidth: 0 }}>{label.toUpperCase()}</span>
      {active && (
        <span
          style={{
            position: 'absolute',
            left: 0,
            bottom: 0,
            height: 3,
            width: `${Math.min(1, progress) * 100}%`,
            background: color.pink,
          }}
        />
      )}
    </div>
  )
}

interface DemoRowProps {
  place: string
  name: string
  note: string
  gain: string
  highlight?: boolean
  visible: boolean
}

export function DemoRow({ place, name, note, gain, highlight = false, visible }: DemoRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '6px 12px',
        borderRadius: 10,
        border: border.thin,
        background: highlight ? color.leaderBg : color.white,
        opacity: visible ? 1 : 0,
        transform: visible ? 'none' : 'translateY(8px)',
        transition: 'opacity .3s ease, transform .3s ease',
        textAlign: 'left',
      }}
    >
      <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: fluid(14, 16), color: color.mutedStrong, width: 30 }}>
        {place}
      </span>
      <span style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: fluid(14, 16), ...sharedStyles.ellipsis }}>
        {name}
      </span>
      <span style={{ fontWeight: 700, fontSize: fluid(12, 13), color: color.mutedStrong, whiteSpace: 'nowrap' }}>
        {note}
      </span>
      <span
        style={{
          fontFamily: font.display,
          fontWeight: 700,
          fontSize: fluid(16, 18),
          color: color.red,
          minWidth: 22,
          textAlign: 'right',
          // The point lands with a pop once its row is in.
          animation: highlight && visible ? 'pa-pop .45s cubic-bezier(.34,1.56,.64,1) .25s both' : undefined,
        }}
      >
        {gain}
      </span>
    </div>
  )
}
