/**
 * The word's public pattern and its hints.
 *
 * Guessers see the word as a pattern: each letter or digit is '_' until it is
 * revealed, everything else (spaces, hyphens, dots) shows from the start, so
 * "T-rex" is "_-___". Over the turn the server reveals a few letters at
 * evenly spaced times. The pattern is public and lives in synced state; the
 * word itself never does.
 */

export const HIDDEN = '_';

const isLetter = (char: string): boolean => /[\p{L}\p{N}]/u.test(char);

/** Indexes of the characters a guesser has to work out. */
export const letterIndexes = (word: string): number[] =>
    [...word].flatMap((char, index) => (isLetter(char) ? [index] : []));

/** The pattern with the given indexes revealed. */
export const wordPattern = (word: string, revealed: ReadonlySet<number> = new Set()): string =>
    [...word].map((char, index) => (isLetter(char) && !revealed.has(index) ? HIDDEN : char)).join('');

/**
 * How many letters a turn may reveal: at most the setting, and always fewer
 * than half the letters, so a hint never gives the word away.
 */
export const hintCount = (word: string, setting: number): number =>
    Math.max(0, Math.min(setting, Math.floor((letterIndexes(word).length - 1) / 2)));

/** When each hint is revealed, in ms after drawing starts: evenly spaced over the turn. */
export const hintTimesMs = (count: number, drawMs: number): number[] =>
    Array.from({ length: count }, (_, index) => Math.round((drawMs * (index + 1)) / (count + 1)));

/**
 * Pick the next letter to reveal. `randomInt(n)` returns 0..n-1 (crypto on
 * the server, seeded in tests). Returns null once every letter is out.
 */
export const pickHint = (
    word: string,
    revealed: ReadonlySet<number>,
    randomInt: (n: number) => number
): number | null => {
    const hidden = letterIndexes(word).filter((index) => !revealed.has(index));
    if (hidden.length === 0) return null;
    return hidden[randomInt(hidden.length)]!;
};
