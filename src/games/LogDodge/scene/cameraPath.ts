import { CAMERA, ZOOM } from './sceneConfig.ts'

const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

/**
 * How far the opening swoop has got, 0 (high above everyone) to 1 (behind the
 * player), for a time measured from the clock starting. A pure function of the
 * time, so a screen that mounts late simply finds the camera where it should be.
 */
export function zoomProgress(msFromStart: number): number {
  const raw = (msFromStart - ZOOM.START_MS) / (ZOOM.END_MS - ZOOM.START_MS)
  return easeInOutCubic(Math.min(1, Math.max(0, raw)))
}

export interface CameraPose {
  position: [number, number, number]
  target: [number, number, number]
}

/** Above the belt, high enough to take in `halfWidth` either side of the middle. */
export function overviewPose(halfWidth: number, verticalFov: number, aspect: number): CameraPose {
  const halfTan = Math.tan((verticalFov * Math.PI) / 360)
  const height = Math.max(15, (halfWidth + 1.5) / (halfTan * aspect)) * CAMERA.OVERVIEW_PULL_BACK
  return {
    position: [0, height, height * CAMERA.OVERVIEW_TILT],
    target: [0, 0, -1.5],
  }
}

/** Low and behind the player, looking up the belt at what is coming. */
export function followPose(playerX: number): CameraPose {
  return {
    position: [playerX, CAMERA.FOLLOW_HEIGHT, CAMERA.FOLLOW_BEHIND],
    target: [playerX, CAMERA.FOLLOW_LOOK_HEIGHT, CAMERA.FOLLOW_LOOK_AHEAD],
  }
}
