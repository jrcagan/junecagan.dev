// A six-track step sequencer on the Web Audio API, voiced after the machine
// families of early-2000s digital hardware synths: sine and noise generators,
// a SID-style pulse voice, a detuned saw stack, two-operator FM, and single-cycle
// digital wavetables. Each track runs one machine. Knob values are 0-127.

export const STEPS = 16 // steps per page
export const PAGES = 4
export const TOTAL_STEPS = STEPS * PAGES

export type Machine = 'GND SIN' | 'GND NOIS' | 'SID' | 'SWAVE' | 'FM+' | 'DPRO' | 'VO'

/** Every machine a track can run; songs store an index into this list. */
export const MACHINE_NAMES: Machine[] = ['GND SIN', 'GND NOIS', 'SID', 'SWAVE', 'FM+', 'DPRO', 'VO']

/** Machine on each of the six tracks in the default song. */
export const DEFAULT_MACHINES: number[] = [0, 1, 2, 3, 4, 1]

// COLOR and MOD mean different things per machine:
//   GND SIN   drive                 / pitch sweep
//   GND NOIS  highpass              / pitch sweep
//   SID       pulse width           / pitch sweep
//   SWAVE     detune spread         / pitch sweep
//   FM+       modulator ratio       / FM depth
//   DPRO      wavetable select      / pitch sweep
//   VO        vowel (A-E-I-O-U)     / pitch sweep
export const PARAMS = ['TUNE', 'COLOR', 'MOD', 'DECAY', 'CUTOFF', 'RESO', 'DELAY', 'LEVEL'] as const
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

const P = { tune: 0, color: 1, mod: 2, decay: 3, cutoff: 4, reso: 5, delay: 6, level: 7 }

export const DEFAULT_BPM = 119

/** Tonic of the song's major scale, 0 = C ... 11 = B. The default song is in G major (E minor). */
export const DEFAULT_KEY = 7

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11]
const inKey = (note: number, key: number) => MAJOR_SCALE.includes((((note - key) % 12) + 12) % 12)

/**
 * The closest note in the key's major scale. dir picks which way to look:
 * 1 = at or above, -1 = at or below, 0 = nearest (the lower one on a tie).
 */
export function snapToKey(note: number, key: number, dir = 0): number {
  for (let d = 0; d < 12; d++) {
    const below = note - d
    const above = note + d
    if (dir <= 0 && below >= 0 && inKey(below, key)) return below
    if (dir >= 0 && above <= 127 && inKey(above, key)) return above
  }
  // Ran off the end of the range: take the nearest note in the other direction.
  return snapToKey(Math.min(127, Math.max(0, note)), key, -dir)
}

/** Moves a note up or down the key's scale by a number of scale steps. */
export function moveInKey(note: number, steps: number, key: number): number {
  let n = snapToKey(note, key)
  for (let i = 0; i < Math.abs(steps); i++) {
    const next = n + Math.sign(steps)
    if (next < 0 || next > 127) break
    n = snapToKey(next, key, Math.sign(steps))
  }
  return n
}

/** Scale steps from one note to another (both snapped to the key first). */
export function scaleSteps(from: number, to: number, key: number): number {
  const a = snapToKey(from, key)
  const b = snapToKey(to, key)
  let steps = 0
  for (let n = Math.min(a, b) + 1; n <= Math.max(a, b); n++) if (inKey(n, key)) steps++
  return b >= a ? steps : -steps
}

/** Machines whose TUNE is a musical pitch (noise uses it as texture, so it is left alone). */
export const isPitched = (machine: number) => MACHINE_NAMES[machine] !== 'GND NOIS'

/** Name of a key's major scale and of its relative minor. */
export const keyNames = (key: number) => ({
  major: `${NOTE_NAMES[key]} maj`,
  minor: `${NOTE_NAMES[(key + 9) % 12]} min`,
})

// The default song is a trance loop in E minor: a driven four-on-the-floor
// kick, offbeat hats, a rolling bass, a supersaw lead, an FM pluck arpeggio, and
// a clap that turns into a roll at the end of the fourth page.
//                                    TUNE COLOR MOD DECAY CUT  RESO DELAY LEVEL
export const DEFAULT_PARAMS: number[][] = [
  /* T1 GND SIN  kick  */ [28, 80, 100, 124, 123, 0, 0, 124],
  /* T2 GND NOIS hat   */ [84, 100, 0, 20, 127, 0, 10, 46],
  /* T3 SID      bass  */ [40, 40, 0, 24, 62, 50, 0, 96],
  /* T4 SWAVE    lead  */ [52, 99, 1, 85, 89, 79, 71, 77],
  /* T5 FM+      pluck */ [76, 40, 40, 34, 120, 0, 70, 50],
  /* T6 GND NOIS clap  */ [64, 50, 0, 34, 108, 14, 22, 70],
]

const FLOOR = [0, 4, 8, 12]
const OFFBEAT = [2, 6, 10, 14]
const ROLLING = [1, 2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15]
const LEAD_STEPS = [0, 3, 6, 8, 11, 14]
const PLUCK_SPARSE = [1, 2, 5, 7, 9, 10, 13, 15]
const PLUCK_FULL = [1, 2, 4, 5, 7, 9, 10, 12, 13, 15]

// SONG[track][page] = steps that are on.
const SONG: number[][][] = [
  [FLOOR, FLOOR, FLOOR, [0, 4, 8]], // the last kick drops out under the clap roll
  [OFFBEAT, OFFBEAT, [...OFFBEAT, 7, 15], [...OFFBEAT, 7, 15]],
  [ROLLING, ROLLING, ROLLING, ROLLING],
  [[0, 6], [0, 6, 14], [0, 6, 14], LEAD_STEPS], // the lead fills in page by page
  [PLUCK_SPARSE, PLUCK_SPARSE, PLUCK_FULL, PLUCK_FULL],
  [[4, 12], [4, 12], [4, 12], [4, 8, 10, 12, 13, 14, 15]],
]

export const DEFAULT_PATTERNS: boolean[][] = SONG.map((pages) =>
  Array.from({ length: TOTAL_STEPS }, (_, i) => pages[Math.floor(i / STEPS)].includes(i % STEPS)),
)

/** Steps the sequencer loops over: everything up to the last page that has a step on it. */
export function patternLength(patterns: boolean[][]): number {
  for (let page = PAGES - 1; page > 0; page--) {
    if (patterns.some((row) => row.slice(page * STEPS, (page + 1) * STEPS).some(Boolean))) {
      return (page + 1) * STEPS
    }
  }
  return STEPS
}

/**
 * Per-step overrides ("parameter locks"). locks[track][step] is null, or one value
 * per parameter for that step alone, where NO_LOCK means "use the track's knob".
 */
export type Locks = (number[] | null)[][]
export const NO_LOCK = -1

export const emptyLocks = (): Locks =>
  Array.from({ length: DEFAULT_PATTERNS.length }, () => Array<number[] | null>(TOTAL_STEPS).fill(null))

/** The parameters a step actually plays: the track's knobs with the step's locks on top. */
export function stepParams(params: number[], lock: number[] | null): number[] {
  return lock ? params.map((v, i) => (lock[i] === NO_LOCK ? v : lock[i])) : params
}

// The default melodies, written as semitones above each track's TUNE and turned
// into TUNE locks below. The harmony changes once per page and every chord is
// minor: E minor, A minor, E minor, B minor.
const ROOTS = [0, -7, 0, -5]
const CHORDS = [
  [0, 3, 7, 12],
  [0, 5, 8, 12],
  [0, 3, 7, 12],
  [-2, 2, 7, 10],
]
// The lead melody, one row per page.
const MELODY: number[][] = [
  [7, 7, 7, 7, 7, 7, 3, 3, 7, 7, 7, 10, 10, 10, 7, 7],
  [8, 8, 8, 8, 8, 8, 5, 5, 8, 8, 8, 12, 12, 12, 8, 8],
  [12, 12, 12, 12, 12, 12, 7, 7, 12, 12, 12, 15, 15, 15, 12, 12],
  [10, 10, 10, 10, 10, 10, 7, 7, 10, 10, 10, 14, 14, 14, 8, 8],
]
const ARP_ORDER = [0, 1, 2, 3, 2, 1]

const perStep = (note: (page: number, step: number) => number) =>
  Array.from({ length: TOTAL_STEPS }, (_, i) => note(Math.floor(i / STEPS), i % STEPS))

const NOTES: number[][] = [
  perStep(() => 0),
  perStep(() => 0),
  perStep((page) => ROOTS[page]),
  perStep((page, step) => MELODY[page][step]),
  perStep((page, step) => CHORDS[page][ARP_ORDER[step % ARP_ORDER.length]]),
  perStep(() => 0),
]

export const DEFAULT_LOCKS: Locks = DEFAULT_PATTERNS.map((row, t) =>
  row.map((on, i) => {
    if (!on || NOTES[t][i] === 0) return null
    const lock = Array<number>(PARAMS.length).fill(NO_LOCK)
    lock[P.tune] = DEFAULT_PARAMS[t][P.tune] + NOTES[t][i]
    return lock
  }),
)

const LEVEL_TRIM: Record<Machine, number> = {
  'GND SIN': 1,
  'GND NOIS': 0.5,
  SID: 0.4,
  SWAVE: 0.22,
  'FM+': 0.55,
  DPRO: 0.5,
  VO: 1.1,
}

const FM_RATIOS = [0.5, 1, 2, 3, 3.5, 5, 7]

// First three formant frequencies (Hz) for A, E, I, O, U.
const VOWELS = [
  [800, 1150, 2900],
  [400, 1700, 2600],
  [270, 2140, 2950],
  [450, 800, 2830],
  [325, 700, 2700],
]

// Harmonic recipes for the DPRO single-cycle waves (amplitude of harmonic n).
const WAVETABLES: ((n: number) => number)[] = [
  (n) => (n % 2 ? 1 / n : 0.08 / n), // hollow
  (n) => (n % 4 < 2 ? 1 / n : 0.1 / n), // nasal pulse
  (n) => Math.exp(-((n - 6) ** 2) / 8) + 0.3 / n, // formant bump
  (n) => (n <= 14 ? 1 / Math.sqrt(n) : 0), // bright, band-limited
  (n) => Math.abs(Math.sin(n * 12.9898) * 0.9) / Math.sqrt(n), // jagged
  (n) => ([1, 3, 4, 7, 11, 16].includes(n) ? 1 / Math.sqrt(n) : 0), // glassy
]

export function formatParam(param: number, v: number): string {
  if (param === P.tune) return `${NOTE_NAMES[v % 12]}${Math.floor(v / 12) - 1}`
  return String(v)
}

export interface EngineState {
  patterns: boolean[][]
  params: number[][]
  machines: number[]
  bpm: number
  key: number
  locks: Locks
  volume: number
}

export class Engine {
  readonly ctx: AudioContext
  readonly analyser: AnalyserNode
  running = false

  private master: GainNode
  private delayIn: GainNode
  private delay: DelayNode
  private noise: AudioBuffer
  private waves: PeriodicWave[]
  private timer: number | undefined
  private step = 0
  private nextTime = 0

  constructor(
    private read: () => EngineState,
    private onStep: (step: number) => void,
  ) {
    const Ctor: typeof AudioContext =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = (this.ctx = new Ctor())

    this.master = ctx.createGain()
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -14
    comp.ratio.value = 4
    this.analyser = ctx.createAnalyser()
    this.analyser.fftSize = 512
    this.master.connect(comp).connect(this.analyser).connect(ctx.destination)

    // Feedback delay with a darkening filter in the loop.
    this.delayIn = ctx.createGain()
    this.delay = ctx.createDelay(2)
    const feedback = ctx.createGain()
    feedback.gain.value = 0.42
    const tone = ctx.createBiquadFilter()
    tone.type = 'lowpass'
    tone.frequency.value = 2600
    this.delayIn.connect(this.delay)
    this.delay.connect(tone).connect(feedback).connect(this.delay)
    tone.connect(this.master)

    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const data = this.noise.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1

    this.waves = WAVETABLES.map((amp) => {
      const imag = new Float32Array(33)
      for (let n = 1; n < imag.length; n++) imag[n] = amp(n)
      return ctx.createPeriodicWave(new Float32Array(33), imag)
    })

    this.setVolume(read().volume)
  }

  setVolume(v: number) {
    this.master.gain.setTargetAtTime((v / 127) ** 2 * 0.9, this.ctx.currentTime, 0.02)
  }

  start() {
    if (this.running) return
    void this.ctx.resume()
    this.running = true
    this.step = 0
    this.nextTime = this.ctx.currentTime + 0.06
    this.timer = window.setInterval(() => this.tick(), 25)
    this.tick()
  }

  stop() {
    this.running = false
    window.clearInterval(this.timer)
  }

  dispose() {
    this.stop()
    void this.ctx.close()
  }

  // Look-ahead scheduler: queue every step that starts within the next 100 ms.
  private tick() {
    const { patterns, params, machines, bpm, key, locks } = this.read()
    const length = patternLength(patterns)
    const stepDur = 60 / bpm / 4
    this.delay.delayTime.setTargetAtTime(stepDur * 3, this.ctx.currentTime, 0.05)

    while (this.nextTime < this.ctx.currentTime + 0.1) {
      if (this.step >= length) this.step = 0
      const step = this.step
      const time = this.nextTime
      patterns.forEach((row, t) => {
        if (row[step]) this.trigger(MACHINE_NAMES[machines[t]], stepParams(params[t], locks[t][step]), key, time)
      })
      window.setTimeout(
        () => this.running && this.onStep(step),
        Math.max(0, (time - this.ctx.currentTime) * 1000),
      )
      this.nextTime += stepDur
      this.step = (step + 1) % length
    }
  }

  private trigger(machine: Machine, p: number[], key: number, t: number) {
    const ctx = this.ctx
    // Pitched machines always play a note of the song's key.
    const note = machine === 'GND NOIS' ? p[P.tune] : snapToKey(p[P.tune], key)
    const freq = 440 * 2 ** ((note - 69) / 12)
    const color = p[P.color] / 127
    const mod = p[P.mod] / 127
    const decay = 0.03 + (p[P.decay] / 127) ** 2 * 1.6
    const sweep = machine === 'FM+' ? 0 : mod

    const pre = ctx.createGain()
    const sources: AudioScheduledSourceNode[] = []

    const osc = (shape: OscillatorType | PeriodicWave, f: number, cents = 0) => {
      const o = ctx.createOscillator()
      if (typeof shape === 'string') o.type = shape as OscillatorType
      else o.setPeriodicWave(shape)
      o.detune.value = cents
      o.frequency.setValueAtTime(f * (1 + sweep * 8), t)
      o.frequency.exponentialRampToValueAtTime(f, t + 0.015 + sweep * 0.08)
      sources.push(o)
      return o
    }

    switch (machine) {
      case 'GND SIN': {
        // Sine through a soft clipper; COLOR is drive.
        const shaper = ctx.createWaveShaper()
        const drive = 1 + color * 6
        const curve = new Float32Array(257)
        for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh(((i - 128) / 128) * drive)
        shaper.curve = curve
        osc('sine', freq).connect(shaper).connect(pre)
        break
      }
      case 'GND NOIS': {
        // Noise replayed at a pitched rate, so TUNE changes its grain.
        const n = ctx.createBufferSource()
        n.buffer = this.noise
        n.loop = true
        n.playbackRate.value = Math.min(4, Math.max(0.05, 2 ** ((note - 72) / 12)))
        const hp = ctx.createBiquadFilter()
        hp.type = 'highpass'
        hp.frequency.value = 200 * 2 ** (color * 5.5)
        n.connect(hp).connect(pre)
        sources.push(n)
        break
      }
      case 'SID': {
        // Pulse wave = saw minus a delayed copy of itself. COLOR sets the width
        // and a slow LFO wobbles it for pulse-width modulation.
        const saw = osc('sawtooth', freq)
        const shift = ctx.createDelay(0.1)
        shift.delayTime.value = (0.08 + color * 0.42) / freq
        const invert = ctx.createGain()
        invert.gain.value = -1
        const lfo = ctx.createOscillator()
        lfo.frequency.value = 5.5
        const lfoDepth = ctx.createGain()
        lfoDepth.gain.value = 0.06 / freq
        lfo.connect(lfoDepth).connect(shift.delayTime)
        sources.push(lfo)
        saw.connect(pre)
        saw.connect(shift).connect(invert).connect(pre)
        break
      }
      case 'SWAVE': {
        // Five saws fanned out around the note; COLOR is the detune spread.
        for (const d of [-1, -0.5, 0, 0.5, 1]) osc('sawtooth', freq, d * color * 40).connect(pre)
        break
      }
      case 'FM+': {
        // Two-operator FM. COLOR picks the modulator ratio, MOD the depth,
        // and the depth decays faster than the amp for a struck, bell-like attack.
        const ratio = FM_RATIOS[Math.min(FM_RATIOS.length - 1, Math.floor(color * FM_RATIOS.length))]
        const carrier = osc('sine', freq)
        const modulator = osc('sine', freq * ratio)
        const depth = ctx.createGain()
        const peak = Math.max(1, mod * 8 * freq)
        depth.gain.setValueAtTime(peak, t)
        depth.gain.exponentialRampToValueAtTime(peak * 0.04, t + decay * 0.6)
        modulator.connect(depth).connect(carrier.frequency)
        carrier.connect(pre)
        break
      }
      case 'DPRO': {
        const wave = this.waves[Math.min(this.waves.length - 1, Math.floor(color * this.waves.length))]
        osc(wave, freq).connect(pre)
        break
      }
      case 'VO': {
        // A saw "glottis" through three formant filters; COLOR morphs between vowels.
        const saw = osc('sawtooth', freq)
        const pos = color * (VOWELS.length - 1)
        const i = Math.min(VOWELS.length - 2, Math.floor(pos))
        VOWELS[i].forEach((f, k) => {
          const formant = ctx.createBiquadFilter()
          formant.type = 'bandpass'
          formant.frequency.value = f + (VOWELS[i + 1][k] - f) * (pos - i)
          formant.Q.value = 9
          const gain = ctx.createGain()
          gain.gain.value = [1, 0.6, 0.35][k]
          saw.connect(formant).connect(gain).connect(pre)
        })
        break
      }
    }

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = Math.min(20000, 30 * 2 ** ((p[P.cutoff] / 127) * 9.5))
    filter.Q.value = 0.5 + (p[P.reso] / 127) * 14

    const amp = ctx.createGain()
    const level = (p[P.level] / 127) ** 2 * LEVEL_TRIM[machine]
    amp.gain.setValueAtTime(0.0001, t)
    amp.gain.exponentialRampToValueAtTime(Math.max(level, 0.0002), t + 0.003)
    amp.gain.exponentialRampToValueAtTime(0.0001, t + decay)

    const send = ctx.createGain()
    send.gain.value = (p[P.delay] / 127) * 0.6

    pre.connect(filter).connect(amp)
    amp.connect(this.master)
    amp.connect(send).connect(this.delayIn)

    for (const s of sources) {
      s.start(t)
      s.stop(t + decay + 0.05)
    }
    sources[0].onended = () => {
      amp.disconnect()
      send.disconnect()
    }
  }
}
