import { useRuleStore } from '@/store/useRuleStore'
import { useUIStore } from '@/store/useUIStore'
import type { StepView } from '@/lib/tour/steps'
import { allBlocks, GuideKind, handleSel, KINDS, MENU_LABEL, MENU_SEL, nodeSel, paletteSel } from './blocks'
import type { LabAction, LabLine } from './parseLab'

/** Which blocks already existed when the kid opened the lab card (so old blocks don't count). */
export type LabSnapshot = string[]

export const takeSnapshot = (): LabSnapshot => allBlocks().map((b) => b.id)

const isVisible = (sel: string) => {
  const el = document.querySelector(sel)
  if (!el) return false
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0
}

// ── "it just happened" events (for experiment steps like "Turn ON the switch") ─────────────

let lastOn = new Map<string, boolean>()
const switchOnEvents: number[] = []

/** Call every tick: notices switches being flipped on. */
export function recordEvents() {
  const now = Date.now()
  const next = new Map<string, boolean>()
  for (const b of allBlocks()) {
    if (b.kind !== 'switch') continue
    next.set(b.id, !!b.isOn)
    if (b.isOn && lastOn.get(b.id) === false) switchOnEvents.push(now)
  }
  lastOn = next
}

// ── done checks ──────────────────────────────────────────────────────────────

const isNew = (snap: LabSnapshot) => {
  const before = new Set(snap)
  return (id: string) => !before.has(id)
}

function links(from: GuideKind, to: GuideKind, snap: LabSnapshot) {
  const blocks = allBlocks()
  const kindOf = new Map(blocks.map((b) => [b.id, b.kind]))
  const fresh = isNew(snap)
  const pairs: Array<{ source: string; target: string }> = []
  for (const t of blocks) {
    if (t.kind !== to) continue
    for (const s of t.inputs) if (kindOf.get(s) === from && (fresh(s) || fresh(t.id))) pairs.push({ source: s, target: t.id })
  }
  return pairs
}

const sameValue = (a: unknown, b: unknown) =>
  typeof b === 'number' ? Number(a) === b : typeof b === 'boolean' ? a === b : String(a ?? '').trim() === String(b).trim()

/** Is this action's "what you should see" true right now? (ignores timing) */
export function matches(a: LabAction, snap: LabSnapshot): boolean {
  const blocks = allBlocks()
  const fresh = isNew(snap)
  switch (a.type) {
    case 'add':
      return blocks.filter((b) => b.kind === a.kind && fresh(b.id)).length >= a.n
    case 'connect':
      return links(a.from, a.to, snap).length >= a.n
    case 'props': {
      const sel = useUIStore.getState().selectedBlockId
      return !!sel && blocks.some((b) => b.id === sel && b.kind === a.kind)
    }
    case 'condOp':
      return blocks.some((b) => b.kind === 'condition' && b.operator === a.op && (a.value === undefined || sameValue(b.threshold, a.value)))
    case 'condValue':
      return blocks.some((b) => b.kind === 'condition' && String(b.threshold ?? '').trim().toLowerCase() === String(a.value).toLowerCase())
    case 'switch': {
      const sw = blocks.filter((b) => b.kind === 'switch')
      return a.on ? sw.filter((b) => b.isOn).length >= a.n : sw.some((b) => !b.isOn)
    }
    case 'motion':
      return blocks.some((b) => b.kind === 'sensor-motion' && Boolean(b.value) === a.detected)
    case 'sensorValue':
      return blocks.some((b) => b.kind === a.kind && Number(b.value) === a.value)
    case 'text':
      return blocks.some((b) => b.kind === 'sensor-text' && String(b.value ?? '').trim() === a.value)
    case 'manual':
      return false
  }
}

/**
 * Done check for the step the kid is on. `since` = when this step became the current one.
 * "Turn ON" steps need a fresh flip, so "Turn ON only the second Switch" doesn't pass just
 * because the first switch is still on from the step before.
 */
export function isDone(a: LabAction, snap: LabSnapshot, since: number): boolean {
  if (!matches(a, snap)) return false
  if (a.type === 'switch' && a.on) return switchOnEvents.some((t) => t >= since)
  return true
}

/** Steps whose result is about the canvas layout (can tick even when they aren't the current step). */
export const isStructural = (a: LabAction) => ['add', 'connect', 'props', 'condOp', 'condValue'].includes(a.type)

// ── hints (what 👆 Show me points at) ────────────────────────────────────────

function newestOf(kind: GuideKind, snap: LabSnapshot) {
  const fresh = isNew(snap)
  const list = allBlocks().filter((b) => b.kind === kind)
  return (list.filter((b) => fresh(b.id)).at(-1) ?? list.at(-1)) || null
}

function freeInHandle(targetId: string, kind: GuideKind) {
  const ins = KINDS[kind].in ?? []
  if (kind.startsWith('logic-') && ins.length > 1) {
    const lb = useRuleStore.getState().logicBlocks.find((b) => b.id === targetId)
    const slot = lb ? lb.linkedInputIds.findIndex((x) => !x) : 0
    return ins[Math.max(0, slot)] ?? ins[0]
  }
  return ins[0]
}

export function hintFor(a: LabAction, snap: LabSnapshot, lineText: string): StepView {
  switch (a.type) {
    case 'add': {
      const info = KINDS[a.kind]
      return isVisible(paletteSel(a.kind))
        ? { target: paletteSel(a.kind), gesture: 'drag', dragTo: '[data-tour="canvas"]', prefer: 'side', text: `Drag ${info.label} onto the canvas.` }
        : { target: MENU_SEL[info.menu], gesture: 'tap', text: `Open ${MENU_LABEL[info.menu]} in the toolbar. ${info.label} is in there.` }
    }
    case 'connect': {
      const blocks = allBlocks()
      const fresh = isNew(snap)
      const already = new Set(links(a.from, a.to, snap).map((l) => `${l.source}>${l.target}`))
      const sources = blocks.filter((b) => b.kind === a.from).sort((x, y) => Number(fresh(y.id)) - Number(fresh(x.id)))
      const targets = blocks.filter((b) => b.kind === a.to).sort((x, y) => Number(fresh(y.id)) - Number(fresh(x.id)))
      let pick: { s: string; t: string } | null = null
      for (const t of targets) {
        const full = (KINDS[t.kind].in?.length ?? 1) <= t.inputs.length
        if (full) continue
        const s = sources.find((s) => s.id !== t.id && !already.has(`${s.id}>${t.id}`) && !t.inputs.includes(s.id))
        if (s) { pick = { s: s.id, t: t.id }; break }
      }
      if (!pick) {
        return { target: null, gesture: 'none', text: `Add the blocks first, then connect ${KINDS[a.from].label} to ${KINDS[a.to].label}.` }
      }
      return {
        target: handleSel(pick.s, KINDS[a.from].out ?? 'rule-out'),
        gesture: 'drag',
        dragTo: handleSel(pick.t, freeInHandle(pick.t, a.to)) ?? undefined,
        avoid: [nodeSel(pick.s), nodeSel(pick.t)],
        text: `Drag from the dot on the right of ${KINDS[a.from].label} to the dot on the left of ${KINDS[a.to].label}.`,
      }
    }
    case 'props': {
      const b = newestOf(a.kind, snap)
      return { target: nodeSel(b?.id), gesture: 'dblclick', text: `Double-click ${KINDS[a.kind].label} to open its settings.` }
    }
    case 'condOp':
    case 'condValue': {
      const ui = useUIStore.getState()
      const open = ui.selectedBlockType === 'condition' && isVisible('[data-properties-panel]')
      const want =
        a.type === 'condValue'
          ? `type “${a.value}” in the value box`
          : a.op === 'is'
          ? `pick “${a.value ? 'Motion Detected' : 'No Motion'}”`
          : `choose “${a.op}”${a.value !== undefined ? ` and set the value to ${a.value}` : ''}`
      return open
        ? { target: '[data-properties-panel]', gesture: 'tap', prefer: 'side', text: `In the IF Condition settings, ${want}.` }
        : { target: nodeSel(newestOf('condition', snap)?.id), gesture: 'dblclick', text: `Double-click the IF Condition first, then ${want}.` }
    }
    case 'switch': {
      const sw = allBlocks().filter((b) => b.kind === 'switch')
      const pickSw = sw.find((b) => (a.on ? !b.isOn : b.isOn)) ?? sw.at(-1)
      const n = nodeSel(pickSw?.id)
      return { target: n ? `${n} [data-tour="switch-toggle"]` : null, gesture: 'tap', text: `Click the switch to turn it ${a.on ? 'ON' : 'OFF'}, then watch what happens.` }
    }
    case 'motion': {
      const b = newestOf('sensor-motion', snap)
      return { target: nodeSel(b?.id), gesture: 'tap', text: `Click the button on the Motion Sensor so it says “${a.detected ? 'Motion Detected' : 'No Motion'}”.` }
    }
    case 'sensorValue': {
      const b = newestOf(a.kind, snap)
      const unit = a.kind === 'sensor-temperature' ? '°C' : a.kind === 'sensor-humidity' || a.kind === 'sensor-light' ? '%' : ''
      return { target: nodeSel(b?.id), gesture: 'tap', text: `Move the slider on the ${KINDS[a.kind].label} sensor to ${a.value}${unit}. The – and + buttons help you hit it exactly.` }
    }
    case 'text': {
      const b = newestOf('sensor-text', snap)
      return { target: nodeSel(b?.id), gesture: 'tap', text: `Type “${a.value}” into the Text Input and press Send.` }
    }
    case 'manual':
      return { target: null, gesture: 'none', text: `${lineText} When you've done it, tap ✓ Done.` }
  }
}

// ── "No, it didn't work" → what to fix ─────────────────────────────────────────

const showValue = (op: string | undefined, v: unknown) =>
  op === 'is' ? (v ? 'Motion Detected' : 'No Motion') : `${op ?? ''} ${String(v ?? '').trim() || '(empty)'}`.trim()

/** If a condition step fails, compare it with the IF Conditions actually on the canvas. */
function conditionMismatch(a: LabAction, others: LabAction[]): string | null {
  if (a.type !== 'condOp' && a.type !== 'condValue') return null
  // Skip IF Conditions that already do another step's job (Lab: one IF for MONEY, a new one for MonEy).
  const takenBy = (b: ReturnType<typeof allBlocks>[number]) =>
    others.some(
      (o) =>
        (o.type === 'condOp' || o.type === 'condValue') &&
        o.value !== undefined &&
        String(b.threshold ?? '').trim() === String(o.value).trim() &&
        (o.type === 'condValue' || b.operator === o.op)
    )
  const all = allBlocks().filter((b) => b.kind === 'condition')
  const conds = all.filter((b) => !takenBy(b)).length ? all.filter((b) => !takenBy(b)) : all
  if (!conds.length) return null
  const want = a.value
  const wantOp = a.type === 'condOp' ? a.op : undefined
  // Same words, different capitals: the classic password mistake.
  if (typeof want === 'string') {
    const near = conds.find((b) => String(b.threshold ?? '').trim().toLowerCase() === want.toLowerCase())
    if (near) return `You typed **${String(near.threshold).trim()}** but this lab needs **${want}**. Capital letters matter!`
  }
  if (wantOp && wantOp !== 'is' && !conds.some((b) => b.operator === wantOp)) {
    return `Your IF Condition uses **${conds.at(-1)!.operator ?? '?'}**, but this lab needs **${wantOp}**.`
  }
  if (want === undefined) return null
  const same = conds.filter((b) => !wantOp || b.operator === wantOp)
  const pick =
    typeof want === 'number'
      ? [...same].sort((x, y) => Math.abs(Number(x.threshold) - want) - Math.abs(Number(y.threshold) - want))[0]
      : same.at(-1)
  if (!pick) return null
  return `Your IF Condition says **${showValue(pick.operator, pick.threshold)}**, but this lab needs **${showValue(wantOp ?? pick.operator, want)}**.`
}

const isExperiment = (a: LabAction) => ['switch', 'motion', 'sensorValue', 'text'].includes(a.type)

export interface Diagnosis {
  /** The step to point 👆 Show me at (null = nothing to point at). */
  stepIndex: number | null
  /** Kid-friendly message, may contain **bold**. */
  text: string
}

/** The kid says an Expected Result didn't happen: find the most likely reason. */
export function diagnose(lines: LabLine[], snap: LabSnapshot): Diagnosis {
  for (let i = 0; i < lines.length; i++) {
    const a = lines[i].action
    if (!isStructural(a) || a.type === 'props') continue
    if (matches(a, snap)) continue
    return {
      stepIndex: i,
      text: conditionMismatch(a, lines.filter((_, j) => j !== i).map((l) => l.action)) ?? `Step ${i + 1} isn't right any more: **${lines[i].text}**`,
    }
  }
  let exp = -1
  lines.forEach((l, i) => {
    if (isExperiment(l.action)) exp = i
  })
  return exp >= 0
    ? { stepIndex: exp, text: `Your build looks right ✔ Try it again slowly: **${lines[exp].text}** Then watch the output block.` }
    : { stepIndex: null, text: 'Your build looks right ✔ Change the inputs again, one at a time, and watch the output block.' }
}
