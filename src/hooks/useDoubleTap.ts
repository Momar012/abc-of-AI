'use client'

import { useCallback, useRef } from 'react'

const DOUBLE_TAP_MS = 350
const DOUBLE_TAP_SLOP_PX = 20

type Tap = { key: string; t: number; x: number; y: number }

/**
 * Detects a finger double-tap. Chrome only sometimes turns a double-tap into
 * a `dblclick`, so every double-click action also listens for this on touch.
 * Returns true when this tap completes a double-tap on the same `key`.
 * Mouse/pen pointers are ignored — they get the native `dblclick`.
 */
export function createDoubleTapDetector() {
  let last: Tap | null = null
  return (pointerType: string | undefined, key: string, x: number, y: number) => {
    if (pointerType !== 'touch') return false
    const now = performance.now()
    const prev = last
    if (prev && prev.key === key && now - prev.t < DOUBLE_TAP_MS && Math.hypot(x - prev.x, y - prev.y) < DOUBLE_TAP_SLOP_PX) {
      last = null
      return true
    }
    last = { key, t: now, x, y }
    return false
  }
}

/** `onPointerUp` handler that calls `onDoubleTap` on a finger double-tap — pair it with the element's `onDoubleClick`. */
export function useDoubleTap(onDoubleTap: () => void) {
  const detectorRef = useRef<ReturnType<typeof createDoubleTapDetector>>()
  if (!detectorRef.current) detectorRef.current = createDoubleTapDetector()
  return useCallback(
    (e: React.PointerEvent) => {
      if (detectorRef.current!(e.pointerType, '', e.clientX, e.clientY)) onDoubleTap()
    },
    [onDoubleTap]
  )
}
