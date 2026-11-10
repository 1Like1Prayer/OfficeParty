/** Eases in and out, so motion starts and stops softly. */
export const easeInOut = (progress: number): number =>
  progress * progress * (3 - 2 * progress)

interface Tween {
  elapsed: number
  delaySeconds: number
  durationSeconds: number
  apply: (progress: number) => void
  onDone?: () => void
}

/**
 * Runs timed changes: after a delay, call `apply` with a progress from 0 to 1
 * (eased) over a duration, then `onDone`. It lets the scene script a
 * changeover as a handful of tweens instead of tracking each one by hand.
 */
export class Tweener {
  private tweens: Tween[] = []

  add(
    delaySeconds: number,
    durationSeconds: number,
    apply: (progress: number) => void,
    onDone?: () => void,
  ): void {
    this.tweens.push({ elapsed: 0, delaySeconds, durationSeconds, apply, onDone })
  }

  update(deltaSeconds: number): void {
    const stillRunning: Tween[] = []
    for (const tween of this.tweens) {
      tween.elapsed += deltaSeconds
      const raw = (tween.elapsed - tween.delaySeconds) / tween.durationSeconds
      if (raw < 0) {
        stillRunning.push(tween)
        continue
      }
      tween.apply(easeInOut(Math.min(1, raw)))
      if (raw >= 1) tween.onDone?.()
      else stillRunning.push(tween)
    }
    this.tweens = stillRunning
  }

  clear(): void {
    this.tweens = []
  }
}
