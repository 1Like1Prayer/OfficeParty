/**
 * The drawing: its binary wire format and the model both sides keep.
 *
 * The drawer's browser batches what it draws (~20 times a second) into one
 * draw packet and sends it with `room.sendBytes`. The server checks it
 * against the canvas model, keeps it, and relays the same bytes to everyone
 * else. Strokes must arrive reliably and in order (a lost undo breaks every
 * canvas), which is exactly what the WebSocket gives us.
 *
 * Packet, little-endian:
 *
 *   u8 version | u32 turnId | op…
 *
 *   1 BEGIN   u8 color, u8 size, u16 x, u16 y      start a stroke at a point
 *   2 POINTS  u8 count, count × (u16 x, u16 y, u8 dtMs)
 *   3 END                                          finish the open stroke
 *   4 FILL    u8 color, u16 x, u16 y               flood fill
 *   5 UNDO                                         remove the last stroke or fill
 *   6 CLEAR                                        wipe the canvas
 *
 * Coordinates are pixels on the fixed CANVAS.WIDTH × CANVAS.HEIGHT canvas.
 * `dtMs` is how long after the previous point this one was drawn, so viewers
 * can replay the stroke at the pace it was drawn (with a ~100 ms playout
 * buffer, the netcode guide's interpolation delay) instead of in 50 ms jumps.
 */

import { CANVAS } from './constants.js';

export const CANVAS_PROTOCOL_VERSION = 1;

export interface CanvasPoint {
    x: number;
    y: number;
    /** Milliseconds since the previous point, 0-255. */
    dtMs: number;
}

export type CanvasOp =
    | { op: 'begin'; color: number; size: number; x: number; y: number }
    | { op: 'points'; points: CanvasPoint[] }
    | { op: 'end' }
    | { op: 'fill'; color: number; x: number; y: number }
    | { op: 'undo' }
    | { op: 'clear' };

export interface DrawPacket {
    turnId: number;
    ops: CanvasOp[];
}

const OPCODE = { begin: 1, points: 2, end: 3, fill: 4, undo: 5, clear: 6 } as const;
const HEADER_BYTES = 5;
const MAX_POINTS_PER_OP = 255;

const opBytes = (op: CanvasOp): number => {
    switch (op.op) {
        case 'begin': return 7;
        case 'points': return 2 + op.points.length * 5;
        case 'fill': return 6;
        default: return 1;
    }
};

/** Split long point runs into ops of at most 255 points. */
const chunkPoints = (ops: readonly CanvasOp[]): CanvasOp[] =>
    ops.flatMap((op) => {
        if (op.op !== 'points' || op.points.length <= MAX_POINTS_PER_OP) return [op];
        const chunks: CanvasOp[] = [];
        for (let start = 0; start < op.points.length; start += MAX_POINTS_PER_OP) {
            chunks.push({ op: 'points', points: op.points.slice(start, start + MAX_POINTS_PER_OP) });
        }
        return chunks;
    });

export const encodeDrawPacket = (packet: DrawPacket): Uint8Array => {
    const ops = chunkPoints(packet.ops).filter((op) => op.op !== 'points' || op.points.length > 0);
    const bytes = new Uint8Array(HEADER_BYTES + ops.reduce((sum, op) => sum + opBytes(op), 0));
    const view = new DataView(bytes.buffer);
    view.setUint8(0, CANVAS_PROTOCOL_VERSION);
    view.setUint32(1, packet.turnId, true);
    let at = HEADER_BYTES;
    for (const op of ops) {
        view.setUint8(at++, OPCODE[op.op]);
        switch (op.op) {
            case 'begin':
                view.setUint8(at++, op.color);
                view.setUint8(at++, op.size);
                view.setUint16(at, op.x, true); at += 2;
                view.setUint16(at, op.y, true); at += 2;
                break;
            case 'points':
                view.setUint8(at++, op.points.length);
                for (const point of op.points) {
                    view.setUint16(at, point.x, true); at += 2;
                    view.setUint16(at, point.y, true); at += 2;
                    view.setUint8(at++, Math.min(255, Math.max(0, Math.round(point.dtMs))));
                }
                break;
            case 'fill':
                view.setUint8(at++, op.color);
                view.setUint16(at, op.x, true); at += 2;
                view.setUint16(at, op.y, true); at += 2;
                break;
            default:
                break;
        }
    }
    return bytes;
};

const inCanvas = (x: number, y: number): boolean => x < CANVAS.WIDTH && y < CANVAS.HEIGHT;
const validColor = (color: number): boolean => color < CANVAS.PALETTE_SIZE;

/**
 * Parse a packet. Returns null for anything malformed: a wrong version, a
 * truncated op, an unknown opcode, a point off the canvas, a color or brush
 * outside the palette, or no ops at all. A packet is all or nothing.
 */
export const decodeDrawPacket = (bytes: Uint8Array): DrawPacket | null => {
    if (bytes.length < HEADER_BYTES + 1) return null;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.getUint8(0) !== CANVAS_PROTOCOL_VERSION) return null;
    const turnId = view.getUint32(1, true);
    const ops: CanvasOp[] = [];
    let at = HEADER_BYTES;
    const has = (count: number) => at + count <= bytes.length;

    while (at < bytes.length) {
        const opcode = view.getUint8(at++);
        if (opcode === OPCODE.begin) {
            if (!has(6)) return null;
            const color = view.getUint8(at);
            const size = view.getUint8(at + 1);
            const x = view.getUint16(at + 2, true);
            const y = view.getUint16(at + 4, true);
            at += 6;
            if (!validColor(color) || size >= CANVAS.BRUSH_SIZES || !inCanvas(x, y)) return null;
            ops.push({ op: 'begin', color, size, x, y });
        } else if (opcode === OPCODE.points) {
            if (!has(1)) return null;
            const count = view.getUint8(at++);
            if (count === 0 || !has(count * 5)) return null;
            const points: CanvasPoint[] = [];
            for (let i = 0; i < count; i++) {
                const x = view.getUint16(at, true);
                const y = view.getUint16(at + 2, true);
                const dtMs = view.getUint8(at + 4);
                at += 5;
                if (!inCanvas(x, y)) return null;
                points.push({ x, y, dtMs });
            }
            ops.push({ op: 'points', points });
        } else if (opcode === OPCODE.fill) {
            if (!has(5)) return null;
            const color = view.getUint8(at);
            const x = view.getUint16(at + 1, true);
            const y = view.getUint16(at + 3, true);
            at += 5;
            if (!validColor(color) || !inCanvas(x, y)) return null;
            ops.push({ op: 'fill', color, x, y });
        } else if (opcode === OPCODE.end) {
            ops.push({ op: 'end' });
        } else if (opcode === OPCODE.undo) {
            ops.push({ op: 'undo' });
        } else if (opcode === OPCODE.clear) {
            ops.push({ op: 'clear' });
        } else {
            return null;
        }
    }
    return ops.length > 0 ? { turnId, ops } : null;
};

/* ------------------------------------------------------------------ */
/* The model                                                            */
/* ------------------------------------------------------------------ */

export type CanvasAction =
    | { kind: 'stroke'; color: number; size: number; points: { x: number; y: number }[] }
    | { kind: 'fill'; color: number; x: number; y: number };

export interface CanvasLimits {
    maxActions: number;
    maxPoints: number;
}

/**
 * The drawing as a list of actions (strokes and fills), which is what undo
 * works on. The server keeps one per turn, so a player who joins or
 * reconnects mid-turn gets the drawing as it stands; the client can keep one
 * to redraw after an undo.
 */
export class CanvasModel {
    private actions: CanvasAction[] = [];
    /** The last action is a stroke still being drawn. */
    private strokeOpen = false;
    private points = 0;

    private readonly limits: CanvasLimits;

    // A plain field, not a parameter property: the browser build allows only erasable TypeScript syntax.
    constructor(limits: CanvasLimits = { maxActions: CANVAS.MAX_ACTIONS, maxPoints: CANVAS.MAX_POINTS }) {
        this.limits = limits;
    }

    get actionList(): readonly CanvasAction[] {
        return this.actions;
    }

    get pointCount(): number {
        return this.points;
    }

    get isEmpty(): boolean {
        return this.actions.length === 0;
    }

    /**
     * Apply a packet's ops, all or nothing. Refuses points with no stroke to
     * add them to, and anything that would take the turn past its limits.
     */
    tryApply(ops: readonly CanvasOp[]): boolean {
        if (!this.fits(ops)) return false;
        for (const op of ops) this.apply(op);
        return true;
    }

    clear(): void {
        this.actions = [];
        this.strokeOpen = false;
        this.points = 0;
    }

    /**
     * The drawing as ops that rebuild it on an empty canvas: a clear, then
     * each action. A stroke still being drawn is left open, so the drawer's
     * next points carry on from it.
     */
    toOps(): CanvasOp[] {
        const ops: CanvasOp[] = [{ op: 'clear' }];
        this.actions.forEach((action, index) => {
            if (action.kind === 'fill') {
                ops.push({ op: 'fill', color: action.color, x: action.x, y: action.y });
                return;
            }
            const [first, ...rest] = action.points;
            if (!first) return;
            ops.push({ op: 'begin', color: action.color, size: action.size, x: first.x, y: first.y });
            if (rest.length > 0) ops.push({ op: 'points', points: rest.map((p) => ({ ...p, dtMs: 0 })) });
            const isOpen = this.strokeOpen && index === this.actions.length - 1;
            if (!isOpen) ops.push({ op: 'end' });
        });
        return ops;
    }

    /** Check a packet without changing anything, by replaying its effect on the counts and the open stroke. */
    private fits(ops: readonly CanvasOp[]): boolean {
        /** Actions kept from earlier packets that are still there. */
        let kept = this.actions.length;
        /** Points this packet adds to the stroke kept open from an earlier packet. */
        let extraOnOpen = 0;
        /** Points of each action this packet adds, in order. */
        const added: number[] = [];
        let points = this.points;
        let open = this.strokeOpen;
        for (const op of ops) {
            switch (op.op) {
                case 'begin':
                    added.push(1); points++; open = true;
                    break;
                case 'points':
                    if (!open) return false;
                    points += op.points.length;
                    if (added.length > 0) added[added.length - 1]! += op.points.length;
                    else extraOnOpen += op.points.length;
                    break;
                case 'end':
                    open = false;
                    break;
                case 'fill':
                    added.push(0); open = false;
                    break;
                case 'undo':
                    open = false;
                    if (added.length > 0) {
                        points -= added.pop()!;
                    } else if (kept > 0) {
                        const removed = this.actions[kept - 1]!;
                        points -= (removed.kind === 'stroke' ? removed.points.length : 0) + extraOnOpen;
                        extraOnOpen = 0;
                        kept--;
                    }
                    break;
                case 'clear':
                    kept = 0; extraOnOpen = 0; added.length = 0; points = 0; open = false;
                    break;
            }
            if (kept + added.length > this.limits.maxActions || points > this.limits.maxPoints) return false;
        }
        return true;
    }

    private apply(op: CanvasOp): void {
        switch (op.op) {
            case 'begin':
                this.actions.push({ kind: 'stroke', color: op.color, size: op.size, points: [{ x: op.x, y: op.y }] });
                this.strokeOpen = true;
                this.points++;
                break;
            case 'points': {
                const stroke = this.actions.at(-1);
                if (stroke?.kind !== 'stroke') return;
                for (const point of op.points) stroke.points.push({ x: point.x, y: point.y });
                this.points += op.points.length;
                break;
            }
            case 'end':
                this.strokeOpen = false;
                break;
            case 'fill':
                this.actions.push({ kind: 'fill', color: op.color, x: op.x, y: op.y });
                this.strokeOpen = false;
                break;
            case 'undo': {
                const removed = this.actions.pop();
                if (removed?.kind === 'stroke') this.points -= removed.points.length;
                this.strokeOpen = false;
                break;
            }
            case 'clear':
                this.clear();
                break;
        }
    }
}
