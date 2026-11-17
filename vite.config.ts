import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { spawn } from 'node:child_process'
import { mkdir, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import { defineConfig, type Plugin } from 'vite'

const SFX_DIR = resolve(import.meta.dirname, 'src/assets/audio/sfx')

/** MP3 bitrate for the rendered sounds: plenty for synthesised effects. */
const MP3_KBPS = { mono: 96, stereo: 128 } as const

/** Encodes a .wav (as bytes) to an .mp3 file with ffmpeg. */
function wavToMp3(wav: Buffer, target: string, isStereo: boolean): Promise<void> {
  return new Promise((done, fail) => {
    const bitrate = `${isStereo ? MP3_KBPS.stereo : MP3_KBPS.mono}k`
    const ffmpeg = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'wav', '-i', 'pipe:0', '-codec:a', 'libmp3lame', '-b:a', bitrate, target])
    let errors = ''
    ffmpeg.stderr.on('data', (chunk: Buffer) => { errors += chunk.toString() })
    ffmpeg.on('error', () => { fail(new Error('ffmpeg not found: install it (macOS: brew install ffmpeg) to render the sound effects')) })
    ffmpeg.on('close', (code) => { if (code === 0) done(); else fail(new Error(`ffmpeg failed: ${errors.trim()}`)) })
    ffmpeg.stdin.end(wav)
  })
}

/**
 * Dev server only: lets tools/sfx/render.html save the sound effects it
 * renders. POST /__sfx/clear empties src/assets/audio/sfx; POST
 * /__sfx/save?path=shared/ui/click.mp3 writes one file there, sent as .wav
 * bytes: saved as they are for a .wav path, encoded with ffmpeg for an .mp3
 * one. Nothing else can be written: only .wav and .mp3, only inside that folder.
 */
function sfxRender(): Plugin {
  return {
    name: 'sfx-render',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__sfx', (request, response) => {
        const fail = (status: number, message: string) => {
          response.statusCode = status
          response.end(message)
        }
        if (request.method !== 'POST') return fail(405, 'POST only')
        const url = new URL(request.url ?? '/', 'http://localhost')

        if (url.pathname === '/clear') {
          rm(SFX_DIR, { recursive: true, force: true })
            .then(() => { response.end('cleared') })
            .catch((error: unknown) => { fail(500, String(error)) })
          return
        }
        if (url.pathname !== '/save') return fail(404, 'unknown')

        const relative = url.searchParams.get('path') ?? ''
        const target = resolve(SFX_DIR, relative)
        const isMp3 = relative.endsWith('.mp3')
        if (!(isMp3 || relative.endsWith('.wav')) || !target.startsWith(SFX_DIR + sep)) return fail(400, 'bad path')
        const isStereo = url.searchParams.get('stereo') === '1'

        const chunks: Buffer[] = []
        request.on('data', (chunk: Buffer) => { chunks.push(chunk) })
        request.on('end', () => {
          const wav = Buffer.concat(chunks)
          mkdir(dirname(target), { recursive: true })
            .then(() => (isMp3 ? wavToMp3(wav, target, isStereo) : writeFile(target, wav)))
            // The size it came to on disk, for the render page's totals.
            .then(() => stat(target))
            .then(({ size }) => { response.end(String(size)) })
            .catch((error: unknown) => { fail(500, error instanceof Error ? error.message : String(error)) })
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    sfxRender(),
  ],
  build: {
    // Sound files stay files, however small: they load in the background after
    // the page, rather than being inlined into the script it has to load first.
    assetsInlineLimit: (file) => (/\.(mp3|wav)$/.test(file) ? false : undefined),
  },
})
