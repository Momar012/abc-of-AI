'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import type { StepView } from '@/lib/tour/steps'
import Spotlight, { placeBubble, useTrackedBoxes } from './Spotlight'

/** A 💡 hint: spotlight + ghost hand on the target, with the hint text in a bubble beside it.
 *  Used by mission hints and Guided Lab "👆 Show me". Never blocks clicks except the bubble's ×.
 *  With onClose, kids can put the hint away: the × on the bubble, or the Escape key. */
export default function HintOverlay({
  view,
  playKey,
  onClose,
}: {
  view: StepView | null
  playKey: number
  onClose?: () => void
}) {
  const boxes = useTrackedBoxes(view)
  const open = !!view

  useEffect(() => {
    if (!open || !onClose) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!view || typeof document === 'undefined') return null
  return createPortal(
    <>
      <Spotlight view={view} targetBox={boxes.targetBox} dragToBox={boxes.dragToBox} showHand playKey={playKey} />
      <motion.div
        key={view.text}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="fixed z-[10004] pointer-events-none glass-card border border-cyan-400/40 px-3 py-2 shadow-2xl flex items-start gap-2"
        style={{ ...placeBubble(boxes.targetBox, boxes.avoidBox, 64, view.prefer), width: 'min(320px, calc(100vw - 32px))' }}
      >
        <p className="flex-1 text-sm font-body text-cyan-50">💡 {view.text}</p>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close hint"
            title="Close hint"
            // Big enough for a finger on a Chromebook touch screen.
            className="pointer-events-auto -mr-1 -mt-0.5 flex-shrink-0 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white text-base leading-none flex items-center justify-center transition-colors"
          >
            ×
          </button>
        )}
      </motion.div>
    </>,
    document.body
  )
}
