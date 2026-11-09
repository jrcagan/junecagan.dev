// The shared song and the library of saved compositions.
//
//   GET  /api/song               -> { song }          (null until someone edits)
//   PUT  /api/song               <- { song, from }    (replaces the live song)
//   GET  /api/song/events        -> server-sent events, one per change
//   GET  /api/compositions       -> { emojis, items: [{ id, emoji, date }] }
//   GET  /api/compositions/:id   -> { song }
//   POST /api/compositions       <- { emoji, song }   -> { item }
//
// Visitors can only store numbers, booleans, and an emoji from a fixed list;
// the server stamps the date. There is no free text anywhere.

import { randomBytes } from 'node:crypto'
import { mkdirSync, readFileSync, writeFile } from 'node:fs'
import { dirname, join } from 'node:path'

const TRACKS = 6
const STEPS = 64 // 4 pages of 16
const PARAMS = 8
const MACHINES = 7
const MAX_BODY = 16 * 1024
const MAX_LISTENERS = 300
const MAX_COMPOSITIONS = 100
const SAVE_COOLDOWN_MS = 20000

const EMOJIS = [
  '🎹', '🥁', '🎸', '🎺', '🎻', '🎷', '🎧', '🔊',
  '🌙', '⭐', '🔥', '🌊', '⚡', '🌈', '🍄', '🌵',
  '🐙', '🦊', '🐸', '🤖', '👾', '🚀', '💎', '🪩',
]

const int = (v, min, max) => Number.isInteger(v) && v >= min && v <= max

/** Returns a clean copy of the song, or null if it is not exactly the expected shape. */
function validate(song) {
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

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function writeJson(file, value) {
  mkdirSync(dirname(file), { recursive: true })
  writeFile(file, JSON.stringify(value), (err) => err && console.error(`Could not save ${file}:`, err.message))
}

/** Connect-style middleware `(req, res, next)`. Data lives as JSON files in `dir`. */
export function createSongApi(dir) {
  const songFile = join(dir, 'song.json')
  const libraryFile = join(dir, 'compositions.json')

  let song = validate(readJson(songFile))
  let library = (Array.isArray(readJson(libraryFile)) ? readJson(libraryFile) : [])
    .map((c) => ({ id: String(c?.id), emoji: c?.emoji, date: String(c?.date), song: validate(c?.song) }))
    .filter((c) => c.song && EMOJIS.includes(c.emoji))

  const listeners = new Set()
  const lastSave = new Map() // address -> time of last saved composition
  let saveTimer

  const saveSong = () => {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => writeJson(songFile, song), 500)
  }

  const heartbeat = setInterval(() => {
    for (const res of listeners) res.write(': ping\n\n')
  }, 25000)
  heartbeat.unref()

  const send = (res, status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
    res.end(JSON.stringify(body))
  }

  /** Reads a small JSON body, answering 413/400 itself when it is too big or malformed. */
  const readBody = (req, res, then) => {
    let body = ''
    let tooBig = false
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > MAX_BODY) tooBig = true
    })
    req.on('end', () => {
      if (tooBig) return send(res, 413, { error: 'Too large' })
      let parsed
      try {
        parsed = JSON.parse(body)
      } catch {
        return send(res, 400, { error: 'Invalid JSON' })
      }
      then(parsed)
    })
  }

  return function songApi(req, res, next) {
    const path = (req.url || '').split('?')[0]
    const method = req.method

    if (path === '/api/song' && method === 'GET') {
      return send(res, 200, { song })
    }

    if (path === '/api/song' && method === 'PUT') {
      return readBody(req, res, (parsed) => {
        const clean = validate(parsed?.song)
        if (!clean) return send(res, 400, { error: 'Invalid song' })
        song = clean
        saveSong()
        const from = typeof parsed.from === 'string' ? parsed.from.slice(0, 40) : ''
        const event = `data: ${JSON.stringify({ song, from })}\n\n`
        for (const listener of listeners) listener.write(event)
        send(res, 200, { ok: true })
      })
    }

    if (path === '/api/song/events' && method === 'GET') {
      if (listeners.size >= MAX_LISTENERS) return send(res, 503, { error: 'Busy' })
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-store',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      })
      res.write(': connected\n\n')
      listeners.add(res)
      req.on('close', () => listeners.delete(res))
      return
    }

    if (path === '/api/compositions' && method === 'GET') {
      const items = library.map(({ id, emoji, date }) => ({ id, emoji, date })).reverse()
      return send(res, 200, { emojis: EMOJIS, items })
    }

    if (path === '/api/compositions' && method === 'POST') {
      const who = req.socket.remoteAddress || 'unknown'
      const now = Date.now()
      if (now - (lastSave.get(who) || 0) < SAVE_COOLDOWN_MS) {
        return send(res, 429, { error: 'Wait a moment before saving again.' })
      }
      return readBody(req, res, (parsed) => {
        const clean = validate(parsed?.song)
        if (!clean || !EMOJIS.includes(parsed?.emoji)) return send(res, 400, { error: 'Invalid composition' })
        lastSave.set(who, now)
        if (lastSave.size > 5000) lastSave.clear()
        const item = { id: randomBytes(6).toString('hex'), emoji: parsed.emoji, date: new Date().toISOString() }
        library.push({ ...item, song: clean })
        library = library.slice(-MAX_COMPOSITIONS)
        writeJson(libraryFile, library)
        send(res, 200, { item })
      })
    }

    if (path.startsWith('/api/compositions/') && method === 'GET') {
      const found = library.find((c) => c.id === path.slice('/api/compositions/'.length))
      return found ? send(res, 200, { song: found.song }) : send(res, 404, { error: 'Not found' })
    }

    next()
  }
}
