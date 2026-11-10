import { useEffect, useRef, type MutableRefObject, type ReactNode } from 'react'
import type { Engine } from '../audio/engine'
import { TRACKS, education, experience, papers, profile, projects, type Entry, type TrackId } from '../data/content'

interface ScreenProps {
  track: number
  playing: boolean
  bpm: number
  engine: MutableRefObject<Engine | null>
  onSelect: (track: number) => void
  /** True when the song is saved on the server and shared with other visitors. */
  shared: boolean
  /** Replaces the keyboard hint in the footer (used while selecting steps). */
  hint?: string
  /** When set, replaces the section page (used for the save / browse menu). */
  overlay?: ReactNode
  overlayTitle?: string
}

export function Screen({ track, playing, bpm, engine, onSelect, shared, hint, overlay, overlayTitle }: ScreenProps) {
  const t = TRACKS[track]
  return (
    <section className="screen" aria-label={t.label}>
      <header className="screen-bar">
        <span className="screen-badge">T{track + 1}</span>
        <h2 className="screen-title">{overlay ? overlayTitle : t.label}</h2>
        <span className="screen-machine">{overlay ? 'MENU' : t.machine}</span>
        <Scope engine={engine} playing={playing} />
        <span className="screen-bpm">{bpm} BPM</span>
        <span className={`screen-play${playing ? ' is-on' : ''}`} aria-hidden="true">
          {playing ? '▶' : '■'}
        </span>
      </header>

      <div className="screen-body" key={overlay ? 'menu' : t.id}>
        {overlay ?? PAGES[t.id](onSelect)}
      </div>

      <footer className="screen-foot">
        <span>
          {String(track + 1).padStart(2, '0')}/{String(TRACKS.length).padStart(2, '0')}
        </span>
        <span className={`screen-foot-hint${hint ? ' is-live' : ''}`}>{hint ?? 'KEYS 1–6 SELECT · SPACE PLAY'}</span>
        <span className={`screen-sync${shared ? ' is-on' : ''}`}>{shared ? '● Shared song' : 'Local song'}</span>
      </footer>
    </section>
  )
}

const PAGES: Record<TrackId, (onSelect: (track: number) => void) => ReactNode> = {
  about: (onSelect) => <About onSelect={onSelect} />,
  experience: () => <Entries items={experience} />,
  projects: () => <Entries items={projects} />,
  papers: () => <Entries items={papers} />,
  education: () => <Education />,
  contact: () => <Contact />,
}

/* ---------- Pages ---------- */

function About({ onSelect }: { onSelect: (track: number) => void }) {
  return (
    <div className="page about">
      <p className="eyebrow">{profile.role}</p>
      <h1 className="hero-name">{profile.name}</h1>
      <p className="hero-tagline">{profile.tagline}</p>
      <p className="body-text">{profile.summary}</p>
      <p className="status-line">
        <i className="status-dot" />
        {profile.availability}
      </p>

      <dl className="facts">
        {profile.facts.map((f) => (
          <div key={f.k}>
            <dt>{f.k}</dt>
            <dd>{f.v}</dd>
          </div>
        ))}
      </dl>

      <div className="actions">
        <button className="btn btn-primary" onClick={() => onSelect(1)}>
          View experience
        </button>
        <a className="btn" href={profile.resume} target="_blank" rel="noreferrer">
          Résumé (PDF)
        </a>
        <a className="btn" href={profile.github} target="_blank" rel="noreferrer">
          GitHub ↗
        </a>
        <a className="btn" href={profile.linkedin} target="_blank" rel="noreferrer">
          LinkedIn ↗
        </a>
      </div>
    </div>
  )
}

/** A numbered list of one-sentence entries: used for experience, projects, and papers. */
function Entries({ items }: { items: Entry[] }) {
  return (
    <ol className="page entries">
      {items.map((e, i) => (
        <li className="entry" key={e.title}>
          <span className="entry-num">{String(i + 1).padStart(2, '0')}</span>
          <div className="entry-main">
            <p className="eyebrow">{e.meta}</p>
            <h3 className="entry-title">{e.title}</h3>
            <p className="entry-summary">{e.summary}</p>
            {e.byline && <p className="entry-byline">{highlightName(e.byline)}</p>}
            {(e.tags || e.links) && (
              <div className="entry-foot">
                {e.tags && <Chips items={e.tags} />}
                {e.links?.map((l) => (
                  <a className="entry-link" key={l.url} href={l.url} target="_blank" rel="noreferrer">
                    {l.label} ↗
                  </a>
                ))}
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}

/** Marks the site owner's name in an author list. */
function highlightName(byline: string): ReactNode {
  const [before, after] = byline.split(profile.name)
  if (after === undefined) return byline
  return (
    <>
      {before}
      <b>{profile.name}</b>
      {after}
    </>
  )
}

function Education() {
  return (
    <div className="page">
      <p className="eyebrow">{education.dates}</p>
      <h3 className="detail-title">{education.school}</h3>
      <p className="detail-sub">
        {education.degree} · {education.minor}
      </p>
      <dl className="facts facts-compact">
        <div>
          <dt>GPA</dt>
          <dd>{education.gpa}</dd>
        </div>
        <div>
          <dt>Graduating</dt>
          <dd>May 2027</dd>
        </div>
      </dl>
      <h3 className="eyebrow section-gap">Coursework</h3>
      <Chips items={education.coursework} />
    </div>
  )
}

function Contact() {
  const rows = [
    { k: 'Email', v: profile.email, href: `mailto:${profile.email}` },
    { k: 'GitHub', v: 'github.com/jrcagan', href: profile.github },
    { k: 'LinkedIn', v: 'linkedin.com/in/june-cagan', href: profile.linkedin },
    { k: 'Résumé', v: 'Download PDF', href: profile.resume },
  ]
  return (
    <div className="page">
      <p className="eyebrow">Get in touch</p>
      <h3 className="detail-title">Let’s talk.</h3>
      <p className="body-text">{profile.availability} Email is the fastest way to reach me.</p>
      <ul className="contact-list">
        {rows.map((r) => (
          <li key={r.k}>
            <a href={r.href} target={r.href.startsWith('mailto') ? undefined : '_blank'} rel="noreferrer">
              <span className="contact-k">{r.k}</span>
              <span className="contact-v">{r.v}</span>
              <span className="contact-arrow" aria-hidden="true">
                →
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Chips({ items }: { items: string[] }) {
  return (
    <ul className="chips">
      {items.map((i) => (
        <li key={i}>{i}</li>
      ))}
    </ul>
  )
}

/* ---------- Oscilloscope in the status bar ---------- */

function Scope({ engine, playing }: { engine: MutableRefObject<Engine | null>; playing: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const g = canvas?.getContext('2d')
    if (!canvas || !g) return
    const dpr = window.devicePixelRatio || 1
    const w = (canvas.width = canvas.clientWidth * dpr)
    const h = (canvas.height = canvas.clientHeight * dpr)
    const buf = new Uint8Array(256)
    let raf = 0
    let stopAt = 0

    const draw = () => {
      const analyser = engine.current?.analyser
      g.clearRect(0, 0, w, h)
      g.lineWidth = dpr
      g.strokeStyle = '#ffffff'
      g.beginPath()
      if (analyser) {
        analyser.getByteTimeDomainData(buf)
        for (let i = 0; i < buf.length; i++) {
          const x = (i / (buf.length - 1)) * w
          const y = h / 2 + ((buf[i] - 128) / 128) * h * 0.9
          if (i === 0) g.moveTo(x, y)
          else g.lineTo(x, y)
        }
      } else {
        g.moveTo(0, h / 2)
        g.lineTo(w, h / 2)
      }
      g.stroke()
      // Keep drawing briefly after stop so the tail of the delay is visible.
      if (playing || performance.now() < stopAt) raf = requestAnimationFrame(draw)
    }

    if (!playing) stopAt = performance.now() + 2500
    draw()
    return () => cancelAnimationFrame(raf)
  }, [engine, playing])

  return <canvas ref={ref} className="screen-scope" aria-hidden="true" />
}
