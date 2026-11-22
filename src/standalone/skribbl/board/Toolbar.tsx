import type { CSSProperties, ReactNode } from 'react'
import { useMediaQuery } from '../../../hooks/index.ts'
import { border, breakpoint, color, fluid, lift } from '../../../theme/index.ts'
import { sfx } from '../../../audio/sfx/index.ts'
import { PALETTE, TOOLBAR_SIZES, widthOf } from '../palette.ts'
import type { ShapeKind } from './shapes.ts'

export type Tool = 'pen' | 'eraser' | 'fill' | ShapeKind

interface ToolbarProps {
  tool: Tool
  colorIndex: number
  size: number
  onTool: (tool: Tool) => void
  onColor: (index: number) => void
  onSize: (size: number) => void
  onUndo: () => void
  onClear: () => void
}

const ROW = Math.ceil(PALETTE.length / 2)

/** The drawer's controls: colors, pen widths, tools and shapes, undo and clear. */
export function Toolbar({ tool, colorIndex, size, onTool, onColor, onSize, onUndo, onClear }: ToolbarProps) {
  const current = PALETTE[colorIndex] ?? PALETTE[0]
  // On a phone the palette takes a full row, so each swatch is big enough to tap.
  const compact = useMediaQuery(breakpoint.compact)
  const buttonSize = compact ? 36 : 40
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: compact ? 8 : fluid(8, 14),
        padding: fluid(8, 10),
        background: color.white,
        border: border.medium,
        borderRadius: 14,
      }}
    >
      <div
        title="Current color"
        style={{
          width: buttonSize,
          height: compact ? 52 : 40,
          borderRadius: 10,
          border: border.medium,
          background: current,
          flexShrink: 0,
        }}
      />
      <div
        role="radiogroup"
        aria-label="Color"
        style={
          compact
            ? { flex: `1 1 calc(100% - ${buttonSize + 16}px)`, minWidth: 0, display: 'grid', gridTemplateColumns: `repeat(${ROW}, minmax(0, 1fr))`, gap: 2 }
            : { display: 'grid', gridTemplateColumns: `repeat(${ROW}, 20px)`, gap: 2 }
        }
      >
        {PALETTE.map((hex, index) => (
          <button
            key={hex}
            type="button"
            role="radio"
            aria-checked={index === colorIndex}
            aria-label={`Color ${hex}`}
            onClick={() => { onColor(index) }}
            style={{
              width: compact ? '100%' : 20,
              height: compact ? 25 : 20,
              padding: 0,
              borderRadius: 4,
              border: index === colorIndex ? `3px solid ${color.ink}` : '1px solid rgba(46,42,69,.25)',
              background: hex,
              cursor: 'pointer',
            }}
          />
        ))}
      </div>

      <Group label="Width">
        {TOOLBAR_SIZES.map((value) => (
          <ToolButton
            key={value}
            label={`Width ${value + 1}`}
            active={size === value}
            size={buttonSize}
            onClick={() => { onSize(value) }}
          >
            <span
              style={{
                width: Math.max(4, Math.round(widthOf(value) * 0.6)),
                height: Math.max(4, Math.round(widthOf(value) * 0.6)),
                borderRadius: 999,
                background: color.ink,
              }}
            />
          </ToolButton>
        ))}
      </Group>

      <Group label="Tools">
        <ToolButton label="Pen" active={tool === 'pen'} size={buttonSize} onClick={() => { onTool('pen') }}>
          <Icon d="M4 20l1.5-5.5L16 4l4 4L9.5 18.5z M14 6l4 4" />
        </ToolButton>
        <ToolButton label="Eraser" active={tool === 'eraser'} size={buttonSize} onClick={() => { onTool('eraser') }}>
          <Icon d="M8 20h12 M4.5 15.5l9-9 5 5-8.5 8.5H8.5z M9 11l5 5" />
        </ToolButton>
        <ToolButton label="Fill bucket" active={tool === 'fill'} size={buttonSize} onClick={() => { onTool('fill') }}>
          <Icon d="M5 11l7-7 7 7-7 7z M5 11h14 M20 15c0 1.5-1 2.5-1 3.5a1 1 0 002 0c0-1-1-2-1-3.5z" />
        </ToolButton>
      </Group>

      <Group label="Shapes">
        <ToolButton label="Line" active={tool === 'line'} size={buttonSize} onClick={() => { onTool('line') }}>
          <Icon d="M5 19L19 5" />
        </ToolButton>
        <ToolButton label="Rectangle" active={tool === 'rectangle'} size={buttonSize} onClick={() => { onTool('rectangle') }}>
          <Icon d="M4 6h16v12H4z" />
        </ToolButton>
        <ToolButton label="Triangle" active={tool === 'triangle'} size={buttonSize} onClick={() => { onTool('triangle') }}>
          <Icon d="M12 4l8 15H4z" />
        </ToolButton>
        <ToolButton label="Circle" active={tool === 'circle'} size={buttonSize} onClick={() => { onTool('circle') }}>
          <Icon d="M12 4a8 8 0 100 16 8 8 0 000-16z" />
        </ToolButton>
        <ToolButton label="Ellipse" active={tool === 'ellipse'} size={buttonSize} onClick={() => { onTool('ellipse') }}>
          <Icon d="M12 6c5 0 9 2.7 9 6s-4 6-9 6-9-2.7-9-6 4-6 9-6z" />
        </ToolButton>
      </Group>

      <Group label="Edit">
        <ToolButton label="Undo (Ctrl+Z)" size={buttonSize} onClick={onUndo}>
          <Icon d="M9 14L4 9l5-5 M4 9h10a5 5 0 010 10h-3" />
        </ToolButton>
        <ToolButton label="Clear the board" size={buttonSize} onClick={onClear}>
          <Icon d="M5 7h14 M10 7V4h4v3 M7 7l1 13h8l1-13" />
        </ToolButton>
      </Group>
    </div>
  )
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      {children}
    </div>
  )
}

interface ToolButtonProps {
  label: string
  active?: boolean
  size: number
  onClick: () => void
  children: ReactNode
}

function ToolButton({ label, active = false, size, onClick, children }: ToolButtonProps) {
  const style: CSSProperties = {
    width: size,
    height: size,
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    border: border.thin,
    background: active ? color.yellow : color.white,
    boxShadow: active ? 'none' : lift(3),
    transform: active ? 'translateY(3px)' : undefined,
    color: color.ink,
    cursor: 'pointer',
  }
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={() => {
        sfx.ui.toggle()
        onClick()
      }}
      style={style}
    >
      {children}
    </button>
  )
}

function Icon({ d }: { d: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}
