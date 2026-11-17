import type { CSSProperties } from 'react'
import { useHover } from '../../../hooks/index.ts'
import { border, color, fluid, font, lift } from '../../../theme/index.ts'
import { sfx } from '../../../audio/sfx/index.ts'

export type PushButtonVariant = 'primary' | 'success'
export type PushButtonSize = 'lg' | 'md' | 'sm'

interface PushButtonProps {
  children: string
  onClick: () => void
  variant?: PushButtonVariant
  size?: PushButtonSize
  disabled?: boolean
  /** Stretch to the width of the container, as on a phone. */
  fullWidth?: boolean
  /** Skip the click sound, for a button whose action plays a sound of its own. */
  silent?: boolean
}

const VARIANTS: Record<PushButtonVariant, CSSProperties> = {
  primary: {
    background: color.pink,
    color: color.white,
    border: border.heavy,
    borderRadius: fluid(14, 18),
  },
  success: {
    background: color.mint,
    color: color.mintInk,
    border: 'none',
    borderRadius: fluid(12, 16),
  },
}

const SIZES: Record<PushButtonSize, CSSProperties & { depth: number }> = {
  lg: { padding: `${fluid(14, 20)} ${fluid(24, 40)}`, fontSize: fluid(21, 28), depth: 7 },
  md: { padding: `${fluid(13, 18)} ${fluid(22, 36)}`, fontSize: fluid(20, 26), depth: 7 },
  sm: { padding: `${fluid(12, 16)} ${fluid(20, 34)}`, fontSize: fluid(19, 23), depth: 6 },
}

/** The chunky raised button the whole arena runs on. */
export function PushButton({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  fullWidth = false,
  silent = false,
}: PushButtonProps) {
  const [hovered, hoverHandlers] = useHover()
  const { depth, ...sizeStyle } = SIZES[size]
  const pressed = hovered && !disabled

  return (
    <button
      type="button"
      onClick={() => {
        if (!silent) sfx.ui.click()
        onClick()
      }}
      disabled={disabled}
      {...hoverHandlers}
      style={{
        ...VARIANTS[variant],
        ...sizeStyle,
        fontFamily: font.display,
        fontWeight: 700,
        lineHeight: 1.15,
        width: fullWidth ? '100%' : undefined,
        maxWidth: '100%',
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
