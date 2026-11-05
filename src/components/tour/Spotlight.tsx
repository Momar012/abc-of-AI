'use client'

import { useEffect, useState } from 'react'
import type { StepView } from '@/lib/tour/steps'
import GhostHand from './GhostHand'

// Shared by the Getting Started tour and mission hints.

export const PAD = 8
const GAP = 14
export const BUBBLE_W = 320

export interface Box { left: number; top: number; width: number; height: number }

export function visibleRect(el: Element | null): Box | null {
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.width === 0 && r.height === 0) return null
  return { left: r.left, top: r.top, width: r.width, height: r.height }
}

export const center = (b: Box) => ({ x: b.left + b.width / 2, y: b.top + b.height / 2 })

export function sameBox(a: Box | null, b: Box | null) {
  if (!a || !b) return a === b
  return Math.abs(a.left - b.left) < 1 && Math.abs(a.top - b.top) < 1 &&
    Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1
}

export function union(boxes: (Box | null)[]): Box | null {
  const list = boxes.filter((b): b is Box => !!b)
  if (!list.length) return null
  const l = Math.min(...list.map((b) => b.left))
  const t = Math.min(...list.map((b) => b.top))
  const r = Math.max(...list.map((b) => b.left + b.width))
  const btm = Math.max(...list.map((b) => b.top + b.height))
  return { left: l, top: t, width: r - l, height: btm - t }
}

/** Measure everything a view points at: target, drag destination, and what the bubble must keep clear of. */
export function measureView(v: StepView) {
  const targetBox = v.target ? visibleRect(document.querySelector(v.target)) : null
  const dragToBox = v.dragTo ? visibleRect(document.querySelector(v.dragTo)) : null
  const zoneBox = v.zone ? { left: v.zone.x - v.zone.w / 2, top: v.zone.y - v.zone.h / 2, width: v.zone.w, height: v.zone.h } : null
  const avoidBox = union([targetBox, zoneBox, ...(v.avoid ?? []).map((sel) => (sel ? visibleRect(document.querySelector(sel)) : null))])
  return { targetBox, dragToBox, avoidBox }
}

/** Keeps the boxes for a view up to date (menus open, blocks move, canvas pans). */
export function useTrackedBoxes(view: StepView | null) {
  const [boxes, setBoxes] = useState<ReturnType<typeof measureView>>({ targetBox: null, dragToBox: null, avoidBox: null })
  useEffect(() => {
    if (!view) { setBoxes({ targetBox: null, dragToBox: null, avoidBox: null }); return }
    const tick = () => {
      const next = measureView(view)
      setBoxes((prev) =>
        sameBox(prev.targetBox, next.targetBox) && sameBox(prev.dragToBox, next.dragToBox) && sameBox(prev.avoidBox, next.avoidBox)
          ? prev
          : next
      )
    }
    tick()
    const id = window.setInterval(tick, 250)
    return () => window.clearInterval(id)
  }, [view])
  return boxes
}

/** Pick a spot for a bubble next to the target (and the things it must not cover) that stays on screen. */
export function placeBubble(target: Box | null, keepClear: Box | null, bubbleH: number, prefer?: 'side'): React.CSSProperties {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const w = Math.min(BUBBLE_W, vw - 32)
  const clampX = (x: number) => Math.max(16, Math.min(x, vw - w - 16))
  const clampY = (y: number) => Math.max(16, Math.min(y, vh - bubbleH - 16))

  if (!target) return { left: (vw - w) / 2, top: (vh - bubbleH) / 2 }
  const box = keepClear ?? target
  const midX = clampX(target.left + target.width / 2 - w / 2)
  const midY = clampY(target.top + target.height / 2 - bubbleH / 2)

  const tryBelow = () => {
    const y = box.top + box.height + PAD + GAP
    return y + bubbleH < vh - 16 ? { left: midX, top: y } : null
  }
  const tryAbove = () => {
    const y = box.top - PAD - GAP - bubbleH
    return y > 16 ? { left: midX, top: y } : null
  }
  const tryRight = () => {
    const x = box.left + box.width + PAD + GAP
    return x + w < vw - 16 ? { left: x, top: midY } : null
  }
  const tryLeft = () => {
    const x = box.left - PAD - GAP - w
    return x > 16 ? { left: x, top: midY } : null
  }

  const order = prefer === 'side' ? [tryLeft, tryRight, tryBelow, tryAbove] : [tryBelow, tryAbove, tryRight, tryLeft]
  for (const f of order) {
    const pos = f()
    if (pos) return pos
  }
  // Nothing fits (e.g. the target is the whole canvas): tuck it in the bottom-right corner.
  return { left: vw - w - 24, top: vh - bubbleH - 24 }
}

/** Dim + cut-out around the target, a pulsing ring, an optional drop zone, and the ghost hand.
 *  Never blocks clicks. Render inside a portal on document.body. */
export default function Spotlight({
  view,
  targetBox,
  dragToBox,
  showHand,
  playKey,
}: {
  view: StepView
  targetBox: Box | null
  dragToBox: Box | null
  showHand: boolean
  playKey: number
}) {
  const hole = targetBox && {
    x: targetBox.left - PAD,
    y: targetBox.top - PAD,
    w: targetBox.width + PAD * 2,
    h: targetBox.height + PAD * 2,
  }
  // Huge targets (the whole canvas) don't need a dim — it would just darken the UI around it.
  const isHuge = !!targetBox && targetBox.width * targetBox.height > window.innerWidth * window.innerHeight * 0.45

  let handFrom = targetBox ? center(targetBox) : null
  let handTo = view.dragToPoint ?? (dragToBox ? center(dragToBox) : null)
  if (view.gesture === 'pan' && targetBox) {
    // Lower-left of the canvas is usually empty (blocks get placed centre/top).
    handFrom = { x: targetBox.left + targetBox.width * 0.3, y: targetBox.top + targetBox.height * 0.78 }
  }
  if (view.gesture === 'drag' && !view.dragToPoint && dragToBox && dragToBox.width > window.innerWidth * 0.4) {
    // Dropping onto the canvas: aim for a spot a bit inside it rather than the dead centre under the bubble.
    handTo = { x: dragToBox.left + dragToBox.width * 0.42, y: dragToBox.top + dragToBox.height * 0.45 }
  }

  return (
    <>
      {hole && !isHuge && (
        <svg className="pointer-events-none fixed inset-0 z-[10001] w-screen h-screen" aria-hidden>
          <defs>
            <mask id="abita-tour-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              <rect x={hole.x} y={hole.y} width={hole.w} height={hole.h} rx="12" fill="black" />
            </mask>
          </defs>
          <rect x="0" y="0" width="100%" height="100%" fill="rgba(4,6,20,0.5)" mask="url(#abita-tour-mask)" />
        </svg>
      )}
      {hole && (
        <div
          className="pointer-events-none fixed z-[10002] rounded-xl border-2 border-cyan-300 animate-pulse shadow-[0_0_24px_rgba(34,211,238,0.6)]"
          style={{ left: hole.x, top: hole.y, width: hole.w, height: hole.h }}
        />
      )}

      {view.zone && (
        <div
          className="pointer-events-none fixed z-[10002] rounded-2xl border-[3px] border-dashed border-amber-300 bg-amber-300/10 shadow-[0_0_30px_rgba(252,211,77,0.45)] flex items-center justify-center animate-pulse"
          style={{
            left: view.zone.x - view.zone.w / 2,
            top: view.zone.y - view.zone.h / 2,
            width: view.zone.w,
            height: view.zone.h,
          }}
        >
          <span className="font-heading font-extrabold text-amber-200 text-sm drop-shadow">Drop here</span>
        </div>
      )}

      {showHand && handFrom && <GhostHand key={playKey} gesture={view.gesture} from={handFrom} to={handTo} />}
    </>
  )
}
