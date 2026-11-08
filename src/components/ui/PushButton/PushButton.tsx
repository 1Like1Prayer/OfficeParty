import type { CSSProperties } from 'react'
import { useHover } from '../../../hooks/index.ts'
import { border, color, font, lift } from '../../../theme/index.ts'

export type PushButtonVariant = 'primary' | 'success'
export type PushButtonSize = 'lg' | 'md' | 'sm'

interface PushButtonProps {
  children: string
  onClick: () => void
  variant?: PushButtonVariant
  size?: PushButtonSize
  disabled?: boolean
}

const VARIANTS: Record<PushButtonVariant, CSSProperties> = {
  primary: {
    background: color.pink,
    color: color.white,
    border: border.heavy,
    borderRadius: 18,
  },
  success: {
    background: color.mint,
    color: color.mintInk,
    border: 'none',
    borderRadius: 16,
  },
}

const SIZES: Record<PushButtonSize, CSSProperties & { depth: number }> = {
  lg: { padding: '20px 40px', fontSize: 28, depth: 7 },
  md: { padding: '18px 36px', fontSize: 26, depth: 7 },
  sm: { padding: '16px 34px', fontSize: 23, depth: 6 },
}

/** The chunky raised button the whole arena runs on. */
export function PushButton({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
}: PushButtonProps) {
  const [hovered, hoverHandlers] = useHover()
  const { depth, ...sizeStyle } = SIZES[size]
  const pressed = hovered && !disabled

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      {...hoverHandlers}
      style={{
        ...VARIANTS[variant],
        ...sizeStyle,
        fontFamily: font.display,
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        boxShadow: lift(pressed ? depth - 2 : depth),
        transform: pressed ? 'translateY(2px)' : 'none',
        transition: 'transform .1s ease, box-shadow .1s ease',
      }}
    >
      {children}
    </button>
  )
}
