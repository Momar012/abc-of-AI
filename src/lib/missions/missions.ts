import { useRuleStore } from '@/store/useRuleStore'
import { useWorkflowStore } from '@/store/useWorkflowStore'
import { useUIStore } from '@/store/useUIStore'
import { useCurriculumStore } from '@/store/useCurriculumStore'
import { useMissionStore } from '@/store/useMissionStore'
import { CURRICULUM } from '@/data/curriculum'
import type { SensorType } from '@/types/rules'
import type { StepView } from '@/lib/tour/steps'
import { readViewport } from '@/lib/tour/steps'
import { canvasBlocks } from '@/lib/canvas/removeBlocks'

/**
 * Mini-missions ("The ABITA Challenge": 13 missions that make kids comfortable with the playground).
 * Source: Beaconhouse Bootcamp Day 1 deck, Mini Missions 1–13.
 *
 * Each mission:
 *  - steps:   the "Your Mission" checklist. An item ticks itself when its isDone() is true (and stays ticked).
 *             Its hint is what 💡 Hint highlights (same shape as a Getting Started step).
 *  - check:   the ✅ Success condition.
 * Every mission snapshots the canvas when it starts (snapshot()), so blocks that were already there don't count.
 * Missions unlock in order: mission N opens once mission N-1 is done.
 */

export interface MissionStep {
  text: string
  isDone: (baseline: unknown) => boolean
  /** What 💡 Hint highlights. A function can adapt, e.g. "open the menu first" if it closed again. */
  hint: StepView | (() => StepView)
}

export interface MissionDef {
  id: string
  emoji: string
  title: string
  steps: MissionStep[]
  success: string
  check: (baseline: unknown) => boolean
}

// ── block bookkeeping ────────────────────────────────────────────────────────

type Kind = 'switch' | 'bulb' | 'fan' | 'door' | 'condition' | 'sensor-temperature' | 'sensor-motion' | 'sensor-light'

const sensorIds = (t: SensorType) => useRuleStore.getState().sensorBlocks.filter((b) => b.sensorType === t).map((b) => b.id)

const IDS: Record<Kind, () => string[]> = {
  switch: () => useRuleStore.getState().switchBlocks.map((b) => b.id),
  bulb: () => useWorkflowStore.getState().bulbBlocks.map((b) => b.id),
  fan: () => useRuleStore.getState().fanBlocks.map((b) => b.id),
  door: () => useWorkflowStore.getState().doorBlocks.map((b) => b.id),
  condition: () => useRuleStore.getState().conditionBlocks.map((b) => b.id),
  'sensor-temperature': () => sensorIds('temperature'),
  'sensor-motion': () => sensorIds('motion'),
  'sensor-light': () => sensorIds('light'),
}

interface Snapshot {
  blocks: Partial<Record<Kind, string[]>>
  lesson: { m: string; i: number }
  /** Every block on the canvas when the mission started (any type). */
  nodes?: string[]
}

/** Taken when a mission starts: which blocks already exist, and where the lessons panel is. */
function snapshot(): Snapshot {
  const c = useCurriculumStore.getState()
  return {
    blocks: Object.fromEntries((Object.keys(IDS) as Kind[]).map((k) => [k, IDS[k]()])),
    lesson: { m: c.currentModuleId, i: c.currentStepIndex },
    nodes: canvasBlocks().map((n) => n.id),
  }
}

/** Blocks the kid added during this mission (to tidy up afterwards). */
export function missionBlocks(b: unknown) {
  const before = new Set(snap(b)?.nodes ?? [])
  return canvasBlocks().filter((n) => !before.has(n.id))
}

/** Blocks that were already on the canvas before this mission started. */
export function oldBlocks(b: unknown) {
  const before = new Set(snap(b)?.nodes ?? [])
  return canvasBlocks().filter((n) => before.has(n.id))
}

const snap = (b: unknown) => (b && typeof b === 'object' && 'blocks' in b ? (b as Snapshot) : null)

/** Blocks of this kind added since the mission started (oldest first). */
export const newIds = (b: unknown, kind: Kind) => {
  const before = new Set(snap(b)?.blocks[kind] ?? [])
  return IDS[kind]().filter((id) => !before.has(id))
}
export const hasNew = (b: unknown, kind: Kind) => newIds(b, kind).length > 0
const newest = (b: unknown, kind: Kind) => newIds(b, kind).at(-1)

/** Targets (bulb / fan / door) that are wired to a Switch, where the switch or the target is new. */
function switchLinks(b: unknown, target: 'bulb' | 'fan' | 'door') {
  const switches = new Set(IDS.switch())
  const freshSwitches = new Set(newIds(b, 'switch'))
  const freshTargets = new Set(newIds(b, target))
  const list =
    target === 'bulb' ? useWorkflowStore.getState().bulbBlocks
    : target === 'door' ? useWorkflowStore.getState().doorBlocks
    : useRuleStore.getState().fanBlocks
  return list
    .filter((t) => t.linkedRuleBlockId && switches.has(t.linkedRuleBlockId))
    .filter((t) => freshTargets.has(t.id) || freshSwitches.has(t.linkedRuleBlockId!))
    .map((t) => ({ targetId: t.id, switchId: t.linkedRuleBlockId! }))
}
const switchConnectedTo = (b: unknown, target: 'bulb' | 'fan' | 'door') => switchLinks(b, target).length > 0

// ── DOM helpers ──────────────────────────────────────────────────────────────

/** True if a selector is on screen right now (e.g. a menu item, so the menu is open). */
export const visible = (selector: string) => {
  const el = document.querySelector(selector)
  if (!el) return false
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0
}

const nodeSel = (id: string | undefined) => (id ? `.react-flow__node[data-id="${id}"]` : null)
const nodeRect = (id: string | undefined) => {
  const sel = nodeSel(id)
  const el = sel ? document.querySelector(sel) : null
  return el && !el.classList.contains('dragging') ? el.getBoundingClientRect() : null
}

/** The part of the canvas that's actually on screen. */
function canvasView() {
  const r = document.querySelector('[data-tour="canvas"]')?.getBoundingClientRect()
  if (!r) return null
  const left = Math.max(r.left, 0)
  const right = Math.min(r.right, window.innerWidth)
  const top = Math.max(r.top, 0)
  const bottom = Math.min(r.bottom, window.innerHeight)
  return { left, right, top, bottom, width: right - left, height: bottom - top }
}

// "Locate" checks: remember which tagged UI items (data-tour="…") the kid has pointed at
// (mouse/touchpad hover, or a finger press on a touchscreen) during the current mission.
const pointedKeys = new Set<string>()
let pointerWatching = false
function watchPointer() {
  if (pointerWatching || typeof document === 'undefined') return
  pointerWatching = true
  const record = (e: Event) => {
    const el = (e.target as Element | null)?.closest?.('[data-tour]')
    const key = el?.getAttribute('data-tour')
    if (key) pointedKeys.add(key)
  }
  document.addEventListener('pointerover', record, true)
  document.addEventListener('pointerdown', record, true)
}

/** True once the kid has put their pointer (or finger) on this data-tour item during this mission. */
export const pointedAt = (dataTourKey: string) => {
  watchPointer()
  return pointedKeys.has(dataTourKey)
}

// "Move" checks: where each block was when we first saw it, so we know it was really dragged.
const firstSeenAt = new Map<string, { x: number; y: number }>()
/** A block's position on the canvas, read from the node itself (React Flow sets transform: translate(x, y)). */
function blockPos(id: string) {
  const sel = nodeSel(id)
  const el = sel ? (document.querySelector(sel) as HTMLElement | null) : null
  if (!el || !el.style.transform) return null
  const m = new DOMMatrixReadOnly(el.style.transform)
  return { x: m.e, y: m.f }
}
function wasMoved(id: string | undefined) {
  if (!id) return false
  const p = blockPos(id)
  if (!p) return false
  const first = firstSeenAt.get(id)
  if (!first) { firstSeenAt.set(id, { ...p }); return false }
  return Math.hypot(p.x - first.x, p.y - first.y) > 30
}

/** A new block of this kind that was dragged into the left (or right) half of the visible canvas. */
function movedToSide(b: unknown, kind: Kind, side: 'left' | 'right') {
  const c = canvasView()
  if (!c) return false
  const mid = c.left + c.width / 2
  return newIds(b, kind).some((id) => {
    const moved = wasMoved(id)
    const r = nodeRect(id)
    if (!r || !moved) return false
    const cx = r.left + r.width / 2
    return side === 'left' ? cx < mid : cx > mid
  })
}

/** The three blocks don't overlap and sit in a tidy row or column — and the kid moved at least one. */
function neatlyArranged(b: unknown, kinds: Kind[]) {
  const ids = kinds.map((k) => newest(b, k))
  if (ids.some((id) => !id)) return false
  const moved = ids.map((id) => wasMoved(id)).some(Boolean)
  const rects = ids.map((id) => nodeRect(id))
  if (rects.some((r) => !r)) return false
  const rs = rects as DOMRect[]
  const gap = 8
  for (let i = 0; i < rs.length; i++)
    for (let j = i + 1; j < rs.length; j++) {
      const a = rs[i], o = rs[j]
      const overlap = a.left < o.right + gap && o.left < a.right + gap && a.top < o.bottom + gap && o.top < a.bottom + gap
      if (overlap) return false
    }
  const zoom = readViewport()?.zoom ?? 1
  const tol = 70 * zoom
  const cx = rs.map((r) => r.left + r.width / 2)
  const cy = rs.map((r) => r.top + r.height / 2)
  const row = Math.max(...cy) - Math.min(...cy) < tol
  const col = Math.max(...cx) - Math.min(...cx) < tol
  return moved && (row || col)
}

// ── toolbar menus & palette items ────────────────────────────────────────────

const MENUS = {
  rule: { sel: '[data-tour="menu-rule"]', label: '🔌 Rule-Based' },
  actions: { sel: '[data-tour="menu-actions"]', label: '⚡ Actions' },
} as const
type Menu = keyof typeof MENUS

const ITEMS: Record<Kind, { menu: Menu; label: string; section: string }> = {
  'sensor-temperature': { menu: 'rule', label: '🌡️ Temperature', section: '📡 Sensors' },
  'sensor-motion': { menu: 'rule', label: '👁️ Motion', section: '📡 Sensors' },
  'sensor-light': { menu: 'rule', label: '💡 Light Level', section: '📡 Sensors' },
  switch: { menu: 'rule', label: '🎚️ Switch', section: '🎚️ Manual Input' },
  condition: { menu: 'rule', label: '📋 IF Condition', section: '🔢 Logic' },
  bulb: { menu: 'actions', label: '💡 Bulb', section: 'ML Actions' },
  door: { menu: 'actions', label: '🚪 Door', section: 'ML Actions' },
  fan: { menu: 'actions', label: '🌀 Fan', section: 'Rule Actions' },
}
const itemSel = (k: Kind) => `[data-tour="palette-${k}"]`
const CANVAS = '[data-tour="canvas"]'

const openMenuHint = (menu: Menu): StepView => ({
  target: MENUS[menu].sel,
  gesture: 'tap',
  text: `The ${MENUS[menu].label} menu is in the toolbar at the top. Click it!`,
})

/** "Open the menu" — done once any item of that menu is showing (or the block is already added). */
const menuOpen = (menu: Menu) =>
  (Object.keys(ITEMS) as Kind[]).some((k) => ITEMS[k].menu === menu && visible(itemSel(k)))

const locateHint = (k: Kind) => (): StepView =>
  visible(itemSel(k))
    ? { target: itemSel(k), gesture: 'tap', prefer: 'side', text: `Look under ${ITEMS[k].section}. Can you find ${ITEMS[k].label}? Put your pointer on it.` }
    : { ...openMenuHint(ITEMS[k].menu), text: `Open ${MENUS[ITEMS[k].menu].label} first. ${ITEMS[k].label} is under ${ITEMS[k].section}.` }

const dragHint = (k: Kind) => (): StepView =>
  visible(itemSel(k))
    ? { target: itemSel(k), gesture: 'drag', dragTo: CANVAS, prefer: 'side', text: `Grab ${ITEMS[k].label} and drag it onto the canvas.` }
    : { ...openMenuHint(ITEMS[k].menu), text: `Open ${MENUS[ITEMS[k].menu].label}, then drag ${ITEMS[k].label} onto the canvas.` }

// Step builders
const openMenuStep = (menu: Menu, alsoDoneIf: (b: unknown) => boolean): MissionStep => ({
  text: `Open the ${menu === 'rule' ? 'Rule-Based' : 'Actions'} menu.`,
  isDone: (b) => menuOpen(menu) || alsoDoneIf(b),
  hint: openMenuHint(menu),
})
const locateStep = (text: string, k: Kind): MissionStep => ({
  text,
  isDone: (b) => pointedAt(`palette-${k}`) || hasNew(b, k),
  hint: locateHint(k),
})
const dragStep = (text: string, k: Kind): MissionStep => ({ text, isDone: (b) => hasNew(b, k), hint: dragHint(k) })

/** Wire hint: from the newest Switch's dot to the target's dot. */
const connectHint = (target: 'bulb' | 'fan' | 'door', label: string) => (b: unknown): StepView => {
  const handle = { bulb: 'bulb-in', fan: 'fan-in', door: 'door-in' }[target]
  const sw = newest(b, 'switch') ?? IDS.switch().at(-1)
  // Prefer a target that isn't wired yet.
  const linked = new Set(switchLinks(b, target).map((l) => l.targetId))
  const tgt = newIds(b, target).find((id) => !linked.has(id)) ?? newest(b, target) ?? IDS[target]().at(-1)
  return {
    target: sw ? `.react-flow__handle[data-nodeid="${sw}"][data-handleid="rule-out"]` : null,
    gesture: 'drag',
    dragTo: tgt ? `.react-flow__handle[data-nodeid="${tgt}"][data-handleid="${handle}"]` : undefined,
    avoid: [nodeSel(sw), nodeSel(tgt)],
    text: `Drag a wire from the green dot on the Switch to the dot on the ${label}.`,
  }
}
const currentBaseline = () => useMissionStore.getState().baseline

/** A "drop here" spot in the left or right part of the visible canvas, for the Move mission. */
const sideHint = (kind: Kind, side: 'left' | 'right', label: string) => (): StepView => {
  const b = currentBaseline()
  const id = newest(b, kind)
  const c = canvasView()
  const zoom = readViewport()?.zoom ?? 1
  const spot = c ? { x: c.left + c.width * (side === 'left' ? 0.22 : 0.78), y: c.top + c.height * 0.55 } : undefined
  return {
    target: nodeSel(id),
    gesture: 'drag',
    dragToPoint: spot,
    zone: spot ? { ...spot, w: 180 * zoom, h: 160 * zoom } : undefined,
    text: `Click and hold the ${label}, then drag it to the ${side} side of the canvas.`,
  }
}

/** A simple "find a block in a menu and drag it out" mission (Missions 1, 2, 3, 4, 6). */
function findBlockMission(o: { id: string; emoji: string; title: string; kind: Kind; name: string }): MissionDef {
  return {
    id: o.id,
    emoji: o.emoji,
    title: o.title,
    steps: [
      openMenuStep(ITEMS[o.kind].menu, (b) => hasNew(b, o.kind)),
      locateStep(`Locate the ${o.name}.`, o.kind),
      dragStep('Drag it onto the Canvas.', o.kind),
    ],
    success: `The ${o.name} is visible on the Canvas.`,
    check: (b) => hasNew(b, o.kind),
  }
}

// ── curriculum (Mission 5) ───────────────────────────────────────────────────

const CHAPTER_2 = CURRICULUM.find((m) => m.title.trim().startsWith('2.')) ?? CURRICULUM[2]
const SLIDE_15 = 14 // zero-based
const lessonsOpen = () => visible('[data-tour="curriculum-next"]')
const inChapter2 = () => useCurriculumStore.getState().currentModuleId === CHAPTER_2?.id
const onSlide15 = () => inChapter2() && useCurriculumStore.getState().currentStepIndex === SLIDE_15
let lessonLeftStart = false

// ── the missions ─────────────────────────────────────────────────────────────

export const MISSIONS: MissionDef[] = [
  findBlockMission({ id: 'm01-find-temp-sensor', emoji: '🌡️', title: 'Find the Temperature Sensor', kind: 'sensor-temperature', name: 'Temperature Sensor' }),
  findBlockMission({ id: 'm02-find-switch', emoji: '🎚️', title: 'Find the Switch', kind: 'switch', name: 'Switch' }),
  findBlockMission({ id: 'm03-find-bulb', emoji: '💡', title: 'Find the Bulb', kind: 'bulb', name: 'Bulb' }),
  findBlockMission({ id: 'm04-find-fan', emoji: '🌀', title: 'Find the Fan', kind: 'fan', name: 'Fan' }),

  {
    id: 'm05-explore-curriculum',
    emoji: '🧠',
    title: 'Explore the Curriculum',
    steps: [
      {
        text: 'Open the Curriculum.',
        isDone: () => lessonsOpen(),
        hint: { target: '[data-tour="curriculum-open"]', gesture: 'tap', text: 'Click the 🧠 brain on the left to open the Curriculum.' },
      },
      {
        text: 'Find Chapter 2.',
        isDone: () => (CHAPTER_2 ? pointedAt(`chapter-${CHAPTER_2.id}`) : false) || inChapter2(),
        hint: () =>
          !lessonsOpen()
            ? { target: '[data-tour="curriculum-open"]', gesture: 'tap', text: 'Open the Curriculum first: click the 🧠 brain.' }
            : visible('[data-tour="chapter-list"]') && CHAPTER_2
            ? { target: `[data-tour="chapter-${CHAPTER_2.id}"]`, gesture: 'tap', prefer: 'side', avoid: ['[data-tour="lesson-panel"]'], text: `Here it is: ${CHAPTER_2.title}. Click it!` }
            : { target: '[data-tour="chapter-picker"]', gesture: 'tap', prefer: 'side', avoid: ['[data-tour="lesson-panel"]'], text: 'Click the chapter name to see all the chapters.' },
      },
      {
        text: 'Navigate to Slide 15.',
        isDone: () => onSlide15(),
        hint: () => {
          const c = useCurriculumStore.getState()
          if (!lessonsOpen()) return { target: '[data-tour="curriculum-open"]', gesture: 'tap', text: 'Open the Curriculum first: click the 🧠 brain.' }
          if (!inChapter2()) return { target: '[data-tour="chapter-picker"]', gesture: 'tap', prefer: 'side', avoid: ['[data-tour="lesson-panel"]'], text: 'Pick Chapter 2 first: click the chapter name.' }
          const forward = c.currentStepIndex < SLIDE_15
          return {
            target: forward ? '[data-tour="curriculum-next"]' : '[data-tour="curriculum-prev"]',
            gesture: 'tap',
            prefer: 'side',
            avoid: ['[data-tour="lesson-panel"]'],
            text: `You are on slide ${c.currentStepIndex + 1}. Press ${forward ? 'Next →' : '← Prev'} until the number says 15.`,
          }
        },
      },
    ],
    success: 'Chapter 2, Slide 15 is open.',
    check: (b) => {
      // If they happened to start on Chapter 2 / Slide 15 already, they have to navigate away and back.
      const s = snap(b)
      const startedThere = !!s && s.lesson.m === CHAPTER_2?.id && s.lesson.i === SLIDE_15
      if (!onSlide15()) { lessonLeftStart = true; return false }
      return !startedThere || lessonLeftStart
    },
  },

  findBlockMission({ id: 'm06-find-if', emoji: '📋', title: 'Find the IF Condition', kind: 'condition', name: 'IF Condition block' }),

  {
    id: 'm07-tiny-collection',
    emoji: '🧺',
    title: 'Build a Tiny Block Collection',
    steps: [
      openMenuStep('rule', (b) => hasNew(b, 'switch') || hasNew(b, 'sensor-temperature') || hasNew(b, 'sensor-motion')),
      dragStep('Drag a Switch onto the Canvas.', 'switch'),
      dragStep('Drag a Temperature Sensor onto the Canvas.', 'sensor-temperature'),
      dragStep('Drag a Motion Sensor onto the Canvas.', 'sensor-motion'),
    ],
    success: 'All three blocks are visible on the Canvas.',
    check: (b) => hasNew(b, 'switch') && hasNew(b, 'sensor-temperature') && hasNew(b, 'sensor-motion'),
  },

  {
    id: 'm08-two-block-setup',
    emoji: '🔗',
    title: 'Build Your First Two-Block Setup',
    steps: [
      dragStep('Drag a Switch onto the Canvas.', 'switch'),
      openMenuStep('actions', (b) => hasNew(b, 'bulb')),
      dragStep('Drag a Bulb onto the Canvas.', 'bulb'),
      {
        text: 'Connect the Switch to the Bulb.',
        isDone: (b) => switchConnectedTo(b, 'bulb'),
        hint: () => connectHint('bulb', 'Bulb')(currentBaseline()),
      },
    ],
    success: 'The Switch and Bulb are connected.',
    check: (b) => switchConnectedTo(b, 'bulb'),
  },

  {
    id: 'm09-move-blocks',
    emoji: '✋',
    title: 'Move Your Blocks',
    steps: [
      dragStep('Drag a Switch onto the Canvas.', 'switch'),
      dragStep('Drag a Bulb onto the Canvas.', 'bulb'),
      { text: 'Move the Switch to the left side of the Canvas.', isDone: (b) => movedToSide(b, 'switch', 'left'), hint: sideHint('switch', 'left', 'Switch') },
      { text: 'Move the Bulb to the right side of the Canvas.', isDone: (b) => movedToSide(b, 'bulb', 'right'), hint: sideHint('bulb', 'right', 'Bulb') },
    ],
    success: 'Both blocks are placed where you want them.',
    check: (b) => movedToSide(b, 'switch', 'left') && movedToSide(b, 'bulb', 'right'),
  },

  {
    id: 'm10-three-block-setup',
    emoji: '🧩',
    title: 'Make a Three-Block Setup',
    steps: [
      dragStep('Drag a Switch onto the Canvas.', 'switch'),
      dragStep('Drag a Bulb onto the Canvas.', 'bulb'),
      dragStep('Drag a Fan onto the Canvas.', 'fan'),
      {
        text: 'Arrange the three blocks neatly on the Canvas.',
        isDone: (b) => neatlyArranged(b, ['switch', 'bulb', 'fan']),
        hint: () => {
          const b = currentBaseline()
          const sw = nodeRect(newest(b, 'switch'))
          const zoom = readViewport()?.zoom ?? 1
          return {
            target: nodeSel(newest(b, 'bulb')),
            gesture: 'drag',
            dragToPoint: sw ? { x: sw.left + sw.width / 2 + 230 * zoom, y: sw.top + sw.height / 2 } : undefined,
            avoid: [nodeSel(newest(b, 'switch')), nodeSel(newest(b, 'fan'))],
            text: 'Line the three blocks up in a neat row (or a column), with a little space between them. Drag them one by one.',
          }
        },
      },
    ],
    success: 'All three blocks are visible and neatly arranged.',
    check: (b) => neatlyArranged(b, ['switch', 'bulb', 'fan']),
  },

  {
    id: 'm11-explore-sensor',
    emoji: '🔎',
    title: 'Find and Explore a Sensor',
    steps: [
      openMenuStep('rule', (b) => hasNew(b, 'sensor-light')),
      locateStep('Find the Light Sensor.', 'sensor-light'),
      dragStep('Drag it onto the Canvas.', 'sensor-light'),
      {
        text: "Open the Light Sensor's properties.",
        isDone: (b) => {
          const sel = useUIStore.getState().selectedBlockId
          return !!sel && newIds(b, 'sensor-light').includes(sel)
        },
        hint: () => ({
          target: nodeSel(newest(currentBaseline(), 'sensor-light')),
          gesture: 'dblclick',
          text: 'Double-click the Light Sensor to open its properties. (Use the arrow tool, not the ✋ hand.)',
        }),
      },
    ],
    success: "The Light Sensor's properties are visible.",
    check: (b) => {
      const sel = useUIStore.getState().selectedBlockId
      return !!sel && newIds(b, 'sensor-light').includes(sel)
    },
  },

  {
    id: 'm12-switch-door',
    emoji: '🚪',
    title: 'Connect Switch to Door',
    steps: [
      dragStep('Drag a Switch onto the Canvas.', 'switch'),
      openMenuStep('actions', (b) => hasNew(b, 'door')),
      dragStep('Drag a Door onto the Canvas.', 'door'),
      {
        text: 'Connect the Switch to the Door.',
        isDone: (b) => switchConnectedTo(b, 'door'),
        hint: () => connectHint('door', 'Door')(currentBaseline()),
      },
    ],
    success: 'The Switch and Door are connected.',
    check: (b) => switchConnectedTo(b, 'door'),
  },

  {
    id: 'm13-switch-bulb-fan',
    emoji: '⚡',
    title: 'Connect Switch to Bulb and Fan',
    steps: [
      dragStep('Drag a Switch onto the Canvas.', 'switch'),
      openMenuStep('actions', (b) => hasNew(b, 'bulb') || hasNew(b, 'fan')),
      {
        text: 'Drag a Bulb and Fan onto the Canvas.',
        isDone: (b) => hasNew(b, 'bulb') && hasNew(b, 'fan'),
        hint: () => (hasNew(currentBaseline(), 'bulb') ? dragHint('fan')() : dragHint('bulb')()),
      },
      {
        text: 'Connect the Switch to both the Bulb and the Fan.',
        isDone: (b) => switchToBoth(b),
        hint: () => {
          const b = currentBaseline()
          return switchConnectedTo(b, 'bulb') ? connectHint('fan', 'Fan')(b) : connectHint('bulb', 'Bulb')(b)
        },
      },
    ],
    success: 'The Switch is connected to the Bulb and the Fan.',
    check: (b) => switchToBoth(b),
  },
]

/** One switch wired to both a bulb and a fan. */
function switchToBoth(b: unknown) {
  const bulbSwitches = new Set(switchLinks(b, 'bulb').map((l) => l.switchId))
  return switchLinks(b, 'fan').some((l) => bulbSwitches.has(l.switchId))
}

/** How many missions the full set has (the badge needs all of them). */
export const MISSION_TOTAL = 13

export const resolveHint = (h: MissionStep['hint']): StepView => (typeof h === 'function' ? h() : h)

export const missionNumber = (id: string) => MISSIONS.findIndex((m) => m.id === id) + 1

/** Begin (or replay) a mission: snapshot the canvas so only new work counts. */
export function startMission(id: string) {
  const m = MISSIONS.find((x) => x.id === id)
  if (!m) return
  pointedKeys.clear() // a fresh attempt has to find things again
  firstSeenAt.clear()
  lessonLeftStart = false
  watchPointer()
  useMissionStore.getState().start(m.id, snapshot())
}

/** Mission N is open once mission N-1 is done. */
export function isUnlocked(index: number, results: Record<string, unknown>) {
  if (index === 0) return true
  const prev = MISSIONS[index - 1]
  return !!prev && !!results[prev.id]
}
