import { color, font } from '../../theme/index.ts'

/** "+N" on the top marker of a pile on a progress bar: how many more are bunched up under it. */
export function FoldedBadge({ count, isCompact = false }: { count: number; isCompact?: boolean }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: isCompact ? -9 : -12,
        top: isCompact ? -6 : -8,
        minWidth: isCompact ? 16 : 20,
        padding: '1px 4px',
        borderRadius: 999,
        background: color.ink,
        border: `2px solid ${color.cream}`,
        color: color.cream,
        fontFamily: font.display,
        fontWeight: 700,
        fontSize: isCompact ? 9 : 11,
        lineHeight: 1.2,
        textAlign: 'center',
        whiteSpace: 'nowrap',
        zIndex: 4,
      }}
    >
      +{count}
    </div>
  )
}
