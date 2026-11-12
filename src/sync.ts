import { useEffect, useRef, useState } from 'react'
import type { Locks } from './audio/engine'

export interface Song {
  patterns: boolean[][]
  params: number[][]
  machines: number[]
  bpm: number
  /** Tonic of the song's major scale, 0 = C ... 11 = B. */
  key: number
  locks: Locks
}

/** A saved composition as listed by the server: an emoji and a date, never a name. */
export interface Composition {
  id: string
  emoji: string
  date: string
}

const clientId = Math.random().toString(36).slice(2)

const pick = ({ patterns, params, machines, bpm, key, locks }: Song): Song => ({
  patterns,
  params,
  machines,
  bpm,
  key,
  locks,
})

/**
 * Keeps the song in step with the server: loads the saved song on arrival, sends
 * local edits, and applies other visitors' edits as they happen. If the site is
 * hosted without the server (plain static hosting), it quietly stays local.
 *
 * Returns true while the song is shared.
 */
export function useSharedSong(song: Song, apply: (song: Song) => void): boolean {
  const [shared, setShared] = useState(false)
  // JSON of the last state known to match the server, so we only send real local edits.
  const synced = useRef(JSON.stringify(pick(song)))
  const applyRef = useRef(apply)
  applyRef.current = apply

  useEffect(() => {
    let events: EventSource | undefined
    let cancelled = false

    const receive = (incoming: Song | null) => {
      if (!incoming) return
      synced.current = JSON.stringify(pick(incoming))
      applyRef.current(incoming)
    }

    fetch('api/song')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: { song: Song | null }) => {
        if (cancelled) return
        receive(data.song)
        setShared(true)
        events = new EventSource('api/song/events')
        events.onmessage = (e) => {
          const msg = JSON.parse(e.data) as { song: Song; from: string }
          if (msg.from !== clientId) receive(msg.song)
        }
      })
      .catch(() => setShared(false))

    return () => {
      cancelled = true
      events?.close()
    }
  }, [])

  const json = JSON.stringify(pick(song))

  useEffect(() => {
    if (!shared || json === synced.current) return
    // Short debounce so a knob drag sends a handful of updates, not hundreds.
    const timer = window.setTimeout(() => {
      synced.current = json
      void fetch('api/song', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: `{"song":${json},"from":"${clientId}"}`,
      }).catch(() => {})
    }, 120)
    return () => window.clearTimeout(timer)
  }, [json, shared])

  return shared
}

/* ---------- Saved compositions ---------- */

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Something went wrong.')
  return data as T
}

export const listCompositions = () => request<{ emojis: string[]; items: Composition[] }>('api/compositions')

export const loadComposition = (id: string) =>
  request<{ song: Song }>(`api/compositions/${encodeURIComponent(id)}`).then((d) => d.song)

export const saveComposition = (emoji: string, song: Song) =>
  request<{ item: Composition }>('api/compositions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emoji, song: pick(song) }),
  }).then((d) => d.item)
