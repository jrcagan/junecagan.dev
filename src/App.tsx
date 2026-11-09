import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DEFAULT_BPM,
  DEFAULT_MACHINES,
  DEFAULT_PARAMS,
  DEFAULT_PATTERNS,
  Engine,
  MACHINE_NAMES,
  PAGES,
  PARAMS,
  STEPS,
  formatParam,
  type EngineState,
} from './audio/engine'
import { Knob } from './components/Knob'
import { Screen } from './components/Screen'
import { SongMenu, type MenuMode } from './components/SongMenu'
import { TRACKS, profile } from './data/content'
import { useSharedSong, type Song } from './sync'

const clone = (rows: number[][]) => rows.map((r) => [...r])
const clonePatterns = (rows: boolean[][]) => rows.map((r) => [...r])

function trackFromHash(): number {
  const i = TRACKS.findIndex((t) => t.id === window.location.hash.slice(1))
  return i < 0 ? 0 : i
}

export default function App() {
  const [track, setTrack] = useState(trackFromHash)
  const [patterns, setPatterns] = useState(() => clonePatterns(DEFAULT_PATTERNS))
  const [params, setParams] = useState(() => clone(DEFAULT_PARAMS))
  const [machines, setMachines] = useState(() => [...DEFAULT_MACHINES])
  const [bpm, setBpm] = useState(DEFAULT_BPM)
  const [volume, setVolume] = useState(100)
  const [playing, setPlaying] = useState(false)
  /** Step being played across all pages (0-63), or -1 when stopped. */
  const [step, setStep] = useState(-1)
  /** Pattern page shown on the step keys. */
  const [page, setPage] = useState(0)
  const [menu, setMenu] = useState<MenuMode | null>(null)

  const engine = useRef<Engine | null>(null)
  // The audio scheduler reads the latest sequencer state through this ref.
  const live = useRef<EngineState>({ patterns, params, machines, bpm, volume })
  live.current = { patterns, params, machines, bpm, volume }

  const song: Song = { patterns, params, machines, bpm }
  const applySong = useCallback((s: Song) => {
    setPatterns(s.patterns)
    setParams(s.params)
    setMachines(s.machines)
    setBpm(s.bpm)
  }, [])
  const shared = useSharedSong(song, applySong)

  const selectTrack = useCallback((i: number) => {
    setTrack(i)
    setMenu(null)
    window.history.replaceState(null, '', `#${TRACKS[i].id}`)
  }, [])

  const togglePlay = useCallback(() => {
    // Created on first press: browsers only allow audio after a user gesture.
    engine.current ??= new Engine(() => live.current, setStep)
    if (engine.current.running) {
      engine.current.stop()
      setPlaying(false)
      setStep(-1)
    } else {
      engine.current.start()
      setPlaying(true)
    }
  }, [])

  useEffect(() => engine.current?.setVolume(volume), [volume])

  useEffect(
    () => () => {
      engine.current?.dispose()
      engine.current = null
    },
    [],
  )

  useEffect(() => {
    const onHash = () => setTrack(trackFromHash())
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const el = e.target as HTMLElement
      const n = Number(e.key)
      if (n >= 1 && n <= TRACKS.length) {
        selectTrack(n - 1)
      } else if (e.code === 'Space' && !['BUTTON', 'A', 'INPUT'].includes(el.tagName)) {
        e.preventDefault()
        togglePlay()
      }
    }
    window.addEventListener('hashchange', onHash)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('hashchange', onHash)
      window.removeEventListener('keydown', onKey)
    }
  }, [selectTrack, togglePlay])

  const first = page * STEPS // index of the first step on the visible page
  const onPage = (i: number) => i >= first && i < first + STEPS

  const setStepOn = (s: number, value: boolean) =>
    setPatterns((prev) =>
      prev[track][s] === value
        ? prev
        : prev.map((row, t) => (t === track ? row.map((on, i) => (i === s ? value : on)) : row)),
    )

  // Press a step and drag across others to paint them all on (or all off,
  // if the first step pressed was already on).
  const paint = useRef<boolean | null>(null)
  const stepAt = (x: number, y: number): number | null => {
    const key = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-step]')
    return key ? Number(key.dataset.step) : null
  }
  const paintStart = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    const s = stepAt(e.clientX, e.clientY)
    if (s === null) return
    paint.current = !patterns[track][s]
    setStepOn(s, paint.current)
  }
  const paintMove = (e: React.PointerEvent) => {
    if (paint.current === null) return
    const s = stepAt(e.clientX, e.clientY)
    if (s !== null) setStepOn(s, paint.current)
  }
  const paintEnd = () => (paint.current = null)

  const setParam = (p: number, v: number) =>
    setParams((prev) => prev.map((row, t) => (t === track ? row.map((old, i) => (i === p ? v : old)) : row)))

  const cycleMachine = (dir: number) =>
    setMachines((prev) =>
      prev.map((m, t) => (t === track ? (m + dir + MACHINE_NAMES.length) % MACHINE_NAMES.length : m)),
    )

  const clearPage = () =>
    setPatterns((prev) => prev.map((row, t) => (t === track ? row.map((on, i) => (onPage(i) ? false : on)) : row)))

  const reset = () => {
    setPatterns(clonePatterns(DEFAULT_PATTERNS))
    setParams(clone(DEFAULT_PARAMS))
    setMachines([...DEFAULT_MACHINES])
    setBpm(DEFAULT_BPM)
  }

  const playPage = step < 0 ? -1 : Math.floor(step / STEPS)
  const pageUsed = (p: number) => patterns.some((row) => row.slice(p * STEPS, (p + 1) * STEPS).some(Boolean))

  return (
    <main className="chassis">
      <span className="screw screw-tl" />
      <span className="screw screw-tr" />
      <span className="screw screw-bl" />
      <span className="screw screw-br" />

      <header className="top">
        <nav className="ports" aria-label="Links">
          <a href={profile.github} target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a href={profile.linkedin} target="_blank" rel="noreferrer">
            LinkedIn
          </a>
          <a href={profile.resume} target="_blank" rel="noreferrer">
            Résumé
          </a>
          <a href={`mailto:${profile.email}`}>Email</a>
        </nav>
        <span className="mark" aria-hidden="true">
          JC
        </span>
      </header>

      <div className="side">
        <div className="side-knobs">
          <Knob label="Tempo" value={bpm} min={60} max={180} onChange={setBpm} />
          <Knob label="Volume" value={volume} onChange={setVolume} />
        </div>
        <nav className="tracks" aria-label="Sections">
          {TRACKS.map((t, i) => (
            <button
              key={t.id}
              className={`key track-key${i === track ? ' is-active' : ''}`}
              aria-current={i === track ? 'page' : undefined}
              onClick={() => selectTrack(i)}
            >
              <span className="track-num">{i + 1}</span>
              <span className="track-label">{t.label}</span>
              <i className={`dot${patterns[i][step] ? ' is-hit' : ''}`} />
            </button>
          ))}
        </nav>
      </div>

      <div className="bezel">
        <Screen
          track={track}
          playing={playing}
          bpm={bpm}
          engine={engine}
          onSelect={selectTrack}
          shared={shared}
          overlayTitle={menu === 'save' ? 'Save song' : 'Saved songs'}
          overlay={
            menu && (
              <SongMenu mode={menu} song={song} onMode={setMenu} onLoad={applySong} onClose={() => setMenu(null)} />
            )
          }
        />
        <div className="bezel-name">
          {profile.name} <em>JC-6</em>
        </div>
      </div>

      <aside className="controls" aria-label="Sound controls">
        <div className="knob-grid">
          {PARAMS.map((name, p) => (
            <Knob
              key={name}
              label={name}
              value={params[track][p]}
              display={formatParam(p, params[track][p])}
              onChange={(v) => setParam(p, v)}
            />
          ))}
        </div>

        <div className="machine">
          <button className="key mini" onClick={() => cycleMachine(-1)} aria-label="Previous machine">
            ‹
          </button>
          <span className="machine-name" aria-live="polite">
            <small>Track {track + 1} machine</small>
            <b>{MACHINE_NAMES[machines[track]]}</b>
          </span>
          <button className="key mini" onClick={() => cycleMachine(1)} aria-label="Next machine">
            ›
          </button>
        </div>

        <div className="pages" role="group" aria-label="Pattern page">
          {Array.from({ length: PAGES }, (_, p) => (
            <button
              key={p}
              className={`key page-key${p === page ? ' is-active' : ''}${p === playPage ? ' is-playing' : ''}${
                pageUsed(p) ? '' : ' is-empty'
              }`}
              aria-pressed={p === page}
              aria-label={`Pattern page ${p + 1} of ${PAGES}`}
              onClick={() => setPage(p)}
            >
              <i className="dot" />
              {p + 1}:{PAGES}
            </button>
          ))}
        </div>

        <div className="transport">
          <div className="fn">
            <button
              className={`key fn-key fn-play${playing ? ' is-active' : ''}`}
              onClick={togglePlay}
              aria-pressed={playing}
              aria-label={playing ? 'Stop' : 'Play'}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                {playing ? <rect x="6" y="6" width="12" height="12" rx="1.5" /> : <path d="M8 5.5v13l10.5-6.5z" />}
              </svg>
            </button>
            <span>{playing ? 'Stop' : 'Play'}</span>
          </div>
          <div className="fn">
            <button className="key fn-key" onClick={clearPage} aria-label="Clear this track's steps on this page">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="6.5" />
              </svg>
            </button>
            <span>Clear</span>
          </div>
          <div className="fn">
            <button className="key fn-key" onClick={reset} aria-label="Reload the default song">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18 8.5A7 7 0 1 0 19 12M18.5 4v4.5H14" />
              </svg>
            </button>
            <span>Reload</span>
          </div>
          <div className="fn">
            <button
              className="key fn-key"
              disabled={!shared}
              onClick={() => setMenu(menu === 'save' ? null : 'save')}
              aria-label="Save this song"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 5v9M8 10.5l4 4 4-4M6 18.5h12" />
              </svg>
            </button>
            <span>Save</span>
          </div>
          <div className="fn">
            <button
              className="key fn-key"
              disabled={!shared}
              onClick={() => setMenu(menu === 'songs' ? null : 'songs')}
              aria-label="Browse saved songs"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 7.5h12M6 12h12M6 16.5h12" />
              </svg>
            </button>
            <span>Songs</span>
          </div>
        </div>
      </aside>

      <div
        className="trigs"
        role="group"
        aria-label={`Steps for track ${track + 1}, page ${page + 1}`}
        onPointerDown={paintStart}
        onPointerMove={paintMove}
        onPointerUp={paintEnd}
        onPointerCancel={paintEnd}
        onPointerLeave={(e) => e.pointerType === 'mouse' && e.buttons === 0 && paintEnd()}
      >
        {Array.from({ length: STEPS }, (_, k) => {
          const s = first + k
          const on = patterns[track][s]
          return (
            <button
              key={k}
              className={`key trig${on ? ' is-on' : ''}${s === step ? ' is-now' : ''}`}
              aria-pressed={on}
              aria-label={`Step ${k + 1}`}
              data-step={s}
              // Pointer presses are handled by the drag-paint handlers above;
              // this covers keyboard activation (Enter / Space), where detail is 0.
              onClick={(e) => e.detail === 0 && setStepOn(s, !on)}
            >
              <span>{k + 1}</span>
            </button>
          )
        })}
      </div>

      <footer className="foot">
        <span>
          Each section is a track. <b>Play</b> starts the pattern, the step keys rewrite it across {PAGES} pages, the
          knobs shape the sound{shared ? ' — and your changes stay for the next visitor.' : '.'}
        </span>
        <span>React · TypeScript · Web Audio</span>
      </footer>
    </main>
  )
}
