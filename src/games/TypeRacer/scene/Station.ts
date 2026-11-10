import {
  BoxGeometry,
  CanvasTexture,
  Group,
  Mesh,
  MeshStandardMaterial,
  Vector3,
  type Texture,
} from 'three'
import type { RoundPlayerView } from '../../../types/index.ts'
import { createAvatarTexture } from '../../three/avatarTexture.ts'
import { Nameplate, type NameplateContent } from '../../three/Nameplate.ts'
import { LightBeam } from '../../three/LightBeam.ts'
import { Crown } from './Crown.ts'
import { Die } from './Die.ts'
import { Typist, type Mood } from './Typist.ts'
import { Typewriter } from './Typewriter.ts'
import { STATION, WATER_LEVEL, type StationPose } from './stageConfig.ts'
import { WoodBlock } from './WoodBlock.ts'
import type { Burst } from './ParticleSystem.ts'

/** What a station needs the scene to do for it: effects, ripples and camera kicks. */
export interface StationEffects {
  splashParticles: (burst: Burst) => void
  ripple: (x: number, z: number, strength: number) => void
  /** A jolt for the camera; larger is bigger. `isYours` is the player's own station. */
  trauma: (amount: number, isYours: boolean) => void
}

export interface StationTextures {
  wood: Texture
  planks: Texture
  heartFace: Texture
  skullFace: Texture
}

const GRAVITY = 15
const FALL_DELAY_SECONDS = 0.55

type Fall = 'standing' | 'waiting' | 'falling' | 'sunk'

/** The skull sides on a roll's die and the face it landed on, as the server reports them. */
export interface RollView {
  face: number
  skulls: number
  isSkull: boolean
}

/**
 * One player's place in the ring: a board held up by a single wooden block,
 * a low table with a typewriter, and the player sitting at it. It reacts to
 * everything that happens in the race — keys, mistakes, finished lines, the
 * dice — and, when the player is out, the block crumbles and the board, table
 * and typist drop into the water.
 *
 * Its origin is the board's top surface; forward (toward the middle of the
 * ring) is -Z.
 */
export class Station {
  readonly root = new Group()
  readonly player: RoundPlayerView
  readonly nameplate = new Nameplate()
  private readonly platform = new Group()
  private readonly block: WoodBlock
  private readonly typewriter = new Typewriter()
  private readonly typist: Typist
  private readonly die: Die
  private readonly crown = new Crown()
  private readonly winBeam = new LightBeam(0xffe08a)
  /** Seconds since this player won, or 0 if they have not. */
  private winClock = 0
  private readonly faceTexture: CanvasTexture
  private readonly effects: StationEffects
  private readonly isYours: boolean
  private readonly disposables: { dispose: () => void }[] = []

  private fall: Fall = 'standing'
  private fallClock = 0
  private fallVelocity = 0
  private hasSplashedPlatform = false
  private tilt = new Vector3()
  private stress = 0
  private stressGoal = 0
  private hopClock = 0
  private mood: Mood = 'calm'
  private time = Math.random() * 20
  private foamRadius: number = STATION.BLOCK_RADIUS

  constructor(
    player: RoundPlayerView,
    pose: StationPose,
    textures: StationTextures,
    effects: StationEffects,
    isYours: boolean,
  ) {
    this.player = player
    this.effects = effects
    this.isYours = isYours
    this.root.position.set(pose.x, STATION.BOARD_TOP_HEIGHT + WATER_LEVEL, pose.z)
    this.root.rotation.y = pose.yaw

    this.block = new WoodBlock(textures.wood)
    this.block.group.position.y = -STATION.BOARD_THICKNESS
    this.root.add(this.block.group, this.platform)

    this.buildBoardAndTable(textures)

    this.typewriter.group.position.set(0, STATION.TABLE_HEIGHT, STATION.TABLE_Z)
    this.platform.add(this.typewriter.group)

    this.faceTexture = createAvatarTexture({ initial: player.initial, color: player.color, seed: player.avatar })
    // Each hand's resting place on the keys, in the typist's frame.
    const keys = (side: -1 | 1) =>
      this.typewriter.handRestPoint(side).add(new Vector3(0, STATION.TABLE_HEIGHT, STATION.TABLE_Z - STATION.TYPIST_Z))
    this.typist = new Typist(player.color, this.faceTexture, [keys(-1), keys(1)])
    this.typist.group.position.set(0, 0, STATION.TYPIST_Z)
    this.platform.add(this.typist.group)

    this.die = new Die(textures.heartFace, textures.skullFace)
    this.platform.add(this.die.mesh)

    // The winner's crown floats above their head; a golden light falls on the whole board.
    this.crown.group.position.set(0, 2.2, STATION.TYPIST_Z)
    this.platform.add(this.crown.group)
    this.winBeam.group.scale.set(2.5, 1, 2.5)
    this.root.add(this.winBeam.group)
  }

  /** Where the camera should look to see this player's typewriter and hands. */
  worldPoint(local: Vector3, target = new Vector3()): Vector3 {
    this.root.updateMatrixWorld(true)
    return this.root.localToWorld(target.copy(local))
  }

  /** Above the typist's head, where their name tag floats. */
  get nameTagLocal(): Vector3 {
    return new Vector3(0, 2.65, STATION.TYPIST_Z)
  }

  get hasFallen(): boolean {
    return this.fall !== 'standing'
  }

  /** The ring of foam round this block; 0 once the block has gone. */
  get foam(): number {
    return this.foamRadius
  }

  setLabel(content: NameplateContent): void {
    this.nameplate.update(content)
  }

  /* ---------------- things that happen ---------------- */

  /** A correct key. */
  keyPress(): void {
    if (this.hasFallen) return
    this.typewriter.press()
    this.typist.tap()
  }

  /** A finished line: the carriage returns and rings. */
  lineDone(): void {
    if (this.hasFallen) return
    this.typewriter.lineDone()
  }

  /** A fresh paragraph on a fresh sheet. */
  newParagraph(): void {
    this.typewriter.newSheet()
  }

  /** A wrong key. */
  mistake(): void {
    if (this.hasFallen) return
    this.typewriter.jam()
    this.typist.flinch()
  }

  /** How worried the board's occupant is: 0 calm, up to 1 for the dice about to be cast. */
  setStress(level: number): void {
    this.stressGoal = level
    if (this.hasFallen) return
    this.setMood(level >= 1 ? 'panic' : level > 0.3 ? 'worried' : 'calm')
  }

  /**
   * Throw the die: `roll` is what the server said. `onOutcome` fires as it
   * lands, with the result already shown by the scene's effects.
   */
  rollDie(roll: RollView, onOutcome?: () => void): void {
    if (this.hasFallen) return
    this.setStress(1)
    const from = new Vector3(0.75, STATION.TABLE_HEIGHT + 0.9, STATION.TABLE_Z + 0.5)
    const landing = new Vector3(STATION.DIE_LANDING.x, Die.HALF_SIZE, STATION.DIE_LANDING.z)

    this.die.roll(roll.face, roll.skulls, from, landing, () => {
      this.showRollOutcome(roll)
      onOutcome?.()
    })
  }

  /**
   * What a roll's result does to the board. A safe roll lets the strain ease;
   * a skull gives the camera the smallest nudge. Nothing more: the die itself
   * and the words on the front layer say the rest.
   */
  showRollOutcome(roll: RollView): void {
    if (this.hasFallen) return
    if (roll.isSkull) this.effects.trauma(0.15, this.isYours)
    else this.setStress(0.35)
  }

  /** The block gives way. */
  crumble(): void {
    if (this.fall !== 'standing') return
    this.fall = 'waiting'
    this.fallClock = 0
    this.setMood('panic')

    const water = WATER_LEVEL - this.root.position.y + STATION.BOARD_THICKNESS
    this.block.crumble(water, (local) => {
      const world = this.block.group.localToWorld(local.clone())
      this.splashDroplets(world, 10, 4.2, 0.4)
      this.effects.ripple(world.x, world.z, 0.5)
    })
    this.effects.trauma(0.4, this.isYours)
    // Splinters fly off the top as it goes.
    const top = this.localToWorld(new Vector3(0, -STATION.BOARD_THICKNESS, 0))
    this.splash({ position: top, count: 26, color: [0x9a6a3a, 0x6b4423, 0xc79a62], speed: 3.2, up: 3.5, gravity: 10, life: 1.4, size: 0.28 })
  }

  /** Every paragraph typed: arms up. */
  celebrate(): void {
    if (this.hasFallen) return
    this.hopClock = 0.0001
    this.setMood('cheer')
    this.setStress(0)
  }

  /**
   * The race is won. Arms up and hopping, a crown appears over the winner's
   * head and a golden light falls on their board.
   */
  win(): void {
    if (this.hasFallen || this.winClock > 0) return
    this.celebrate()
    this.winClock = 0.0001
  }

  /* ---------------- per frame ---------------- */

  update(deltaSeconds: number): void {
    this.time += deltaSeconds
    this.block.update(deltaSeconds)
    this.typewriter.update(deltaSeconds)
    this.typist.update(deltaSeconds)
    this.die.update(deltaSeconds)

    this.stress += (this.stressGoal - this.stress) * (1 - Math.exp(-5 * deltaSeconds))
    this.updatePlatform(deltaSeconds)
    this.updateWin(deltaSeconds)
  }

  dispose(): void {
    this.block.dispose()
    this.typewriter.dispose()
    this.typist.dispose()
    this.die.dispose()
    this.crown.dispose()
    this.winBeam.dispose()
    this.faceTexture.dispose()
    this.nameplate.dispose()
    this.root.traverse((object) => {
      if (object instanceof Mesh && this.platform.children.includes(object)) object.geometry.dispose()
    })
    this.disposables.forEach((item) => { item.dispose() })
  }

  /* ---------------- internals ---------------- */

  private updatePlatform(deltaSeconds: number): void {
    const platform = this.platform

    if (this.fall === 'standing') {
      // Bobs on the swell; shakes under strain; hops when it cheers.
      const bob = Math.sin(this.time * 1.4) * 0.03
      const strain = this.stress * this.stress
      // Under strain the board trembles: smooth and small, never a buzz.
      platform.position.set(
        Math.sin(this.time * 23) * 0.012 * strain,
        bob + this.hopOffset(deltaSeconds),
        Math.sin(this.time * 19 + 1) * 0.012 * strain,
      )
      platform.rotation.set(
        Math.sin(this.time * 1.1) * 0.012 + Math.sin(this.time * 17) * 0.006 * strain,
        0,
        Math.sin(this.time * 0.9) * 0.012 + Math.sin(this.time * 21 + 2) * 0.006 * strain,
      )
      return
    }

    this.fallClock += deltaSeconds

    if (this.fall === 'waiting') {
      // The block is breaking; the board shudders before it drops.
      platform.position.x = Math.sin(this.fallClock * 38) * 0.035
      platform.position.z = Math.sin(this.fallClock * 31 + 1) * 0.035
      if (this.fallClock >= FALL_DELAY_SECONDS) {
        this.fall = 'falling'
        this.fallVelocity = 0.5
        this.tilt.set((Math.random() - 0.5) * 1.6, 0, (Math.random() - 0.5) * 1.6)
        this.typist.setMood('falling')
        this.foamRadius = 0
      }
      return
    }

    if (this.fall === 'falling') {
      this.fallVelocity -= GRAVITY * deltaSeconds
      platform.position.y += this.fallVelocity * deltaSeconds
      platform.rotation.x += this.tilt.x * deltaSeconds
      platform.rotation.z += this.tilt.z * deltaSeconds

      const waterY = WATER_LEVEL - this.root.position.y
      if (!this.hasSplashedPlatform && platform.position.y < waterY + 0.1) {
        this.hasSplashedPlatform = true
        const at = this.localToWorld(new Vector3(0, 0, 0)).setY(WATER_LEVEL)
        this.splashDroplets(at, 60, 7, 0.55)
        this.splash({ position: at, count: 30, color: 0xe8f6ff, speed: 1.4, up: 3, gravity: -2.5, buoyancy: 3.5, life: 2.2, size: 0.32 })
        this.effects.ripple(at.x, at.z, 1.6)
        this.effects.trauma(0.25, this.isYours)
      }
      if (this.hasSplashedPlatform) {
        // In the water: the weight slows and the whole thing slowly sinks.
        this.fallVelocity = Math.max(this.fallVelocity * Math.exp(-3 * deltaSeconds), -1.5)
        this.tilt.multiplyScalar(Math.exp(-1.5 * deltaSeconds))
        if (Math.random() < deltaSeconds * 18) this.bubble()
      }
      if (platform.position.y < waterY - 7) {
        this.fall = 'sunk'
        platform.visible = false
        this.nameplate.sprite.visible = false
      }
    }
  }

  private updateWin(deltaSeconds: number): void {
    if (this.winClock === 0) return
    this.winClock += deltaSeconds
    const arrival = Math.min(1, this.winClock / 0.7)
    // The crown eases in with a little overshoot; the light fades up beside it.
    const eased = 1 - Math.pow(1 - arrival, 3)
    this.crown.update(deltaSeconds, eased)
    this.winBeam.update(deltaSeconds)
    this.winBeam.setStrength(eased * 0.85)
  }

  private hopOffset(deltaSeconds: number): number {
    // A winner keeps hopping for as long as the celebration lasts.
    if (this.winClock > 0) {
      this.hopClock += deltaSeconds
      return Math.abs(Math.sin(this.hopClock * 4.6)) * 0.16
    }
    if (this.hopClock === 0) return 0
    this.hopClock += deltaSeconds
    if (this.hopClock > 1.6) return 0
    // A few little hops of joy, shrinking.
    return Math.abs(Math.sin(this.hopClock * 9)) * 0.22 * (1 - this.hopClock / 1.6)
  }

  private setMood(mood: Mood): void {
    if (mood === this.mood) return
    this.mood = mood
    this.typist.setMood(mood)
  }

  private bubble(): void {
    const at = this.localToWorld(
      new Vector3((Math.random() - 0.5) * 1.5, this.platform.position.y, (Math.random() - 0.5) * 1.5),
    ).setY(WATER_LEVEL - 0.3)
    this.splash({ position: at, count: 1, color: 0xcfeeff, speed: 0.3, up: 0.6, gravity: -2, buoyancy: 4, life: 1.2, size: 0.22 })
  }

  private splashDroplets(at: Vector3, count: number, speed: number, size: number): void {
    this.splash({ position: at, count, color: [0xe8f6ff, 0xb9e3f5, 0xffffff], speed, up: speed * 0.9, gravity: 12, life: 1.1, size })
  }

  private splash(burst: Burst): void {
    this.effects.splashParticles(burst)
  }

  private localToWorld(local: Vector3): Vector3 {
    this.root.updateMatrixWorld(true)
    return this.root.localToWorld(local)
  }

  private buildBoardAndTable(textures: StationTextures): void {
    const plankTop = this.track(new MeshStandardMaterial({ map: textures.planks, roughness: 0.85 }))
    const plankSide = this.track(new MeshStandardMaterial({ color: 0x5a3a1c, roughness: 0.9 }))
    const board = new Mesh(
      this.track(new BoxGeometry(STATION.BOARD_WIDTH, STATION.BOARD_THICKNESS, STATION.BOARD_DEPTH)),
      [plankSide, plankSide, plankTop, plankSide, plankSide, plankSide],
    )
    board.position.y = -STATION.BOARD_THICKNESS / 2
    board.receiveShadow = true
    board.castShadow = true
    this.platform.add(board)

    // Two cross-beams under the board, where it meets the block.
    const beam = this.track(new BoxGeometry(STATION.BOARD_WIDTH * 0.92, 0.16, 0.34))
    for (const z of [-1.15, 1.15]) {
      const mesh = new Mesh(beam, plankSide)
      mesh.position.set(0, -STATION.BOARD_THICKNESS - 0.08, z)
      mesh.castShadow = true
      this.platform.add(mesh)
    }

    // The low table.
    const wood = this.track(new MeshStandardMaterial({ map: textures.wood, roughness: 0.8 }))
    const top = new Mesh(
      this.track(new BoxGeometry(STATION.TABLE_WIDTH, 0.06, STATION.TABLE_DEPTH)),
      wood,
    )
    top.position.set(0, STATION.TABLE_HEIGHT - 0.03, STATION.TABLE_Z)
    top.castShadow = true
    top.receiveShadow = true
    this.platform.add(top)

    const leg = this.track(new BoxGeometry(0.08, STATION.TABLE_HEIGHT - 0.06, 0.08))
    for (const x of [-1, 1]) {
      for (const z of [-1, 1]) {
        const mesh = new Mesh(leg, wood)
        mesh.position.set(
          x * (STATION.TABLE_WIDTH / 2 - 0.1),
          (STATION.TABLE_HEIGHT - 0.06) / 2,
          STATION.TABLE_Z + z * (STATION.TABLE_DEPTH / 2 - 0.1),
        )
        mesh.castShadow = true
        this.platform.add(mesh)
      }
    }
  }

  private track<T extends { dispose: () => void }>(item: T): T {
    this.disposables.push(item)
    return item
  }
}
