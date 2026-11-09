// Rules shared by the Node server (server/song-api.js) and the Cloudflare Worker
// (worker/index.js): what a valid song looks like, and the limits on saving.
// Visitors can only store numbers, booleans, and an emoji from a fixed list.

const TRACKS = 6
const STEPS = 64 // 4 pages of 16
const PARAMS = 8
const MACHINES = 7
export const MAX_BODY = 16 * 1024
export const MAX_LISTENERS = 300
export const MAX_COMPOSITIONS = 100
export const SAVE_COOLDOWN_MS = 20000

export const EMOJIS = [
  '🎹', '🥁', '🎸', '🎺', '🎻', '🎷', '🎧', '🔊',
  '🌙', '⭐', '🔥', '🌊', '⚡', '🌈', '🍄', '🌵',
  '🐙', '🦊', '🐸', '🤖', '👾', '🚀', '💎', '🪩',
]

const int = (v, min, max) => Number.isInteger(v) && v >= min && v <= max

/** Returns a clean copy of the song, or null if it is not exactly the expected shape. */
export function validate(song) {
  if (!song || typeof song !== 'object') return null
  const { patterns, params, machines, bpm } = song
  if (!int(bpm, 60, 180)) return null
  if (!Array.isArray(patterns) || patterns.length !== TRACKS) return null
  if (!Array.isArray(params) || params.length !== TRACKS) return null
  if (!Array.isArray(machines) || machines.length !== TRACKS) return null
  if (!machines.every((m) => int(m, 0, MACHINES - 1))) return null
  for (const row of patterns) {
    if (!Array.isArray(row) || row.length !== STEPS || !row.every((s) => typeof s === 'boolean')) return null
  }
  for (const row of params) {
    if (!Array.isArray(row) || row.length !== PARAMS || !row.every((v) => int(v, 0, 127))) return null
  }
  return {
    patterns: patterns.map((r) => [...r]),
    params: params.map((r) => [...r]),
    machines: [...machines],
    bpm,
  }
}
