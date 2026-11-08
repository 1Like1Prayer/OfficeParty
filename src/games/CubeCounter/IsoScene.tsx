import { memo } from 'react'
import type { Box } from '../../shared/games/cubeCounter/types.ts'
import { color } from '../../theme/index.ts'
import { VIEW_BOX, boxFaces, drawOrder, floorLines, floorOutline } from './projection.ts'

const FACE = { top: '#FFE9A3', sideX: '#FFC400', sideY: '#FF9E4F' } as const

interface IsoSceneProps {
  boxes: readonly Box[]
}

/** The 5x5 floor and the blocks on it, seen from the server's fixed camera. */
export const IsoScene = memo(function IsoScene({ boxes }: IsoSceneProps) {
  const lines = floorLines()

  return (
    <svg
      role="img"
      aria-label="A scene of blocks"
      viewBox={`${VIEW_BOX.x} ${VIEW_BOX.y} ${VIEW_BOX.width} ${VIEW_BOX.height}`}
      style={{ display: 'block', overflow: 'visible', width: '100%', height: '100%' }}
    >
      <polygon points={floorOutline} fill={color.white} stroke={color.ink} strokeWidth={3} strokeLinejoin="round" />
      {lines.map(([a, b], index) => (
        <line key={index} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color.dashed} strokeWidth={1.5} />
      ))}
      {drawOrder(boxes).map((box) => {
          const faces = boxFaces(box)
          const key = `${box.x}-${box.y}-${box.z}`
          const stroke = { stroke: color.ink, strokeWidth: 2.5, strokeLinejoin: 'round' as const }
          return (
            <g key={key}>
              <polygon points={faces.sideY} fill={FACE.sideY} {...stroke} />
              <polygon points={faces.sideX} fill={FACE.sideX} {...stroke} />
              <polygon points={faces.top} fill={FACE.top} {...stroke} />
            </g>
          )
        })}
    </svg>
  )
})
