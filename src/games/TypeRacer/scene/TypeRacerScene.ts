import {
  ACESFilmicToneMapping,
  AmbientLight,
  Clock,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three'
import type { RoundPlayerView } from '../../../types/index.ts'
import { labelWidthFor } from '../../three/Nameplate.ts'
import { CameraRig, type CameraMode } from './CameraRig.ts'
import { FrontDie } from './FrontDie.ts'
import { ParticleSystem } from './ParticleSystem.ts'
import { SkyDome } from './SkyDome.ts'
import { Station, type RollView, type StationEffects, type StationTextures } from './Station.ts'
import { CAMERA, SKY, WATER_LEVEL, ringRadius, stationPose } from './stageConfig.ts'
import { createDieFaceTexture, createPlankTexture, createWoodTexture } from './textures.ts'
import { Tweener } from '../../three/tweens.ts'
import { Water } from './Water.ts'

/** What the room reports about one player, for the scene to act out. */
export interface StationView {
  playerId: string
  /** How far along the race, 0 to 1. */
  fraction: number
  chars: number
  strikes: number
  /** Skull sides on the die they would roll next. */
  skulls: number
  status: 'typing' | 'finished' | 'out'
}

const LABEL_MAX_PIXELS = 190
const LABEL_MIN_PIXELS = 110

/**
 * The stage: a calm sea at dusk with a ring of boards, each held up by one
 * wooden block, each with a person at a typewriter. React owns the race; this
 * class only draws it. Tell it who is playing with `setRoster`, tell it about
 * the player's own keystrokes and dice as they happen, and feed it what the
 * others report so it can act their race out too.
 */
export class TypeRacerScene {
  private readonly renderer: WebGLRenderer
  private readonly scene = new Scene()
  private readonly camera = new PerspectiveCamera(CAMERA.FIELD_OF_VIEW, 1, 0.5, 1500)
  private readonly rig = new CameraRig(this.camera)
  private readonly clock = new Clock()
  private readonly tweens = new Tweener()
  private readonly water = new Water()
  private readonly sky = new SkyDome()
  private readonly splashes = new ParticleSystem(false)
  private readonly sun = new DirectionalLight(0xffb27a, 2.6)
  private readonly textures: StationTextures
  /** The roll of the player's own die, on its own layer over the whole scene. */
  private readonly frontDie: FrontDie
  private readonly resizeObserver: ResizeObserver
  private readonly stations = new Map<string, Station>()
  private readonly lastViews = new Map<string, StationView>()
  private selfPlayerId = ''
  private labelWidth = 1
  private elapsedSeconds = 0
  /** How much of the canvas's top the on-screen UI covers; the scene is framed in the rest. */
  private topInset = 0
  /** Where `topInset` is heading. It eases there, so the picture slides when the UI moves away. */
  private topInsetGoal = 0
  private hasSetInset = false
  private hasFinished = false

  private readonly effects: StationEffects = {
    splashParticles: (burst) => { this.splashes.emit(burst) },
    ripple: (x, z, strength) => { this.water.addRipple(x, z, strength) },
    // Only the player's own big moments move the camera; other people's never do.
    trauma: (amount, isYours) => { if (isYours) this.rig.addTrauma(amount) },
  }

  constructor(host: HTMLElement) {
    this.renderer = new WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.toneMapping = ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = PCFSoftShadowMap
    // Out of the layout flow, so a stale canvas size can never force the page wider.
    Object.assign(this.renderer.domElement.style, { position: 'absolute', inset: '0' })
    host.appendChild(this.renderer.domElement)

    this.scene.background = new Color(SKY.HORIZON)
    this.scene.fog = new Fog(SKY.HORIZON, 70, 330)
    this.scene.add(this.sky.mesh, this.water.mesh, this.splashes.points)
    this.addLights()

    this.textures = {
      wood: createWoodTexture(),
      planks: createPlankTexture(),
      heartFace: createDieFaceTexture('heart'),
      skullFace: createDieFaceTexture('skull'),
    }
    this.frontDie = new FrontDie(this.textures.heartFace, this.textures.skullFace)

    this.resizeObserver = new ResizeObserver(() => { this.resize(host) })
    this.resizeObserver.observe(host)
    this.resize(host)
    this.renderer.setAnimationLoop(() => { this.renderFrame() })
  }

  /* ---------------- set-up ---------------- */

  /**
   * Who is playing. The player themself sits nearest the camera; the others
   * follow round the ring in the order given.
   */
  setRoster(players: readonly RoundPlayerView[], selfPlayerId: string): void {
    for (const station of this.stations.values()) this.removeStation(station)
    this.stations.clear()
    this.lastViews.clear()
    this.selfPlayerId = selfPlayerId
    this.hasFinished = false

    const selfIndex = Math.max(0, players.findIndex(({ playerId }) => playerId === selfPlayerId))
    players.forEach((player, index) => {
      const station = new Station(
        player,
        stationPose(index, selfIndex, players.length),
        this.textures,
        this.effects,
        player.playerId === selfPlayerId,
      )
      this.scene.add(station.root, station.nameplate.sprite)
      this.stations.set(player.playerId, station)
    })

    this.rig.setPlayerCount(players.length)
    this.addShadowReach(ringRadius(players.length))
    this.sizeLabels()
  }

  /** Begin the camera's showcase of everyone, then settle on the player. `skip` goes straight to the player. */
  startShowcase(skip: boolean): void {
    this.rig.start(skip)
  }

  setCameraMode(mode: CameraMode): void {
    this.rig.setMode(mode)
  }

  /**
   * Gives the dice roll a canvas of its own inside `host`, an element stacked
   * above the rest of the screen so the die is the nearest thing to the player.
   */
  attachFrontLayer(host: HTMLElement): void {
    this.frontDie.attach(host)
  }

  /* ---------------- the player's own race ---------------- */

  keyPress(): void { this.self()?.keyPress() }
  lineDone(): void { this.self()?.lineDone() }
  newParagraph(): void { this.self()?.newParagraph() }
  mistake(): void { this.self()?.mistake() }
  setSelfStress(level: number): void { this.self()?.setStress(level) }
  celebrate(): void {
    // Winning ends any roll still in the air.
    this.frontDie.cancel()
    this.self()?.celebrate()
  }

  /**
   * The player has earned a roll. The die is picked up and shaken on the front
   * layer in the middle of the screen at once, while the server decides how it
   * lands; `skulls` is how many of its sides are skulls.
   */
  beginRoll(skulls: number): void {
    this.self()?.setStress(1)
    this.frontDie.begin(skulls)
  }

  /**
   * The server's roll for the player. The die is thrown, and the board reacts
   * to the result when it lands.
   */
  rollDie(roll: RollView): void {
    const station = this.self()
    if (station === undefined) return
    station.setStress(1)
    this.frontDie.resolve(roll, () => { station.showRollOutcome(roll) })
  }

  /** The player is out: their block gives way, and the camera rises to watch the rest. */
  crumble(): void {
    this.self()?.crumble()
    // Let the fall play before the camera lifts away from it.
    this.tweens.add(1.6, 0.01, () => { this.rig.setMode('overview') })
  }

  /**
   * The race is decided. The winner or winners celebrate — arms up, a crown, a
   * golden light — and everyone else still on a board watches it give way and
   * drowns, one after another. The camera follows whichever fate is the player's.
   */
  finishRace(winnerIds: readonly string[]): void {
    if (this.hasFinished) return
    this.hasFinished = true
    this.frontDie.cancel()

    let loser = 0
    for (const station of this.stations.values()) {
      if (winnerIds.includes(station.player.playerId)) {
        station.win()
      } else if (!station.hasFallen) {
        const isYou = station.player.playerId === this.selfPlayerId
        // The player's own fate goes first, so it is not missed.
        const delay = isYou ? 0.25 : 0.7 + 0.22 * loser++
        this.tweens.add(delay, 0.01, () => { if (isYou) this.crumble(); else station.crumble() })
      }
    }
    if (winnerIds.includes(this.selfPlayerId)) {
      this.tweens.add(0.6, 0.01, () => { this.rig.setMode('victory') })
    }
  }

  /* ---------------- everyone else ---------------- */

  /** What the room reports about each player. The others' races are acted out from changes in it. */
  applyViews(views: readonly StationView[]): void {
    for (const view of views) {
      const station = this.stations.get(view.playerId)
      if (!station) continue

      const previous = this.lastViews.get(view.playerId)
      this.lastViews.set(view.playerId, view)

      if (view.playerId !== this.selfPlayerId) this.actOut(station, previous, view)
      this.labelStation(station, view)
    }
  }

  dispose(): void {
    this.renderer.setAnimationLoop(null)
    this.resizeObserver.disconnect()
    this.tweens.clear()
    for (const station of this.stations.values()) this.removeStation(station)
    this.stations.clear()
    this.water.dispose()
    this.sky.dispose()
    this.splashes.dispose()
    this.frontDie.dispose()
    Object.values(this.textures).forEach((texture) => { texture.dispose() })
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  /* ---------------- acting out the others ---------------- */

  /** A player reported something new. Show whatever changed since last time. */
  private actOut(station: Station, previous: StationView | undefined, view: StationView): void {
    if (previous === undefined || station.hasFallen) return

    const typed = view.chars - previous.chars
    if (typed > 0) {
      // A burst of progress is a handful of key presses.
      for (let tap = 0; tap < Math.min(6, typed); tap++) {
        this.tweens.add(tap * 0.07, 0.01, () => { station.keyPress() })
      }
    } else if (typed < 0) {
      station.mistake()
    }

    if (view.strikes >= 3 && previous.strikes < 3 && view.status === 'typing') station.setStress(1)
    else if (view.strikes === 2) station.setStress(0.4)
    else if (view.strikes < 2 && previous.strikes >= 2) station.setStress(0)

    // They survived a roll: the die they threw had the skulls they had before.
    if (view.skulls > previous.skulls && view.status === 'typing') {
      const skulls = previous.skulls
      station.rollDie({ face: this.faceFor(false, skulls), skulls, isSkull: false })
    }

    if (view.status === 'finished' && previous.status !== 'finished') station.celebrate()

    if (view.status === 'out' && previous.status !== 'out') {
      // Three strikes means the dice did it; otherwise the clock did.
      if (view.strikes >= 3) {
        station.rollDie(
          { face: this.faceFor(true, view.skulls), skulls: view.skulls, isSkull: true },
          () => { this.tweens.add(0.5, 0.01, () => { station.crumble() }) },
        )
      } else {
        station.crumble()
      }
    }
  }

  /** A face showing a skull (the lowest numbers) or a heart (the rest). */
  private faceFor(isSkull: boolean, skulls: number): number {
    const sides = 6
    return isSkull
      ? 1 + Math.floor(Math.random() * Math.max(1, skulls))
      : skulls + 1 + Math.floor(Math.random() * Math.max(1, sides - skulls))
  }

  private labelStation(station: Station, view: StationView): void {
    const isYou = station.player.playerId === this.selfPlayerId
    station.setLabel({
      name: station.player.name,
      score: Math.round(view.fraction * 100),
      unit: '%',
      status:
        view.status === 'out' ? 'OUT' : view.status === 'finished' ? 'DONE!' : view.strikes > 0 ? `${view.strikes} STRIKE${view.strikes > 1 ? 'S' : ''}` : 'TYPING',
      isYou,
      isFallen: view.status === 'out',
    })
  }

  /* ---------------- frame ---------------- */

  private renderFrame(): void {
    const deltaSeconds = Math.min(this.clock.getDelta(), 0.05)
    this.elapsedSeconds += deltaSeconds

    this.tweens.update(deltaSeconds)
    this.easeTopInset(deltaSeconds)
    this.rig.update(deltaSeconds)
    this.sky.update(this.elapsedSeconds)
    this.water.update(deltaSeconds)
    this.splashes.update(deltaSeconds)
    this.frontDie.update(deltaSeconds)

    let slot = 0
    for (const station of this.stations.values()) {
      station.update(deltaSeconds)
      this.water.setStation(slot++, station.root.position.x, station.root.position.z, station.foam)

      // The name tag rides above its player; the player's own is out of the way while the camera is behind them.
      const tag = station.nameplate
      station.root.updateMatrixWorld(true)
      tag.sprite.position.copy(station.root.localToWorld(station.nameTagLocal))
      tag.setWidth(this.labelWidth)
      const isHiddenSelf = station.player.playerId === this.selfPlayerId && this.rig.mode === 'focus'
      tag.setOpacity(isHiddenSelf ? 0 : 1)
      // A player who has gone into the water takes their name tag with them.
      tag.sprite.visible = !station.hasFallen
    }
    this.renderer.render(this.scene, this.camera)
    this.frontDie.render()
  }

  /* ---------------- helpers ---------------- */

  private self(): Station | undefined {
    return this.stations.get(this.selfPlayerId)
  }

  private removeStation(station: Station): void {
    this.scene.remove(station.root, station.nameplate.sprite)
    station.dispose()
  }

  private addLights(): void {
    this.scene.add(new HemisphereLight(0xffcfa0, 0x1d3550, 0.85), new AmbientLight(0x6a5a7a, 0.4))
    const direction = new Vector3(...SKY.SUN_DIRECTION).normalize()
    this.sun.position.copy(direction).multiplyScalar(-40).setY(18)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(2048, 2048)
    this.sun.shadow.bias = -0.0004
    this.sun.shadow.normalBias = 0.04
    this.scene.add(this.sun, this.sun.target)
  }

  /** The shadow camera has to cover the whole ring. */
  private addShadowReach(radius: number): void {
    const reach = radius + 6
    Object.assign(this.sun.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, near: 1, far: 120 })
    this.sun.shadow.camera.updateProjectionMatrix()
    this.sun.position.set(-reach * 0.9, 18, reach * 0.6)
    void WATER_LEVEL
  }

  private sizeLabels(): void {
    const { clientHeight, clientWidth } = this.renderer.domElement
    if (clientHeight === 0) return
    const pixels = Math.min(LABEL_MAX_PIXELS, Math.max(LABEL_MIN_PIXELS, clientWidth * 0.12))
    this.labelWidth = labelWidthFor(pixels, clientHeight, this.camera.fov)
  }

  private resize(host: HTMLElement): void {
    const { clientWidth: width, clientHeight: height } = host
    if (width === 0 || height === 0) return
    this.renderer.setSize(width, height)
    this.camera.aspect = width / height
    this.applyViewOffset(width, height)
    this.frontDie.resize(width, height)
    this.sizeLabels()
  }

  /**
   * The text and progress bar cover the top of the screen, so the stage is
   * framed in what is left: the picture is shifted down by half the cover, which
   * puts its centre in the middle of the free part.
   */
  setTopInset(pixels: number): void {
    this.topInsetGoal = pixels
    // The first measurement is simply where things start; only later changes glide.
    if (!this.hasSetInset) {
      this.hasSetInset = true
      this.topInset = pixels
      const { clientWidth: width, clientHeight: height } = this.renderer.domElement
      if (width > 0 && height > 0) this.applyViewOffset(width, height)
    }
  }

  private easeTopInset(deltaSeconds: number): void {
    if (Math.abs(this.topInsetGoal - this.topInset) < 0.5) {
      if (this.topInset !== this.topInsetGoal) {
        this.topInset = this.topInsetGoal
      } else return
    } else {
      this.topInset += (this.topInsetGoal - this.topInset) * (1 - Math.exp(-5 * deltaSeconds))
    }
    const { clientWidth: width, clientHeight: height } = this.renderer.domElement
    if (width > 0 && height > 0) this.applyViewOffset(width, height)
  }

  private applyViewOffset(width: number, height: number): void {
    if (this.topInset > 0) {
      this.camera.setViewOffset(width, height, 0, -Math.round(this.topInset / 2), width, height)
    } else {
      this.camera.clearViewOffset()
    }
    this.camera.updateProjectionMatrix()
  }
}
