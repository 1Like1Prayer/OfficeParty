import { ROUND_CUE_MS } from '../../components/GamePlay/cue.ts'
import { MAGE_BATTLE } from '../../shared/games/mageBattle/constants.ts'
import { advanceTo, angleAt, pressDial, startDial } from '../../shared/games/mageBattle/dial.ts'
import { dialKey, readDial } from '../../shared/games/mageBattle/module.ts'
import { battleBar, type Standing } from '../../shared/games/mageBattle/progress.ts'
import type { Dial, MageBattleRound, PressReply } from '../../shared/games/mageBattle/types.ts'
import type { RoundPlayerView } from '../../types/index.ts'
import { MageBattleScene, type MageView } from './scene/MageBattleScene.ts'
import { BLOCK_COLORS, drawDial, type DialFlash } from './ui/drawDial.ts'
import { sfx } from '../../audio/sfx/index.ts'

/** A dial flourish lasts this long after a press. */
const FLASH_MS = 450
const PRESS_KEYS = new Set([' ', 'Enter'])

export type Stage = 'building' | 'cueing' | 'playing'

export interface MageBattleSetup {
  host: HTMLElement
  /** The dial is drawn here, over the scene. */
  dialCanvas: HTMLCanvasElement
  round: MageBattleRound
  players: readonly RoundPlayerView[]
  selfPlayerId: string
  /** False for someone only watching: they have no dial. */
  isFighting: boolean
  /** `performance.now()` value the round's clock starts at. */
  timingStartsAtLocalMs: number
}

/** What this player's own spell just did, for the HUD. */
export type SpellEvent =
  | { kind: 'hit'; points: number }
  | { kind: 'miss' }
  /** A whole spin went by without a press. */
  | { kind: 'idle' }
  /** Pressed again in a spin already used: nothing happens. */
  | { kind: 'spent' }

export interface MageBattleCallbacks {
  /** Tell the server about a press; it answers with what it scored. */
  press: (atMs: number) => Promise<unknown>
  /** This mage's own dial changed: the HUD redraws from it. */
  dial: (dial: Dial) => void
  spell: (event: SpellEvent) => void
  /** This mage is done (knocked out, the clock ran out, or told to stop). Called once. */
  finish: () => void
}

/** What the game remembers of each mage's last spin, to notice a new press or a spin gone by. */
interface Seen {
  spin: number
  pressPoints: number | null
}

/**
 * Mage Battle in the browser: turns this player's dial, answers a press at
 * once, and hands the scene a frame to draw.
 *
 * A press is scored here straight away with the same rules the server uses
 * (see dial.ts), so the dial and the beam answer the moment it lands; the
 * server's reply then replaces this dial with its own word. Only one press
 * per spin counts, so a reply is always back before the next press can
 * matter. Everyone else's dial arrives in the round's shared world and is
 * turned on locally between their presses.
 */
export class MageBattleGame {
  private readonly scene: MageBattleScene
  private readonly setup: MageBattleSetup
  private readonly callbacks: MageBattleCallbacks

  private dial: Dial
  private shared: Readonly<Record<string, number>> = {}
  private stage: Stage = 'building'
  private finished = false
  private winners: ReadonlySet<string> = new Set()
  /** Sounds heard already: mages knocked out, and this mage's own win. */
  private readonly knockedOut = new Set<string>()
  private hasCheered = false
  private flash: (DialFlash & { atMs: number }) | null = null
  private readonly seen = new Map<string, Seen>()

  private readonly unlisten: () => void
  private readonly backgroundTimer: ReturnType<typeof setInterval>
  private frameId = 0

  constructor(setup: MageBattleSetup, callbacks: MageBattleCallbacks) {
    this.setup = setup
    this.callbacks = callbacks
    this.dial = startDial(setup.round.seed, setup.selfPlayerId)
    this.scene = new MageBattleScene(setup.host)
    this.scene.setRoster(setup.players, setup.isFighting ? setup.selfPlayerId : null)

    this.unlisten = this.listenToKeys()
    // Spins keep turning while the tab is hidden and frames stop; the game keeps up.
    this.backgroundTimer = setInterval(() => { this.advance() }, 250)
    const loop = () => {
      this.advance()
      this.draw()
      this.frameId = requestAnimationFrame(loop)
    }
    this.frameId = requestAnimationFrame(loop)
  }

  setStage(stage: Stage): void {
    this.stage = stage
  }

  /** Every mage's dial and score, as the server publishes them. */
  setShared(values: Readonly<Record<string, number>>): void {
    this.shared = values
    if (this.setup.isFighting && values[dialKey(this.setup.selfPlayerId, 'outAtMs')] !== undefined) {
      this.dial = { ...this.dial, outAtMs: values[dialKey(this.setup.selfPlayerId, 'outAtMs')]! }
      this.callbacks.dial(this.dial)
      this.finish()
    }
  }

  setWinners(playerIds: ReadonlySet<string>): void {
    this.winners = playerIds
  }

  /** The server has called the round while this mage is still standing. */
  stop(): void {
    this.finish()
  }

  /** A press: Space, Enter, a click or a tap. */
  press(): void {
    if (!this.canPress()) return
    const atMs = this.raceMs()
    const { dial, points, counted } = pressDial(this.dial, atMs, this.setup.round.seed, this.setup.selfPlayerId)
    if (!counted) {
      sfx.mageBattle.spent()
      this.callbacks.spell({ kind: 'spent' })
      return
    }
    this.dial = dial
    this.callbacks.dial(dial)
    this.showSpell(this.setup.selfPlayerId, points)
    this.callbacks.spell(points > 0 ? { kind: 'hit', points } : { kind: 'miss' })
    this.flash = {
      color: points > 0 ? (BLOCK_COLORS[points] ?? '#FFFFFF') : '#E5382F',
      strength: 1,
      isMiss: points === 0,
      atMs,
    }

    this.callbacks
      .press(atMs)
      .then((reply) => {
        // The server's word: a press that reached it late may have been scored differently.
        const answer = reply as PressReply
        if (typeof answer?.dial?.spin === 'number' && answer.dial.spin >= this.dial.spin) {
          this.dial = { ...answer.dial, outAtMs: this.dial.outAtMs ?? answer.dial.outAtMs }
          this.callbacks.dial(this.dial)
        }
      })
      .catch(() => undefined)
  }

  dispose(): void {
    cancelAnimationFrame(this.frameId)
    clearInterval(this.backgroundTimer)
    this.unlisten()
    this.scene.dispose()
  }

  /* ---------------- the dial ---------------- */

  private raceMs(): number {
    return performance.now() - this.setup.timingStartsAtLocalMs
  }

  private canPress(): boolean {
    const now = this.raceMs()
    return this.setup.isFighting && !this.finished && this.stage === 'playing' && now >= 0 && now < MAGE_BATTLE.ROUND_MS
  }

  /** Plays out spins that have ended: a spin with no press is a miss. */
  private advance(): void {
    if (!this.setup.isFighting || this.finished) return
    const now = this.raceMs()
    if (now < 0) return
    const atMs = Math.min(now, MAGE_BATTLE.ROUND_MS)
    const next = advanceTo(this.dial, atMs, this.setup.round.seed, this.setup.selfPlayerId)
    if (next.spin !== this.dial.spin) {
      if (this.dial.pressPoints === null && this.stage === 'playing') {
        this.callbacks.spell({ kind: 'idle' })
        this.showSpell(this.setup.selfPlayerId, 0)
      }
      this.dial = next
      this.callbacks.dial(next)
    }
    if (now >= MAGE_BATTLE.ROUND_MS) this.finish()
  }

  private finish(): void {
    if (this.finished || !this.setup.isFighting) return
    this.finished = true
    this.callbacks.finish()
  }

  private showSpell(playerId: string, points: number): void {
    // This mage's own spells in full; the others' quietly, so a crowd is not a din.
    const isSelf = playerId === this.setup.selfPlayerId
    const quiet = { volume: 0.25, gate: `mb.other.${playerId}`, minGapMs: 120 }
    if (points > 0) sfx.mageBattle.cast(points, isSelf ? {} : quiet)
    else sfx.mageBattle.fizzle(isSelf ? {} : quiet)
    if (points > 0) this.scene.spellLanded(playerId, points)
    else this.scene.spellFizzled(playerId)
  }

  /** Notices other mages' presses, and their spins going by unpressed, to play them out. */
  private watchOthers(playerId: string, dial: Dial, now: number): void {
    const before = this.seen.get(playerId)
    const turned = now >= 0 ? advanceTo(dial, now, this.setup.round.seed, playerId) : dial
    const current = { spin: turned.spin, pressPoints: turned.pressPoints }
    this.seen.set(playerId, current)
    if (before === undefined || dial.outAtMs !== null) return
    if (current.spin === before.spin && before.pressPoints === null && current.pressPoints !== null) {
      this.showSpell(playerId, current.pressPoints)
    } else if (current.spin > before.spin && before.pressPoints === null && this.stage === 'playing') {
      // A press in the spin just ended arrived along with the turn; otherwise it went by unpressed.
      const pressed = dial.spin === before.spin ? dial.pressPoints : null
      this.showSpell(playerId, pressed ?? 0)
    }
  }

  /* ---------------- drawing ---------------- */

  private draw(): void {
    const now = this.raceMs()
    const { round, selfPlayerId, isFighting } = this.setup

    // Scores from the shared world, with this mage's own the moment they press.
    const world = { get: (key: string) => this.shared[key] }
    const dials = new Map(round.playerIds.map((playerId) => [playerId, readDial(world, round, playerId)]))
    if (isFighting) dials.set(selfPlayerId, this.dial)
    const standings: Standing[] = round.playerIds.map((playerId) => ({
      playerId,
      score: dials.get(playerId)!.score,
      out: dials.get(playerId)!.outAtMs !== null,
    }))
    const might = new Map(battleBar(standings).markers.map(({ playerId, fractionOfBar }) => [playerId, fractionOfBar]))

    const mages: MageView[] = round.playerIds.map((playerId) => {
      const dial = dials.get(playerId)!
      if (playerId !== selfPlayerId || !isFighting) this.watchOthers(playerId, dial, Math.min(now, MAGE_BATTLE.ROUND_MS))
      const pose = this.winners.has(playerId) ? 'won' : dial.outAtMs !== null ? 'out' : 'casting'
      this.poseSounds(playerId, pose)
      return { playerId, pose, might: might.get(playerId) ?? 1, score: dial.score, isSelf: playerId === selfPlayerId }
    })

    const isStanding = isFighting && this.dial.outAtMs === null && this.winners.size === 0
    this.scene.render({
      mages,
      focusOnSelf: isStanding && this.stage !== 'building',
      isOpening: this.stage === 'building',
      // The flight to the shoulder sets off as the start is counted in.
      secondsToFlight: (this.setup.timingStartsAtLocalMs - ROUND_CUE_MS - performance.now()) / 1000,
    })

    if (isFighting) this.drawDial(now)
  }

  /** A shatter as a mage is knocked out (the player's own in full), and the win for the last one standing. */
  private poseSounds(playerId: string, pose: 'won' | 'out' | 'casting'): void {
    const isSelf = playerId === this.setup.selfPlayerId
    if (pose === 'out' && !this.knockedOut.has(playerId)) {
      this.knockedOut.add(playerId)
      sfx.mageBattle.knockedOut({ volume: isSelf ? 1 : 0.35 })
    }
    if (pose === 'won' && isSelf && !this.hasCheered) {
      this.hasCheered = true
      sfx.mageBattle.win()
    }
  }

  private drawDial(now: number): void {
    const dial = this.stage === 'playing' && now >= 0 ? advanceTo(this.dial, Math.min(now, MAGE_BATTLE.ROUND_MS), this.setup.round.seed, this.setup.selfPlayerId) : this.dial
    // Waiting at the top until the clock runs.
    const needle = this.stage === 'playing' && now >= 0 && !this.finished ? angleAt(dial, Math.min(now, MAGE_BATTLE.ROUND_MS)) : 0
    const pressed = dial.pressedAtMs === null ? null : angleAt(dial, dial.pressedAtMs)
    let flash: DialFlash | null = null
    if (this.flash !== null) {
      const strength = 1 - (now - this.flash.atMs) / FLASH_MS
      if (strength > 0) flash = { ...this.flash, strength }
      else this.flash = null
    }
    drawDial(this.setup.dialCanvas, dial, needle, pressed, flash)
  }

  private listenToKeys(): () => void {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || !PRESS_KEYS.has(event.key)) return
      event.preventDefault()
      if (!event.repeat) this.press()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => { window.removeEventListener('keydown', onKeyDown) }
  }
}
