import { useHover } from '../../../hooks/index.ts'
import { color, lift, sharedStyles } from '../../../theme/index.ts'

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
        borderRadius: 20,
        padding: '22px 54px',
        fontSize: 34,
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
