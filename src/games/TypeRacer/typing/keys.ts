/**
 * The character a key press types, or null if it is not one the game counts.
 * Only plain characters count — letters, digits, punctuation, space — and
 * never with Ctrl, Cmd or Alt held. Backspace, Enter and the arrows do nothing,
 * so there is no way to repair a mistake.
 */
export const typedCharacter = (event: KeyboardEvent): string | null => {
  if (event.ctrlKey || event.metaKey || event.altKey) return null
  return event.key.length === 1 ? event.key : null
}

/** Marks the phone's typing box, whose text arrives through its own input events. */
export const TYPING_INPUT_ATTRIBUTE = 'data-typing-input'

/** Whether a key press was aimed at the phone's typing box. */
export const isFromTypingInput = (event: KeyboardEvent): boolean =>
  event.target instanceof HTMLElement && event.target.hasAttribute(TYPING_INPUT_ATTRIBUTE)
