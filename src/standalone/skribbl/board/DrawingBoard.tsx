import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { CANVAS } from '../../../shared/standalone/skribbl/constants.ts'
import { decodeDrawPacket, type CanvasOp } from '../../../shared/standalone/skribbl/canvas.ts'
import type { SkribblConnection } from '../../../network/skribblConnection.ts'
import { border, color as themeColor } from '../../../theme/index.ts'
import { BACKGROUND_COLOR, colorOf, DEFAULT_COLOR, DEFAULT_SIZE, widthOf } from '../palette.ts'
import { DrawSender, SEND_INTERVAL_MS } from './drawSender.ts'
import { Playback } from './playback.ts'
import { BoardRenderer } from './renderer.ts'
import { shapePoints, type Point, type ShapeKind } from './shapes.ts'
import { Toolbar, type Tool } from './Toolbar.tsx'

interface DrawingBoardProps {
  game: SkribblConnection
  /** The turn on screen: the board starts blank for each one. */
  turnId: number
  /** This player is the drawer, and the word is chosen. */
  canDraw: boolean
}

const isShape = (tool: Tool): tool is ShapeKind =>
  tool === 'line' || tool === 'rectangle' || tool === 'triangle' || tool === 'circle' || tool === 'ellipse'

/** Is the key press meant for a text field rather than the board? */
const typingInField = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)

/**
 * The shared canvas. Everyone sees the same fixed-size bitmap, scaled to fit.
 *
 * - The drawer's strokes are drawn at once and sent in batches.
 * - Everyone else replays them at the pace they were drawn, a moment late.
 * - Shapes preview on an overlay while dragged, then go out as one stroke.
 */
export function DrawingBoard({ game, turnId, canDraw }: DrawingBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<BoardRenderer | null>(null)
  const senderRef = useRef<DrawSender | null>(null)
  /** The stroke being drawn with the pen or eraser. */
  const strokeRef = useRef<{ last: Point; lastAtMs: number } | null>(null)
  /** Where a shape's drag started. */
  const shapeFromRef = useRef<Point | null>(null)

  const [tool, setTool] = useState<Tool>('pen')
  const [colorIndex, setColorIndex] = useState<number>(DEFAULT_COLOR)
  const [size, setSize] = useState<number>(DEFAULT_SIZE)

  // Each turn: a blank board, the drawing so far, then everything new as it comes.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    rendererRef.current ??= new BoardRenderer(canvas)
    const renderer = rendererRef.current
    const playback = new Playback()
    renderer.reset()
    for (const bytes of game.drawLog(turnId)) {
      const packet = decodeDrawPacket(bytes)
      if (packet?.turnId === turnId) renderer.apply(packet.ops)
    }

    const unsubscribe = game.onDraw((bytes, kind) => {
      const packet = decodeDrawPacket(bytes)
      if (packet?.turnId !== turnId) return
      if (kind === 'snapshot') {
        // The whole drawing at once; it starts with a clear.
        playback.clear()
        renderer.apply(packet.ops)
      } else {
        playback.push(packet.ops, performance.now())
      }
    })
    let frame = requestAnimationFrame(function play() {
      const ops = playback.due(performance.now())
      if (ops.length > 0) renderer.apply(ops)
      frame = requestAnimationFrame(play)
    })
    return () => {
      unsubscribe()
      cancelAnimationFrame(frame)
    }
  }, [game, turnId])

  // The drawer's outbox, for this turn only.
  useEffect(() => {
    if (!canDraw) return
    const overlay = overlayRef.current
    const sender = new DrawSender(turnId, (bytes) => { game.sendDraw(bytes) })
    senderRef.current = sender
    const timer = setInterval(() => { sender.flush() }, SEND_INTERVAL_MS)
    return () => {
      clearInterval(timer)
      sender.flush()
      senderRef.current = null
      strokeRef.current = null
      shapeFromRef.current = null
      clearOverlay(overlay)
    }
  }, [canDraw, game, turnId])

  /** Draw an op here and send it; one the model refuses (the turn's limits) goes nowhere. */
  const emit = useCallback((op: CanvasOp) => {
    const renderer = rendererRef.current
    const sender = senderRef.current
    if (!renderer || !sender) return
    if (renderer.apply([op])) sender.push(op)
  }, [])

  const endStroke = useCallback(() => {
    if (strokeRef.current === null) return
    strokeRef.current = null
    emit({ op: 'end' })
  }, [emit])

  const undo = useCallback(() => {
    endStroke()
    emit({ op: 'undo' })
  }, [emit, endStroke])

  const clear = useCallback(() => {
    endStroke()
    emit({ op: 'clear' })
  }, [emit, endStroke])

  // Ctrl+Z / Cmd+Z, unless the player is typing in the chat.
  useEffect(() => {
    if (!canDraw) return
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.key.toLowerCase() !== 'z') return
      if (typingInField(event.target)) return
      event.preventDefault()
      undo()
    }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey) }
  }, [canDraw, undo])

  const toCanvas = (event: { clientX: number; clientY: number }): Point => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * CANVAS.WIDTH
    const y = ((event.clientY - rect.top) / rect.height) * CANVAS.HEIGHT
    return {
      x: Math.round(Math.min(CANVAS.WIDTH - 1, Math.max(0, x))),
      y: Math.round(Math.min(CANVAS.HEIGHT - 1, Math.max(0, y))),
    }
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!canDraw || event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = toCanvas(event)
    if (tool === 'fill') {
      emit({ op: 'fill', color: colorIndex, ...point })
    } else if (isShape(tool)) {
      shapeFromRef.current = point
    } else {
      endStroke()
      emit({ op: 'begin', color: tool === 'eraser' ? BACKGROUND_COLOR : colorIndex, size, ...point })
      strokeRef.current = { last: point, lastAtMs: event.timeStamp }
    }
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const stroke = strokeRef.current
    if (stroke) {
      // Every sample since the last frame, for a smooth line on a fast flick.
      const samples = event.nativeEvent.getCoalescedEvents?.() ?? []
      for (const sample of samples.length > 0 ? samples : [event.nativeEvent]) {
        const point = toCanvas(sample)
        if (point.x === stroke.last.x && point.y === stroke.last.y) continue
        const dtMs = Math.min(255, Math.max(0, Math.round(sample.timeStamp - stroke.lastAtMs)))
        emit({ op: 'points', points: [{ ...point, dtMs }] })
        stroke.last = point
        stroke.lastAtMs = sample.timeStamp
      }
      return
    }
    const from = shapeFromRef.current
    if (from && isShape(tool)) {
      drawPreview(overlayRef.current, shapePoints(tool, from, toCanvas(event)), colorOf(colorIndex), widthOf(size))
    }
  }

  const onPointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    endStroke()
    const from = shapeFromRef.current
    if (from === null || !isShape(tool)) return
    shapeFromRef.current = null
    clearOverlay(overlayRef.current)
    const [first, ...rest] = shapePoints(tool, from, toCanvas(event))
    if (!first) return
    emit({ op: 'begin', color: colorIndex, size, ...first })
    if (rest.length > 0) emit({ op: 'points', points: rest.map((point) => ({ ...point, dtMs: 0 })) })
    emit({ op: 'end' })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', minWidth: 0 }}>
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: `${CANVAS.WIDTH} / ${CANVAS.HEIGHT}`,
          border: border.heavy,
          borderRadius: 16,
          overflow: 'hidden',
          background: themeColor.white,
        }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            touchAction: 'none',
            cursor: canDraw ? (tool === 'fill' ? 'cell' : 'crosshair') : 'default',
          }}
        />
        <canvas
          ref={overlayRef}
          width={CANVAS.WIDTH}
          height={CANVAS.HEIGHT}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        />
      </div>
      {canDraw && (
        <Toolbar
          tool={tool}
          colorIndex={colorIndex}
          size={size}
          onTool={setTool}
          onColor={(index) => {
            setColorIndex(index)
            // Picking a color while erasing means you want to draw again.
            if (tool === 'eraser') setTool('pen')
          }}
          onSize={setSize}
          onUndo={undo}
          onClear={clear}
        />
      )}
    </div>
  )
}

function clearOverlay(canvas: HTMLCanvasElement | null): void {
  canvas?.getContext('2d')?.clearRect(0, 0, CANVAS.WIDTH, CANVAS.HEIGHT)
}

function drawPreview(canvas: HTMLCanvasElement | null, points: Point[], strokeColor: string, width: number): void {
  const ctx = canvas?.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, CANVAS.WIDTH, CANVAS.HEIGHT)
  const [first, ...rest] = points
  if (!first) return
  ctx.strokeStyle = strokeColor
  ctx.fillStyle = strokeColor
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (rest.length === 0) {
    ctx.beginPath()
    ctx.arc(first.x, first.y, width / 2, 0, Math.PI * 2)
    ctx.fill()
    return
  }
  ctx.beginPath()
  ctx.moveTo(first.x, first.y)
  for (const point of rest) ctx.lineTo(point.x, point.y)
  ctx.stroke()
}
