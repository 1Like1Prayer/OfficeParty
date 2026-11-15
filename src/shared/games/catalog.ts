/**
 * The eight games and what kind each one is. Only games marked `implemented`
 * can appear in a playlist; any still being built are listed here too, so the
 * client can show the full catalogue and playlist code doesn't need a second list.
 */

export const GAME_IDS = [
    'minefield',
    'cube-counter',
    'crusher-escalator',
    'stop-the-clock',
    'type-racer-roulette',
    'mage-battle',
    'log-dodge',
    'hex-drop'
] as const;

export type GameId = (typeof GAME_IDS)[number];

/** How a game is synced. Determines which runner drives it. */
export type GameKind = 'self-timed' | 'shared-world';

export interface GameMeta {
    id: GameId;
    title: string;
    kind: GameKind;
    implemented: boolean;
}

export const GAME_CATALOG: Record<GameId, GameMeta> = {
    'minefield': { id: 'minefield', title: 'Minefield', kind: 'self-timed', implemented: true },
    'cube-counter': { id: 'cube-counter', title: 'Cube Counter', kind: 'self-timed', implemented: true },
    'crusher-escalator': { id: 'crusher-escalator', title: 'Crusher Escalator', kind: 'self-timed', implemented: true },
    'stop-the-clock': { id: 'stop-the-clock', title: 'Stop the Clock', kind: 'self-timed', implemented: true },
    'type-racer-roulette': { id: 'type-racer-roulette', title: 'Type Racer Roulette', kind: 'self-timed', implemented: true },
    'mage-battle': { id: 'mage-battle', title: 'Mage Battle', kind: 'shared-world', implemented: true },
    'log-dodge': { id: 'log-dodge', title: 'Log Dodge', kind: 'self-timed', implemented: true },
    'hex-drop': { id: 'hex-drop', title: 'Hex Drop', kind: 'shared-world', implemented: true }
};

export const isGameId = (value: unknown): value is GameId =>
    typeof value === 'string' && (GAME_IDS as readonly string[]).includes(value);

export const implementedGameIds = (): GameId[] =>
    GAME_IDS.filter((id) => GAME_CATALOG[id].implemented);
