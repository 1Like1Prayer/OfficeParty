import {
  AmbientLight,
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  Clock,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Scene,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three'
import { CUES, ROUND_CUE_MS } from '../../components/GamePlay/cue.ts'
import type { RoundPlayerView } from '../../types/index.ts'
import { createAvatarTexture } from './avatarTexture.ts'
import { labelWidthFor } from './Nameplate.ts'
import { Typist } from './Typist.ts'
import { sfx } from '../../audio/sfx/index.ts'

/**
 * A game's opening, shared by the self-timed games: everyone sits on a
 * cushion round a tower of giant TV screens, one screen facing each player.
 * The camera floats round the circle, then glides down behind the player's own
 * head onto their screen, which counts them in — GET READY, SET, START! — and
 * the picture gives way to the game itself just as the clock starts.
 *
 * What the screens show before the count-in is the game's own (a `TvShow`).
 * Everything is timed from the round's start (`timingStartsAtLocalMs`), so a
 * screen that opens late joins the intro wherever it has got to.
 */

/** What a screen is told each time it might be redrawn. */
export interface TvScreenFrame {
  /** Seconds since the scene was built, for looping animation. */
  elapsed: number
  /** Ms relative to when the clock starts (negative = before). */
  sinceStartMs: number
  /** Whose screen it is. */
  ownerId: string
  ownerName: string
  isYou: boolean
}

/** A game's picture on the TVs. */
export interface TvShow {
  /**
   * The game is played on the TV itself: instead of diving in and fading
   * away as the clock starts, the camera settles square on the player's
   * screen and stays, and the card goes on being drawn for the whole round.
   */
  staysForGame?: boolean
  /** Draws the screen outside the count-in (before it, and through the game if it stays), over the whole canvas. */
  drawCard: (context: CanvasRenderingContext2D, width: number, height: number, frame: TvScreenFrame) => void
  /** Changes whenever the card needs drawing again; the canvas is only redrawn then. */
  cardKey: (frame: TvScreenFrame) => string
  /** A line under each word of the count-in, e.g. what to aim for. */
  cueCaption?: string
  /**
   * How long the count-in on the screens runs, GET READY to START! (the
   * platform's is ROUND_CUE_MS). The glide in lands just before it starts.
   */
  cueMs?: number
}

/** The line under a title card saying whose screen it is. */
export const screenOwnerLine = ({ isYou, ownerName }: TvScreenFrame): string =>
  isYou ? 'This screen is yours' : `${ownerName}'s screen`

/** The intro's timings, in ms. */
export const TV_TIMELINE = {
  /** The glide from the circle to the player's screen, before the count-in starts: it lands just before. */
  ZOOM_LEAD_MS: 2_600,
  ZOOM_LANDS_MS: 100,
  /** The last push toward the screen, as if diving into it. */
  PUSH_START_MS: -650,
  /** The overlay fades out over this, finishing exactly as the clock starts, so the first puzzle is never covered. */
  FADE_MS: 450,
} as const
export const TV_INTRO_FADE_MS = TV_TIMELINE.FADE_MS

const SCREEN = { WIDTH: 2.4, HEIGHT: 1.5, CENTER_Y: 2.25 } as const
const CABINET = { BORDER: 0.18, DEPTH: 0.4 } as const
const TOWER_HEIGHT = 3.6
/** How far from the screens the cushions sit. */
const VIEWING_DISTANCE = 2.7
const CUSHION_HEIGHT = 0.38
/** The camera's usual field of view, in degrees (vertical). */
const BASE_FOV = 45
/**
 * The furthest the camera may be from a screen it is framing: just in front
 * of the player's own head, so their figure never stands between them and it.
 */
const MAX_SCREEN_DISTANCE = CABINET.DEPTH / 2 + VIEWING_DISTANCE - 0.55
/** The orbit shows the circle as wide as a screen of this shape would... */
const ORBIT_FIT_ASPECT = 1.35
/** ...widening its view up to this (degrees, vertical) on a narrower one before it backs off. */
const ORBIT_MAX_FOV = 75
/** The room fades into fog between these distances, pushed back as far as the orbit is. */
const FOG = { NEAR: 18, FAR: 60 } as const
/** Screen pixels kept clear at the bottom for the controls over the picture (the STOP button and its hint). */
const CONTROLS_PX = 130
/** How fast the camera circles while showing everyone, in radians a second. */
const ORBIT_SPEED = 0.3
/** The screen picture's size as games draw it... */
const CANVAS = { WIDTH: 512, HEIGHT: 320 } as const
/** ...and how many canvas pixels each of those is, so lines and text stay crisp on a big screen. */
const CANVAS_SCALE = 2
const TAG = { WIDTH: 300, HEIGHT: 84, PIXELS: 120 } as const

const BACKGROUND = '#241A3D'
const CUE_COLORS: Record<(typeof CUES)[number], string> = {
  'GET READY': '#FFC400',
  SET: '#FF9E4F',
  'START!': '#3FD6A0',
}

const smoothstep = (x: number): number => {
  const t = Math.min(1, Math.max(0, x))
  return t * t * (3 - 2 * t)
}

interface Seat {
  player: RoundPlayerView
  /** Where round the circle, in radians; the player's own is π/2, nearest the camera's final pose. */
  angle: number
  figure: Typist
  screen: CanvasTexture
  screenCanvas: HTMLCanvasElement
  drawnKey: string
  tag: Sprite
  isYou: boolean
}

export class TvCircleScene {
  private readonly renderer: WebGLRenderer
  private readonly scene = new Scene()
  private readonly camera = new PerspectiveCamera(BASE_FOV, 1, 0.1, 200)
  private readonly clock = new Clock()
  private readonly resizeObserver: ResizeObserver
  private readonly disposables: { dispose: () => void }[] = []
  private readonly seats: Seat[] = []
  private readonly towerRadius: number
  private readonly seatRadius: number
  private readonly host: HTMLElement
  private timingStartsAtLocalMs: number
  private show: TvShow
  /**
   * Set once the scene has moved on to a later attempt of the same round (a
   * game's next stage): the camera stays on the player's screen, with no
   * second trip round the circle.
   */
  private isContinuing = false
  /** The last word of the count-in sounded, so each is heard once. */
  private soundedCue: (typeof CUES)[number] | null = null
  private hasSoundedGlide = false
  private tagWidth = 1
  private elapsed = 0

  constructor(
    host: HTMLElement,
    players: readonly RoundPlayerView[],
    selfPlayerId: string,
    timingStartsAtLocalMs: number,
    show: TvShow,
  ) {
    this.host = host
    this.timingStartsAtLocalMs = timingStartsAtLocalMs
    this.show = show
    this.renderer = new WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    Object.assign(this.renderer.domElement.style, { position: 'absolute', inset: '0' })
    host.appendChild(this.renderer.domElement)

    this.scene.background = new Color(BACKGROUND)
    this.scene.fog = new Fog(BACKGROUND, FOG.NEAR, FOG.FAR)

    // Two players face each other across a four-sided tower; otherwise one side each.
    const sides = players.length === 2 ? 4 : Math.max(3, players.length)
    const faceStep = sides / Math.max(1, players.length)
    // Wide enough for every screen side by side.
    this.towerRadius = Math.max(1.3, (SCREEN.WIDTH / 2 + CABINET.BORDER + 0.1) / Math.tan(Math.PI / sides))
    this.seatRadius = this.towerRadius + CABINET.DEPTH + VIEWING_DISTANCE

    this.addRoom()
    this.addTower(sides)
    const selfIndex = Math.max(0, players.findIndex(({ playerId }) => playerId === selfPlayerId))
    players.forEach((player, index) => {
      const angle = Math.PI / 2 + ((index - selfIndex) * faceStep * 2 * Math.PI) / sides
      this.addSeat(player, angle, player.playerId === selfPlayerId)
    })

    this.resizeObserver = new ResizeObserver(() => { this.resize() })
    this.resizeObserver.observe(host)
    this.resize()
    this.renderer.setAnimationLoop(() => { this.frame() })
  }

  /** The next attempt's start: the scene carries on to it from where it is. */
  setTiming(timingStartsAtLocalMs: number): void {
    if (timingStartsAtLocalMs === this.timingStartsAtLocalMs) return
    this.timingStartsAtLocalMs = timingStartsAtLocalMs
    this.isContinuing = true
    this.redrawScreens()
  }

  /** A new picture for the screens, such as the next stage's. */
  setShow(show: TvShow): void {
    if (show === this.show) return
    this.show = show
    this.redrawScreens()
  }

  private redrawScreens(): void {
    for (const seat of this.seats) seat.drawnKey = ''
  }

  dispose(): void {
    this.renderer.setAnimationLoop(null)
    this.resizeObserver.disconnect()
    for (const seat of this.seats) seat.figure.dispose()
    this.scene.traverse((object) => {
      if (object instanceof Mesh) object.geometry.dispose()
    })
    this.disposables.forEach((item) => { item.dispose() })
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  /* ---------------- building ---------------- */

  private addRoom(): void {
    this.scene.add(
      new HemisphereLight(0xffd9b8, 0x2a1f45, 0.9),
      new AmbientLight(0x8a78b0, 0.35),
    )
    const key = new DirectionalLight(0xffe2c4, 1.1)
    key.position.set(-6, 12, 8)
    this.scene.add(key)
    // The screens' glow on everyone's faces.
    const glow = new PointLight(0x9fd8ff, 26, this.seatRadius * 2.2, 1.6)
    glow.position.set(0, SCREEN.CENTER_Y, 0)
    this.scene.add(glow)

    const floor = new Mesh(new CircleGeometry(60, 48), this.track(new MeshStandardMaterial({ color: 0x31254f, roughness: 1 })))
    floor.rotation.x = -Math.PI / 2
    const rug = new Mesh(
      new CircleGeometry(this.seatRadius + 1.8, 64),
      this.track(new MeshStandardMaterial({ color: 0xe2579f, roughness: 0.95 })),
    )
    rug.rotation.x = -Math.PI / 2
    rug.position.y = 0.01
    const rugInner = new Mesh(
      new CircleGeometry(this.seatRadius + 1.3, 64),
      this.track(new MeshStandardMaterial({ color: 0xffc94a, roughness: 0.95 })),
    )
    rugInner.rotation.x = -Math.PI / 2
    rugInner.position.y = 0.02
    this.scene.add(floor, rug, rugInner)
  }

  private addTower(sides: number): void {
    const cabinet = this.track(new MeshStandardMaterial({ color: 0x2e2a45, roughness: 0.55, metalness: 0.2 }))
    const trim = this.track(new MeshStandardMaterial({ color: 0xff7a3d, roughness: 0.5 }))
    const tower = new Group()

    // The core the cabinets are fixed to, with a cap and a little antenna on top.
    const core = new Mesh(new CylinderGeometry(this.towerRadius * 0.92, this.towerRadius, TOWER_HEIGHT, sides * 2), cabinet)
    core.position.y = TOWER_HEIGHT / 2
    const cap = new Mesh(new CylinderGeometry(this.towerRadius * 1.08, this.towerRadius * 1.08, 0.22, sides * 2), trim)
    cap.position.y = TOWER_HEIGHT + 0.11
    const antenna = new Mesh(new CylinderGeometry(0.05, 0.05, 1.2, 8), cabinet)
    antenna.position.y = TOWER_HEIGHT + 0.8
    const bulb = new Mesh(new SphereGeometry(0.16, 16, 12), this.track(new MeshBasicMaterial({ color: 0xff5470 })))
    bulb.position.y = TOWER_HEIGHT + 1.45
    tower.add(core, cap, antenna, bulb)

    for (let side = 0; side < sides; side++) {
      const angle = Math.PI / 2 + (side * 2 * Math.PI) / sides
      const box = new Mesh(
        new BoxGeometry(SCREEN.WIDTH + CABINET.BORDER * 2, SCREEN.HEIGHT + CABINET.BORDER * 2, CABINET.DEPTH),
        cabinet,
      )
      box.position.set(Math.cos(angle) * this.towerRadius, SCREEN.CENTER_Y, Math.sin(angle) * this.towerRadius)
      // Its front (+Z) faces out from the middle.
      box.rotation.y = Math.PI / 2 - angle
      tower.add(box)
    }
    this.scene.add(tower)
  }

  private addSeat(player: RoundPlayerView, angle: number, isYou: boolean): void {
    const outward = new Vector3(Math.cos(angle), 0, Math.sin(angle))
    const facing = Math.PI / 2 - angle

    // The screen in front of them, on the face of the tower that points their way.
    const screenCanvas = document.createElement('canvas')
    screenCanvas.width = CANVAS.WIDTH * CANVAS_SCALE
    screenCanvas.height = CANVAS.HEIGHT * CANVAS_SCALE
    const screen = this.track(new CanvasTexture(screenCanvas))
    screen.colorSpace = SRGBColorSpace
    // Seen at an angle on the way in: keeps the picture sharp rather than smeared.
    screen.anisotropy = this.renderer.capabilities.getMaxAnisotropy()
    const panel = new Mesh(new PlaneGeometry(SCREEN.WIDTH, SCREEN.HEIGHT), this.track(new MeshBasicMaterial({ map: screen })))
    panel.position.copy(outward).multiplyScalar(this.towerRadius + CABINET.DEPTH / 2 + 0.005).setY(SCREEN.CENTER_Y)
    panel.rotation.y = facing
    this.scene.add(panel)

    // A cushion in their colour, and them on it, facing the screen.
    const seat = new Group()
    seat.position.copy(outward).multiplyScalar(this.seatRadius)
    seat.rotation.y = facing
    const cushion = new Mesh(
      new SphereGeometry(0.62, 24, 14),
      this.track(new MeshStandardMaterial({ color: new Color(player.color).lerp(new Color(0xffffff), 0.25), roughness: 0.9 })),
    )
    cushion.scale.set(1, 0.42, 1)
    cushion.position.y = CUSHION_HEIGHT * 0.55
    // Hands in the lap, on the thighs stretched out in front.
    const lap = (side: -1 | 1) => new Vector3(side * 0.2, 0.42, -0.42)
    const face = this.track(createAvatarTexture({ initial: player.initial, color: player.color, seed: player.avatar }))
    const figure = new Typist(player.color, face, [lap(-1), lap(1)])
    figure.group.position.y = CUSHION_HEIGHT
    seat.add(cushion, figure.group)
    this.scene.add(seat)

    const tag = this.createTag(isYou ? 'You' : player.name, isYou)
    tag.position.copy(outward).multiplyScalar(this.seatRadius).setY(CUSHION_HEIGHT + 2.05)
    this.scene.add(tag)

    this.seats.push({ player, angle, figure, screen, screenCanvas, drawnKey: '', tag, isYou })
  }

  private createTag(text: string, isYou: boolean): Sprite {
    const canvas = document.createElement('canvas')
    canvas.width = TAG.WIDTH
    canvas.height = TAG.HEIGHT
    const context = canvas.getContext('2d')!
    context.fillStyle = isYou ? '#FFC400' : '#FFFAF0'
    context.strokeStyle = '#2E2A45'
    context.lineWidth = 7
    context.beginPath()
    context.roundRect(5, 5, TAG.WIDTH - 10, TAG.HEIGHT - 10, 30)
    context.fill()
    context.stroke()
    context.fillStyle = '#2E2A45'
    context.font = '800 40px sans-serif'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    let fitted = text
    while (fitted.length > 1 && context.measureText(fitted).width > TAG.WIDTH - 40) fitted = fitted.slice(0, -1)
    context.fillText(fitted === text ? text : `${fitted}…`, TAG.WIDTH / 2, TAG.HEIGHT / 2 + 2)
    const texture = this.track(new CanvasTexture(canvas))
    texture.colorSpace = SRGBColorSpace
    const sprite = new Sprite(this.track(new SpriteMaterial({ map: texture, sizeAttenuation: false, depthTest: false, transparent: true })))
    sprite.renderOrder = 10
    return sprite
  }

  /* ---------------- each frame ---------------- */

  private frame(): void {
    const delta = Math.min(this.clock.getDelta(), 0.05)
    this.elapsed += delta
    const sinceStartMs = performance.now() - this.timingStartsAtLocalMs
    const zoom = this.isContinuing
      ? 1
      : smoothstep((sinceStartMs - this.zoomStartMs()) / (TV_TIMELINE.ZOOM_LEAD_MS - TV_TIMELINE.ZOOM_LANDS_MS))
    const cue = this.cueAt(sinceStartMs)
    this.playSounds(sinceStartMs, cue)

    for (const seat of this.seats) {
      // Everyone else throws their arms up as the count lands on START! The
      // player's own stay down: the camera is behind them, and they would cover the screen.
      seat.figure.setMood(cue === 'START!' && !seat.isYou ? 'cheer' : 'calm')
      seat.figure.update(delta)
      this.drawScreen(seat, cue, sinceStartMs)
      seat.tag.scale.set(this.tagWidth, (this.tagWidth * TAG.HEIGHT) / TAG.WIDTH, 1)
      // Name tags are drawn over everything, so in the close-up they would sit on the screen: they go as the camera comes in.
      seat.tag.material.opacity = 1 - smoothstep(zoom * (seat.isYou ? 2 : 1.4))
    }

    this.placeCamera(sinceStartMs, zoom)
    this.renderer.render(this.scene, this.camera)
  }

  /** The glide in gets a swoosh, and each word of the count-in its beep, once each. */
  private playSounds(sinceStartMs: number, cue: (typeof CUES)[number] | null): void {
    if (!this.isContinuing && !this.hasSoundedGlide && sinceStartMs >= this.zoomStartMs() && sinceStartMs < 0) {
      this.hasSoundedGlide = true
      sfx.flow.swoosh()
    }
    if (cue === this.soundedCue) return
    this.soundedCue = cue
    if (cue === 'START!') sfx.flow.go()
    else if (cue !== null) sfx.flow.cueBeep(CUES.indexOf(cue) + 1)
  }

  /** Which word of the count-in is up, or null outside it. */
  private cueAt(sinceStartMs: number): (typeof CUES)[number] | null {
    const msLeft = -sinceStartMs
    const cueMs = this.cueMs()
    if (msLeft > cueMs || msLeft <= 0) return null
    const beat = Math.min(CUES.length, Math.max(1, Math.ceil(msLeft / (cueMs / CUES.length))))
    return CUES[beat - 1]!
  }

  private cueMs(): number {
    return this.show.cueMs ?? ROUND_CUE_MS
  }

  /** When the glide in starts, relative to the clock starting. */
  private zoomStartMs(): number {
    return -this.cueMs() - TV_TIMELINE.ZOOM_LEAD_MS
  }

  private placeCamera(sinceStartMs: number, zoom: number): void {
    const aspect = this.camera.aspect
    // Far enough to see the whole circle. On a tall, narrow screen the view
    // widens first, so the camera need not back off into the fog.
    const spread = this.orbitSpread()
    const reach = (this.seatRadius + 1.6) * spread.distanceScale
    const orbitDistance = reach * 1.55 + 2
    const orbitHeight = reach * 1.05 + 2.5
    const fog = this.scene.fog as Fog
    fog.near = FOG.NEAR * spread.distanceScale
    fog.far = FOG.FAR * spread.distanceScale
    // The orbit arrives behind the player just as the glide starts, and holds there while it runs.
    const orbitAngle = Math.PI / 2 + ORBIT_SPEED * Math.min(0, sinceStartMs - this.zoomStartMs()) / 1000
    const bob = Math.sin(this.elapsed * 0.7) * 0.15 * (1 - zoom)
    const orbit = new Vector3(Math.cos(orbitAngle) * orbitDistance, orbitHeight + bob, Math.sin(orbitAngle) * orbitDistance)
    const orbitTarget = new Vector3(0, 1.2, 0)

    // Above and behind the player's head, looking down past it at their screen: the head sits low in the frame.
    const behind = this.seatRadius + 2.7 * Math.max(1, 1.1 / aspect)
    const focus = new Vector3(0.3, CUSHION_HEIGHT + 3.05, behind)
    const focusTarget = new Vector3(0, SCREEN.CENTER_Y - 0.05, this.towerRadius)
    let focusFov = BASE_FOV

    if (this.show.staysForGame === true) {
      // The game is on the screen: the glide lands square on it, close enough
      // that it fills the view, and stays there from the count-in to the end,
      // so every attempt is framed the same. Camera and aim drop together, so
      // the screen sits higher in the frame, clear of the controls under it.
      const pose = this.screenPose()
      focus.set(0, SCREEN.CENTER_Y - pose.drop, this.towerRadius + CABINET.DEPTH / 2 + pose.distance)
      focusTarget.set(0, SCREEN.CENTER_Y - pose.drop, this.towerRadius)
      focusFov = pose.fov
    } else {
      // At the very end, a push toward the screen as the game takes over.
      const push = smoothstep((sinceStartMs - TV_TIMELINE.PUSH_START_MS) / -TV_TIMELINE.PUSH_START_MS)
      focus.lerp(new Vector3(0, SCREEN.CENTER_Y, this.towerRadius + CABINET.DEPTH + 1.4), push * 0.85)
    }

    this.setFov(spread.fov + (focusFov - spread.fov) * zoom)
    this.camera.position.copy(orbit).lerp(focus, zoom)
    this.camera.lookAt(orbitTarget.lerp(focusTarget, zoom))
  }

  /**
   * The circle's framing: as wide as a screen of ORBIT_FIT_ASPECT shows it.
   * A narrower screen widens the view (up to ORBIT_MAX_FOV) before backing
   * the camera off, which would leave the circle small and lost in the fog.
   */
  private orbitSpread(): { fov: number; distanceScale: number } {
    const baseHalfTan = Math.tan((BASE_FOV * Math.PI) / 360)
    const wantedHalfTan = Math.max(baseHalfTan, (baseHalfTan * ORBIT_FIT_ASPECT) / this.camera.aspect)
    const halfTan = Math.min(wantedHalfTan, Math.tan((ORBIT_MAX_FOV * Math.PI) / 360))
    return { fov: (Math.atan(halfTan) * 360) / Math.PI, distanceScale: wantedHalfTan / halfTan }
  }

  /**
   * Where the camera frames the player's screen. The whole cabinet front fits
   * with a little room round it; on a tall, narrow screen just the picture
   * does, edge to edge, so it is as big as the width allows. The bottom of
   * the view is kept clear for the controls over it (the STOP button), so the
   * screen sits in the part above, `drop` being how far camera and aim are
   * lowered to put it there. The camera never goes further back than just in
   * front of the player's own head; past that it widens its view instead,
   * which leaves the square-on screen undistorted.
   */
  private screenPose(): { distance: number; fov: number; drop: number } {
    const aspect = this.camera.aspect
    const isNarrow = aspect < 1
    const width = isNarrow ? SCREEN.WIDTH * 1.04 : (SCREEN.WIDTH + CABINET.BORDER * 2) * 1.08
    const viewHeightPx = Math.max(1, this.host.clientHeight)
    const kept = Math.min(0.34, Math.max(0.1, CONTROLS_PX / viewHeightPx))
    const height = ((SCREEN.HEIGHT + CABINET.BORDER * 2) * 1.08) / (1 - kept)
    const neededHalfTan = (distance: number) => Math.max(height / 2 / distance, width / 2 / (distance * aspect))
    const baseHalfTan = Math.tan((BASE_FOV * Math.PI) / 360)
    const distance = Math.min(MAX_SCREEN_DISTANCE, Math.max(height / 2 / baseHalfTan, width / 2 / (baseHalfTan * aspect)))
    const halfTan = Math.max(baseHalfTan, neededHalfTan(distance))
    const drop = distance * halfTan * kept
    return { distance, fov: (Math.atan(halfTan) * 360) / Math.PI, drop }
  }

  private setFov(fov: number): void {
    if (Math.abs(this.camera.fov - fov) < 0.01) return
    this.camera.fov = fov
    this.camera.updateProjectionMatrix()
  }

  /** The screen's picture: the game's own card while everyone settles in, then the count-in. */
  private drawScreen(seat: Seat, cue: (typeof CUES)[number] | null, sinceStartMs: number): void {
    const frame: TvScreenFrame = {
      elapsed: this.elapsed,
      sinceStartMs,
      ownerId: seat.player.playerId,
      ownerName: seat.player.name,
      isYou: seat.isYou,
    }
    const key = cue === null ? `card:${this.show.cardKey(frame)}` : `cue:${cue}`
    if (key === seat.drawnKey) return
    seat.drawnKey = key

    const context = seat.screenCanvas.getContext('2d')!
    const { WIDTH: w, HEIGHT: h } = CANVAS
    context.setTransform(CANVAS_SCALE, 0, 0, CANVAS_SCALE, 0, 0)
    context.save()
    if (cue === null) {
      this.show.drawCard(context, w, h, frame)
    } else {
      const gradient = context.createLinearGradient(0, 0, 0, h)
      gradient.addColorStop(0, '#2E2A45')
      gradient.addColorStop(1, '#1B1730')
      context.fillStyle = gradient
      context.fillRect(0, 0, w, h)
      const caption = this.show.cueCaption
      const wordY = caption === undefined ? h / 2 + 6 : h / 2 - 22
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillStyle = CUE_COLORS[cue]
      context.font = `900 ${(cue === 'START!' ? 120 : cue === 'SET' ? 128 : 92) * (caption === undefined ? 1 : 0.85)}px sans-serif`
      context.lineWidth = 12
      context.strokeStyle = '#2E2A45'
      context.strokeText(cue, w / 2, wordY)
      context.fillText(cue, w / 2, wordY)
      if (caption !== undefined) {
        context.fillStyle = '#FFFAF0'
        // As big as it can be while still fitting across the screen.
        context.font = '800 44px sans-serif'
        const fitsAt = Math.min(44, (44 * (w - 48)) / context.measureText(caption).width)
        context.font = `800 ${Math.floor(fitsAt)}px sans-serif`
        context.fillText(caption, w / 2, h - 62)
      }
    }
    context.restore()

    // Scanlines, for an old-telly look.
    context.fillStyle = 'rgba(0,0,0,0.12)'
    for (let y = 0; y < h; y += 4) context.fillRect(0, y, w, 1.5)
    seat.screen.needsUpdate = true
  }

  private resize(): void {
    const { clientWidth: width, clientHeight: height } = this.host
    if (width === 0 || height === 0) return
    this.renderer.setSize(width, height)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.tagWidth = labelWidthFor(Math.min(TAG.PIXELS, width * 0.2), height, BASE_FOV)
  }

  private track<T extends { dispose: () => void }>(item: T): T {
    this.disposables.push(item)
    return item
  }
}
