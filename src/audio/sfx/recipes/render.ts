import { RECIPES } from './index.ts'
import type { LoopBuilder } from './synth.ts'
import type { LoopRecipe, OneShotRecipe, Synth } from './types.ts'

/**
 * Renders every recipe in the browser's own audio engine, so each file is
 * exactly the sound the recipe makes live. Run from tools/sfx/render.html,
 * which sends each one to the dev server to save under src/assets/audio/sfx/
 * (see the `sfx-render` plugin in vite.config.ts).
 *
 * Everything is rendered as .wav. One-shots are saved as .mp3 (the dev server
 * encodes them with ffmpeg): about a tenth of the size, and played by every
 * browser. Loops stay .wav, because an MP3 encoder pads the start with a few
 * milliseconds of silence, which would be a gap every time a loop came round.
 */

/** Enough for everything the recipes make (the highest partials sit under 15 kHz), at two thirds the size of CD rate. */
export const SAMPLE_RATE = 32_000
/** Longer than any one-shot; the silence after it is trimmed. */
const MAX_ONE_SHOT_SECONDS = 6
/** Below this a sample counts as silence, for trimming. */
const SILENCE = 0.0004
/** A loop's sources run this long before what is kept, so filters and swells have settled. */
const LOOP_WARMUP_SECONDS = 1

export interface RenderedFile {
  /** Under src/assets/audio/sfx/, e.g. "shared/ui/click.mp3", "games/typeRacer/key.v2.mp3" or "shared/ambience/sea.wav". */
  path: string
  /** The sound as .wav; for an .mp3 path, the dev server encodes it. */
  wav: ArrayBuffer
  isStereo: boolean
  seconds: number
  peak: number
}

function whiteNoise(ctx: BaseAudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
  const samples = buffer.getChannelData(0)
  for (let index = 0; index < samples.length; index++) samples[index] = Math.random() * 2 - 1
  return buffer
}

function channelsOf(buffer: AudioBuffer): Float32Array[] {
  return Array.from({ length: buffer.numberOfChannels }, (_, channel) => buffer.getChannelData(channel))
}

/** Plays one take of a one-shot recipe and cuts it where it falls silent, with a short fade so it never clicks. */
async function renderOneShot(synth: Synth, stereo: boolean): Promise<Float32Array[]> {
  const ctx = new OfflineAudioContext(stereo ? 2 : 1, SAMPLE_RATE * MAX_ONE_SHOT_SECONDS, SAMPLE_RATE)
  synth({ ctx, out: ctx.destination, at: 0, volume: 1, pitch: 1, noise: whiteNoise(ctx) })
  const channels = channelsOf(await ctx.startRendering())

  let last = 0
  for (const samples of channels) {
    for (let index = samples.length - 1; index > last; index--) {
      if (Math.abs(samples[index]!) > SILENCE) { last = index; break }
    }
  }
  const length = Math.min(channels[0]!.length, last + Math.round(SAMPLE_RATE * 0.02))
  const fade = Math.min(length, Math.round(SAMPLE_RATE * 0.005))
  return channels.map((samples) => {
    const cut = samples.slice(0, length)
    for (let index = 0; index < fade; index++) cut[length - 1 - index]! *= index / fade
    return cut
  })
}

/**
 * Plays a loop recipe for `seconds` (after a warm-up), and folds the stretch
 * just past the end back over the start with an equal-power crossfade: the
 * last sample then runs straight on into the first, so it repeats seamlessly.
 */
async function renderLoop(build: LoopBuilder, seconds: number, sampleRate: number): Promise<Float32Array[]> {
  const length = Math.round(sampleRate * seconds)
  const overlap = Math.round(sampleRate * Math.min(1.5, seconds * 0.2))
  const warmup = Math.round(sampleRate * LOOP_WARMUP_SECONDS)
  const ctx = new OfflineAudioContext(1, warmup + length + overlap, sampleRate)
  build(ctx, ctx.destination, whiteNoise(ctx))
  const [rendered] = channelsOf(await ctx.startRendering())

  const kept = rendered!.slice(warmup, warmup + length + overlap)
  const loop = kept.slice(0, length)
  for (let index = 0; index < overlap; index++) {
    const t = index / overlap
    loop[index] = kept[index]! * Math.sin((t * Math.PI) / 2) + kept[length + index]! * Math.cos((t * Math.PI) / 2)
  }
  return [loop]
}

/** 16-bit PCM .wav, interleaved. */
export function encodeWav(channels: Float32Array[], sampleRate: number): ArrayBuffer {
  const frames = channels[0]!.length
  const count = channels.length
  const bytes = 44 + frames * count * 2
  const view = new DataView(new ArrayBuffer(bytes))
  const text = (offset: number, value: string) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)) }
  text(0, 'RIFF')
  view.setUint32(4, bytes - 8, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, count, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * count * 2, true)
  view.setUint16(32, count * 2, true)
  view.setUint16(34, 16, true)
  text(36, 'data')
  view.setUint32(40, frames * count * 2, true)
  let offset = 44
  for (let frame = 0; frame < frames; frame++) {
    for (const samples of channels) {
      const sample = Math.max(-1, Math.min(1, samples[frame]!))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += 2
    }
  }
  return view.buffer
}

function peakOf(channels: Float32Array[]): number {
  let peak = 0
  for (const samples of channels) for (const sample of samples) peak = Math.max(peak, Math.abs(sample))
  return peak
}

async function renderRecipe(path: string, recipe: OneShotRecipe | LoopRecipe): Promise<RenderedFile[]> {
  if (recipe.kind === 'loop') {
    const sampleRate = recipe.sampleRate ?? SAMPLE_RATE
    const channels = await renderLoop(recipe.build, recipe.seconds, sampleRate)
    return [{ path: `${path}.wav`, wav: encodeWav(channels, sampleRate), isStereo: false, seconds: recipe.seconds, peak: peakOf(channels) }]
  }
  const files: RenderedFile[] = []
  for (let take = 1; take <= recipe.variants; take++) {
    const channels = await renderOneShot(recipe.synth, recipe.stereo)
    files.push({
      path: recipe.variants === 1 ? `${path}.mp3` : `${path}.v${take}.mp3`,
      wav: encodeWav(channels, SAMPLE_RATE),
      isStereo: recipe.stereo,
      seconds: channels[0]!.length / SAMPLE_RATE,
      peak: peakOf(channels),
    })
  }
  return files
}

/** Renders every recipe, handing each file to `save` as it is made. */
export async function renderAll(save: (file: RenderedFile) => Promise<void>): Promise<RenderedFile[]> {
  const all: RenderedFile[] = []
  for (const [path, recipe] of RECIPES) {
    for (const file of await renderRecipe(path, recipe)) {
      await save(file)
      all.push(file)
    }
  }
  return all
}
