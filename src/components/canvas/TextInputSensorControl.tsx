'use client'

import { useEffect, useRef, useState } from 'react'

interface TextInputSensorControlProps {
  value: string
  onSend: (v: string) => void
  rows?: number
  textareaClassName?: string
}

// A local draft that only overwrites the sensor's actual (evaluated) value
// when the student explicitly clicks Send — typing alone must never push a
// partial/empty value into a connected IF block or model.
export default function TextInputSensorControl({ value, onSend, rows = 2, textareaClassName }: TextInputSensorControlProps) {
  const [draft, setDraft] = useState(value)
  const lastSent = useRef(value)

  useEffect(() => {
    if (value !== lastSent.current) {
      setDraft(value)
      lastSent.current = value
    }
  }, [value])

  const handleSend = () => {
    lastSent.current = draft
    onSend(draft)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <textarea
        value={draft}
        onPointerDown={(e) => e.stopPropagation()}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Type a value…"
        rows={rows}
        className={
          textareaClassName ??
          'w-full px-2 py-1.5 rounded-lg border border-white/15 text-white text-xs font-body outline-none focus:border-orange-400 bg-transparent resize-none'
        }
      />
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={handleSend}
        className="self-end px-3 py-1 rounded-lg text-xs font-heading font-bold bg-orange-500/20 text-orange-300 border border-orange-500/40 hover:bg-orange-500/30 transition-all"
      >
        → Send
      </button>
    </div>
  )
}
