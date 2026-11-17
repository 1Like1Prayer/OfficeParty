import type { RankedEntry } from '../../shared/games/selfTimed.ts'
import { CUBE_COUNTER } from '../../shared/games/cubeCounter/constants.ts'
import { countBlocks } from '../../shared/games/cubeCounter/sceneValidation.ts'
import type { Box, CubeCounterRound } from '../../shared/games/cubeCounter/types.ts'
import { color } from '../../theme/index.ts'
import { screenOwnerLine, type TvScreenFrame, type TvShow } from '../three/TvCircleScene.ts'
import { VIEW_BOX, boxFaceCorners, drawOrder, floorCorners, floorLines, type Point2 } from './projection.ts'

/**
 * Cube Counter, played on the TVs. Three cubes hop over the game's name while
 * everyone is shown, then the player's own screen is the game: each puzzle's
 * blocks flash up, give way to a "?" and a draining time bar while they
 * answer (what they type shows on the screen), and come back with whether
 * they were right. A "next puzzle" card counts them into the next one. Every
 * player goes at their own pace; the others' screens say which puzzle they
 * are on, never how they are doing. When everyone is done, every screen shows
 * the round's scores.
 */

/** Where the player is in their own run of puzzles. */
export type PuzzleStage = 'flash' | 'answer' | 'reveal' | 'next' | 'done'

/** What the screens need from the game as it is played, read every frame. */
export interface CubeCounterLive {
  stage: PuzzleStage
  /** 0-based puzzle the player is on. */
  index: number
  /** `performance.now()` the current stage began at. */
  stageStartedAtMs: number
  /** What they have typed so far while answering. */
  typed: string
  /** Their answer to the puzzle just answered: a count, or null for out of time. */
  lastAnswer: number | null
  /** How many they have got right so far. */
  rightSoFar: number
  /** How many puzzles each other player has answered. */
  answeredById: Readonly<Record<string, number>>
  /** The round's ranking once everyone is done. */
  ranking: readonly RankedEntry[] | null
  names: Readonly<Record<string, string>>
}

export interface CubeCounterTvShow extends TvShow {
  setLive: (live: CubeCounterLive) => void
}

/** GET READY, SET, START! at 1.7 s a word, as in Stop the Clock. */
export const CUBE_COUNTER_CUE_MS = 5_100

/** Rows on the scores card; with more players, the top ones and this player's own. */
const SCORE_ROWS = 6

const INK = '#2E2A45'
const CREAM = '#FFFAF0'
const MUTED = 'rgba(255,250,240,0.6)'
const YELLOW = '#FFC400'
const GREEN = '#3FD6A0'
const RED = '#FF5C6C'
const FACE = { top: '#FFE9A3', sideX: '#FFC400', sideY: '#FF9E4F' } as const

const CUBE_COLORS = [
  ['#FFE9A3', '#FFC400', '#FF9E4F'],
  ['#C9F5E6', '#3FD6A0', '#2BB08A'],
  ['#FFD3E6', '#FF5C9E', '#E0418A'],
] as const

const seconds = (ms: number): string => `${(Math.max(0, ms) / 1000).toFixed(1)}s`

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

const fitted = (context: CanvasRenderingContext2D, text: string, maxWidth: number): string => {
  if (context.measureText(text).width <= maxWidth) return text
  let cut = text
  while (cut.length > 1 && context.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1)
  return `${cut}…`
}

const polygon = (context: CanvasRenderingContext2D, corners: readonly Point2[]): void => {
  context.beginPath()
  corners.forEach(({ x, y }, index) => { if (index === 0) context.moveTo(x, y); else context.lineTo(x, y) })
  context.closePath()
}

/** The 5x5 floor and the blocks on it, as the puzzle's own picture draws them, fitted into the box given. */
function drawScene(context: CanvasRenderingContext2D, boxes: readonly Box[], x: number, y: number, w: number, h: number): void {
  const scale = Math.min(w / VIEW_BOX.width, h / VIEW_BOX.height)
  context.save()
  context.translate(x + (w - VIEW_BOX.width * scale) / 2, y + (h - VIEW_BOX.height * scale) / 2)
  context.scale(scale, scale)
  context.translate(-VIEW_BOX.x, -VIEW_BOX.y)
  context.lineJoin = 'round'

  polygon(context, floorCorners)
  context.fillStyle = '#FFFFFF'
  context.fill()
  context.lineWidth = 3
  context.strokeStyle = INK
  context.stroke()
  context.strokeStyle = color.dashed
  context.lineWidth = 1.5
  for (const [a, b] of floorLines()) {
    context.beginPath()
    context.moveTo(a.x, a.y)
    context.lineTo(b.x, b.y)
    context.stroke()
  }
  context.lineWidth = 2.5
  context.strokeStyle = INK
  for (const box of drawOrder(boxes)) {
    const faces = boxFaceCorners(box)
    for (const face of ['sideY', 'sideX', 'top'] as const) {
      polygon(context, faces[face])
      context.fillStyle = FACE[face]
      context.fill()
      context.stroke()
    }
  }
  context.restore()
}

function drawCube(context: CanvasRenderingContext2D, x: number, y: number, size: number, top: string, left: string, right: string): void {
  const half = size * 0.58
  const faces: [string, [number, number][]][] = [
    [top, [[x, y - size * 0.6], [x + size, y - size * 0.6 + half], [x, y - size * 0.6 + half * 2], [x - size, y - size * 0.6 + half]]],
    [left, [[x - size, y - size * 0.6 + half], [x, y - size * 0.6 + half * 2], [x, y + size * 1.1], [x - size, y + size * 1.1 - half]]],
    [right, [[x + size, y - size * 0.6 + half], [x, y - size * 0.6 + half * 2], [x, y + size * 1.1], [x + size, y + size * 1.1 - half]]],
  ]
  context.lineWidth = 4
  context.lineJoin = 'round'
  context.strokeStyle = INK
  for (const [fill, corners] of faces) {
    polygon(context, corners.map(([px, py]) => ({ x: px, y: py })))
    context.fillStyle = fill
    context.fill()
    context.stroke()
  }
}

export function cubeCounterShow(round: CubeCounterRound): CubeCounterTvShow {
  const { puzzles } = round
  const count = puzzles.length
  let live: CubeCounterLive = {
    stage: 'flash',
    index: 0,
    stageStartedAtMs: 0,
    typed: '',
    lastAnswer: null,
    rightSoFar: 0,
    answeredById: {},
    ranking: null,
    names: {},
  }
  let version = 0

  const msInStage = (): number => performance.now() - live.stageStartedAtMs
  const label = (index: number): string => `PUZZLE ${Math.min(index + 1, count)} OF ${count}`

  const header = (context: CanvasRenderingContext2D, w: number, text: string, fill = YELLOW): void => {
    context.font = '800 24px sans-serif'
    context.fillStyle = fill
    context.fillText(text, w / 2, 24)
  }

  const drawTitle = (context: CanvasRenderingContext2D, w: number, h: number, frame: TvScreenFrame): void => {
    background(context, w, h, '#3B2F7A', '#1E5C8A')
    CUBE_COLORS.forEach(([top, left, right], index) => {
      const hop = Math.max(0, Math.sin(frame.elapsed * 4 - index * 0.9)) * 18
      drawCube(context, w / 2 + (index - 1) * 92, 120 - hop, 40, top, left, right)
    })
    context.fillStyle = CREAM
    context.font = '900 46px sans-serif'
    context.fillText('CUBE COUNTER', w / 2, 236)
    context.font = '700 22px sans-serif'
    context.fillStyle = 'rgba(255,250,240,0.7)'
    context.fillText(screenOwnerLine(frame), w / 2, 280)
  }

  const drawOwn = (context: CanvasRenderingContext2D, w: number, h: number): void => {
    const puzzle = puzzles[Math.min(live.index, count - 1)]
    const right = puzzle === undefined ? 0 : countBlocks(puzzle.boxes)
    switch (live.stage) {
      case 'flash': {
        background(context, w, h, '#3B2F7A', '#1B1730')
        header(context, w, label(live.index))
        // As big as the screen allows: the blocks are what is being counted.
        if (puzzle !== undefined) drawScene(context, puzzle.boxes, 4, 40, w - 8, h - 42)
        return
      }
      case 'answer': {
        background(context, w, h, INK, '#1B1730')
        header(context, w, label(live.index))
        context.font = '800 26px sans-serif'
        context.fillStyle = MUTED
        context.fillText('HOW MANY BLOCKS?', w / 2, 76)
        context.font = '900 130px sans-serif'
        if (live.typed === '') {
          context.fillStyle = 'rgba(255,250,240,0.3)'
          context.fillText('?', w / 2, 172)
        } else {
          context.fillStyle = CREAM
          outlined(context, live.typed, w / 2, 172, 10)
        }
        // The time left, draining.
        const left = Math.max(0, 1 - msInStage() / CUBE_COUNTER.ANSWER_LIMIT_MS)
        const barWidth = w - 96
        context.fillStyle = 'rgba(255,255,255,0.12)'
        context.beginPath()
        context.roundRect(48, 266, barWidth, 16, 8)
        context.fill()
        context.fillStyle = left < 0.3 ? RED : GREEN
        context.beginPath()
        context.roundRect(48, 266, Math.max(16, barWidth * left), 16, 8)
        context.fill()
        return
      }
      case 'reveal': {
        const isRight = live.lastAnswer === right
        background(context, w, h, '#3B2F7A', '#1B1730')
        if (puzzle !== undefined) drawScene(context, puzzle.boxes, 4, 4, w - 8, h - 82)
        context.fillStyle = isRight ? 'rgba(23,67,74,0.92)' : 'rgba(90,20,30,0.92)'
        context.fillRect(0, h - 78, w, 78)
        context.font = '900 40px sans-serif'
        context.fillStyle = isRight ? GREEN : RED
        outlined(
          context,
          isRight ? `YES — ${right}!` : live.lastAnswer === null ? `TIME'S UP — IT WAS ${right}` : `NOPE — IT WAS ${right}`,
          w / 2,
          h - 38,
          8,
        )
        return
      }
      case 'next': {
        background(context, w, h, '#3B2F7A', '#1B1730')
        context.font = '800 30px sans-serif'
        context.fillStyle = YELLOW
        context.fillText('NEXT PUZZLE', w / 2, 62)
        context.font = '900 60px sans-serif'
        context.fillStyle = CREAM
        outlined(context, label(live.index + 1), w / 2, 146, 10)
        context.font = '800 30px sans-serif'
        context.fillStyle = CREAM
        const left = Math.max(1, Math.ceil((CUBE_COUNTER.NEXT_PUZZLE_MS - msInStage()) / 1000))
        context.fillText(`Begins in ${left}…`, w / 2, 250)
        return
      }
      case 'done': {
        background(context, w, h, INK, '#1B1730')
        context.font = '900 64px sans-serif'
        context.fillStyle = GREEN
        outlined(context, 'ALL DONE', w / 2, 120, 10)
        context.font = '800 34px sans-serif'
        context.fillStyle = CREAM
        context.fillText(`${live.rightSoFar} of ${count} right`, w / 2, 200)
        return
      }
    }
  }

  const drawOther = (context: CanvasRenderingContext2D, w: number, h: number, frame: TvScreenFrame): void => {
    background(context, w, h, INK, '#1B1730')
    const answered = live.answeredById[frame.ownerId] ?? 0
    const isDone = answered >= count
    header(context, w, isDone ? `${count} OF ${count}` : label(answered))
    context.font = '900 60px sans-serif'
    context.fillStyle = isDone ? GREEN : 'rgba(255,250,240,0.55)'
    if (isDone) outlined(context, 'ALL DONE', w / 2, 160, 10)
    else context.fillText(`COUNTING${'.'.repeat(1 + (Math.floor(frame.sinceStartMs / 400) % 4))}`, w / 2, 160)
    context.font = '700 24px sans-serif'
    context.fillStyle = MUTED
    context.fillText(screenOwnerLine(frame), w / 2, 262)
  }

  const drawScores = (context: CanvasRenderingContext2D, w: number, h: number, frame: TvScreenFrame): void => {
    const ranking = live.ranking ?? []
    background(context, w, h, INK, '#1B1730')
    context.font = '900 30px sans-serif'
    context.fillStyle = YELLOW
    context.fillText('FINAL SCORES', w / 2, 38)
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
      const right = typeof detail['correctCount'] === 'number' ? detail['correctCount'] : 0
      context.textAlign = 'right'
      context.font = `900 ${fontSize}px sans-serif`
      context.fillStyle = isBest ? GREEN : CREAM
      context.fillText(`★ ${right}/${count}`, w - 150, mid)
      context.font = `700 ${Math.round(fontSize * 0.8)}px sans-serif`
      context.fillStyle = MUTED
      const ms = typeof detail['correctAnswerMs'] === 'number' ? detail['correctAnswerMs'] : null
      context.fillText(ms === null || right === 0 ? '' : `time ${seconds(ms)}`, w - 30, mid)
      context.textAlign = 'center'
    })
  }

  return {
    setLive: (next) => {
      live = next
      version += 1
    },
    staysForGame: true,
    cueCaption: `${count} PUZZLES · COUNT THE BLOCKS`,
    cueMs: CUBE_COUNTER_CUE_MS,
    cardKey: (frame) => {
      if (live.ranking !== null) return `scores:${version}`
      if (frame.sinceStartMs < 0) return `title:${Math.floor(frame.elapsed * 8)}`
      if (!frame.isYou) {
        const answered = live.answeredById[frame.ownerId] ?? 0
        return answered >= count ? `other:done` : `other:${answered}:${Math.floor(frame.sinceStartMs / 400) % 4}`
      }
      const tick =
        live.stage === 'answer' ? Math.floor(msInStage() / 50) : live.stage === 'next' ? Math.floor(msInStage() / 250) : 0
      return `own:${version}:${tick}`
    },
    drawCard: (context, w, h, frame) => {
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      if (live.ranking !== null) drawScores(context, w, h, frame)
      else if (frame.sinceStartMs < 0) drawTitle(context, w, h, frame)
      else if (frame.isYou) drawOwn(context, w, h)
      else drawOther(context, w, h, frame)
    },
  }
}
