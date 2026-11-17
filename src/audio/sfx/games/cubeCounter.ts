import { sound, type Sound } from '../core/sound.ts'

/** Cube Counter: the flash, the hide, typing the count, and right or wrong. */
export const cubeCounter = {
  /** The blocks flash up: a camera shutter. */
  flash: sound('games/cubeCounter/flash'),

  /** The blocks vanish: a falling whoop. */
  hide: sound('games/cubeCounter/hide'),

  /** One digit typed. */
  digit: (digit: string) => { DIGIT_SOUNDS[digit]?.() },

  /** The answer clock running out: ticks, quickening. */
  tick: sound('games/cubeCounter/tick'),

  /** Right: a rising chime. */
  correct: sound('games/cubeCounter/correct'),

  /** Wrong: a short buzzer. */
  wrong: sound('games/cubeCounter/wrong'),

  /** Out of time with no answer: a lower, longer buzzer. */
  timeout: sound('games/cubeCounter/timeout'),

  /** The "next puzzle" card counting in: a blip per second. */
  nextBlip: sound('games/cubeCounter/nextBlip'),

  /** A cube hopping in the intro: a cartoon boing. */
  hop: sound('games/cubeCounter/hop', { vary: 0.08 }),
} as const

/** One per digit: phone-keypad tones, so typing a number sounds like dialling it. */
const DIGIT_SOUNDS: Record<string, Sound> = Object.fromEntries(
  [...'0123456789'].map((digit) => [digit, sound(`games/cubeCounter/digit${digit}`, { gate: `cc.digit.${digit}`, minGapMs: 30 })]),
)
