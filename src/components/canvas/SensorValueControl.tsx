'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  value: number
  min: number
  max: number
  unit?: string
  onChange: (value: number) => void
  size?: 'sm' | 'lg'
}

const HOLD_DELAY_MS = 400
const HOLD_REPEAT_MS = 80

// Numeric sensor control shared by the canvas node and the inspector:
// − / + buttons (press-and-hold repeats), a slider, and a value you can click to type.
// `nodrag nopan nowheel` stops React Flow from dragging/panning the canvas while it's used.
export default function SensorValueControl({ value, min, max, unit = '', onChange, size = 'sm' }: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState('')

  // Latest value/onChange for the hold-to-repeat timer, which outlives a single render
  const valueRef = useRef(value)
  const onChangeRef = useRef(onChange)
  valueRef.current = value
  onChangeRef.current = onChange

  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const repeatTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n)))

  const stopHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current)
    if (repeatTimer.current) clearInterval(repeatTimer.current)
    holdTimer.current = null
    repeatTimer.current = null
  }

  useEffect(() => stopHold, [])

  const nudge = (delta: number) => {
    const next = clamp(valueRef.current + delta)
    if (next !== valueRef.current) onChangeRef.current(next)
    else stopHold()
  }

  const startHold = (delta: number) => {
    nudge(delta)
    stopHold()
    holdTimer.current = setTimeout(() => {
      repeatTimer.current = setInterval(() => nudge(delta), HOLD_REPEAT_MS)
    }, HOLD_DELAY_MS)
  }

  const startEditing = () => {
    setDraft(String(value))
    setIsEditing(true)
  }

  const commit = () => {
    const n = Number(draft)
    if (draft.trim() !== '' && !Number.isNaN(n)) onChange(clamp(n))
    setIsEditing(false)
  }

  const pct = max > min ? Math.round(((value - min) / (max - min)) * 100) : 0
  const lg = size === 'lg'
  const btnCls = `${lg ? 'w-8 h-8 text-lg' : 'w-6 h-6 text-sm'} flex-shrink-0 rounded-full bg-white/10 text-orange-200 font-heading font-bold flex items-center justify-center hover:bg-orange-500/25 active:scale-90 transition-all disabled:opacity-30 disabled:pointer-events-none select-none`

  return (
    <div className="nodrag nopan nowheel flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Decrease"
          disabled={value <= min}
          onPointerDown={() => startHold(-1)}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onPointerCancel={stopHold}
          className={btnCls}
        >
          −
        </button>
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="sensor-slider flex-1 min-w-0"
          style={{ background: `linear-gradient(to right, #fb923c ${pct}%, rgba(255,255,255,0.15) ${pct}%)` }}
        />
        <button
          type="button"
          aria-label="Increase"
          disabled={value >= max}
          onPointerDown={() => startHold(1)}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onPointerCancel={stopHold}
          className={btnCls}
        >
          +
        </button>
      </div>

      <div className={`flex items-center justify-between ${lg ? 'text-xs' : 'text-[10px]'}`}>
        <span className="text-white/40 font-body">{min}{unit}</span>
        {isEditing ? (
          <input
            type="number"
            autoFocus
            min={min}
            max={max}
            value={draft}
            onFocus={(e) => e.target.select()}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit()
              else if (e.key === 'Escape') setIsEditing(false)
            }}
            className={`${lg ? 'w-20 text-base' : 'w-14 text-xs'} text-center bg-white/10 border border-orange-400/60 rounded-md px-1 py-0.5 text-orange-200 font-heading font-bold outline-none [color-scheme:dark]`}
          />
        ) : (
          <button
            type="button"
            onClick={startEditing}
            title="Click to type a value"
            className={`${lg ? 'text-lg font-extrabold' : 'text-xs font-bold'} font-heading text-orange-300 px-1.5 rounded-md border border-dashed border-transparent hover:border-orange-400/50 hover:bg-white/5 transition-colors`}
          >
            {value}{unit}
          </button>
        )}
        <span className="text-white/40 font-body">{max}{unit}</span>
      </div>
    </div>
  )
}
