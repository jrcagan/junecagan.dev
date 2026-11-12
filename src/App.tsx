import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DEFAULT_BPM,
  DEFAULT_KEY,
  DEFAULT_LOCKS,
  DEFAULT_MACHINES,
  DEFAULT_PARAMS,
  DEFAULT_PATTERNS,
  Engine,
  MACHINE_NAMES,
  NO_LOCK,
  PAGES,
  PARAMS,
  STEPS,
  formatParam,
  isPitched,
  keyNames,
  moveInKey,
  scaleSteps,
  snapToKey,
  stepParams,
  type EngineState,
  type Locks,
} from './audio/engine'
import { Knob } from './components/Knob'
import { Screen } from './components/Screen'
import { SongMenu, type MenuMode } from './components/SongMenu'
import { TRACKS, profile } from './data/content'
import { useSharedSong, type Song } from './sync'

const clone = (rows: number[][]) => rows.map((r) => [...r])
const clonePatterns = (rows: boolean[][]) => rows.map((r) => [...r])
const cloneLocks = (rows: Locks): Locks => rows.map((r) => r.map((lock) => lock && [...lock]))

/** Copies a table, replacing the values in one row. */
const mapRow = <T,>(rows: T[][], row: number, f: (value: T, i: number) => T): T[][] =>
  rows.map((r, t) => (t === row ? r.map(f) : r))

function trackFromHash(): number {
  const i = TRACKS.findIndex((t) => t.id === window.location.hash.slice(1))
  return i < 0 ? 0 : i
}

export default function App() {
  const [track, setTrack] = useState(trackFromHash)
  const [patterns, setPatterns] = useState(() => clonePatterns(DEFAULT_PATTERNS))
  const [params, setParams] = useState(() => clone(DEFAULT_PARAMS))
  const [machines, setMachines] = useState(() => [...DEFAULT_MACHINES])
  const [locks, setLocks] = useState(() => cloneLocks(DEFAULT_LOCKS))
  const [bpm, setBpm] = useState(DEFAULT_BPM)
  const [key, setKeyState] = useState(DEFAULT_KEY)
  /** Whether the Key knob names the scale by its relative minor. Only the label changes. */
  const [minorLabel, setMinorLabel] = useState(false)
  const [volume, setVolume] = useState(100)
  const [playing, setPlaying] = useState(false)
  /** Step being played across all pages (0-63), or -1 when stopped. */
  const [step, setStep] = useState(-1)
  /** Pattern page shown on the step keys. */
  const [page, setPage] = useState(0)
  const [menu, setMenu] = useState<MenuMode | null>(null)
  /** Select mode: pressing step keys selects them for per-step knob edits instead of toggling them. */
  const [selecting, setSelecting] = useState(false)
  /** Selected steps on the current track, most recently selected last. */
  const [selected, setSelected] = useState<number[]>([])

  const engine = useRef<Engine | null>(null)
  // The audio scheduler reads the latest sequencer state through this ref.
  const live = useRef<EngineState>({ patterns, params, machines, bpm, key, locks, volume })
  live.current = { patterns, params, machines, bpm, key, locks, volume }

  const song: Song = { patterns, params, machines, bpm, key, locks }
  const applySong = useCallback((s: Song) => {
    setPatterns(s.patterns)
    setParams(s.params)
    setMachines(s.machines)
    setBpm(s.bpm)
    setKeyState(s.key)
    setLocks(s.locks)
  }, [])
  const shared = useSharedSong(song, applySong)

  const selectTrack = useCallback((i: number) => {
    setTrack(i)
    setMenu(null)
    setSelected([])
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
      } else if (e.key === 'Escape') {
        setSelecting(false)
        setSelected([])
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

  const sel = selected
  const isLocked = (p: number) => sel.some((s) => (locks[track][s]?.[p] ?? NO_LOCK) !== NO_LOCK)
  // With steps selected, the knobs show the most recently selected step.
  const raw = sel.length ? stepParams(params[track], locks[track][sel[sel.length - 1]]) : params[track]
  // TUNE on a pitched machine is held to the song's key, so show the note that actually plays.
  const pitched = isPitched(machines[track])
  const shown = pitched ? raw.map((v, p) => (p === 0 ? snapToKey(v, key) : v)) : raw

  const setStepOn = (s: number, value: boolean) => {
    setPatterns((prev) => (prev[track][s] === value ? prev : mapRow(prev, track, (on, i) => (i === s ? value : on))))
    if (!value) {
      // A step that is switched off loses its locks.
      setLocks((prev) => (prev[track][s] ? mapRow(prev, track, (lock, i) => (i === s ? null : lock)) : prev))
      setSelected((prev) => prev.filter((x) => x !== s))
    }
  }

  const setStepSelected = (s: number, value: boolean) =>
    setSelected((prev) => (value ? (prev.includes(s) ? prev : [...prev, s]) : prev.filter((x) => x !== s)))

  // Press a step and drag across others to paint them all on (or all off, if the
  // first step pressed was already on). In select mode, or with Shift held, the
  // same gesture selects steps instead.
  const paint = useRef<{ select: boolean; value: boolean } | null>(null)
  const stepAt = (x: number, y: number): number | null => {
    const key = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-step]')
    return key ? Number(key.dataset.step) : null
  }
  const paintStart = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    const s = stepAt(e.clientX, e.clientY)
    if (s === null) return
    if (selecting || e.shiftKey) {
      setSelecting(true)
      // Selecting never switches a step on or off.
      paint.current = { select: true, value: !sel.includes(s) }
      setStepSelected(s, paint.current.value)
    } else {
      paint.current = { select: false, value: !patterns[track][s] }
      setStepOn(s, paint.current.value)
    }
  }
  const paintMove = (e: React.PointerEvent) => {
    if (!paint.current) return
    const s = stepAt(e.clientX, e.clientY)
    if (s === null) return
    if (paint.current.select) setStepSelected(s, paint.current.value)
    else setStepOn(s, paint.current.value)
  }
  const paintEnd = () => (paint.current = null)

  // With steps selected, a knob locks its value on those steps only. Otherwise it
  // sets the track's value and moves every lock of that parameter by the same
  // amount, so a locked melody transposes with TUNE instead of ignoring it.
  const setParam = (p: number, v: number) => {
    // Read and update the ref directly: several knob events can arrive between renders.
    const now = live.current
    const tuned = p === 0 && isPitched(now.machines[track])
    // TUNE moves from one note of the key to the next, in the direction the knob turned.
    if (tuned) v = snapToKey(v, now.key, Math.sign(v - shown[p]))
    let nextParams = now.params
    let nextLocks: Locks
    if (sel.length) {
      nextLocks = mapRow(now.locks, track, (lock, i) => {
        if (!sel.includes(i)) return lock
        const next = lock ? [...lock] : Array<number>(PARAMS.length).fill(NO_LOCK)
        next[p] = v
        return next
      })
    } else {
      const old = now.params[track][p]
      if (v === old) return
      // Locked notes move by the same number of scale steps, so the melody stays in key.
      const steps = tuned ? scaleSteps(old, v, now.key) : 0
      const shift = (x: number) => (tuned ? moveInKey(x, steps, now.key) : Math.min(127, Math.max(0, x + v - old)))
      nextParams = mapRow(now.params, track, (x, i) => (i === p ? v : x))
      nextLocks = mapRow(now.locks, track, (lock) =>
        lock && lock[p] !== NO_LOCK ? lock.map((x, i) => (i === p ? shift(x) : x)) : lock,
      )
    }
    live.current = { ...now, params: nextParams, locks: nextLocks }
    setParams(nextParams)
    setLocks(nextLocks)
  }

  // Changing the key moves every pitched note in the song by the same interval
  // and lands it in the new scale.
  const setKey = (next: number) => {
    const now = live.current
    const delta = next - now.key
    if (!delta) return
    const move = (note: number) => snapToKey(Math.min(127, Math.max(0, note + delta)), next)
    const nextParams = now.params.map((row, t) =>
      isPitched(now.machines[t]) ? row.map((x, i) => (i === 0 ? move(x) : x)) : row,
    )
    const nextLocks = now.locks.map((row, t) =>
      isPitched(now.machines[t])
        ? row.map((lock) => (lock && lock[0] !== NO_LOCK ? lock.map((x, i) => (i === 0 ? move(x) : x)) : lock))
        : row,
    )
    live.current = { ...now, key: next, params: nextParams, locks: nextLocks }
    setKeyState(next)
    setParams(nextParams)
    setLocks(nextLocks)
  }

  /** Removes locks from the selected steps: one parameter, or all of them. */
  const unlock = (p?: number) =>
    setLocks((prev) =>
      mapRow(prev, track, (lock, i) => {
        if (!lock || !sel.includes(i) || p === undefined) return sel.includes(i) ? null : lock
        const next = lock.map((x, k) => (k === p ? NO_LOCK : x))
        return next.some((x) => x !== NO_LOCK) ? next : null
      }),
    )

  const toggleSelecting = () => {
    setSelecting(!selecting)
    setSelected([])
  }

  const cycleMachine = (dir: number) =>
    setMachines((prev) =>
      prev.map((m, t) => (t === track ? (m + dir + MACHINE_NAMES.length) % MACHINE_NAMES.length : m)),
    )

  const clearPage = () => {
    setPatterns((prev) => mapRow(prev, track, (on, i) => (onPage(i) ? false : on)))
    setLocks((prev) => mapRow(prev, track, (lock, i) => (onPage(i) ? null : lock)))
    setSelected((prev) => prev.filter((s) => !onPage(s)))
  }

  const reset = () => {
    setPatterns(clonePatterns(DEFAULT_PATTERNS))
    setParams(clone(DEFAULT_PARAMS))
    setMachines([...DEFAULT_MACHINES])
    setBpm(DEFAULT_BPM)
    setKeyState(DEFAULT_KEY)
    setLocks(cloneLocks(DEFAULT_LOCKS))
    setSelected([])
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
          <Knob label="Tempo" value={bpm} min={60} max={180} size={46} onChange={setBpm} />
          <Knob label="Volume" value={volume} size={46} onChange={setVolume} />
          <Knob
            label="Key"
            value={key}
            min={0}
            max={11}
            size={46}
            display={minorLabel ? keyNames(key).minor : keyNames(key).major}
            onDisplayClick={() => setMinorLabel(!minorLabel)}
            displayHint={`Show as ${minorLabel ? keyNames(key).major : keyNames(key).minor}`}
            onChange={setKey}
          />
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
          hint={
            !selecting
              ? undefined
              : sel.length
                ? `${sel.length} STEP${sel.length > 1 ? 'S' : ''} SELECTED · KNOBS CHANGE ONLY THESE`
                : 'PRESS STEPS TO SELECT THEM'
          }
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
              value={shown[p]}
              display={formatParam(p, shown[p])}
              locked={isLocked(p)}
              onChange={(v) => setParam(p, v)}
              onReset={() => unlock(p)}
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
            <button
              className={`key fn-key fn-select${selecting ? ' is-active' : ''}`}
              onClick={toggleSelecting}
              aria-pressed={selecting}
              aria-label="Select steps to change their sound one by one"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="5.5" y="5.5" width="13" height="13" rx="2" strokeDasharray="3.2 3.3" />
              </svg>
            </button>
            <span>Select</span>
          </div>
          <div className="fn">
            <button
              className="key fn-key"
              onClick={sel.length ? () => unlock() : clearPage}
              aria-label={
                sel.length ? 'Remove the per-step values from the selected steps' : "Clear this track's steps on this page"
              }
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="6.5" />
              </svg>
            </button>
            <span>{sel.length ? 'Unlock' : 'Clear'}</span>
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
          const picked = sel.includes(s)
          const locked = locks[track][s] !== null
          return (
            <button
              key={k}
              className={`key trig${on ? ' is-on' : ''}${s === step ? ' is-now' : ''}${picked ? ' is-sel' : ''}`}
              aria-pressed={on}
              aria-label={`Step ${k + 1}${picked ? ', selected' : ''}${locked ? ', has its own values' : ''}`}
              data-step={s}
              // Pointer presses are handled by the drag-paint handlers above;
              // this covers keyboard activation (Enter / Space), where detail is 0.
              onClick={(e) => {
                if (e.detail !== 0) return
                if (selecting) setStepSelected(s, !picked)
                else setStepOn(s, !on)
              }}
            >
              {locked && <i className="trig-lock" />}
              <span>{k + 1}</span>
            </button>
          )
        })}
      </div>

      <footer className="foot">
        <h2 className="foot-title">Some notes :D</h2>
        <span>
          Each section of the site is its own track! You can click the step keys to choose where you want notes across {PAGES} pages. {shared ? 'Your changes to the sounds and pattern will stay for the next visitor!' : '.'}
        </span>
      </footer>
    </main>
  )
}
