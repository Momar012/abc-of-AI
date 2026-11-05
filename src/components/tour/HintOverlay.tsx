'use client'

import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import type { StepView } from '@/lib/tour/steps'
import Spotlight, { placeBubble, useTrackedBoxes } from './Spotlight'

/** A 💡 hint: spotlight + ghost hand on the target, with the hint text in a bubble beside it.
 *  Used by mission hints and Guided Lab "👆 Show me". Never blocks clicks except the bubble. */
export default function HintOverlay({ view, playKey }: { view: StepView | null; playKey: number }) {
  const boxes = useTrackedBoxes(view)
  if (!view || typeof document === 'undefined') return null
  return createPortal(
    <>
      <Spotlight view={view} targetBox={boxes.targetBox} dragToBox={boxes.dragToBox} showHand playKey={playKey} />
      <motion.div
        key={view.text}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="fixed z-[10004] pointer-events-none glass-card border border-cyan-400/40 px-3 py-2 shadow-2xl"
        style={{ ...placeBubble(boxes.targetBox, boxes.avoidBox, 64, view.prefer), width: 'min(320px, calc(100vw - 32px))' }}
      >
        <p className="text-sm font-body text-cyan-50">💡 {view.text}</p>
      </motion.div>
    </>,
    document.body
  )
}
