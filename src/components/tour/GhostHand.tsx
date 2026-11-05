'use client'

import { motion } from 'framer-motion'
import type { Gesture } from '@/lib/tour/steps'

interface Pt { x: number; y: number }

/** A see-through hand that acts out the gesture the kid should try.
 *  It plays 3 times, then stops. Remount it (change `key`) to replay. */
export default function GhostHand({ gesture, from, to }: { gesture: Gesture; from: Pt; to?: Pt | null }) {
  if (gesture === 'none') return null

  if (gesture === 'pinch') {
    // Two fingertips spreading apart and back together.
    const finger = (dir: 1 | -1) => (
      <motion.div
        className="fixed left-0 top-0 w-7 h-7 rounded-full bg-cyan-300/70 border-2 border-white shadow-[0_0_16px_rgba(34,211,238,0.8)]"
        style={{ marginLeft: -14, marginTop: -14 }}
        initial={{ x: from.x, y: from.y, opacity: 0 }}
        animate={{
          x: [from.x - dir * 12, from.x + dir * 60, from.x - dir * 12],
          y: [from.y - dir * 12, from.y + dir * 60, from.y - dir * 12],
          opacity: [0, 1, 0],
        }}
        transition={{ duration: 1.8, repeat: 2, ease: 'easeInOut' }}
      />
    )
    return (
      <div className="pointer-events-none fixed inset-0 z-[10003]">
        {finger(1)}
        {finger(-1)}
      </div>
    )
  }

  let end: Pt = from
  if (gesture === 'drag' && to) end = to
  if (gesture === 'pan') end = { x: from.x + 160, y: from.y + 40 }
  const moves = gesture === 'drag' || gesture === 'pan'

  const animate = moves
    ? {
        x: [from.x, from.x, end.x, end.x],
        y: [from.y, from.y, end.y, end.y],
        scale: [1, 0.8, 0.8, 1],
        opacity: [0, 1, 1, 0],
      }
    : gesture === 'dblclick'
    ? { x: from.x, y: from.y, scale: [1, 0.78, 1, 0.78, 1, 1], opacity: [0, 1, 1, 1, 1, 0] }
    : { x: from.x, y: from.y, scale: [1, 0.78, 1, 1], opacity: [0, 1, 1, 0] }

  const times = moves ? [0, 0.2, 0.8, 1] : gesture === 'dblclick' ? [0, 0.25, 0.4, 0.55, 0.7, 1] : [0, 0.35, 0.6, 1]

  return (
    <div className="pointer-events-none fixed inset-0 z-[10003]">
      {/* tap ripple */}
      {!moves && (
        <motion.div
          className="fixed left-0 top-0 w-12 h-12 rounded-full border-2 border-cyan-300"
          style={{ marginLeft: -24, marginTop: -24 }}
          initial={{ x: from.x, y: from.y, scale: 0.3, opacity: 0 }}
          animate={{ x: from.x, y: from.y, scale: [0.3, 0.3, 1.4], opacity: [0, 0.9, 0] }}
          transition={{ duration: 1.6, repeat: 2, times: [0, 0.35, 0.8] }}
        />
      )}
      <motion.div
        className="fixed left-0 top-0 text-[38px] leading-none select-none"
        // the fingertip of 👆 sits roughly top-centre of the glyph
        style={{ marginLeft: -16, marginTop: -4, filter: 'drop-shadow(0 0 8px rgba(34,211,238,0.9))' }}
        initial={{ x: from.x, y: from.y, opacity: 0 }}
        animate={animate}
        transition={{ duration: moves ? 2.2 : 1.6, repeat: 2, times, ease: 'easeInOut' }}
      >
        👆
      </motion.div>
    </div>
  )
}
