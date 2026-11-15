/**
 * How a runner moves: run, jump, fall, land. Each browser moves its own
 * runner with this, in fixed steps of STEP_SECONDS, so it responds the moment
 * a key is pressed and moves the same on any screen. Plain data in and out:
 * no clock, no scene.
 *
 * Only the top of a tile is solid. A runner stands on a tile while their
 * middle is over it (with a little grace at the edge), drops through the
 * moment it is gone, and lands on the first standing tile below them.
 */

import { HEX_DROP } from './constants.js';
import { LAYER_COUNT, layerHeight, OUT_HEIGHT, tileUnder } from './arena.js';
import type { Tile } from './types.js';

export interface RunnerState {
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    /** The tile they are standing on, or null in the air. */
    tile: number | null;
    /** The layer they last stood on (0 at the top). */
    layer: number;
    /** Seconds left in which a jump still works after leaving an edge. */
    coyote: number;
    /** Seconds left in which a jump pressed early still happens on landing. */
    jumpBuffer: number;
    /** Fell below the bottom layer: out of the round. */
    out: boolean;
}

export interface Controls {
    /** -1 to 1 on each axis; longer than 1 is shortened. */
    moveX: number;
    moveZ: number;
    /** The jump key went down this step. */
    jump: boolean;
}

export const startState = (tile: Tile): RunnerState => ({
    x: tile.x,
    y: layerHeight(tile.layer),
    z: tile.z,
    vx: 0,
    vy: 0,
    vz: 0,
    tile: tile.id,
    layer: tile.layer,
    coyote: 0,
    jumpBuffer: 0,
    out: false
});


/**
 * Moves the runner on by one step. `isStanding(tile)` says whether a tile is
 * still there at this step's time. Returns a new state; the old one is untouched.
 */
export const stepRunner = (
    previous: RunnerState,
    controls: Controls,
    isStanding: (tile: Tile) => boolean
): RunnerState => {
    const dt = HEX_DROP.STEP_SECONDS;
    const state = { ...previous };
    if (state.out) return state;

    // Run: ease toward the speed the keys ask for, quicker on the ground.
    const length = Math.hypot(controls.moveX, controls.moveZ);
    const scale = length > 1 ? 1 / length : 1;
    const accel = (state.tile !== null ? HEX_DROP.GROUND_ACCEL : HEX_DROP.AIR_ACCEL) * dt;
    const gapX = controls.moveX * scale * HEX_DROP.RUN_SPEED - state.vx;
    const gapZ = controls.moveZ * scale * HEX_DROP.RUN_SPEED - state.vz;
    const gap = Math.hypot(gapX, gapZ);
    // As one vector, so a diagonal speeds up no quicker than a straight line.
    const share = gap <= accel ? 1 : accel / gap;
    state.vx += gapX * share;
    state.vz += gapZ * share;
    state.x += state.vx * dt;
    state.z += state.vz * dt;

    // Still standing? The tile may have dropped, or they may have walked off it.
    if (state.tile !== null) {
        const under = tileUnder(state.layer, state.x, state.z, isStanding);
        if (under === null) {
            state.tile = null;
            state.coyote = HEX_DROP.COYOTE_SECONDS;
        } else {
            state.tile = under.id;
        }
    } else {
        state.coyote = Math.max(0, state.coyote - dt);
    }

    // Jump, from the ground or just after leaving it, or as soon as they land.
    state.jumpBuffer = controls.jump ? HEX_DROP.JUMP_BUFFER_SECONDS : Math.max(0, state.jumpBuffer - dt);
    if (state.jumpBuffer > 0 && (state.tile !== null || state.coyote > 0)) {
        state.vy = HEX_DROP.JUMP_SPEED;
        state.tile = null;
        state.coyote = 0;
        state.jumpBuffer = 0;
    }

    if (state.tile !== null) {
        state.vy = 0;
        state.y = layerHeight(state.layer);
        return state;
    }

    // In the air: fall, and land on the first standing tile passed through on the way down.
    state.vy = Math.max(state.vy - HEX_DROP.GRAVITY * dt, -HEX_DROP.MAX_FALL_SPEED);
    const fromY = state.y;
    const toY = fromY + state.vy * dt;
    if (state.vy < 0) {
        for (let layer = 0; layer < LAYER_COUNT; layer++) {
            const surface = layerHeight(layer);
            if (fromY < surface || toY > surface) continue;
            const under = tileUnder(layer, state.x, state.z, isStanding);
            if (under === null) continue;
            state.y = surface;
            state.vy = 0;
            state.tile = under.id;
            state.layer = layer;
            // A jump pressed early waits for the next step, so even a bounce
            // stands on the tile for a moment and sets it off.
            return state;
        }
    }
    state.y = toY;
    if (state.y < OUT_HEIGHT) state.out = true;
    return state;
};
