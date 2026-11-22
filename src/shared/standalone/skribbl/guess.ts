/**
 * Is a chat message the word? Guesses are compared on letters and digits
 * only, ignoring case, accents, spaces and punctuation, so "T-rex" matches
 * "trex" and "mr bean" matches "Mr. Bean". The server decides; the client
 * may use the same function for nothing more than UI hints.
 */

export type GuessVerdict = 'correct' | 'close' | 'wrong';

/** Lowercase letters and digits only, accents stripped. */
export const normalizeGuess = (text: string): string =>
    text
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');

/** Levenshtein distance, stopping early once it passes `limit`. */
export const editDistance = (a: string, b: string, limit = Infinity): number => {
    if (Math.abs(a.length - b.length) > limit) return limit + 1;
    let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
    for (let i = 1; i <= a.length; i++) {
        const current = [i];
        let rowMin = i;
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            const value = Math.min(previous[j]! + 1, current[j - 1]! + 1, previous[j - 1]! + cost);
            current.push(value);
            rowMin = Math.min(rowMin, value);
        }
        if (rowMin > limit) return limit + 1;
        previous = current;
    }
    return previous[b.length]!;
};

/** Words this short are too easy to be one letter off by accident, so they never say "close". */
const MIN_CLOSE_LENGTH = 4;

export const judgeGuess = (text: string, word: string): GuessVerdict => {
    const guess = normalizeGuess(text);
    const target = normalizeGuess(word);
    if (guess.length === 0) return 'wrong';
    if (guess === target) return 'correct';
    if (target.length >= MIN_CLOSE_LENGTH && editDistance(guess, target, 1) === 1) return 'close';
    return 'wrong';
};

/**
 * Does a message give the word away? Used to stop the drawer, and players who
 * already guessed, from spelling it out where the others can read it.
 */
export const revealsWord = (text: string, word: string): boolean => {
    const target = normalizeGuess(word);
    return target.length > 0 && normalizeGuess(text).includes(target);
};
