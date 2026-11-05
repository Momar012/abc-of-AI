import { useRuleStore } from '@/store/useRuleStore'
import { useWorkflowStore } from '@/store/useWorkflowStore'
import { useUIStore } from '@/store/useUIStore'
import { useCurriculumStore } from '@/store/useCurriculumStore'
import { useTourStore } from '@/store/useTourStore'
import { CURRICULUM } from '@/data/curriculum'

export type Gesture = 'tap' | 'drag' | 'dblclick' | 'pinch' | 'pan' | 'none'

export interface TourEnv {
  isTouch: boolean
  find: (selector: string) => Element | null
}

/** What the overlay should show right now for a step. Re-evaluated every tick,
 *  so it can change as the kid opens menus, adds blocks, etc. */
export interface StepView {
  /** CSS selector to spotlight; null = centred bubble with no spotlight. */
  target: string | null
  text: string
  gesture: Gesture
  /** For drag gestures: where the ghost hand drags to. */
  dragTo?: string
  /** Other things the bubble must not cover (e.g. the blocks being wired). */
  avoid?: (string | null)[]
  /** 'side' = put the bubble left/right of the target first (menus, sidebars). */
  prefer?: 'side'
  /** A glowing "parking spot" (screen px, centre + size) to drop a block into. */
  zone?: { x: number; y: number; w: number; h: number }
  /** For drag gestures towards a spot that isn't an element (e.g. the zone). */
  dragToPoint?: { x: number; y: number }
  /** Explain-only card: the bubble shows "Got it →" and nothing has to be done. */
  info?: boolean
}

export interface TourStep {
  id: string
  emoji: string
  title: string
  onEnter?: () => void
  /** Checked when the step starts; true = already satisfied, move straight on. */
  skipIf?: () => boolean
  capture?: () => unknown
  /** Checked every tick: true = the snapshot is stale (e.g. drop spot went off screen), take a new one. */
  recaptureIf?: (baseline: unknown) => boolean
  view: (env: TourEnv, baseline: unknown) => StepView
  isDone: (baseline: unknown) => boolean
}

// ── helpers ──────────────────────────────────────────────────────────────────

const refs = () => useTourStore.getState().refs
const renameWatch = { name: '', at: 0 }

function tourSwitch() {
  const list = useRuleStore.getState().switchBlocks
  return list.find((b) => b.id === refs().switchId) ?? list[list.length - 1]
}

function tourBulb() {
  const list = useWorkflowStore.getState().bulbBlocks
  return list.find((b) => b.id === refs().bulbId) ?? list[list.length - 1]
}

const nodeSel = (id: string | undefined) => (id ? `.react-flow__node[data-id="${id}"]` : null)
const handleSel = (nodeId: string | undefined, handleId: string) =>
  nodeId ? `.react-flow__handle[data-nodeid="${nodeId}"][data-handleid="${handleId}"]` : null

export function readViewport(): { x: number; y: number; zoom: number } | null {
  const el = document.querySelector('.react-flow__viewport') as HTMLElement | null
  if (!el) return null
  const t = getComputedStyle(el).transform
  if (!t || t === 'none') return { x: 0, y: 0, zoom: 1 }
  const m = new DOMMatrixReadOnly(t)
  return { x: m.e, y: m.f, zoom: m.a }
}

/** Screen centre of the move-bulb drop spot (stored as an offset from the Switch). */
function zoneCentre(baseline: unknown) {
  const d = baseline as { dx: number; dy: number } | null
  const sel = nodeSel(tourSwitch()?.id)
  const el = sel ? document.querySelector(sel) : null
  if (!d || !el) return null
  const r = el.getBoundingClientRect()
  const zoom = readViewport()?.zoom ?? 1
  return { x: r.left + r.width / 2 + d.dx * zoom, y: r.top + r.height / 2 + d.dy * zoom, zoom }
}

const ZONE_W = 190
const ZONE_H = 170

/** "Open the menu, then drag the item" — one step whose view follows the menu state. */
function addBlockStep(opts: {
  id: string
  emoji: string
  title: string
  menuSel: string
  menuLabel: string
  itemSel: string
  itemLabel: string
  ids: () => string[]
  refKey: 'switchId' | 'bulbId'
  onEnter?: () => void
}): TourStep {
  return {
    id: opts.id,
    emoji: opts.emoji,
    title: opts.title,
    onEnter: opts.onEnter,
    capture: () => opts.ids(),
    view: ({ isTouch, find }) => {
      if (find(opts.itemSel)) {
        return {
          target: opts.itemSel,
          gesture: 'drag',
          dragTo: '[data-tour="canvas"]',
          prefer: 'side',
          text: isTouch
            ? `Press and hold ${opts.itemLabel}, then drag it onto the canvas. (Tapping it works too!)`
            : `Drag ${opts.itemLabel} onto the canvas. (Clicking it works too!)`,
        }
      }
      return {
        target: opts.menuSel,
        gesture: 'tap',
        text: `${isTouch ? 'Tap' : 'Click'} ${opts.menuLabel} to open the block menu.`,
      }
    },
    isDone: (baseline) => {
      const before = new Set((baseline as string[] | undefined) ?? [])
      const added = opts.ids().find((id) => !before.has(id))
      if (added) useTourStore.getState().setRef(opts.refKey, added)
      return !!added
    },
  }
}

// ── lessons panel helpers ────────────────────────────────────────────────────

function lessonsOpen() {
  return !!document.querySelector('[data-tour="curriculum-next"]')
}

function lessonsClosedView(isTouch: boolean): StepView {
  return {
    target: '[data-tour="curriculum-open"]',
    gesture: 'tap',
    text: `${isTouch ? 'Tap' : 'Click'} the 🧠 brain on the left to open your lessons.`,
  }
}

/** Lesson steps point at the 🧠 button first if the panel is folded away. */
function whenLessonsOpen(isTouch: boolean, v: StepView): StepView {
  // Keep the bubble beside the lessons panel so it never hides what we're pointing at.
  return lessonsOpen() ? { ...v, avoid: [...(v.avoid ?? []), '[data-tour="lesson-panel"]'] } : lessonsClosedView(isTouch)
}

// ── the Getting Started tour ─────────────────────────────────────────────────────────────

export const TOUR_STEPS: TourStep[] = [
  addBlockStep({
    id: 'add-switch',
    emoji: '🎚️',
    title: 'Add your first block',
    menuSel: '[data-tour="menu-rule"]',
    menuLabel: '🔌 Rule-Based',
    itemSel: '[data-tour="palette-switch"]',
    itemLabel: 'the 🎚️ Switch',
    ids: () => useRuleStore.getState().switchBlocks.map((b) => b.id),
    refKey: 'switchId',
    // Start from a clean view: close Properties so the toolbar shows full labels.
    onEnter: () => {
      const ui = useUIStore.getState()
      ui.clearSelectedBlock()
      ui.setCanvasTool('select')
    },
  }),

  addBlockStep({
    id: 'add-bulb',
    emoji: '💡',
    title: 'Add a light bulb',
    menuSel: '[data-tour="menu-actions"]',
    menuLabel: '⚡ Actions',
    itemSel: '[data-tour="palette-bulb"]',
    itemLabel: 'the 💡 Bulb',
    ids: () => useWorkflowStore.getState().bulbBlocks.map((b) => b.id),
    refKey: 'bulbId',
  }),

  {
    id: 'move-bulb',
    emoji: '✋',
    title: 'Move a block',
    onEnter: () => useUIStore.getState().setCanvasTool('select'),
    // Pick a free spot next to the Switch and remember it in canvas coordinates.
    capture: () => {
      const swSel = nodeSel(tourSwitch()?.id)
      const sw = swSel ? document.querySelector(swSel) : null
      const canvas = document.querySelector('[data-tour="canvas"]')
      if (!sw || !canvas) return null
      const r = sw.getBoundingClientRect()
      const cr = canvas.getBoundingClientRect()
      // Only the part of the canvas actually on screen.
      const c = {
        left: Math.max(cr.left, 0),
        top: Math.max(cr.top, 0),
        right: Math.min(cr.right, window.innerWidth),
        bottom: Math.min(cr.bottom, window.innerHeight),
        width: 0,
        height: 0,
      }
      c.width = c.right - c.left
      c.height = c.bottom - c.top
      const z = readViewport()?.zoom ?? 1
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      const bSel = nodeSel(tourBulb()?.id)
      const bEl = bSel ? document.querySelector(bSel) : null
      const br = bEl?.getBoundingClientRect()
      const bulbAt = br ? { x: br.left + br.width / 2, y: br.top + br.height / 2 } : null
      const hw = (ZONE_W / 2) * z
      const hh = (ZONE_H / 2) * z

      // Things the spot must not sit on: the switch, the zoom buttons, the toolbar.
      const blockers = [
        r,
        document.querySelector('.react-flow__controls')?.getBoundingClientRect(),
        document.querySelector('[data-tour="menu-rule"]')?.closest('.glass-panel')?.getBoundingClientRect(),
      ].filter((b): b is DOMRect => !!b)
      const hits = (p: { x: number; y: number }) =>
        blockers.some(
          (b) => p.x + hw > b.left - 16 && p.x - hw < b.right + 16 && p.y + hh > b.top - 16 && p.y - hh < b.bottom + 16
        )
      const distFromBulb = (p: { x: number; y: number }) => (bulbAt ? Math.hypot(p.x - bulbAt.x, p.y - bulbAt.y) : 9999)

      // Scan the visible canvas for free spots; prefer one ~300px from the switch,
      // and the bulb must actually travel to get there.
      let best: { x: number; y: number } | null = null
      let bestScore = Infinity
      for (const minTravel of [220, 140]) {
        for (let x = c.left + hw + 16; x <= c.right - hw - 16; x += 24) {
          for (let y = c.top + hh + 16; y <= c.bottom - hh - 16; y += 24) {
            const p = { x, y }
            if (hits(p) || distFromBulb(p) < minTravel) continue
            // Right of the switch reads best (wire flows left → right, like the lessons).
            const score =
              Math.abs(Math.hypot(x - cx, y - cy) - 300 * z) + Math.abs(y - cy) * 0.3 + (x < cx + 120 * z ? 200 : 0)
            if (score < bestScore) { bestScore = score; best = p }
          }
        }
        if (best) break
      }
      const spot = best ?? { x: c.left + c.width / 2, y: c.top + c.height / 2 }
      // Remember it relative to the Switch (in canvas units), so it survives the canvas auto-fitting or moving.
      return { dx: (spot.x - cx) / z, dy: (spot.y - cy) / z }
    },
    recaptureIf: (baseline) => {
      const s = zoneCentre(baseline)
      const canvas = document.querySelector('[data-tour="canvas"]')
      const bSel = nodeSel(tourBulb()?.id)
      if (bSel && document.querySelector(bSel)?.classList.contains('dragging')) return false
      if (!s || !canvas) return false
      const c = canvas.getBoundingClientRect()
      const hw = (ZONE_W / 2) * s.zoom
      const hh = (ZONE_H / 2) * s.zoom
      return (
        s.x - hw < Math.max(c.left, 0) || s.x + hw > Math.min(c.right, window.innerWidth) ||
        s.y - hh < Math.max(c.top, 0) || s.y + hh > Math.min(c.bottom, window.innerHeight)
      )
    },
    view: ({ isTouch }, baseline) => {
      const s = zoneCentre(baseline)
      const zone = s ? { x: s.x, y: s.y, w: ZONE_W * s.zoom, h: ZONE_H * s.zoom } : undefined
      return {
        target: nodeSel(tourBulb()?.id),
        gesture: 'drag',
        dragToPoint: s ? { x: s.x, y: s.y } : undefined,
        zone,
        avoid: [nodeSel(tourSwitch()?.id)],
        text: isTouch
          ? 'Blocks can move! Press and hold the Bulb, then slide it into the glowing “Drop here” spot.'
          : 'Blocks can move! Click and hold the Bulb, then drag it into the glowing “Drop here” spot and let go.',
      }
    },
    isDone: (baseline) => {
      const s = zoneCentre(baseline)
      const sel = nodeSel(tourBulb()?.id)
      const el = sel ? document.querySelector(sel) : null
      if (!s || !el || el.classList.contains('dragging')) return false
      const r = el.getBoundingClientRect()
      const dx = r.left + r.width / 2 - s.x
      const dy = r.top + r.height / 2 - s.y
      return Math.hypot(dx, dy) < 55 * s.zoom
    },
  },

  {
    id: 'connect',
    emoji: '🔗',
    title: 'Connect the blocks',
    onEnter: () => useUIStore.getState().setCanvasTool('select'),
    view: ({ isTouch }) => {
      const from = handleSel(tourSwitch()?.id, 'rule-out')
      const to = handleSel(tourBulb()?.id, 'bulb-in')
      return {
        target: from,
        gesture: 'drag',
        dragTo: to ?? undefined,
        avoid: [nodeSel(tourSwitch()?.id), nodeSel(tourBulb()?.id)],
        text: `Blocks talk through their dots. ${isTouch ? 'Put your finger on' : 'Grab'} the green dot on the Switch and drag a wire to the dot on the Bulb.`,
      }
    },
    isDone: () => {
      const b = tourBulb()
      return !!b?.linkedRuleBlockId
    },
  },

  {
    id: 'toggle',
    emoji: '✨',
    title: 'Turn it on!',
    view: ({ isTouch }) => {
      const n = nodeSel(tourSwitch()?.id)
      return {
        target: n ? `${n} [data-tour="switch-toggle"]` : null,
        gesture: 'tap',
        avoid: [n, nodeSel(tourBulb()?.id)],
        text: `${isTouch ? 'Tap' : 'Click'} the switch to flip it ON. Watch what happens to the bulb!`,
      }
    },
    isDone: () => !!tourBulb()?.isOn,
  },

  {
    id: 'open-props',
    emoji: '⚙️',
    title: 'Open the Properties',
    onEnter: () => useUIStore.getState().setCanvasTool('select'),
    view: ({ isTouch }) => ({
      target: nodeSel(tourBulb()?.id),
      gesture: 'dblclick',
      avoid: [nodeSel(tourSwitch()?.id)],
      text: `It worked! 🎉 Every block has settings. ${isTouch ? 'Double-tap' : 'Double-click'} the Bulb to open its Properties.`,
    }),
    isDone: () => {
      const ui = useUIStore.getState()
      return !!ui.selectedBlockId && ui.selectedBlockId === tourBulb()?.id
    },
  },

  {
    id: 'rename',
    emoji: '✏️',
    title: 'Change a property',
    capture: () => tourBulb()?.name ?? '',
    view: ({ isTouch, find }) => {
      if (find('[data-tour="bulb-name-input"]')) {
        return {
          target: '[data-tour="bulb-name-input"]',
          gesture: 'tap',
          text: 'This is the Properties panel. Give your bulb a new name — try “My Lamp”!',
        }
      }
      return {
        target: nodeSel(tourBulb()?.id),
        gesture: 'dblclick',
        text: `The Properties panel closed. ${isTouch ? 'Double-tap' : 'Double-click'} the Bulb again to open it.`,
      }
    },
    isDone: (baseline) => {
      const name = tourBulb()?.name
      if (name === undefined || name.trim() === '' || name === baseline) return false
      // Don't jump away mid-word: wait until they've stopped typing for a moment.
      const now = Date.now()
      if (name !== renameWatch.name) { renameWatch.name = name; renameWatch.at = now; return false }
      return now - renameWatch.at > 1200
    },
  },

  {
    id: 'zoom',
    emoji: '🔍',
    title: 'Zoom in and out',
    capture: () => readViewport()?.zoom ?? null,
    view: ({ isTouch }) =>
      isTouch
        ? {
            target: '[data-tour="canvas"]',
            gesture: 'pinch',
            text: 'Pinch with two fingers to zoom in and out. You can also use the ➕ ➖ buttons in the corner.',
          }
        : {
            target: '.react-flow__controls',
            gesture: 'tap',
            text: 'Use ➕ and ➖ to zoom in and out. On a touchpad you can pinch, too. The ⛶ button fits everything on screen.',
          },
    isDone: (baseline) => {
      const z0 = (baseline as number) || 1
      const z = readViewport()?.zoom ?? z0
      return z / z0 > 1.12 || z / z0 < 0.89
    },
  },

  {
    id: 'pan',
    emoji: '🧭',
    title: 'Move around the canvas',
    capture: () => readViewport(),
    view: ({ isTouch }) => ({
      target: '[data-tour="canvas"]',
      gesture: 'pan',
      text: isTouch
        ? 'Drag an empty part of the canvas with one finger to slide around.'
        : 'Slide the canvas around: two-finger scroll on a touchpad, hold Space and drag, or pick the ✋ Hand tool and drag.',
    }),
    isDone: (baseline) => {
      const v0 = baseline as { x: number; y: number } | null
      const v = readViewport()
      if (!v0 || !v) return false
      return Math.abs(v.x - v0.x) + Math.abs(v.y - v0.y) > 80
    },
  },

  {
    id: 'open-lessons',
    emoji: '🧠',
    title: 'Your lessons',
    onEnter: () => {
      // Brand-new learners start from the very first chapter.
      const cur = useCurriculumStore.getState()
      if (cur.completedStepIds.length === 0 && CURRICULUM[0] && cur.currentModuleId !== CURRICULUM[0].id) {
        cur.setModule(CURRICULUM[0].id)
        cur.goToStep(0)
      }
    },
    skipIf: lessonsOpen,
    view: ({ isTouch }) => lessonsClosedView(isTouch),
    isDone: lessonsOpen,
  },

  {
    id: 'chapters',
    emoji: '📚',
    title: 'Chapters',
    view: ({ isTouch }) =>
      whenLessonsOpen(isTouch, {
        target: '[data-tour="chapter-picker"]',
        gesture: 'tap',
        prefer: 'side',
        text: `Your lessons are split into chapters. ${isTouch ? 'Tap' : 'Click'} the chapter name to see all of them.`,
      }),
    isDone: () => !!document.querySelector('[data-tour="chapter-list"]'),
  },

  {
    id: 'pick-chapter',
    emoji: '🗺️',
    title: 'Jump between chapters',
    view: ({ isTouch }) =>
      whenLessonsOpen(isTouch, {
        target: '[data-tour="chapter-list"]',
        gesture: 'tap',
        prefer: 'side',
        text: `Here are all the chapters, in order. ${isTouch ? 'Tap' : 'Click'} one to jump to it. New here? Pick the first one!`,
      }),
    // Done once the list closes again (a chapter was picked).
    isDone: () => lessonsOpen() && !document.querySelector('[data-tour="chapter-list"]'),
  },

  {
    id: 'card-number',
    emoji: '🔢',
    title: 'Where am I?',
    view: ({ isTouch }) => {
      const c = useCurriculumStore.getState()
      const mod = CURRICULUM.find((m) => m.id === c.currentModuleId) ?? CURRICULUM[0]
      const total = mod?.steps.length ?? 1
      return whenLessonsOpen(isTouch, {
        target: '[data-tour="lesson-progress"]',
        gesture: 'none',
        info: true,
        prefer: 'side',
        text: `Each chapter is a set of cards. The number on the right shows which card you are on: card ${c.currentStepIndex + 1} of ${total}. The bar fills up as you go.`,
      })
    },
    isDone: () => false,
  },

  {
    id: 'card-types',
    emoji: '🏷️',
    title: 'Learn → Lab → Challenge',
    view: ({ isTouch }) =>
      whenLessonsOpen(isTouch, {
        target: '[data-tour="lesson-type"]',
        gesture: 'none',
        info: true,
        prefer: 'side',
        text: [
          'This word tells you what kind of card it is:',
          '📖 LEARN (purple): a new idea, explained',
          '🧪 LAB (teal): a Guided Lab, build it step by step on the canvas',
          '🏆 CHALLENGE (orange): your turn to try it alone',
          'They come in that order: Learn → Lab → Challenge.',
        ].join('\n'),
      }),
    isDone: () => false,
  },

  {
    id: 'card-content',
    emoji: '📖',
    title: 'Read the card',
    view: ({ isTouch }) =>
      whenLessonsOpen(isTouch, {
        target: '[data-tour="lesson-content"]',
        gesture: 'none',
        info: true,
        prefer: 'side',
        text: 'The card is written here. Labs and Challenges show the goal and the steps to follow, so scroll down to read it all. Then build it on the canvas!',
      }),
    isDone: () => false,
  },

  {
    id: 'next-card',
    emoji: '➡️',
    title: 'Next card',
    capture: () => {
      const c = useCurriculumStore.getState()
      return { m: c.currentModuleId, i: c.currentStepIndex }
    },
    view: ({ isTouch }) =>
      whenLessonsOpen(isTouch, {
        target: '[data-tour="curriculum-next"]',
        gesture: 'tap',
        prefer: 'side',
        text: `${isTouch ? 'Tap' : 'Press'} Next → to go to the next card. On the last card of a chapter it becomes Next Chapter →.`,
      }),
    isDone: (baseline) => {
      const b = baseline as { m: string; i: number } | undefined
      const c = useCurriculumStore.getState()
      return !!b && (c.currentModuleId !== b.m || c.currentStepIndex !== b.i)
    },
  },

  {
    id: 'prev-card',
    emoji: '⬅️',
    title: 'Go back',
    skipIf: () => useCurriculumStore.getState().currentStepIndex === 0,
    capture: () => useCurriculumStore.getState().currentStepIndex,
    view: ({ isTouch }) =>
      whenLessonsOpen(isTouch, {
        target: '[data-tour="curriculum-prev"]',
        gesture: 'tap',
        prefer: 'side',
        text: `Want to read a card again? ${isTouch ? 'Tap' : 'Press'} ← Prev to go back one card.`,
      }),
    isDone: (baseline) => useCurriculumStore.getState().currentStepIndex < (baseline as number),
  },
]
