import { useHover } from '../../../hooks/index.ts'
import { color, fluid, lift, sharedStyles } from '../../../theme/index.ts'

export type BigButtonVariant = 'pink' | 'yellow'

interface BigButtonProps {
  children: string
  onClick: () => void
  variant?: BigButtonVariant
  disabled?: boolean
}

const VARIANTS: Record<BigButtonVariant, { background: string; color: string }> = {
  pink: { background: color.pink, color: color.white },
  yellow: { background: color.yellow, color: color.ink },
}

/** The oversized title-screen control. */
export function BigButton({
  children,
  onClick,
  variant = 'pink',
  disabled = false,
}: BigButtonProps) {
  const [hovered, handlers] = useHover()
  const pressed = hovered && !disabled

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      {...handlers}
      style={{
        ...sharedStyles.raised(pressed ? 5 : 8),
        ...VARIANTS[variant],
        borderRadius: fluid(16, 20),
        padding: `${fluid(14, 22)} ${fluid(28, 54)}`,
        fontSize: fluid(26, 34),
        lineHeight: 1.1,
        // The pair sits side by side; give them a shared width so neither looks stubby.
        minWidth: fluid(140, 220),
        maxWidth: '100%',
        opacity: disabled ? 0.55 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: lift(pressed ? 5 : 8),
        transform: pressed ? 'translateY(3px)' : 'none',
        transition: 'transform .1s ease, box-shadow .1s ease',
      }}
    >
      {children}
    </button>
  )
}
