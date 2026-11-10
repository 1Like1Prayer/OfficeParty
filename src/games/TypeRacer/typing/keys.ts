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
