import { PerspectiveCamera, Vector3 } from 'three'
import { CAMERA, STATION, ringRadius } from './stageConfig.ts'

export type CameraMode = 'showcase' | 'focus' | 'overview' | 'victory'

const smoothstep = (x: number): number => {
  const t = Math.min(1, Math.max(0, x))
  return t * t * (3 - 2 * t)
}
const lerp = (from: number, to: number, amount: number): number => from + (to - from) * amount

/**
 * The camera's director. It opens with a showcase: a slow orbit round the
 * ring, from the far side where every face can be seen, ending behind the
 * player's own board. It then floats there, a little closer to the player and
 * their typewriter, drifting gently. If the player falls it rises and circles
 * the ring so they can watch the others.
 *
 * The camera never snaps: it glides toward whichever pose it wants with
 * exponential smoothing, so any change of mode eases. Shake is added on top of
 * that, after the glide, so the two never fight.
 */
export class CameraRig {
  mode: CameraMode = 'showcase'
  private readonly goalPosition = new Vector3()
  private readonly goalTarget = new Vector3()
  private readonly position = new Vector3()
  private readonly target = new Vector3()
  private radius = ringRadius(2)
  private showcaseClock = 0
  private clock = 0
  private trauma = 0
  private hasStarted = false
  private onShowcaseDone: (() => void) | null = null

  private readonly camera: PerspectiveCamera

  constructor(camera: PerspectiveCamera) {
    this.camera = camera
  }

  /** The ring changed size (players joined or left); the poses follow. */
  setPlayerCount(count: number): void {
    this.radius = ringRadius(count)
  }

  /** Begin the showcase, or go straight to the player when `skip` (e.g. joining mid-race). */
  start(skip: boolean, onDone?: () => void): void {
    this.onShowcaseDone = onDone ?? null
    this.showcaseClock = skip ? CAMERA.SHOWCASE_SECONDS : 0
    this.mode = skip ? 'focus' : 'showcase'
    this.hasStarted = false
  }

  setMode(mode: CameraMode): void {
    if (this.mode === 'showcase' && mode !== 'showcase') this.showcaseClock = CAMERA.SHOWCASE_SECONDS
    this.mode = mode
  }

  /** A kick: 0 to 1, stacking, fading on its own. */
  addTrauma(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount)
  }

  update(deltaSeconds: number): void {
    this.clock += deltaSeconds

    if (this.mode === 'showcase') {
      this.showcaseClock += deltaSeconds
      if (this.showcaseClock >= CAMERA.SHOWCASE_SECONDS) {
        this.mode = 'focus'
        this.onShowcaseDone?.()
      }
    }

    this.choosePose()

    // The first frame starts exactly at the goal; after that it only glides.
    const rate = this.mode === 'showcase' ? 9 : CAMERA.FOLLOW_RATE
    const amount = this.hasStarted ? 1 - Math.exp(-rate * deltaSeconds) : 1
    this.hasStarted = true
    this.position.lerp(this.goalPosition, amount)
    this.target.lerp(this.goalTarget, amount)

    // Floating: slow, out-of-step drifts, a little more when the camera is at rest.
    const drift = this.mode === 'focus' ? 1 : 0.6
    this.camera.position.set(
      this.position.x + Math.sin(this.clock * 0.6) * 0.2 * drift,
      this.position.y + Math.sin(this.clock * 0.45) * 0.13 * drift,
      this.position.z + Math.sin(this.clock * 0.33 + 1) * 0.16 * drift,
    )

    // Shake sits on top: smooth noise scaled by trauma², decaying quickly.
    this.trauma = Math.max(0, this.trauma - deltaSeconds * 2.4)
    const shake = this.trauma * this.trauma
    if (shake > 0) {
      const t = this.clock * 32
      this.camera.position.x += Math.sin(t * 1.7) * 0.12 * shake
      this.camera.position.y += Math.sin(t * 2.3) * 0.08 * shake
    }
    this.camera.lookAt(this.target)
    if (shake > 0) this.camera.rotation.z += Math.sin(this.clock * 27) * 0.012 * shake
  }

  /* ---------------- poses ---------------- */

  private choosePose(): void {
    const focus = this.focusPose()
    if (this.mode === 'focus') {
      this.goalPosition.copy(focus.position)
      this.goalTarget.copy(focus.target)
      return
    }
    if (this.mode === 'victory') {
      // Swings slowly from side to side in front of the winner, and a touch closer.
      const swing = Math.sin(this.clock * 0.55) * 0.55
      this.goalPosition.set(Math.sin(swing) * 6, STATION.BOARD_TOP_HEIGHT + 2.6, this.radius + Math.cos(swing) * 6.2)
      this.goalTarget.set(0, STATION.BOARD_TOP_HEIGHT + 1.5, this.radius - 0.6)
      return
    }
    if (this.mode === 'overview') {
      const angle = Math.PI / 2 + this.clock * 0.1
      const distance = this.radius + 10
      this.goalPosition.set(Math.cos(angle) * distance, 8.5, Math.sin(angle) * distance)
      this.goalTarget.set(0, 1.2, 0)
      return
    }

    // The showcase: an orbit from the far side round to behind the player.
    const progress = smoothstep(this.showcaseClock / CAMERA.SHOWCASE_SECONDS)
    const angle = lerp(Math.PI * 1.5, Math.PI / 2, progress)
    const distance = lerp(this.radius + 15, focus.behind, progress)
    this.goalPosition.set(
      Math.cos(angle) * distance + (focus.position.x * progress),
      lerp(10.5, focus.position.y, progress),
      Math.sin(angle) * distance,
    )
    this.goalTarget.set(
      lerp(0, focus.target.x, progress),
      lerp(1.4, focus.target.y, progress),
      lerp(0, focus.target.z, progress),
    )
  }

  /** Behind the player's board, above it, looking over their shoulder at the typewriter. */
  private focusPose(): { position: Vector3; target: Vector3; behind: number } {
    const behind = this.radius + CAMERA.FOCUS_BEHIND
    return {
      behind,
      position: new Vector3(0.6, STATION.BOARD_TOP_HEIGHT + CAMERA.FOCUS_HEIGHT, behind),
      target: new Vector3(0, STATION.BOARD_TOP_HEIGHT + 0.6, this.radius - 1.8),
    }
  }
}
