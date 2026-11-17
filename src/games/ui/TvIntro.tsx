import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { RoundPlayerView } from '../../types/index.ts'
import { TV_INTRO_FADE_MS, TvCircleScene, type TvShow } from '../three/TvCircleScene.ts'

interface TvIntroProps {
  players: readonly RoundPlayerView[]
  selfPlayerId: string
  /** `performance.now()` value the clock starts at; the intro is gone by then. */
  timingStartsAtLocalMs: number
  /** What the screens show before the count-in. Keep it stable (module-level or memoised): a new one rebuilds the scene. */
  show: TvShow
  /** Controls over the picture, such as a button; they take clicks, though the picture never does. */
  children?: ReactNode
}

/**
 * The TV circle (see TvCircleScene) over the whole screen while the round
 * builds up. Usually it fades out so that it has gone exactly as the clock
 * starts, leaving the game underneath it as it always was; a show that
 * `staysForGame` is up for as long as this is mounted, and the game is played
 * on the TV. The picture itself never takes a click or a key.
 */
export function TvIntro({ players, selfPlayerId, timingStartsAtLocalMs, show, children }: TvIntroProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const staysForGame = show.staysForGame === true
  // A screen that opens once the clock is already running has missed it, unless the game is on the TV.
  const [stage, setStage] = useState<'showing' | 'leaving' | 'gone'>(() =>
    staysForGame || performance.now() < timingStartsAtLocalMs ? 'showing' : 'gone',
  )

  const isUp = stage !== 'gone'
  useEffect(() => {
    if (!isUp || staysForGame) return
    const now = performance.now()
    const leave = window.setTimeout(() => { setStage('leaving') }, timingStartsAtLocalMs - TV_INTRO_FADE_MS - now)
    const gone = window.setTimeout(() => { setStage('gone') }, timingStartsAtLocalMs - now)
    return () => {
      window.clearTimeout(leave)
      window.clearTimeout(gone)
    }
  }, [isUp, staysForGame, timingStartsAtLocalMs])

  const playerKey = players.map(({ playerId }) => playerId).join('|')
  const sceneRef = useRef<TvCircleScene | null>(null)
  useEffect(() => {
    const host = hostRef.current
    if (!isUp || host === null) return
    const scene = new TvCircleScene(host, players, selfPlayerId, timingStartsAtLocalMs, show)
    sceneRef.current = scene
    return () => {
      scene.dispose()
      sceneRef.current = null
    }
    // Built once per roster. A later stage's start and picture are handed to
    // the same scene below, so it carries on rather than starting again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUp, playerKey, selfPlayerId])
  useEffect(() => { sceneRef.current?.setTiming(timingStartsAtLocalMs) }, [timingStartsAtLocalMs])
  useEffect(() => { sceneRef.current?.setShow(show) }, [show])

  if (!isUp) return null
  // Over the whole screen, whatever the play screen's layout, but under the screen-change stripes.
  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 900,
        overflow: 'hidden',
        background: '#241A3D',
        pointerEvents: 'none',
        opacity: stage === 'leaving' ? 0 : 1,
        transition: `opacity ${TV_INTRO_FADE_MS}ms ease-in`,
      }}
    >
      <div ref={hostRef} aria-hidden style={{ position: 'absolute', inset: 0 }} />
      {children}
    </div>,
    document.body,
  )
}
