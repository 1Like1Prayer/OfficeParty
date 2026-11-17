/**
 * Every sound file the game has: the .mp3 and .wav files under
 * src/assets/audio/sfx/, found at build time, by sound id. The id is the
 * file's path without the extension (`shared/ui/click`); a sound with several
 * takes keeps them as name.v1.mp3, name.v2.mp3, … under one id, and a take is
 * picked at random each time it plays.
 *
 * One-shots are .mp3 (small, and every browser plays them); loops are .wav,
 * which never pads the start, so they come round without a gap. Drop a
 * recording in under the same name to replace a sound.
 */

const URLS = import.meta.glob('../../../assets/audio/sfx/**/*.{mp3,wav}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

const PREFIX = '../../../assets/audio/sfx/'
const EXTENSION = /\.(mp3|wav)$/
const TAKE = /\.v\d+$/

function buildLibrary(): ReadonlyMap<string, readonly string[]> {
  const library = new Map<string, string[]>()
  for (const [path, url] of Object.entries(URLS).sort(([a], [b]) => a.localeCompare(b))) {
    const id = path.slice(PREFIX.length).replace(EXTENSION, '').replace(TAKE, '')
    library.set(id, [...(library.get(id) ?? []), url])
  }
  return library
}

/** File URLs by sound id; several for a sound with more than one take. */
export const LIBRARY = buildLibrary()

/** The shared sounds first, so menus and the count-in are ready before any one game's. */
export const LOAD_ORDER: readonly string[] = [...LIBRARY.keys()].sort(
  (a, b) => Number(b.startsWith('shared/')) - Number(a.startsWith('shared/')),
)
