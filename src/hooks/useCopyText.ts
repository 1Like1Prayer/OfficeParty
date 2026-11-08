import { useCallback, useEffect, useRef, useState } from 'react'

/** How long the "copied" confirmation stays up. */
const CONFIRM_MS = 1800

export interface CopyText {
  copied: boolean
  /** True when the copy could not be made and the text needs selecting by hand. */
  failed: boolean
  copy: (text: string) => void
}

/**
 * Copy to the clipboard, with the confirmation state the caller shows.
 *
 * `navigator.clipboard` only exists in a secure context, and players on other
 * desks reach this over plain http on a LAN address — so there is a fallback
 * through a throwaway textarea, and a `failed` flag for when even that is
 * refused.
 */
export function useCopyText(): CopyText {
  const [copied, setCopied] = useState(false)
  const [failed, setFailed] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  const settle = useCallback((ok: boolean) => {
    setCopied(ok)
    setFailed(!ok)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      setCopied(false)
      setFailed(false)
    }, CONFIRM_MS)
  }, [])

  const copy = useCallback(
    (text: string) => {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(
          () => { settle(true) },
          () => { settle(legacyCopy(text)) },
        )
        return
      }
      settle(legacyCopy(text))
    },
    [settle],
  )

  return { copied, failed, copy }
}

/** The pre-Clipboard-API route, which still works outside a secure context. */
function legacyCopy(text: string): boolean {
  try {
    const field = document.createElement('textarea')
    field.value = text
    field.setAttribute('readonly', '')
    field.style.position = 'fixed'
    field.style.opacity = '0'
    document.body.appendChild(field)
    field.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(field)
    return ok
  } catch {
    return false
  }
}
