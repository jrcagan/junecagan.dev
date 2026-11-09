import { useEffect, useRef } from 'react'

interface KnobProps {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  /** Text shown under the knob; defaults to the raw value. */
  display?: string
  size?: number
}

export function Knob({ label, value, onChange, min = 0, max = 127, display, size = 54 }: KnobProps) {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<{ y: number; value: number } | null>(null)
  const latest = useRef({ value, onChange })
  latest.current = { value, onChange }

  const range = max - min
  const clamp = (v: number) => Math.round(Math.min(max, Math.max(min, v)))
  const frac = (value - min) / range

  // Wheel needs a non-passive listener so the page doesn't scroll while turning.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const { value, onChange } = latest.current
      onChange(clamp(value - Math.sign(e.deltaY) * Math.max(1, range / 64)))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [min, max])

  return (
    <div className="knob">
      <div
        ref={ref}
        className="knob-dial"
        style={{ width: size, height: size }}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={display ?? String(value)}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          drag.current = { y: e.clientY, value }
        }}
        onPointerMove={(e) => {
          if (!drag.current) return
          onChange(clamp(drag.current.value + ((drag.current.y - e.clientY) * range) / 160))
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onKeyDown={(e) => {
          const big = Math.max(1, Math.round(range / 12))
          const delta =
            { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: big, PageDown: -big }[e.key] ?? 0
          if (delta) {
            e.preventDefault()
            onChange(clamp(value + delta))
          }
        }}
      >
        <div className="knob-cap" style={{ transform: `rotate(${-135 + frac * 270}deg)` }}>
          <i />
        </div>
      </div>
      <div className="knob-label">{label}</div>
      <div className="knob-value">{display ?? value}</div>
    </div>
  )
}
