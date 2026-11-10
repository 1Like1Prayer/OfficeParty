import {
  CapsuleGeometry,
  CircleGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  Vector3,
  type Material,
  type Texture,
} from 'three'
import { aimLimb, solveTwoBone } from './ik.ts'

export type Mood = 'calm' | 'worried' | 'panic' | 'cheer' | 'falling'

const UPPER_ARM = 0.44
const FOREARM = 0.42
const SHOULDER_X = 0.4
const SHOULDER_Y = 1.1
const THIGH = 0.58
const SHIN = 0.5

/** How hard each mood presses the hands, and where they go instead of the keys. */
const lerp = (from: number, to: number, amount: number): number => from + (to - from) * amount

/**
 * A little person sitting on the board, typing. Their avatar is the face; the
 * arms are solved to reach whatever the hands are aiming at — the keys while
 * they type, up in the air when they panic or cheer. Everything is built from
 * simple shapes, so a dozen of them cost almost nothing.
 *
 * The origin is where they sit, facing -Z.
 */
export class Typist {
  readonly group = new Group()
  private readonly torso = new Group()
  private readonly head = new Group()
  private readonly upperArms: [Group, Group]
  private readonly forearms: [Group, Group]
  private readonly handTargets: [Vector3, Vector3] = [new Vector3(), new Vector3()]
  private readonly handGoals: [Vector3, Vector3] = [new Vector3(), new Vector3()]
  private readonly taps: [number, number] = [0, 0]
  private readonly keysAt: [Vector3, Vector3]
  private readonly disposables: { dispose: () => void }[] = []
  private mood: Mood = 'calm'
  private time = Math.random() * 10
  private nextHand: 0 | 1 = 0
  private lean = 0.22
  private shake = 0

  /** `keysAt` is where each hand rests on the keys, in this figure's own frame. */
  constructor(playerColor: string, face: Texture, keysAt: readonly [Vector3, Vector3]) {
    this.keysAt = [keysAt[0].clone(), keysAt[1].clone()]
    const shirt = this.track(new MeshStandardMaterial({ color: playerColor, roughness: 0.6 }))
    const skin = this.track(new MeshStandardMaterial({ color: 0xf2c6a0, roughness: 0.7 }))
    const trousers = this.track(new MeshStandardMaterial({ color: 0x2e2a45, roughness: 0.85 }))
    const hair = this.track(new MeshStandardMaterial({ color: 0x2a1d17, roughness: 0.9 }))

    this.group.add(this.torso)
    this.torso.position.set(0, 0.28, 0)

    this.addMesh(this.torso, new CapsuleGeometry(0.3, 0.5, 6, 14), shirt, [0, 0.45, 0])

    this.head.position.set(0, 1.18, 0)
    this.torso.add(this.head)
    this.addMesh(this.head, new SphereGeometry(0.27, 24, 18), skin, [0, 0, 0])
    const cap = this.addMesh(
      this.head,
      new SphereGeometry(0.285, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.58),
      hair,
      [0, 0.02, 0.03],
    )
    cap.rotation.x = 0.15
    // Their avatar, as the face, on the side they face: forward is -Z.
    const faceMaterial = this.track(new MeshBasicMaterial({ map: face, transparent: true }))
    const facePlane = new Mesh(this.track(new CircleGeometry(0.235, 32)), faceMaterial)
    facePlane.position.set(0, -0.01, -0.262)
    facePlane.rotation.y = Math.PI
    this.head.add(facePlane)

    this.upperArms = [new Group(), new Group()]
    this.forearms = [new Group(), new Group()]
    for (const [index, side] of ([-1, 1] as const).entries()) {
      void side
      this.torso.add(this.upperArms[index]!, this.forearms[index]!)
      this.addLimb(this.upperArms[index]!, UPPER_ARM, 0.085, shirt)
      this.addLimb(this.forearms[index]!, FOREARM, 0.075, skin)
    }

    // Legs stretched out in front, under the table.
    for (const side of [-1, 1]) {
      const thigh = new Group()
      thigh.position.set(side * 0.16, 0.26, 0)
      thigh.rotation.x = Math.PI / 2 // Hangs along -Y; this swings it forward to -Z.
      this.group.add(thigh)
      this.addLimb(thigh, THIGH, 0.11, trousers)
      const shin = new Group()
      shin.position.set(0, -THIGH, 0)
      shin.rotation.x = -0.45
      thigh.add(shin)
      this.addLimb(shin, SHIN, 0.095, trousers)
    }
    this.group.traverse((object) => { object.castShadow = true })
    this.snapHands()
  }

  setMood(mood: Mood): void {
    this.mood = mood
  }

  /** A key press: the next hand dips toward the keys. */
  tap(): void {
    this.taps[this.nextHand] = 1
    this.nextHand = this.nextHand === 0 ? 1 : 0
  }

  /** A jolt of dismay: the head snaps back, the hands jerk. */
  flinch(): void {
    this.shake = 1
  }

  update(deltaSeconds: number): void {
    this.time += deltaSeconds
    this.shake = Math.max(0, this.shake - deltaSeconds * 3)

    this.updateBody(deltaSeconds)
    this.updateHands(deltaSeconds)
  }

  dispose(): void {
    this.group.traverse((object) => {
      if (object instanceof Mesh) object.geometry.dispose()
    })
    this.disposables.forEach((item) => { item.dispose() })
  }

  /* ---------------- posing ---------------- */

  private updateBody(deltaSeconds: number): void {
    const breathing = Math.sin(this.time * 2.1) * 0.012

    const leanGoal = { calm: 0.24, worried: 0.34, panic: -0.08, cheer: -0.12, falling: -0.3 }[this.mood]
    this.lean = lerp(this.lean, leanGoal, 1 - Math.exp(-6 * deltaSeconds))
    this.torso.rotation.x = -this.lean + breathing
    // A body that is panicking or falling sways; a calm one barely moves.
    const sway = this.mood === 'panic' ? 0.1 : this.mood === 'falling' ? 0.45 : this.mood === 'worried' ? 0.03 : 0.012
    this.torso.rotation.z = Math.sin(this.time * (this.mood === 'falling' ? 9 : 5)) * sway

    const nod = { calm: 0.3, worried: 0.45, panic: -0.25, cheer: -0.3, falling: -0.4 }[this.mood]
    this.head.rotation.x = nod + this.shake * -0.4 + Math.sin(this.time * 2.3) * 0.02
    this.head.rotation.y = Math.sin(this.time * (this.mood === 'panic' ? 14 : 1.1)) * (this.mood === 'panic' ? 0.22 : 0.04)
  }

  private updateHands(deltaSeconds: number): void {
    for (const hand of [0, 1] as const) {
      const side = hand === 0 ? -1 : 1
      this.taps[hand] = Math.max(0, this.taps[hand] - deltaSeconds * 10)
      this.handGoals[hand].copy(this.handGoal(hand, side))
      // Quick to move, so a tap reads as a tap.
      this.handTargets[hand].lerp(this.handGoals[hand], 1 - Math.exp(-(this.mood === 'falling' ? 24 : 18) * deltaSeconds))
    }
    this.poseArms()
  }

  /** Where this hand wants to be right now, in the torso's frame's parent (the figure's frame). */
  private handGoal(hand: 0 | 1, side: -1 | 1): Vector3 {
    const goal = new Vector3()
    switch (this.mood) {
      case 'cheer':
        return goal.set(side * 0.55, 1.95, -0.1 + Math.sin(this.time * 9 + hand * 2) * 0.06)
      case 'panic':
        // Hands up at the chest, trembling.
        return goal.set(
          side * 0.3 + Math.sin(this.time * 31 + hand) * 0.03,
          1.25 + Math.sin(this.time * 27 + hand * 3) * 0.03,
          -0.35,
        )
      case 'falling':
        return goal.set(
          side * (0.7 + Math.sin(this.time * 11 + hand) * 0.3),
          1.7 + Math.sin(this.time * 13 + hand * 2) * 0.4,
          -0.1 + Math.cos(this.time * 9 + hand) * 0.3,
        )
      default: {
        const rest = this.keysAt[hand]
        const dip = this.taps[hand] * (this.mood === 'worried' ? 0.05 : 0.04)
        const tremble = this.mood === 'worried' ? Math.sin(this.time * 24 + hand) * 0.012 : 0
        return goal.set(
          rest.x + Math.sin(this.time * 1.7 + hand * 2) * 0.012 + tremble,
          rest.y - dip + Math.abs(Math.sin(this.time * 3 + hand)) * 0.006,
          rest.z + this.taps[hand] * -0.012 + this.shake * 0.04 * (hand === 0 ? 1 : -1),
        )
      }
    }
  }

  /** Solves each arm in the torso's frame so the hand meets its target. */
  private poseArms(): void {
    this.torso.updateMatrixWorld(true)
    const toTorso = this.torso.matrixWorld.clone().invert()

    for (const hand of [0, 1] as const) {
      const side = hand === 0 ? -1 : 1
      const shoulder = new Vector3(side * SHOULDER_X, SHOULDER_Y - 0.28, 0)
      const target = this.handTargets[hand].clone()
      // The target is in the figure's frame; bring it into the torso's.
      this.group.localToWorld(target)
      target.applyMatrix4(toTorso)

      // Elbows bend out and down.
      const elbow = solveTwoBone(shoulder, target, UPPER_ARM, FOREARM, new Vector3(side * 0.7, -1, 0.15))
      aimLimb(this.upperArms[hand]!, shoulder, elbow)
      aimLimb(this.forearms[hand]!, elbow, target)
    }
  }

  private snapHands(): void {
    for (const hand of [0, 1] as const) {
      this.handTargets[hand].copy(this.keysAt[hand])
    }
  }

  private addLimb(parent: Group, length: number, radius: number, material: Material): void {
    this.addMesh(parent, new CapsuleGeometry(radius, Math.max(0.01, length - radius * 2), 4, 10), material, [0, -length / 2, 0])
  }

  private addMesh(parent: Group, geometry: CapsuleGeometry | SphereGeometry, material: Material, [x, y, z]: [number, number, number]): Mesh {
    const mesh = new Mesh(geometry, material)
    mesh.position.set(x, y, z)
    parent.add(mesh)
    this.disposables.push(geometry)
    return mesh
  }

  private track<T extends { dispose: () => void }>(item: T): T {
    this.disposables.push(item)
    return item
  }
}
