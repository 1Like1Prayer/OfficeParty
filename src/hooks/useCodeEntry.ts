import { useCallback, useState } from 'react'

export interface CodeEntry {
  entry: string
  press: (char: string) => void
  /** Take a whole code at once, from a paste or a share link. */
  fill: (text: string) => void
  remove: () => void
  reset: () => void
}

/** The room code being typed, pasted or tapped in. */
export function useCodeEntry(length: number, alphabet: string): CodeEntry {
  const [entry, setEntry] = useState('')

  const press = useCallback(
    (char: string) => {
      if (!alphabet.includes(char)) return
      setEntry((current) => (current.length >= length ? current : current + char))
    },
    [length, alphabet],
  )

  // Pasted text is rarely clean: it arrives with spaces, quotes, a trailing
  // newline, or as a whole sentence someone copied out of a chat.
  const fill = useCallback(
    (text: string) => {
      const code = [...text.toUpperCase()]
        .filter((char) => alphabet.includes(char))
        .slice(0, length)
        .join('')
      if (code.length > 0) setEntry(code)
    },
    [length, alphabet],
  )

  const remove = useCallback(() => { setEntry((current) => current.slice(0, -1)) }, [])
  const reset = useCallback(() => { setEntry('') }, [])

  return { entry, press, fill, remove, reset }
}
