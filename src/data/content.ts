// All of the site's copy lives here. Edit this file to update the site.

export type TrackId = 'about' | 'experience' | 'projects' | 'skills' | 'education' | 'contact'

export interface Track {
  id: TrackId
  label: string
  /** Short "machine" name shown on the screen status bar. */
  machine: string
}

export const TRACKS: Track[] = [
  { id: 'about', label: 'About', machine: 'INTRO' },
  { id: 'experience', label: 'Experience', machine: 'WORK' },
  { id: 'projects', label: 'Projects', machine: 'BUILD' },
  { id: 'skills', label: 'Skills', machine: 'STACK' },
  { id: 'education', label: 'Education', machine: 'STUDY' },
  { id: 'contact', label: 'Contact', machine: 'SEND' },
]

export const profile = {
  name: 'June Cagan',
  role: 'Software Engineer',
  tagline: 'Systems, real-time audio, and computational geometry.',
  summary:
    'Computer science student at the University of Maryland (B.S. May 2027, minor in Linguistics). ' +
    'I like software where correctness and timing both matter: I optimized a trading engine in C++ at Tradeweb, ' +
    'researched geometric algorithms in the Hilbert metric, and build synthesizers in C++ and Rust.',
  availability: 'Open to full-time software engineering roles starting 2027.',
  location: 'College Park, MD',
  email: 'junecagan@gmail.com',
  github: 'https://github.com/jrcagan',
  linkedin: 'https://www.linkedin.com/in/june-cagan/',
  resume: './june-cagan-resume.pdf',
  facts: [
    { k: 'Latest', v: 'Distributed Systems Engineering Intern, Tradeweb' },
    { k: 'Degree', v: 'B.S. Computer Science, UMD — May 2027' },
    { k: 'Based', v: 'College Park, MD' },
    { k: 'Works in', v: 'C++, Rust, Python, OCaml, TypeScript' },
  ],
}

export interface Role {
  title: string
  org: string
  place: string
  dates: string
  short: string
  bullets: string[]
  tags: string[]
}

export const experience: Role[] = [
  {
    title: 'Distributed Systems Engineering Intern',
    org: 'Tradeweb',
    place: 'New York, NY',
    dates: 'Jun 2026 – Aug 2026',
    short: 'Tradeweb',
    bullets: [
      'Optimized the algorithm powering the Sweep-AME engine, increasing total notional by up to 1.5% in internal testing and simulation.',
      'Used CMake, CTest, and GDB to build, test, and debug C++ implementations.',
      'Expanded unit test coverage to stress-test optimized implementations across diverse inputs and edge cases.',
    ],
    tags: ['C++', 'CMake', 'CTest', 'GDB'],
  },
  {
    title: 'REU-CAAR Fellow',
    org: 'University of Maryland, Department of Computer Science',
    place: 'College Park, MD',
    dates: 'Jun 2025 – Aug 2025',
    short: 'REU-CAAR',
    bullets: [
      'Conducted research on geometric algorithms for machine learning and quantum computing applications.',
      'Formulated new algorithms for building geometric data structures, such as Voronoi diagrams and Delaunay triangulations, in the Hilbert metric space.',
      'Worked closely with one researcher to develop software that visualizes algorithms in multiple non-Euclidean metrics.',
    ],
    tags: ['Algorithms', 'Computational geometry', 'JavaScript'],
  },
  {
    title: 'Undergraduate Teaching Assistant',
    org: 'University of Maryland, Department of Computer Science',
    place: 'College Park, MD',
    dates: 'Jan 2025 – Present',
    short: 'UMD CMSC330',
    bullets: [
      'Teaching assistant for CMSC330, which teaches programming paradigms such as functional programming in OCaml and memory safety through Rust.',
      'Organized and developed programming exercises for over 850 students, covering higher-order functions, finite automata, parsing, interpreters, type-checking, and garbage collection.',
      'Lead weekly discussion sections, reinforcing core concepts and working through programming exercises with over 30 students.',
    ],
    tags: ['OCaml', 'Rust', 'Teaching'],
  },
]

export interface Project {
  name: string
  blurb: string
  stack: string[]
  bullets: string[]
  url: string
  note?: string
}

export const projects: Project[] = [
  {
    name: 'Voronoise',
    blurb: 'Geometric percussion synth — VST3 and standalone.',
    stack: ['C++', 'JUCE', 'CMake', 'GoogleTest'],
    bullets: [
      'A synthesizer plugin in which balls bounce off user-placed geometric structures — Voronoi diagrams or hand-drawn lines and shapes — and each collision plays a note through a built-in wavetable or sample engine.',
      'Moved the physics engine to the real-time audio thread with lock-free queues and no memory allocation, cutting note timing jitter from up to 24 ms to sample-accurate.',
      'Built with Claude Code: wrote the specs, reviewed and debugged generated C++, and used 85 GoogleTest unit and audio-timing tests to verify timing and audio output.',
    ],
    url: 'https://github.com/jrcagan/voronoise',
  },
  {
    name: 'Hilbert Metric Visualizer',
    blurb: 'k-th order Voronoi diagrams in the Hilbert metric.',
    stack: ['JavaScript', 'Node.js', 'Express', 'Canvas API'],
    bullets: [
      'Made for REU-CAAR 2025 to explore non-Euclidean geometries and algorithms, including bisectors built from conic sections and a partition tree for point location.',
      'Worked on data structures, object and algorithm design, and user interaction.',
      'Used Node.js and Express for the backend and the Canvas API for graphics.',
    ],
    url: 'https://github.com/anwagger/Hilbert_K_Voronoi',
    note: 'With Andrew Wagger',
  },
  {
    name: 'Pulsar',
    blurb: 'A synthesizer in Rust.',
    stack: ['Rust'],
    bullets: [
      'Practice in audio programming: a synthesizer written from scratch in Rust, split into separate synth and GUI crates.',
    ],
    url: 'https://github.com/jrcagan/pulsar',
  },
  {
    name: 'DirectionGuesser',
    blurb: 'Android app in Kotlin.',
    stack: ['Kotlin', 'Android'],
    bullets: ['Team Android app built in Kotlin for CMSC436 at the University of Maryland.'],
    url: 'https://github.com/yuwex/DirectionGuesser',
    note: 'Team project',
  },
]

export const skills: { group: string; items: string[] }[] = [
  {
    group: 'Languages',
    items: ['Python', 'C', 'C++', 'Rust', 'OCaml', 'Java', 'x86 Assembly', 'Racket', 'Go', 'Kotlin', 'SQL'],
  },
  {
    group: 'Web',
    items: ['JavaScript', 'TypeScript', 'HTML', 'CSS', 'Node.js', 'Express', 'React', 'MongoDB', 'REST APIs'],
  },
  {
    group: 'Tools',
    items: ['Git', 'Docker', 'CMake', 'JUnit', 'npm', 'Claude Code', 'Codex'],
  },
  {
    group: 'Systems',
    items: ['Ubuntu', 'Windows 10/11'],
  },
]

export const education = {
  school: 'University of Maryland, College Park',
  degree: 'B.S. in Computer Science',
  minor: 'Minor in Linguistics',
  dates: 'Aug 2023 – May 2027',
  gpa: '3.62',
  coursework: [
    'Data Structures',
    'Algorithms',
    'Object-Oriented Programming I/II',
    'Linear Algebra',
    'Computer Systems',
    'Compilers',
    'Databases',
    'Web Application Development',
  ],
}
