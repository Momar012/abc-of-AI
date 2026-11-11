/**
 * "Please bring these into view": anything outside the canvas (a hint, a toolbar button) can ask the
 * canvas to pan so some blocks or dots are where a kid can see and grab them. The canvas listens
 * (DatasetCanvas → RevealOnRequest) and does the panning, since only it knows the viewport.
 */

export const REVEAL_EVENT = 'abita:reveal'

export interface RevealRequest {
  selectors: string[]
  /** The first two belong together (a dot and where to drag it): worth shrinking a bit more to show both. */
  pair: boolean
}

/**
 * Ask the canvas to show these elements. The FIRST one matters most (a hint's target, a new block);
 * the rest are nice to have (the drag destination, the blocks around it).
 */
export function requestReveal(selectors: Array<string | null | undefined>, { pair = false } = {}) {
  const list = selectors.filter((s): s is string => !!s)
  if (list.length) window.dispatchEvent(new CustomEvent<RevealRequest>(REVEAL_EVENT, { detail: { selectors: list, pair } }))
}

export interface ScreenBox {
  left: number
  top: number
  right: number
  bottom: number
}

const GAP = 16

/**
 * The part of the canvas kids can actually use, in screen pixels: below the toolbar, above the zoom
 * buttons, and between the panels floating over the canvas (Data Panel, mission card, settings —
 * anything tagged data-canvas-avoid).
 */
export function freeCanvasArea(canvas: DOMRect): ScreenBox {
  const rectOf = (sel: string) => document.querySelector(sel)?.getBoundingClientRect()
  const toolbar = rectOf('[data-canvas-toolbar]')
  // The zoom buttons (+ − ⛶) sit along the bottom: keep blocks above them.
  const controls = rectOf('.react-flow__controls')
  let left = canvas.left
  let right = canvas.right
  const middle = (canvas.left + canvas.right) / 2
  for (const el of Array.from(document.querySelectorAll('[data-data-panel], [data-canvas-avoid]'))) {
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height || r.right <= canvas.left || r.left >= canvas.right) continue
    // A panel on the left pushes the free area's left edge in; one on the right, its right edge.
    if ((r.left + r.right) / 2 < middle) left = Math.max(left, r.right)
    else right = Math.min(right, r.left)
  }
  return {
    left: left + GAP,
    top: Math.max(canvas.top, toolbar?.bottom ?? canvas.top) + GAP,
    right: right - GAP,
    bottom: Math.min(canvas.bottom, controls?.top ?? canvas.bottom) - GAP,
  }
}

export interface Viewport {
  x: number
  y: number
  zoom: number
}

/**
 * The viewport that shows `boxes` inside the free area (clear of panels and the zoom buttons), moving as little
 * as possible. Zooms out (never below `minZoom`) only when they can't fit at the current size, and
 * back in (up to 100%) when an earlier step left the canvas small. Returns null when nothing needs to move.
 */
export function viewportToShow(boxes: ScreenBox[], canvas: DOMRect, vp: Viewport, minZoom = 0.5): Viewport | null {
  if (!boxes.length) return null
  const area = freeCanvasArea(canvas)
  const u: ScreenBox = {
    left: Math.min(...boxes.map((b) => b.left)),
    top: Math.min(...boxes.map((b) => b.top)),
    right: Math.max(...boxes.map((b) => b.right)),
    bottom: Math.max(...boxes.map((b) => b.bottom)),
  }
  const areaW = area.right - area.left
  const areaH = area.bottom - area.top
  if (areaW <= 0 || areaH <= 0) return null

  // The zoom at which the boxes would just fill the free area.
  const fitZoom = vp.zoom * Math.min(areaW / (u.right - u.left), areaH / (u.bottom - u.top)) * 0.95
  const centredAt = (zoom: number): Viewport => {
    const toFlow = (sx: number, sy: number) => ({ x: (sx - canvas.left - vp.x) / vp.zoom, y: (sy - canvas.top - vp.y) / vp.zoom })
    const a = toFlow(u.left, u.top)
    const b = toFlow(u.right, u.bottom)
    return {
      x: (area.left + area.right) / 2 - canvas.left - ((a.x + b.x) / 2) * zoom,
      y: (area.top + area.bottom) / 2 - canvas.top - ((a.y + b.y) / 2) * zoom,
      zoom,
    }
  }
  // Too big for the free area: zoom out around the boxes and centre them.
  if (u.right - u.left > areaW || u.bottom - u.top > areaH) return centredAt(Math.max(minZoom, fitZoom))
  // Shrunk earlier for a wide step, but this step's boxes fit bigger: zoom back in so dots are easy to grab.
  if (vp.zoom < 0.75 && fitZoom > vp.zoom + 0.05) return centredAt(Math.min(1, fitZoom))

  const dx = u.left < area.left ? area.left - u.left : u.right > area.right ? area.right - u.right : 0
  const dy = u.top < area.top ? area.top - u.top : u.bottom > area.bottom ? area.bottom - u.bottom : 0
  if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return null
  return { x: vp.x + dx, y: vp.y + dy, zoom: vp.zoom }
}

/** Where a box on screen ends up if the viewport changes from `vp` to `next`. */
function moveBox(b: ScreenBox, canvas: DOMRect, vp: Viewport, next: Viewport): ScreenBox {
  const sx = (x: number) => canvas.left + next.x + ((x - canvas.left - vp.x) / vp.zoom) * next.zoom
  const sy = (y: number) => canvas.top + next.y + ((y - canvas.top - vp.y) / vp.zoom) * next.zoom
  return { left: sx(b.left), top: sy(b.top), right: sx(b.right), bottom: sy(b.bottom) }
}

/**
 * The best view for `boxes` (first = must show): everything, if it fits without shrinking blocks
 * below 75%; else the first two (a dot and where to drag it) — at 65% if that's enough, down to 50%
 * if not, because a kid who can't see where to drop the wire is stuck; else just the first.
 */
export function bestViewport(boxes: ScreenBox[], canvas: DOMRect, vp: Viewport, pair = false): Viewport | null {
  const area = freeCanvasArea(canvas)
  const inside = (b: ScreenBox) => b.left >= area.left - 1 && b.top >= area.top - 1 && b.right <= area.right + 1 && b.bottom <= area.bottom + 1
  const tries: Array<[ScreenBox[], number]> = [
    [boxes, 0.75],
    ...(pair
      ? ([
          [boxes.slice(0, 2), 0.65],
          [boxes.slice(0, 2), 0.5],
        ] as Array<[ScreenBox[], number]>)
      : []),
    [boxes.slice(0, 1), vp.zoom],
  ]
  let fallback: Viewport | null = null
  for (const [set, minZoom] of tries) {
    if (!set.length) continue
    const next = viewportToShow(set, canvas, vp, minZoom)
    const after = next ?? vp
    if (set.every((b) => inside(moveBox(b, canvas, vp, after)))) return next
    // Nothing fitted yet: the narrowest try (just the first) is the one to fall back on.
    if (next) fallback = next
  }
  return fallback
}
