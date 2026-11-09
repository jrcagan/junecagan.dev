import { useEffect, useState } from 'react'
import { listCompositions, loadComposition, saveComposition, type Composition, type Song } from '../sync'

export type MenuMode = 'save' | 'songs'

interface SongMenuProps {
  mode: MenuMode
  song: Song
  onMode: (mode: MenuMode) => void
  onLoad: (song: Song) => void
  onClose: () => void
}

const day = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
const time = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

/** Shown on the screen in place of the section page: save the current song, or load a saved one. */
export function SongMenu({ mode, song, onMode, onLoad, onClose }: SongMenuProps) {
  const [emojis, setEmojis] = useState<string[]>([])
  const [items, setItems] = useState<Composition[] | null>(null)
  const [emoji, setEmoji] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    listCompositions()
      .then((d) => {
        setEmojis(d.emojis)
        setItems(d.items)
      })
      .catch(() => setNote('Could not reach the server.'))
  }, [mode])

  const save = async () => {
    if (!emoji) return
    setBusy(true)
    try {
      const item = await saveComposition(emoji, song)
      setNote(`Saved ${item.emoji} ${day(item.date)}`)
      setEmoji(null)
      onMode('songs')
    } catch (e) {
      setNote((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const load = async (id: string) => {
    try {
      onLoad(await loadComposition(id))
      onClose()
    } catch (e) {
      setNote((e as Error).message)
    }
  }

  return (
    <div className="page">
      <div className="menu-tabs">
        <button className={`btn${mode === 'save' ? ' btn-primary' : ''}`} onClick={() => onMode('save')}>
          Save song
        </button>
        <button className={`btn${mode === 'songs' ? ' btn-primary' : ''}`} onClick={() => onMode('songs')}>
          Saved songs
        </button>
        <button className="btn" onClick={onClose}>
          Close
        </button>
      </div>

      {mode === 'save' ? (
        <>
          <p className="eyebrow">Pick a symbol</p>
          <p className="body-text">
            Songs are saved under a symbol and today’s date instead of a name. Everyone who visits can load it.
          </p>
          <div className="emoji-grid" role="radiogroup" aria-label="Symbol">
            {emojis.map((e) => (
              <button
                key={e}
                role="radio"
                aria-checked={e === emoji}
                className={`emoji-key${e === emoji ? ' is-active' : ''}`}
                onClick={() => setEmoji(e)}
              >
                {e}
              </button>
            ))}
          </div>
          <div className="actions">
            <button className="btn btn-primary" disabled={!emoji || busy} onClick={save}>
              {emoji ? `Save as ${emoji}` : 'Save'}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="eyebrow">Load a song — it replaces the current one</p>
          {items && items.length === 0 && <p className="body-text">No saved songs yet. Save the first one.</p>}
          <ul className="song-grid">
            {items?.map((c) => (
              <li key={c.id}>
                <button className="song-tile" onClick={() => load(c.id)} aria-label={`${c.emoji} saved ${day(c.date)}`}>
                  <span className="song-emoji">{c.emoji}</span>
                  <span className="song-date">
                    {day(c.date)}
                    <small>{time(c.date)}</small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="menu-note" role="status">
        {note}
      </p>
    </div>
  )
}
