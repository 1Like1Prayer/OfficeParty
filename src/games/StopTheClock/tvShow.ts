import type { RankedEntry } from '../../shared/games/selfTimed.ts'
import { isFinalTarget, type StopTheClockRound } from '../../shared/games/stopTheClock.ts'
import { screenOwnerLine, type TvScreenFrame, type TvShow } from '../three/TvCircleScene.ts'

/**
 * Stop the Clock, played on the TVs: one picture for one target, and a new
 * one for each target of the round.
 *
 * The first target opens on a ticking stopwatch over the game's name while
 * everyone is shown; then, as the camera glides in, every screen rolls through
 * targets and lands on the real one, which stays under the count-in. Every
 * later target opens on a "next round" card counting down to its own roll.
 * Once the clock starts the player's own screen is the game: the target, the
 * running clock (fading on a blind target) and, once they stop, where they
 * stopped. Everyone else's screen says whether they have stopped yet, never
 * at what time. When everyone is in, every screen shows how the target went,
 * and after the last one the whole round's scores.
 */

/** What the screens need from the game as it is played, read every frame. */
export interface StopTheClockLive {
  phase: 'building' | 'cueing' | 'playing'
  /** Where the player stopped their own clock, or null while it runs. */
  stoppedAtMs: number | null
  /** Their result is in, whether or not this screen saw them stop (e.g. after a reload). */
  isLockedIn: boolean
  /** Everyone else who has stopped. */
  lockedInIds: ReadonlySet<string>
  /** The target's ranking once everyone is in; the last target's is the round's. */
  ranking: readonly RankedEntry[] | null
  /** Everyone's name, by player id. */
  names: Readonly<Record<string, string>>
}

/**
 * All ms relative to when the clock starts. Every target rolls for three
 * seconds, then the one picked is shown on its own for a second and a half
 * before the count-in. On the first target the roll starts as the camera
 * glides in.
 */
/** GET READY, SET, START! at 1.7 s a word: a little slower than the platform's count. */
export const STOP_THE_CLOCK_CUE_MS = 5_100
const LAND_MS = -STOP_THE_CLOCK_CUE_MS - 1_500
const ROLL_MS = LAND_MS - 3_000
/** Slow enough that each number is legible on its way past. */
const ROLL_FRAME_MS = 110

/** The roll's timeline, for the sounds that follow it (useClockSounds). */
export const STOP_THE_CLOCK_TIMELINE = {
  ROLL_MS,
  LAND_MS,
  ROLL_FRAME_MS,
  /** On a blind target the clock is gone from here on (ms after the start). */
  blindHidesAtMs: (targetMs: number): number => targetMs / 2 - FADE_LEAD_MS,
} as const

/** On a blind target the clock starts fading this long before half the target... */
const FADE_LEAD_MS = 500
/** ...and takes this long to disappear. */
const FADE_MS = 800

/** Rows on the scores card; with more players, the top ones and this player's own. */
const SCORE_ROWS = 6

const INK = '#2E2A45'
const CREAM = '#FFFAF0'
const MUTED = 'rgba(255,250,240,0.6)'
const YELLOW = '#FFC400'
const GREEN = '#3FD6A0'
const ORANGE = '#FF9E4F'

const target = (ms: number): string => `${ms / 1000}s`
/** The running clock always shows hundredths: that is the margin being played for. */
const clock = (ms: number): string => `${(Math.max(0, ms) / 1000).toFixed(2)}s`

/** A whole second from 1 to 10, never the same twice running, the same on every screen. */
const decoyAt = (step: number): number => (1 + ((step * 7 + 3) % 10)) * 1000

const background = (context: CanvasRenderingContext2D, w: number, h: number, top: string, bottom: string): void => {
  const gradient = context.createLinearGradient(0, 0, 0, h)
  gradient.addColorStop(0, top)
  gradient.addColorStop(1, bottom)
  context.fillStyle = gradient
  context.fillRect(0, 0, w, h)
}

const outlined = (context: CanvasRenderingContext2D, text: string, x: number, y: number, width: number): void => {
  context.lineWidth = width
  context.strokeStyle = INK
  context.strokeText(text, x, y)
  context.fillText(text, x, y)
}

/** `text`, cut short with an ellipsis to fit `maxWidth`. */
const fitted = (context: CanvasRenderingContext2D, text: string, maxWidth: number): string => {
  if (context.measureText(text).width <= maxWidth) return text
  let cut = text
  while (cut.length > 1 && context.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1)
  return `${cut}…`
}

export interface StopTheClockTvShow extends TvShow {
  /** How the round stands now; the screens read it as they draw. */
  setLive: (live: StopTheClockLive) => void
}

export function stopTheClockShow(round: StopTheClockRound): StopTheClockTvShow {
  const { targetMs, blind: isBlind, targetIndex, targetCount, isTiebreak } = round
  const isOpening = targetIndex === 0 && !isTiebreak
  const rollMs = ROLL_MS
  const landMs = LAND_MS
  const roundLabel = isTiebreak ? 'TIEBREAK' : `ROUND ${targetIndex + 1} OF ${targetCount}`

  let live: StopTheClockLive = {
    phase: 'building',
    stoppedAtMs: null,
    isLockedIn: false,
    lockedInIds: new Set(),
    ranking: null,
    names: {},
  }
  // Bumped whenever the round's standing changes, so every screen redraws.
  let version = 0

  /** How visible the player's own running clock is: it fades out on a blind target. */
  const clockOpacity = (elapsedMs: number): number =>
    isBlind ? Math.min(1, Math.max(0, 1 - (elapsedMs - (targetMs / 2 - FADE_LEAD_MS)) / FADE_MS)) : 1

  type Card = 'title' | 'next' | 'roll' | 'landed' | 'play' | 'waiting' | 'scores'
  const cardAt = (sinceStartMs: number): Card => {
    if (live.ranking !== null) return 'scores'
    if (sinceStartMs >= 0) return live.phase === 'playing' ? 'play' : 'waiting'
    if (sinceStartMs < rollMs) return isOpening ? 'title' : 'next'
    return sinceStartMs < landMs ? 'roll' : 'landed'
  }

  const playKey = ({ isYou, ownerId, sinceStartMs }: TvScreenFrame): string => {
    const { stoppedAtMs, isLockedIn, lockedInIds } = live
    if (!isYou) return lockedInIds.has(ownerId) ? 'locked' : `running:${Math.floor(sinceStartMs / 400) % 4}`
    if (stoppedAtMs !== null || isLockedIn) return `stopped:${stoppedAtMs}`
    const opacity = clockOpacity(sinceStartMs)
    // Once it has faded out there is nothing left to redraw.
    return opacity === 0 ? 'hidden' : `clock:${Math.floor(sinceStartMs / 10)}:${opacity.toFixed(2)}`
  }

  const drawRolling = (context: CanvasRenderingContext2D, w: number, sinceStartMs: number, isLanded: boolean): void => {
    context.font = '800 28px sans-serif'
    context.fillStyle = isLanded ? YELLOW : MUTED
    context.fillText(isLanded ? 'YOUR TARGET' : isOpening ? 'PICKING A TARGET…' : `${roundLabel} · PICKING…`, w / 2, 56)
    const shown = isLanded ? targetMs : decoyAt(Math.floor((sinceStartMs - rollMs) / ROLL_FRAME_MS))
    context.font = '900 150px sans-serif'
    context.fillStyle = isLanded ? CREAM : 'rgba(255,250,240,0.45)'
    if (isLanded) outlined(context, target(shown), w / 2, isBlind ? 170 : 182, 12)
    else context.fillText(target(shown), w / 2, 182)
    if (isLanded && isBlind) {
      context.font = '800 26px sans-serif'
      context.fillStyle = ORANGE
      context.fillText('The clock will fade out!', w / 2, 284)
    }
  }

  /** Between targets: who was closest; after the last, the round's standings. */
  const drawScores = (context: CanvasRenderingContext2D, w: number, h: number, frame: TvScreenFrame): void => {
    const ranking = live.ranking ?? []
    const isRoundScore = isFinalTarget(round)
    context.font = '900 30px sans-serif'
    context.fillStyle = YELLOW
    context.fillText(isRoundScore ? 'FINAL SCORES' : isTiebreak ? 'TIEBREAK' : `${roundLabel} · RESULTS`, w / 2, 38)

    // The top rows, and this player's own if they are further down.
    const ownIndex = ranking.findIndex((row) => row.playerId === frame.ownerId)
    const shown =
      ranking.length <= SCORE_ROWS || ownIndex < SCORE_ROWS
        ? ranking.slice(0, SCORE_ROWS)
        : [...ranking.slice(0, SCORE_ROWS - 1), ranking[ownIndex]!]
    const top = 70
    const rowHeight = Math.min(40, (h - top - 10) / Math.max(1, shown.length))
    shown.forEach((row, index) => {
      const y = top + index * rowHeight
      const isOwn = row.playerId === frame.ownerId
      const isBest = row.rank === 1
      context.fillStyle = isOwn ? 'rgba(255,196,0,0.22)' : index % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0)'
      context.beginPath()
      context.roundRect(16, y, w - 32, rowHeight - 4, 10)
      context.fill()
      const mid = y + (rowHeight - 4) / 2 + 1

      const fontSize = Math.round(Math.min(24, rowHeight * 0.6))
      context.textAlign = 'left'
      context.font = `900 ${fontSize}px sans-serif`
      context.fillStyle = isBest ? GREEN : MUTED
      context.fillText(`${row.rank}`, 30, mid)
      context.font = `800 ${fontSize}px sans-serif`
      context.fillStyle = isOwn ? YELLOW : CREAM
      context.fillText(fitted(context, live.names[row.playerId] ?? '?', 190), 66, mid)

      const { detail } = row
      const wins = typeof detail['wins'] === 'number' ? detail['wins'] : null
      context.textAlign = 'right'
      if (isRoundScore) {
        // The round: targets won, then the total that breaks a level count.
        context.font = `900 ${fontSize}px sans-serif`
        context.fillStyle = isBest ? GREEN : CREAM
        context.fillText(`★ ${wins ?? 0}`, w - 150, mid)
        context.font = `700 ${Math.round(fontSize * 0.8)}px sans-serif`
        context.fillStyle = MUTED
        const total = typeof detail['totalErrorMs'] === 'number' ? clock(detail['totalErrorMs']) : '–'
        context.fillText(`total ${total}`, w - 30, mid)
      } else if (detail['missed'] === true) {
        context.font = `800 ${fontSize}px sans-serif`
        context.fillStyle = ORANGE
        context.fillText('missed', w - 150, mid)
      } else {
        // This target: where they stopped, and how far off that was.
        context.font = `900 ${fontSize}px sans-serif`
        context.fillStyle = isBest ? GREEN : CREAM
        context.fillText(typeof detail['elapsedMs'] === 'number' ? clock(detail['elapsedMs']) : '–', w - 150, mid)
        context.font = `700 ${Math.round(fontSize * 0.8)}px sans-serif`
        context.fillStyle = MUTED
        const error = typeof detail['errorMs'] === 'number' ? detail['errorMs'] : null
        context.fillText(error === null ? '' : error === 0 ? 'exact!' : `off ${clock(error)}`, w - 30, mid)
      }
      context.textAlign = 'center'
    })
  }

  return {
    setLive: (next) => {
      live = next
      version += 1
    },
    staysForGame: true,
    cueCaption: `STOP AT ${target(targetMs)}`,
    cueMs: STOP_THE_CLOCK_CUE_MS,
    cardKey: (frame) => {
      const card = cardAt(frame.sinceStartMs)
      switch (card) {
        case 'title':
          return `title:${Math.floor(frame.elapsed * 15)}`
        case 'next':
          return `next:${Math.ceil((rollMs - frame.sinceStartMs) / 1000)}`
        case 'roll':
          return `roll:${Math.floor((frame.sinceStartMs - rollMs) / ROLL_FRAME_MS)}`
        case 'play':
          return `play:${playKey(frame)}`
        case 'waiting':
          return `waiting:${Math.floor(frame.elapsed * 2) % 4}`
        case 'scores':
          return `scores:${version}`
        default:
          return card
      }
    },
    drawCard: (context, w, h, frame) => {
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      const { sinceStartMs } = frame
      const card = cardAt(sinceStartMs)

      if (card === 'title') {
        background(context, w, h, '#7A2F5C', '#3B2F7A')
        drawStopwatch(context, w / 2, 128, 70, frame.elapsed)
        context.fillStyle = CREAM
        context.font = '900 46px sans-serif'
        context.fillText('STOP THE CLOCK', w / 2, 236)
        context.font = '700 22px sans-serif'
        context.fillStyle = 'rgba(255,250,240,0.7)'
        context.fillText(screenOwnerLine(frame), w / 2, 280)
        return
      }

      if (card === 'next' || card === 'waiting') {
        background(context, w, h, '#3B2F7A', '#1B1730')
        context.font = '800 30px sans-serif'
        context.fillStyle = YELLOW
        context.fillText('NEXT ROUND', w / 2, 62)
        context.font = '900 64px sans-serif'
        context.fillStyle = CREAM
        if (card === 'next') {
          outlined(context, roundLabel, w / 2, 146, 10)
          if (isBlind) {
            context.font = '800 24px sans-serif'
            context.fillStyle = ORANGE
            context.fillText('Blind: the clock fades out', w / 2, 204)
          }
          context.font = '800 30px sans-serif'
          context.fillStyle = CREAM
          context.fillText(`Begins in ${Math.max(1, Math.ceil((rollMs - sinceStartMs) / 1000))}…`, w / 2, 262)
        } else {
          context.fillText(`Get ready${'.'.repeat(1 + (Math.floor(frame.elapsed * 2) % 4))}`, w / 2, 160)
        }
        return
      }

      background(context, w, h, INK, '#1B1730')
      if (card === 'roll' || card === 'landed') {
        drawRolling(context, w, sinceStartMs, card === 'landed')
        return
      }
      if (card === 'scores') {
        drawScores(context, w, h, frame)
        return
      }

      // The game itself.
      context.font = '800 34px sans-serif'
      context.fillStyle = YELLOW
      context.fillText(`STOP AT ${target(targetMs)}`, w / 2, 50)
      const { stoppedAtMs, isLockedIn, lockedInIds } = live

      if (!frame.isYou) {
        const isDone = lockedInIds.has(frame.ownerId)
        context.font = '900 64px sans-serif'
        context.fillStyle = isDone ? GREEN : 'rgba(255,250,240,0.55)'
        if (isDone) outlined(context, 'LOCKED IN', w / 2, 168, 10)
        else context.fillText(`COUNTING${'.'.repeat(1 + (Math.floor(sinceStartMs / 400) % 4))}`, w / 2, 168)
        context.font = '700 24px sans-serif'
        context.fillStyle = MUTED
        context.fillText(screenOwnerLine(frame), w / 2, 270)
        return
      }

      if (stoppedAtMs !== null || isLockedIn) {
        context.font = '900 132px sans-serif'
        context.fillStyle = 'rgba(255,250,240,0.8)'
        if (stoppedAtMs !== null) outlined(context, clock(stoppedAtMs), w / 2, 168, 10)
        context.font = '900 40px sans-serif'
        context.fillStyle = GREEN
        outlined(context, 'LOCKED IN', w / 2, stoppedAtMs === null ? 168 : 272, 8)
        return
      }

      const opacity = clockOpacity(sinceStartMs)
      context.globalAlpha = opacity
      context.font = '900 140px sans-serif'
      context.fillStyle = CREAM
      outlined(context, clock(sinceStartMs), w / 2, 178, 10)
      context.globalAlpha = 1
      if (opacity < 1) {
        context.font = '800 26px sans-serif'
        context.fillStyle = 'rgba(255,158,79,0.9)'
        context.fillText('Count it in your head…', w / 2, 284)
      }
    },
  }
}

/** A stopwatch whose hand sweeps round once every second and a half. */
function drawStopwatch(context: CanvasRenderingContext2D, x: number, y: number, radius: number, elapsed: number): void {
  context.lineWidth = 6
  context.strokeStyle = INK
  // The crown and its button.
  context.fillStyle = ORANGE
  context.beginPath()
  context.roundRect(x - 14, y - radius - 22, 28, 20, 5)
  context.fill()
  context.stroke()
  context.beginPath()
  context.arc(x, y, radius, 0, Math.PI * 2)
  context.fillStyle = CREAM
  context.fill()
  context.stroke()
  // Ticks round the face.
  for (let tick = 0; tick < 12; tick++) {
    const angle = (tick / 12) * Math.PI * 2
    const inner = radius * (tick % 3 === 0 ? 0.72 : 0.82)
    context.beginPath()
    context.moveTo(x + Math.sin(angle) * inner, y - Math.cos(angle) * inner)
    context.lineTo(x + Math.sin(angle) * radius * 0.9, y - Math.cos(angle) * radius * 0.9)
    context.lineWidth = tick % 3 === 0 ? 5 : 3
    context.stroke()
  }
  const hand = ((elapsed % 1.5) / 1.5) * Math.PI * 2
  context.strokeStyle = '#E0418A'
  context.lineWidth = 6
  context.lineCap = 'round'
  context.beginPath()
  context.moveTo(x, y)
  context.lineTo(x + Math.sin(hand) * radius * 0.78, y - Math.cos(hand) * radius * 0.78)
  context.stroke()
  context.fillStyle = INK
  context.beginPath()
  context.arc(x, y, 8, 0, Math.PI * 2)
  context.fill()
}
