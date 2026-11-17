import { useEffect, useState } from 'react'

/** How long the title takes to pop away (see TitleIntro). */
export const TITLE_EXIT_MS = 450

export type TitleIntroStage = 'showing' | 'leaving' | 'gone'

const stageAt = (endsAtLocalMs: number, nowMs: number): TitleIntroStage =>
  nowMs < endsAtLocalMs - TITLE_EXIT_MS ? 'showing' : nowMs < endsAtLocalMs ? 'leaving' : 'gone'

/**
 * Where the title intro is, for an intro that is over at `endsAtLocalMs`
 * (`performance.now()` time). A screen that arrives after that skips it.
 */
export function useTitleIntro(endsAtLocalMs: number): TitleIntroStage {
  const [stage, setStage] = useState(() => stageAt(endsAtLocalMs, performance.now()))

  useEffect(() => {
    const update = () => { setStage(stageAt(endsAtLocalMs, performance.now())) }
    update()
    const now = performance.now()
    const timers = [endsAtLocalMs - TITLE_EXIT_MS, endsAtLocalMs]
      .filter((atMs) => atMs > now)
      .map((atMs) => setTimeout(update, atMs - now + 5))
    return () => { timers.forEach(clearTimeout) }
  }, [endsAtLocalMs])

  return stage
}
