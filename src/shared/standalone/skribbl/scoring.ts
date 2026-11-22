/**
 * Points for one turn. Guessers score more the sooner they guess, plus a
 * bonus for being among the first. The drawer scores the guessers' points
 * shared over everyone who could have guessed, so a drawing many people get
 * quickly is worth the most, and one nobody gets is worth nothing.
 */

const TIME_POINTS = { min: 50, max: 400 } as const;
/** Bonus for the first guesser, dropping by `step` for each one after. */
const ORDER_BONUS = { first: 100, step: 25 } as const;

const roundTo5 = (value: number): number => Math.round(value / 5) * 5;

/**
 * @param remainingMs how much drawing time was left when they guessed
 * @param drawMs the turn's full drawing time
 * @param order 0 for the first correct guess of the turn, 1 for the second…
 */
export const guesserPoints = (remainingMs: number, drawMs: number, order: number): number => {
    const share = drawMs > 0 ? Math.min(1, Math.max(0, remainingMs / drawMs)) : 0;
    const timePoints = TIME_POINTS.min + (TIME_POINTS.max - TIME_POINTS.min) * share;
    const bonus = Math.max(0, ORDER_BONUS.first - ORDER_BONUS.step * order);
    return roundTo5(timePoints + bonus);
};

/**
 * @param guesserScores what each correct guesser scored this turn
 * @param eligibleGuessers everyone who could have guessed (guessed or not)
 */
export const drawerPoints = (guesserScores: readonly number[], eligibleGuessers: number): number => {
    if (guesserScores.length === 0 || eligibleGuessers <= 0) return 0;
    const total = guesserScores.reduce((sum, points) => sum + points, 0);
    return roundTo5(total / Math.max(eligibleGuessers, guesserScores.length));
};
