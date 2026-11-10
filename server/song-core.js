// Rules shared by the Node server (server/song-api.js) and the Cloudflare Worker
// (worker/index.js): what a valid song looks like, and the limits on saving.
// Visitors can only store numbers, booleans, and an emoji from a fixed list.
//
// A song is { patterns, params, machines, bpm, locks }. locks[track][step] is null,
// or one value per parameter for that step alone, where -1 means "not locked: use
// the track's knob". Only steps that are switched on keep locks.

const TRACKS = 6
const STEPS = 64 // 4 pages of 16
const PARAMS = 8
const MACHINES = 7
export const MAX_BODY = 32 * 1024
export const MAX_LISTENERS = 300
export const MAX_COMPOSITIONS = 100
export const SAVE_COOLDOWN_MS = 20000

export const EMOJIS = [
  '🎹', '🥁', '🎸', '🎺', '🎻', '🎷', '🎧', '🔊',
  '🌙', '⭐', '🔥', '🌊', '⚡', '🌈', '🍄', '🌵',
  '🐙', '🦊', '🐸', '🤖', '👾', '🚀', '💎', '🪩',
]

const int = (v, min, max) => Number.isInteger(v) && v >= min && v <= max

// Songs saved before per-step locks existed played fixed melodies on tracks 3-5:
// each step added a semitone offset to the track's TUNE. This table is that old
// melody, kept only so those songs can be converted to TUNE locks and sound the same.
const LEGACY_ROOTS = [0, -7, 0, -5]
const LEGACY_CHORDS = [
  [0, 3, 7, 12],
  [0, 5, 8, 12],
  [0, 3, 7, 12],
  [-2, 2, 7, 10],
]
const LEGACY_MELODY = [
  [7, 7, 7, 7, 7, 7, 3, 3, 7, 7, 7, 10, 10, 10, 7, 7],
  [8, 8, 8, 8, 8, 8, 5, 5, 8, 8, 8, 12, 12, 12, 8, 8],
  [12, 12, 12, 12, 12, 12, 7, 7, 12, 12, 12, 15, 15, 15, 12, 12],
  [10, 10, 10, 10, 10, 10, 7, 7, 10, 10, 10, 14, 14, 14, 8, 8],
]
const LEGACY_ARP = [0, 1, 2, 3, 2, 1]

function legacyOffset(track, step) {
  const page = step >> 4
  const k = step & 15
  if (track === 2) return LEGACY_ROOTS[page]
  if (track === 3) return LEGACY_MELODY[page][k]
  if (track === 4) return LEGACY_CHORDS[page][LEGACY_ARP[k % LEGACY_ARP.length]]
  return 0
}

function legacyLocks(patterns, params) {
  return patterns.map((row, t) =>
    row.map((on, s) => {
      const offset = legacyOffset(t, s)
      if (!on || !offset) return null
      const lock = Array(PARAMS).fill(-1)
      lock[0] = Math.min(127, Math.max(0, params[t][0] + offset))
      return lock
    }),
  )
}

/** Returns clean locks for already-checked patterns, or null if the shape is wrong. */
function cleanLocks(locks, patterns) {
  if (!Array.isArray(locks) || locks.length !== TRACKS) return null
  const out = []
  for (let t = 0; t < TRACKS; t++) {
    const row = locks[t]
    if (!Array.isArray(row) || row.length !== STEPS) return null
    const clean = []
    for (let s = 0; s < STEPS; s++) {
      const lock = row[s]
      if (lock === null) {
        clean.push(null)
        continue
      }
      if (!Array.isArray(lock) || lock.length !== PARAMS || !lock.every((v) => int(v, -1, 127))) return null
      clean.push(patterns[t][s] && lock.some((v) => v >= 0) ? [...lock] : null)
    }
    out.push(clean)
  }
  return out
}

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
  const locks = song.locks === undefined ? legacyLocks(patterns, params) : cleanLocks(song.locks, patterns)
  if (!locks) return null
  return {
    patterns: patterns.map((r) => [...r]),
    params: params.map((r) => [...r]),
    machines: [...machines],
    bpm,
    locks,
  }
}
