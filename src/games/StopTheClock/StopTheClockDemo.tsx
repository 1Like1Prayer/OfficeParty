import { useEffect, useState, type CSSProperties } from 'react'
import { useMediaQuery } from '../../hooks/index.ts'
import { border, color, fluid, font, lift, sharedStyles } from '../../theme/index.ts'

/**
 * The round, played on a loop in miniature: the target rolls and lands, the
 * clock runs and a tap stops it, and the closest stop takes the point. It
 * stands in for the written rules on the reveal screen — watching one round
 * says more than a paragraph about one.
 *
 * Every frame is derived from the time into the loop, so it never drifts and
 * can be dropped in or out of the page at any moment.
 */

/** Timeline, in ms into the loop. */
const SPIN_END = 1_500
/** The landed target holds for a beat, so it can be read before the clock starts. */
const TARGET_END = 3_300
/** The tap lands here; the clock freezes on it. */
const TAP_AT = 6_000
/** The stopped clock holds for a beat too, so the stop can be read before it is scored. */
const RESULT_AT = 7_500
const LOOP_MS = 11_000

const TARGET_S = 5
/** Where the demo player stops the clock: close, not perfect. */
const STOPPED_S = 4.97
/** Runs faster than real time so the demo does not drag. */
const CLOCK_RATE = STOPPED_S / ((TAP_AT - TARGET_END) / 1000)
/** Matches the real spin, so the demo rolls at the speed the game does. */
const SPIN_FRAME_MS = 110

const RIVAL = { name: 'Sam', offS: 0.41 }

const STEPS = ['Target lands', 'Stop the clock', 'Closest wins'] as const

/** Below this the step tabs drop their number badge so the labels fit. */
const TIGHT = '(max-width: 380px)'

/**
 * Deterministic decoy per spin frame, 1–10. Stepping by 7 (coprime with 10)
 * never repeats the previous value, so the roll never looks frozen.
 */
const decoyAt = (frame: number): number => 1 + ((frame * 7 + 3) % 10)

function useLoopTime(): number {
  const [time, setTime] = useState(0)

  useEffect(() => {
    let frame = 0
    const startedAt = performance.now()
    const tick = (now: number) => {
      setTime((now - startedAt) % LOOP_MS)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(frame) }
  }, [])

  return time
}

export function StopTheClockDemo() {
  const t = useLoopTime()
  const step = t < TARGET_END ? 0 : t < RESULT_AT ? 1 : 2
  const stepStart = [0, TARGET_END, RESULT_AT][step]!
  const stepEnd = [TARGET_END, RESULT_AT, LOOP_MS][step]!
  const stepProgress = (t - stepStart) / (stepEnd - stepStart)
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
        width: '100%',
        maxWidth: 560,
      }}
      role="img"
      aria-label={`How it works: a target lands, you stop the clock as close to it as you can, and the closest stop wins the point.`}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: fluid(6, 8) }}>
        {STEPS.map((label, index) => (
          <StepTab
            key={label}
            index={index}
            label={label}
            active={index === step}
            done={index < step}
            progress={index === step ? stepProgress : 0}
            showBadge={!tight}
          />
        ))}
      </div>

      <div
        style={{
          position: 'relative',
          height: fluid(210, 240),
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
        {step === 0 && <TargetStep t={t} />}
        {step === 1 && <ClockStep t={t} />}
        {step === 2 && <ResultStep t={t} />}
      </div>

      <div style={{ fontSize: fluid(13, 15), fontWeight: 700, color: color.muted, lineHeight: 1.4 }}>
        Last two rounds, the clock fades out halfway — you count the rest in your head.
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
        fontSize: fluid(10, 12),
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

const label = (playing: boolean): CSSProperties => ({
  ...sharedStyles.microLabel,
  letterSpacing: '0.22em',
  fontSize: playing ? fluid(14, 17) : fluid(10, 12),
  color: playing ? color.ink : color.mutedStrong,
  whiteSpace: 'nowrap',
})

const bigNumber: CSSProperties = {
  fontFamily: font.display,
  fontWeight: 700,
  fontSize: fluid(52, 72),
  lineHeight: 1,
  letterSpacing: '-0.02em',
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
}

function TargetStep({ t }: { t: number }) {
  const spinning = t < SPIN_END
  return (
    <>
      <div style={label(false)}>{spinning ? 'PICKING A TARGET' : 'STOP AT'}</div>
      <div
        key={spinning ? 'spin' : 'landed'}
        style={{
          ...bigNumber,
          color: spinning ? color.mutedSoft : color.ink,
          animation: spinning ? undefined : 'pa-pop .35s cubic-bezier(.34,1.56,.64,1)',
        }}
      >
        {spinning ? decoyAt(Math.floor(t / SPIN_FRAME_MS)) : TARGET_S}s
      </div>
    </>
  )
}

function ClockStep({ t }: { t: number }) {
  const stopped = t >= TAP_AT
  const elapsed = stopped ? STOPPED_S : ((t - TARGET_END) / 1000) * CLOCK_RATE
  // The finger arrives a beat before the tap, so the press reads as deliberate.
  const fingerIn = t >= TAP_AT - 700
  const pressed = t >= TAP_AT && t < TAP_AT + 220

  return (
    <>
      <div style={label(true)}>STOP AT {TARGET_S}s</div>
      <div style={{ ...bigNumber, color: stopped ? color.mutedStrong : color.ink }}>
        {elapsed.toFixed(2)}s
      </div>
      <div style={{ position: 'relative', marginTop: 4 }}>
        <div
          style={{
            background: color.mint,
            color: color.mintInk,
            borderRadius: 12,
            padding: `${fluid(8, 10)} ${fluid(36, 48)}`,
            fontFamily: font.display,
            fontWeight: 700,
            fontSize: fluid(17, 20),
            boxShadow: lift(pressed ? 2 : 5),
            transform: pressed ? 'translateY(3px)' : 'none',
            transition: 'transform .08s ease, box-shadow .08s ease',
            opacity: stopped && !pressed ? 0.45 : 1,
          }}
        >
          STOP
        </div>
        {pressed && (
          <span
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: 56,
              height: 56,
              margin: '-28px 0 0 -28px',
              borderRadius: 999,
              border: `3px solid ${color.pink}`,
              animation: 'pa-demo-ripple .45s ease-out both',
              pointerEvents: 'none',
            }}
          />
        )}
        <Finger visible={fingerIn} pressing={pressed} />
      </div>
    </>
  )
}

function Finger({ visible, pressing }: { visible: boolean; pressing: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={30}
      height={30}
      aria-hidden
      style={{
        position: 'absolute',
        left: '58%',
        top: '55%',
        opacity: visible ? 1 : 0,
        transform: visible
          ? `translate(0, ${pressing ? -2 : 0}px) scale(${pressing ? 0.9 : 1})`
          : 'translate(26px, 30px)',
        transition: 'opacity .25s ease, transform .3s ease',
        pointerEvents: 'none',
        filter: `drop-shadow(0 2px 0 ${color.ink})`,
      }}
    >
      <path
        d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10l.4-.1a1.5 1.5 0 0 1 1.9 1l.1.3.5-.1a1.5 1.5 0 0 1 1.8 1.1l.5-.1a1.5 1.5 0 0 1 1.8 1.5V17a5 5 0 0 1-5 5h-1.3a5 5 0 0 1-4-2l-2.9-3.9a1.5 1.5 0 0 1 2.2-2L9 15.5z"
        fill={color.white}
        stroke={color.ink}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ResultStep({ t }: { t: number }) {
  const since = t - RESULT_AT
  const offS = Math.abs(TARGET_S - STOPPED_S)

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: fluid(8, 12), flexWrap: 'wrap', justifyContent: 'center' }}>
        <div style={{ ...bigNumber, fontSize: fluid(36, 48), color: color.mutedStrong }}>
          {STOPPED_S.toFixed(2)}s
        </div>
        <div
          style={{
            background: color.yellow,
            border: border.thin,
            borderRadius: 999,
            padding: '4px 12px',
            fontWeight: 900,
            fontSize: fluid(12, 14),
            letterSpacing: '0.08em',
            whiteSpace: 'nowrap',
            animation: 'pa-pop .4s cubic-bezier(.34,1.56,.64,1) both',
          }}
        >
          {offS.toFixed(2)}s OFF
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', maxWidth: 320 }}>
        <DemoRow place="1st" name="You" note={`${offS.toFixed(2)}s off`} gain="+1" highlight visible={since > 350} />
        <DemoRow place="2nd" name={RIVAL.name} note={`${RIVAL.offS.toFixed(2)}s off`} gain="—" visible={since > 650} />
      </div>
    </>
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

function DemoRow({ place, name, note, gain, highlight = false, visible }: DemoRowProps) {
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
