// All of the site's copy lives here. Edit this file to update the site.

export type TrackId = 'about' | 'experience' | 'projects' | 'papers' | 'education' | 'contact'

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
  { id: 'papers', label: 'Papers', machine: 'PRINT' },
  { id: 'education', label: 'Education', machine: 'STUDY' },
  { id: 'contact', label: 'Contact', machine: 'SEND' },
]

export const profile = {
  name: 'June Cagan',
  role: 'Software Engineer',
  tagline: 'Systems, real-time audio, and computational geometry.',
  summary:
    'I study computer science at the University of Maryland and like software where correctness and timing both matter. ' +
    'So far that has meant tuning a trading engine at Tradeweb, publishing geometric algorithms at SoCG 2026, ' +
    'and building synthesizers in C++ and Rust. This page is one of them: press Play.',
  availability: 'Open to full-time software engineering roles starting 2027.',
  location: 'College Park, MD',
  email: 'junecagan@gmail.com',
  github: 'https://github.com/jrcagan',
  linkedin: 'https://www.linkedin.com/in/june-cagan/',
  resume: './june-cagan-resume.pdf',
  facts: [
    { k: 'Latest', v: 'Distributed Systems Engineering Intern, Tradeweb' },
    { k: 'Degree', v: 'B.S. Computer Science, UMD — May 2027' },
    { k: 'Published', v: 'Two papers at SoCG 2026' },
    { k: 'Works in', v: 'C++, Rust, Python, OCaml, TypeScript' },
  ],
}

/** One row on the Experience, Projects, or Papers screen. */
export interface Entry {
  title: string
  /** Short line above the title: where and when. */
  meta: string
  /** One sentence. */
  summary: string
  /** Author list for papers. */
  byline?: string
  tags?: string[]
  links?: { label: string; url: string }[]
}

export const experience: Entry[] = [
  {
    title: 'Distributed Systems Engineering Intern',
    meta: 'Tradeweb · New York · Summer 2026',
    summary:
      'Optimized the algorithm behind the Sweep-AME engine in C++, lifting total notional by up to 1.5% in internal testing and simulation.',
    tags: ['C++', 'CMake', 'GDB'],
  },
  {
    title: 'REU-CAAR Research Fellow',
    meta: 'University of Maryland · Summer 2025',
    summary:
      'Developed new algorithms for Voronoi diagrams and Delaunay triangulations in the Hilbert metric and built the software that visualizes them, work later published at SoCG 2026.',
    tags: ['Computational geometry', 'JavaScript'],
  },
  {
    title: 'Teaching Assistant, CMSC330',
    meta: 'University of Maryland · 2025 – now',
    summary:
      'Teach functional programming in OCaml and memory safety in Rust, writing programming exercises for a course of 850+ students and leading a weekly discussion section.',
    tags: ['OCaml', 'Rust'],
  },
]

export const projects: Entry[] = [
  {
    title: 'Voronoise',
    meta: 'VST3 + standalone synth',
    summary:
      'A percussion synth where balls bounce off Voronoi diagrams and hand-drawn shapes and every collision plays a note, with sample-accurate timing from a lock-free physics engine on the audio thread.',
    tags: ['C++', 'JUCE', 'CMake'],
    links: [{ label: 'Source', url: 'https://github.com/jrcagan/voronoise' }],
  },
  {
    title: 'Hilbert Metric Visualizer',
    meta: 'Research software · with Andrew Wagger',
    summary:
      'An interactive tool for drawing k-th order Voronoi diagrams in the Hilbert metric, built for REU-CAAR 2025 and presented at SoCG 2026.',
    tags: ['JavaScript', 'Canvas'],
    links: [
      { label: 'Try it', url: 'https://andrew.wagger.net/hilbert/' },
      { label: 'Source', url: 'https://github.com/anwagger/Hilbert_K_Voronoi' },
    ],
  },
  {
    title: 'Pulsar',
    meta: 'Synth in Rust',
    summary: 'A synthesizer written from scratch in Rust to learn audio programming.',
    tags: ['Rust'],
    links: [{ label: 'Source', url: 'https://github.com/jrcagan/pulsar' }],
  },
  {
    title: 'DirectionGuesser',
    meta: 'Android app · team project',
    summary: 'An Android app built in Kotlin with a team for UMD’s CMSC436.',
    tags: ['Kotlin'],
    links: [{ label: 'Source', url: 'https://github.com/yuwex/DirectionGuesser' }],
  },
]

export const papers: Entry[] = [
  {
    title: 'Visualizing Higher Order Structures, Overlap Regions, and Clustering in the Hilbert Geometry',
    meta: 'SoCG 2026 · Media Exposition',
    summary:
      'Interactive software for higher-order Voronoi diagrams, Delaunay mosaics, and clustering in the Hilbert polygonal metric, with a proof that k-th order Voronoi cells are not always star-shaped.',
    byline:
      'Hridhaan Banerjee, Soren Brown, June Cagan, Auguste H. Gezalyan, Megan Hunleth, Veena Kailad, Chaewoon Kyoung, Rowan Shigeno, Yasmine Tajeddin, Andrew Wagger, Kelin Zhu, David M. Mount',
    links: [
      { label: 'Paper', url: 'https://doi.org/10.4230/LIPIcs.SoCG.2026.100' },
      { label: 'Video', url: 'https://youtu.be/yhJn--3Qgks' },
      { label: 'Software', url: 'https://andrew.wagger.net/hilbert/' },
    ],
  },
  {
    title: 'Proximity Alert: Ipelets for Neighborhood Graphs and Clustering',
    meta: 'SoCG 2026 · Media Exposition',
    summary:
      'A free set of Lua extensions for the Ipe drawing editor that visualize neighborhood graphs and clustering algorithms, from Gabriel and Yao graphs to DBSCAN and k-means.',
    byline:
      'Gitan Balogh, June Cagan, Bea Fatima, Auguste H. Gezalyan, Danesh Sivakumar, Arushi Srinivasan, Yixuan Sun, Vahe Zaprosyan, David M. Mount',
    links: [
      { label: 'Paper', url: 'https://doi.org/10.4230/LIPIcs.SoCG.2026.99' },
      { label: 'Video', url: 'https://youtu.be/NQr-SY1x2qc' },
      { label: 'Source', url: 'https://github.com/Otcavo/Ipelets-Full-Library' },
    ],
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
