import { sound } from '../core/sound.ts'

/**
 * Menu and lobby sounds: buttons, the room filling up, readying, copying the
 * code, typing a code or name, and things going wrong.
 */
export const ui = {
  /** Any chunky button: a short rounded pop. */
  click: sound('shared/ui/click', { vary: 0.04, gate: 'ui.click', minGapMs: 40 }),

  /** The mouse moving onto a button: a faint, airy tick. */
  hover: sound('shared/ui/hover', { vary: 0.05, gate: 'ui.hover', minGapMs: 60 }),

  /** A small toggle (a game chip, "select all"): a tick, up for on and down for off. */
  toggle: sound('shared/ui/toggle', { vary: 0.03 }),

  /** A keystroke in a code box or the name field. */
  key: sound('shared/ui/key', { vary: 0.08, gate: 'ui.key', minGapMs: 25 }),

  /** Someone joined the room: a bubbly upward pop. */
  playerJoin: sound('shared/ui/playerJoin', { vary: 0.05, gate: 'ui.join', minGapMs: 120 }),

  /** Someone left or was removed: the same pop, falling. */
  playerLeave: sound('shared/ui/playerLeave', { vary: 0.04, gate: 'ui.leave', minGapMs: 120 }),

  /** "I'm ready": a bright two-note ding. */
  ready: sound('shared/ui/ready'),

  /** Ready taken back: a softer pair, falling. */
  unready: sound('shared/ui/unready'),

  /** The room code went to the clipboard: two quick blips. */
  copy: sound('shared/ui/copy'),

  /** A refusal (a wrong code, a full room): a low double buzz. */
  error: sound('shared/ui/error', { gate: 'ui.error', minGapMs: 300 }),

  /** Lost the connection: static, and a sagging tone. */
  disconnect: sound('shared/ui/disconnect'),

  /** Back online: a rising three-note chirp. */
  reconnect: sound('shared/ui/reconnect'),
} as const
