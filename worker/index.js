// Cloudflare version of the shared-song API (the Node version is server/song-api.js).
//
// The Worker serves the built site from dist/ and hands every /api/* request to a
// single Durable Object, which holds the live song, the saved compositions, and
// the open event streams, so every visitor talks to the same instance.
//
//   GET  /api/song               -> { song }          (null until someone edits)
//   PUT  /api/song               <- { song, from }    (replaces the live song)
//   GET  /api/song/events        -> server-sent events, one per change
//   GET  /api/compositions       -> { emojis, items: [{ id, emoji, date }] }
//   GET  /api/compositions/:id   -> { song }
//   POST /api/compositions       <- { emoji, song }   -> { item }

import { DurableObject } from 'cloudflare:workers'
import {
  EMOJIS,
  MAX_BODY,
  MAX_COMPOSITIONS,
  MAX_LISTENERS,
  SAVE_COOLDOWN_MS,
  validate,
} from '../server/song-core.js'

const encoder = new TextEncoder()

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })

/** Parses a small JSON body; returns undefined if it is too large or malformed. */
async function readBody(request) {
  const text = await request.text()
  if (text.length > MAX_BODY) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

export class SongRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env)
    this.song = null
    this.library = [] // [{ key, id, emoji, date, song }], oldest first
    this.listeners = new Set() // stream writers for /api/song/events
    this.lastSave = new Map() // visitor address -> time of last saved composition
    this.saveTimer = null
    this.heartbeat = null

    // Load everything from storage before handling the first request.
    ctx.blockConcurrencyWhile(async () => {
      this.song = validate(await ctx.storage.get('song'))
      const saved = await ctx.storage.list({ prefix: 'c:' })
      for (const [key, c] of saved) {
        const song = validate(c?.song)
        if (song && EMOJIS.includes(c.emoji)) {
          this.library.push({ key, id: String(c.id), emoji: c.emoji, date: String(c.date), song })
        }
      }
    })
  }

  /** Sends one chunk to every open event stream, dropping streams that have closed. */
  broadcast(text) {
    const chunk = encoder.encode(text)
    for (const writer of this.listeners) {
      writer.write(chunk).catch(() => this.listeners.delete(writer))
    }
    if (this.listeners.size === 0 && this.heartbeat) {
      clearInterval(this.heartbeat)
      this.heartbeat = null
    }
  }

  async fetch(request) {
    const path = new URL(request.url).pathname
    const method = request.method

    if (path === '/api/song' && method === 'GET') {
      return json(200, { song: this.song })
    }

    if (path === '/api/song' && method === 'PUT') {
      const parsed = await readBody(request)
      const clean = validate(parsed?.song)
      if (!clean) return json(400, { error: 'Invalid song' })
      this.song = clean
      // A knob drag sends many updates; write to storage at most every 2 seconds.
      this.saveTimer ??= setTimeout(() => {
        this.saveTimer = null
        void this.ctx.storage.put('song', this.song)
      }, 2000)
      const from = typeof parsed.from === 'string' ? parsed.from.slice(0, 40) : ''
      this.broadcast(`data: ${JSON.stringify({ song: clean, from })}\n\n`)
      return json(200, { ok: true })
    }

    if (path === '/api/song/events' && method === 'GET') {
      if (this.listeners.size >= MAX_LISTENERS) return json(503, { error: 'Busy' })
      const { readable, writable } = new TransformStream()
      const writer = writable.getWriter()
      this.listeners.add(writer)
      writer.write(encoder.encode(': connected\n\n')).catch(() => this.listeners.delete(writer))
      // Pings keep connections open and are also how closed ones get noticed.
      this.heartbeat ??= setInterval(() => this.broadcast(': ping\n\n'), 25000)
      return new Response(readable, {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' },
      })
    }

    if (path === '/api/compositions' && method === 'GET') {
      const items = this.library.map(({ id, emoji, date }) => ({ id, emoji, date })).reverse()
      return json(200, { emojis: EMOJIS, items })
    }

    if (path === '/api/compositions' && method === 'POST') {
      const who = request.headers.get('CF-Connecting-IP') || 'unknown'
      const now = Date.now()
      if (now - (this.lastSave.get(who) || 0) < SAVE_COOLDOWN_MS) {
        return json(429, { error: 'Wait a moment before saving again.' })
      }
      const parsed = await readBody(request)
      const clean = validate(parsed?.song)
      if (!clean || !EMOJIS.includes(parsed?.emoji)) return json(400, { error: 'Invalid composition' })
      this.lastSave.set(who, now)
      if (this.lastSave.size > 5000) this.lastSave.clear()

      const id = crypto.randomUUID().replaceAll('-', '').slice(0, 12)
      const item = { id, emoji: parsed.emoji, date: new Date(now).toISOString() }
      // Keys sort by time, so storage lists compositions oldest first.
      const key = `c:${String(now).padStart(15, '0')}:${id}`
      this.library.push({ key, ...item, song: clean })
      await this.ctx.storage.put(key, { ...item, song: clean })
      while (this.library.length > MAX_COMPOSITIONS) {
        await this.ctx.storage.delete(this.library.shift().key)
      }
      return json(200, { item })
    }

    if (path.startsWith('/api/compositions/') && method === 'GET') {
      const found = this.library.find((c) => c.id === path.slice('/api/compositions/'.length))
      return found ? json(200, { song: found.song }) : json(404, { error: 'Not found' })
    }

    return json(404, { error: 'Not found' })
  }
}

export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname.startsWith('/api/')) {
      // One room for the whole site.
      return env.SONG.get(env.SONG.idFromName('main')).fetch(request)
    }
    return env.ASSETS.fetch(request)
  },
}
