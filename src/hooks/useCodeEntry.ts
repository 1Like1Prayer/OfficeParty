import { useCallback, useState } from 'react'

export interface CodeEntry {
  entry: string
  /** Accept typed or pasted text, keeping only what a room code can contain. */
  set: (text: string) => void
  reset: () => void
}

/**
 * The room code being entered. Typed and pasted text arrive the same way and
 * are cleaned the same way: pasted codes turn up with spaces, quotes, a
 * trailing newline, or a whole sentence wrapped around them.
 */
export function useCodeEntry(length: number, alphabet: string): CodeEntry {
  const [entry, setEntry] = useState('')

  const set = useCallback(
    (text: string) => {
      setEntry(
        [...text.toUpperCase()]
          .filter((char) => alphabet.includes(char))
          .slice(0, length)
          .join(''),
      )
    },
    [length, alphabet],
  )

  const reset = useCallback(() => { setEntry('') }, [])

  return { entry, set, reset }
}
