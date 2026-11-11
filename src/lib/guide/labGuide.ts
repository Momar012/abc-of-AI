import { useRuleStore } from '@/store/useRuleStore'
import { useUIStore } from '@/store/useUIStore'
import { useDatasetStore } from '@/store/useDatasetStore'
import { useModelStore } from '@/store/useModelStore'
import type { StepView } from '@/lib/tour/steps'
import { allBlocks, type AnyBlock, GuideKind, handleSel, isModelKind, KINDS, MENU_LABEL, MENU_SEL, nodeSel, paletteSel } from './blocks'
import { blockWords, TAB_LABEL, type DataTab, type LabAction, type LabLine } from './parseLab'

/**
 * Which blocks and Data Bank items already existed when the kid opened the lab card, so old work
 * doesn't count (e.g. "Upload 20 new images" when the bank already holds last lab's pictures).
 */
export type LabSnapshot = string[]

export const takeSnapshot = (): LabSnapshot => [
  ...allBlocks().map((b) => b.id),
  ...useDatasetStore.getState().bankItems.map((i) => i.id),
]

const isVisible = (sel: string) => {
  const el = document.querySelector(sel)
  if (!el) return false
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0
}

/** The element is on screen and not covered (e.g. by the settings panel), so a kid can grab it. */
const reachable = (sel: string | null) => {
  const el = sel ? document.querySelector(sel) : null
  if (!el) return false
  const r = el.getBoundingClientRect()
  if (!r.width || !r.height) return false
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
  // The hint overlay itself may sit on top; only a real covering panel counts.
  return !hit || el === hit || el.contains(hit) || !hit.closest('[data-properties-panel], [data-canvas-avoid]')
}

// ── data & model labs: reading the panels ─────────────────────────────────────

/** Names match if they only differ in capitals, spaces or punctuation ("CatDog Model" = "catdogmodel"). */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
const sameName = (a: string | undefined, b: string) => !!a && norm(a) === norm(b)

const tabOpen = (tab: DataTab) => isVisible(`[data-tour="tab-${tab}"][data-active="true"]`)
const inputValue = (sel: string) => (document.querySelector(sel) as HTMLInputElement | null)?.value ?? ''
const savedNames = (what: 'dataset' | 'model') =>
  what === 'dataset'
    ? useDatasetStore.getState().savedDatasets.map((d) => d.name)
    : useModelStore.getState().trainedModels.map((m) => m.name)
const isSaved = (what: 'dataset' | 'model', name: string) => savedNames(what).some((n) => sameName(n, name))
const allLabelBlocks = () => allBlocks().filter((b) => b.kind === 'labelled')
/** Labelled blocks made in this lab: last lab's "Cat"/"Dog" block mustn't tick this lab's label steps. */
const labelBlocks = (snap: LabSnapshot) => {
  const fresh = isNew(snap)
  return allLabelBlocks().filter((b) => fresh(b.id))
}
const modelBlocks = () => allBlocks().filter((b) => isModelKind(b.kind))
/** New Labelled blocks holding at least n sentences, every one with a label (what 📋 Paste makes). */
const pastedBlocks = (snap: LabSnapshot, n: number) =>
  labelBlocks(snap).filter((b) => (b.items ?? 0) >= n && b.unassigned === 0 && (b.labels?.length ?? 0) > 0)
/** Models with test data on their amber dot, made or linked in this lab. */
const testedModels = (snap: LabSnapshot) => {
  const fresh = isNew(snap)
  return modelBlocks().filter((b) => !!b.testInput && (fresh(b.id) || fresh(b.testInput)))
}
/** The button's own words ("📝 Train Model" for text models, "🚀 Train Model" for images). */
const buttonText = (sel: string, fallback: string) =>
  document.querySelector(sel)?.textContent?.replace(/\s+/g, ' ').trim() || fallback

/** Data Bank items added since the lab started. */
const newBankItems = (snap: LabSnapshot) => {
  const fresh = isNew(snap)
  return useDatasetStore.getState().bankItems.filter((i) => fresh(i.id)).length
}

/**
 * Labels must match exactly: the model compares test labels with training labels letter by
 * letter, so "cat" here and "Cat" in the test data would count every cat as wrong.
 */
const sameLabel = (a: string | undefined, b: string) => !!a && a.trim() === b.trim()
const nearLabel = (a: string | undefined, b: string) => !!a && !sameLabel(a, b) && a.trim().toLowerCase() === b.trim().toLowerCase()
/** "Your label says cat but this lab needs Cat" for a label that's only wrong in capitals. */
function labelCaseTip(b: AnyBlock | undefined, names: string[]): string | null {
  for (const n of names) {
    if (b?.labels?.some((l) => sameLabel(l, n))) continue
    const near = b?.labels?.find((l) => nearLabel(l, n))
    if (near) return `Your label says **${near}**, but this lab needs **${n}**. Capital letters matter! Tap × on **${near}** and add **${n}**.`
  }
  return null
}
/** What to call a Labelled block in a hint: its own name once it has a real one. */
const labelledName = (b: AnyBlock | null | undefined) =>
  b?.name && !/^dataset \d+$/i.test(b.name.trim()) ? `“${b.name}”` : 'the 🏷️ Labelled block'
/** The Properties Panel is open on a block of this sort. */
const inspecting = (type: 'labelled' | 'model') =>
  useUIStore.getState().selectedBlockType === type && isVisible('[data-properties-panel]')

// ── "it just happened" events (for experiment steps like "Turn ON the switch") ─────────────

let lastOn = new Map<string, boolean>()
const switchOnEvents: number[] = []
const copyEvents: number[] = []

/** The kid copied something (📋 Copy table, or Ctrl + C on the page). */
export function recordCopy() {
  copyEvents.push(Date.now())
}

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

/** An IF Condition with this sensor wired into it ("the Humidity IF"). */
const fedBy = (b: AnyBlock, via: GuideKind, blocks: AnyBlock[]) =>
  b.inputs.some((id) => blocks.find((x) => x.id === id)?.kind === via)

/**
 * Is this block the one a lesson means: "the second AND" (n = 2nd of its kind made in this lab;
 * older blocks count only if the lab hasn't made enough) and/or "the Light IF" (fed by that sensor)?
 */
function isThe(id: string, kind: GuideKind, n: number | undefined, via: GuideKind | undefined, snap: LabSnapshot, blocks = allBlocks()) {
  if (n) {
    const all = blocks.filter((b) => b.kind === kind)
    const made = all.filter((b) => isNew(snap)(b.id))
    if ((made.length >= n ? made : all)[n - 1]?.id !== id) return false
  }
  if (via) {
    const b = blocks.find((x) => x.id === id)
    if (!b || !fedBy(b, via, blocks)) return false
  }
  return true
}

/** The links a connect step asks for, narrowed to the blocks the lesson named. */
function specLinks(a: Extract<LabAction, { type: 'connect' }>, snap: LabSnapshot) {
  const pairs = links(a.from, a.to, snap)
  const s = a.spec
  if (!s) return pairs
  const blocks = allBlocks()
  return pairs.filter((p) => isThe(p.source, a.from, s.fromN, s.fromVia, snap, blocks) && isThe(p.target, a.to, s.toN, s.toVia, snap, blocks))
}

/** Does this IF Condition hold what a settings step asks for? */
const condHolds = (b: AnyBlock, a: Extract<LabAction, { type: 'condOp' }>) =>
  b.operator === a.op && (a.value === undefined || sameValue(b.threshold, a.value))

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
      // "Connect Switch C to the second AND": only that link counts, not any Switch → AND.
      return a.spec ? specLinks(a, snap).length >= a.spec.k : links(a.from, a.to, snap).length >= a.n
    case 'props': {
      const sel = useUIStore.getState().selectedBlockId
      if (!sel) return false
      const same = blocks.filter((b) => b.kind === a.kind)
      // "Double-click the new / second Labelled block": only that block (or a later one) counts, so an
      // old block that's still selected can't tick this step before the new block even exists.
      if (!a.n) return same.some((b) => b.id === sel)
      const made = same.filter((b) => fresh(b.id))
      return made.length >= a.n && made.slice(a.n - 1).some((b) => b.id === sel)
    }
    case 'condOp':
      // "Humidity > 70%" must be set on the Humidity IF, not typed into the Temperature one.
      return blocks.some((b) => b.kind === 'condition' && condHolds(b, a) && (!a.via || fedBy(b, a.via, blocks)))
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
    case 'auto':
      return true
    case 'tab':
      return tabOpen(a.tab)
    case 'bank':
      return newBankItems(snap) >= a.n
    case 'labels':
      return labelBlocks(snap).some((b) => a.names.every((n) => b.labels?.some((l) => sameLabel(l, n))))
    case 'select':
      return useUIStore.getState().selectedBankItemIds.length > 0 || labelBlocks(snap).some((b) => (b.items ?? 0) > 0)
    case 'items':
      return labelBlocks(snap).some((b) => (b.items ?? 0) >= a.n)
    case 'allLabelled':
      return labelBlocks(snap).some((b) => (b.items ?? 0) >= 2 && b.unassigned === 0 && (b.labels?.length ?? 0) > 0)
    case 'name':
      return (
        sameName(inputValue(`[data-tour="${a.what}-name"]`), a.value) ||
        isSaved(a.what, a.value) ||
        (a.what === 'dataset' ? allLabelBlocks() : modelBlocks()).some((b) => sameName(b.name, a.value))
      )
    case 'saved':
      return isSaved(a.what, a.name)
    case 'dsCanvas':
      return blocks.some((b) => (b.kind === 'labelled' || b.kind === 'unlabelled') && fresh(b.id) && sameName(b.name, a.name))
    case 'train': {
      const ok = a.done ? ['trained'] : ['loading', 'training', 'trained']
      return modelBlocks().some((b) => fresh(b.id) && ok.includes(b.status ?? ''))
    }
    case 'copy':
      return copyEvents.length > 0
    case 'paste':
      return pastedBlocks(snap, a.n).length >= a.k
    case 'testLink':
      return testedModels(snap).length > 0
    case 'runTest': {
      const ok = a.done ? ['done'] : ['running', 'done']
      return testedModels(snap).some((b) => ok.includes(b.testStatus ?? ''))
    }
    case 'results':
      return isVisible('[data-tour="test-results"]')
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
  if (a.type === 'copy') return copyEvents.some((t) => t >= since)
  if (!matches(a, snap)) return false
  if (a.type === 'switch' && a.on) return switchOnEvents.some((t) => t >= since)
  return true
}

/** Steps whose result is about the canvas layout (can tick even when they aren't the current step). */
export const isStructural = (a: LabAction) =>
  ['add', 'connect', 'props', 'condOp', 'condValue', 'auto', 'bank', 'labels', 'items', 'allLabelled', 'name', 'saved', 'dsCanvas', 'train', 'paste', 'testLink', 'runTest'].includes(a.type)

/** Steps from the data & model labs (for wording the 👎 answer). */
const isDataStep = (a: LabAction) =>
  ['bank', 'labels', 'select', 'items', 'allLabelled', 'name', 'saved', 'dsCanvas', 'train', 'tab', 'paste', 'testLink', 'runTest', 'results'].includes(a.type) ||
  ((a.type === 'add' || a.type === 'props') && (a.kind === 'labelled' || a.kind === 'unlabelled' || isModelKind(a.kind)))

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
      const s = a.spec
      // A block whose dot isn't wired anywhere yet is the likelier one ("Switch 3", not Switch 1 again).
      const used = new Set(blocks.flatMap((b) => b.inputs))
      const sources = blocks
        .filter((b) => b.kind === a.from && isThe(b.id, a.from, s?.fromN, s?.fromVia, snap, blocks))
        .sort((x, y) => Number(used.has(x.id)) - Number(used.has(y.id)) || Number(fresh(y.id)) - Number(fresh(x.id)))
      const targets = blocks
        .filter((b) => b.kind === a.to && isThe(b.id, a.to, s?.toN, s?.toVia, snap, blocks))
        .sort((x, y) => Number(fresh(y.id)) - Number(fresh(x.id)))
      const fromName = s ? blockWords(a.from, s.fromN, s.fromVia) : KINDS[a.from].label
      const toName = s ? blockWords(a.to, s.toN, s.toVia) : KINDS[a.to].label
      let pick: { s: string; t: string } | null = null
      for (const t of targets) {
        const full = (KINDS[t.kind].in?.length ?? 1) <= t.inputs.length
        if (full) continue
        const s = sources.find((s) => s.id !== t.id && !already.has(`${s.id}>${t.id}`) && !t.inputs.includes(s.id))
        if (s) { pick = { s: s.id, t: t.id }; break }
      }
      if (!pick) {
        return { target: null, gesture: 'none', text: `Add the blocks first, then connect ${fromName} to ${toName}.` }
      }
      const fromSel = handleSel(pick.s, KINDS[a.from].out ?? 'rule-out')
      const toSel = handleSel(pick.t, freeInHandle(pick.t, a.to))
      // A dot hidden under the settings panel can't be dragged: close the panel first.
      if ((!reachable(fromSel) || !reachable(toSel)) && isVisible('[data-tour="inspector-close"]')) {
        return {
          target: '[data-tour="inspector-close"]',
          gesture: 'tap',
          text: 'The settings panel is covering a dot. Close it with ×, then connect the dots.',
        }
      }
      const dataLink = (a.from === 'labelled' || a.from === 'unlabelled') && isModelKind(a.to)
      const src = blocks.find((b) => b.id === pick!.s)
      return {
        target: fromSel,
        gesture: 'drag',
        dragTo: toSel ?? undefined,
        avoid: [nodeSel(pick.s), nodeSel(pick.t)],
        text: dataLink
          ? `Drag from the violet dot on ${a.from === 'labelled' ? labelledName(src) : KINDS[a.from].label} to the teal dot on the ${KINDS[a.to].label}.`
          : `Drag from the dot on the right of ${fromName} to the dot on the left of ${toName}.`,
      }
    }
    case 'props': {
      // "the first / second / new one": point at that block, not just the newest.
      const fresh = isNew(snap)
      const made = allBlocks().filter((x) => x.kind === a.kind && fresh(x.id))
      const b = (a.n ? made[a.n - 1] : undefined) ?? newestOf(a.kind, snap)
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
      // "Humidity > 70%" belongs on the Humidity IF. If another IF's settings are open (still open from
      // the last step), send the kid to the right IF instead of letting them type into the wrong one.
      const blocks = allBlocks()
      const conds = blocks.filter((b) => b.kind === 'condition')
      const via = a.type === 'condOp' ? a.via : undefined
      const theOnes = via ? conds.filter((b) => fedBy(b, via, blocks)) : []
      const pool = theOnes.length ? theOnes : conds
      const name = theOnes.length ? blockWords('condition', undefined, via) : 'the IF Condition'
      if (open && pool.some((b) => b.id === ui.selectedBlockId)) {
        return { target: '[data-properties-panel]', gesture: 'tap', prefer: 'side', text: `In the IF Condition settings, ${want}.` }
      }
      const fresh = isNew(snap)
      const ordered = [...pool].sort((x, y) => Number(fresh(y.id)) - Number(fresh(x.id)))
      const next = (a.type === 'condOp' ? ordered.find((b) => !condHolds(b, a)) : undefined) ?? ordered[0] ?? newestOf('condition', snap)
      return {
        target: nodeSel(next?.id),
        gesture: 'dblclick',
        text: open
          ? `These settings are for a different IF Condition. Double-click ${name}, then ${want}.`
          : `Double-click ${name} first, then ${want}.`,
      }
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
    case 'auto':
      return { target: null, gesture: 'none', text: lineText }
    case 'tab':
      return openTab(a.tab) ?? { target: `[data-tour="tab-${a.tab}"]`, gesture: 'none', text: `The ${TAB_LABEL[a.tab]} tab is open ✔` }
    case 'bank': {
      const have = newBankItems(snap)
      const count = a.n > 1 ? ` You've added ${have} of ${a.n}.` : ''
      return (
        openTab('bank') ?? {
          target: '[data-tour="add-data"]',
          gesture: 'tap',
          text: `Click Add Data and pick your pictures (you can choose lots at once).${count}`,
        }
      )
    }
    case 'labels': {
      const b = labelBlocks(snap).at(-1)
      if (!b) return { target: MENU_SEL.data, gesture: 'tap', text: `Add a new ${KINDS.labelled.label} block first. It's in ${MENU_LABEL.data}.` }
      const missing = a.names.filter((n) => !b.labels?.some((l) => sameLabel(l, n)))
      const next = missing[0] ?? a.names[0]
      // Hint bubbles are plain text: show the **words** in quotes instead.
      const tip = labelCaseTip(b, a.names)?.replace(/\*\*(.+?)\*\*/g, '“$1”')
      return inspecting('labelled')
        ? { target: '[data-tour="label-creator"]', gesture: 'tap', prefer: 'side', text: tip ?? `Type “${next}” in the Labels box and press + Add.` }
        : { target: nodeSel(b.id), gesture: 'dblclick', text: `Double-click ${labelledName(b)} to open its settings.` }
    }
    case 'select':
      return openTab('bank') ?? { target: '[data-tour="bank-select-all"]', gesture: 'tap', text: 'Tap Select all, or tap each picture you want.' }
    case 'items': {
      const b = newestOf('labelled', snap)
      if (!inspecting('labelled')) {
        return { target: nodeSel(b?.id), gesture: 'dblclick', text: `Double-click ${labelledName(b)} so its Items box shows.` }
      }
      const picked = '[data-tour="bank-grid"] [data-selected="true"]'
      return (
        openTab('bank') ?? {
          target: isVisible(picked) ? picked : '[data-tour="bank-grid"] [data-bank-item]',
          gesture: 'drag',
          dragTo: '[data-tour="label-items"]',
          text: 'Drag the selected pictures into the Items box on the right.',
        }
      )
    }
    case 'allLabelled': {
      const b = biggestLabelBlock(snap)
      const left = b?.unassigned ?? 0
      // Inside Expand View: point at the next picture's drop-down, one picture at a time.
      if (isVisible('[data-tour="label-modal"]')) {
        const next = '[data-tour="label-modal"] [data-tour="label-select"][data-unlabelled="true"]'
        const choices = (b?.labels ?? []).map((l) => `“${l}”`).join(' or ') || 'a label'
        return isVisible(next)
          ? {
              target: next,
              gesture: 'tap',
              text: `Tap the drop-down that says “no label”, then pick ${choices}, whichever the picture shows. Keep going! ${left} left.`,
            }
          : { target: '[data-tour="label-modal-done"]', gesture: 'tap', text: 'Every picture has a label ✔ Tap Done ✓.' }
      }
      return inspecting('labelled')
        ? {
            target: '[data-tour="expand-view"]',
            gesture: 'tap',
            prefer: 'side',
            text:
              left === 1
                ? '1 item still needs a label. Tap ↗ Expand View and find the one with no label.'
                : `${left} items still need a label. Tap ↗ Expand View to label them quickly.`,
          }
        : { target: nodeSel(b?.id), gesture: 'dblclick', text: `Double-click ${labelledName(b)} to see which items still need a label.` }
    }
    case 'name': {
      const typed = inputValue(`[data-tour="${a.what}-name"]`).trim()
      const ask = typed
        ? `The box says “${typed}”, but this lab needs “${a.value}”. Change it to “${a.value}”.`
        : `Type “${a.value}” in the ${a.what === 'model' ? 'model name' : 'Save Dataset'} box.`
      if (a.what === 'model') return modelHint('[data-tour="model-name"]', ask, snap)
      return inspecting('labelled')
        ? { target: '[data-tour="dataset-name"]', gesture: 'tap', prefer: 'side', text: ask }
        : { target: nodeSel(newestOf('labelled', snap)?.id), gesture: 'dblclick', text: `Double-click ${labelledName(newestOf('labelled', snap))} to find the Save Dataset box.` }
    }
    case 'saved':
      if (a.via === 'list') return listHint(a.what, a.name, 'tap', `There it is: “${a.name}” ✔`)
      if (a.what === 'model') return modelHint('[data-tour="model-save"]', `Check the name says “${a.name}”, then click 💾 Save Name.`, snap)
      return inspecting('labelled')
        ? { target: '[data-tour="dataset-save"]', gesture: 'tap', prefer: 'side', text: `Check the name says “${a.name}”, then click 💾 Save Data.` }
        : { target: nodeSel(newestOf('labelled', snap)?.id), gesture: 'dblclick', text: `Double-click ${labelledName(newestOf('labelled', snap))} to find the 💾 Save Data button.` }
    case 'dsCanvas':
      return listHint('dataset', a.name, 'drag', `Drag “${a.name}” onto the canvas.`)
    case 'train':
      return a.done
        ? { target: '[data-tour="model-train"]', gesture: 'none', prefer: 'side', text: 'Training takes a few seconds. Wait for ✓ Training complete!' }
        : modelHint('[data-tour="model-train"]', `Click ${buttonText('[data-tour="model-train"]', '🚀 Train Model')}.`, snap)
    case 'copy':
      return {
        target: '[data-tour="lab-copy-table"]',
        gesture: 'tap',
        prefer: 'side',
        text: 'Tap 📋 Copy table. It copies every sentence for you, ready to paste.',
      }
    case 'paste':
      return pasteHint(a, snap)
    case 'testLink':
      return testLinkHint(snap)
    case 'runTest':
      return a.done
        ? { target: '[data-tour="model-run-test"]', gesture: 'none', prefer: 'side', text: 'Testing takes a moment. Wait for the % accurate score.' }
        : modelHint(
            '[data-tour="model-run-test"]',
            'Click 🔬 Run Test.',
            snap,
            'Scroll down to 4 · Test Model. If 🔬 Run Test isn’t there, connect the amber dots first.'
          )
    case 'results':
      return isVisible('[data-tour="test-results"]')
        ? { target: '[data-tour="test-results"]', gesture: 'none', text: 'Here are all the predictions ✔' }
        : modelHint(
            '[data-tour="model-expand-results"]',
            'Click ↗ Expand Results to see what the AI guessed for every sentence.',
            snap,
            'Run the test first, then scroll down to ↗ Expand Results.'
          )
    case 'manual':
      return { target: null, gesture: 'none', text: `${lineText} When you've done it, tap ✓ I did it.` }
  }
}

/** This lab's Labelled block with the most items (any Labelled block if none is new yet). */
const biggestLabelBlock = (snap: LabSnapshot) => {
  const pool = labelBlocks(snap).length ? labelBlocks(snap) : allLabelBlocks()
  return [...pool].sort((x, y) => (y.items ?? 0) - (x.items ?? 0))[0]
}

/** 📋 Paste, one click at a time: open the block → 📋 Paste → Ctrl + V in the box → Import. */
function pasteHint(a: Extract<LabAction, { type: 'paste' }>, snap: LabSnapshot): StepView {
  const fresh = labelBlocks(snap)
  if (fresh.length < a.k) {
    return { target: MENU_SEL.data, gesture: 'tap', text: `Add a new ${KINDS.labelled.label} block first. It's in ${MENU_LABEL.data}.` }
  }
  const done = new Set(pastedBlocks(snap, a.n).map((b) => b.id))
  const b = fresh.filter((x) => !done.has(x.id)).at(-1) ?? fresh.at(-1)!
  if (isVisible('[data-tour="paste-modal"]')) {
    return inputValue('[data-tour="paste-input"]').trim()
      ? {
          target: '[data-tour="paste-import"]',
          gesture: 'tap',
          text: `Now tap ${buttonText('[data-tour="paste-import"]', 'Import')} to add the sentences.`,
        }
      : { target: '[data-tour="paste-input"]', gesture: 'tap', text: 'Click in this box, then press Ctrl + V to paste the sentences.' }
  }
  if (!inspecting('labelled') || useUIStore.getState().selectedBlockId !== b.id) {
    return { target: nodeSel(b.id), gesture: 'dblclick', text: `Double-click ${labelledName(b)} to open its settings.` }
  }
  const have = b.items ?? 0
  return {
    target: '[data-tour="label-paste"]',
    gesture: 'tap',
    prefer: 'side',
    text:
      have > 0 && have < a.n
        ? `This block has ${have} sentences, but the table has ${a.n}. Copy the table again and paste the rest.`
        : 'Tap 📋 Paste in the Items section.',
  }
}

/** Test data → the model's amber test dot (the lower amber dot on the dataset). */
function testLinkHint(snap: LabSnapshot): StepView {
  const fresh = isNew(snap)
  const models = modelBlocks()
  const m = models.filter((x) => fresh(x.id)).at(-1) ?? models.at(-1)
  // The test data is a new Labelled block that isn't the one the model learned from.
  const trainedOn = new Set(models.flatMap((x) => x.inputs))
  const src = labelBlocks(snap).filter((x) => !trainedOn.has(x.id)).at(-1)
  if (!m || !src) return { target: null, gesture: 'none', text: 'You need a trained model and your new test dataset on the canvas first.' }
  const fromSel = handleSel(src.id, 'test-out')
  const toSel = handleSel(m.id, 'test-in')
  if ((!reachable(fromSel) || !reachable(toSel)) && isVisible('[data-tour="inspector-close"]')) {
    return { target: '[data-tour="inspector-close"]', gesture: 'tap', text: 'The settings panel is covering a dot. Close it with ×, then connect the dots.' }
  }
  return {
    target: fromSel,
    gesture: 'drag',
    dragTo: toSel ?? undefined,
    avoid: [nodeSel(src.id), nodeSel(m.id)],
    text: `Drag from the lower amber dot on ${labelledName(src)} to the amber dot on the ${KINDS[m.kind].label}.`,
  }
}

/** Point at a Data Panel tab (opening the panel first). null = that tab is already showing. */
function openTab(tab: DataTab): StepView | null {
  if (tabOpen(tab)) return null
  if (!isVisible('[data-tour="tab-bank"]')) {
    return { target: '[data-tour="data-panel-open"]', gesture: 'tap', text: 'Tap 🗃️ Data-Panel to open it.' }
  }
  return { target: `[data-tour="tab-${tab}"]`, gesture: 'tap', text: `Tap the ${TAB_LABEL[tab]} tab.` }
}

/** A button in the model's settings (opening them first). `hidden` = what to say when it isn't showing yet. */
function modelHint(
  sel: string,
  text: string,
  snap: LabSnapshot,
  hidden = 'Train the model first, then scroll down in its settings.'
): StepView {
  const fresh = isNew(snap)
  const list = modelBlocks()
  const m = list.filter((b) => fresh(b.id)).at(-1) ?? list.at(-1)
  if (!m) return { target: null, gesture: 'none', text: 'Add the model to the canvas first.' }
  if (!inspecting('model')) return { target: nodeSel(m.id), gesture: 'dblclick', text: 'Double-click the model to open its settings.' }
  if (!m.inputs.length) {
    return { target: nodeSel(m.id), gesture: 'none', text: 'Connect your dataset to the model first: violet dot → teal dot.' }
  }
  if (!isVisible(sel)) {
    return { target: '[data-properties-panel]', gesture: 'none', prefer: 'side', text: hidden }
  }
  return { target: sel, gesture: 'tap', prefer: 'side', text }
}

/** A saved dataset / model in its Data Panel tab. */
function listHint(what: 'dataset' | 'model', name: string, gesture: 'tap' | 'drag', text: string): StepView {
  const tab: DataTab = what === 'dataset' ? 'saved' : 'models'
  const open = openTab(tab)
  if (open) return open
  const list: Array<{ id: string; name: string }> =
    what === 'dataset' ? useDatasetStore.getState().savedDatasets : useModelStore.getState().trainedModels
  const hit = list.find((x) => sameName(x.name, name))
  if (!hit) {
    return {
      target: `[data-tour="tab-${tab}"]`,
      gesture: 'none',
      text: `No ${what} called “${name}” yet. Save it first (look back at the last lab) and check the name.`,
    }
  }
  const sel = `[data-tour="saved-${what === 'dataset' ? 'ds' : 'model'}-${hit.id}"]`
  return gesture === 'drag' ? { target: sel, gesture: 'drag', dragTo: '[data-tour="canvas"]', text } : { target: sel, gesture: 'none', text }
}

// ── "No, it didn't work" → what to fix ─────────────────────────────────────────

/** If a data step fails, say exactly what's different. */
function dataMismatch(a: LabAction, snap: LabSnapshot): string | null {
  switch (a.type) {
    case 'bank': {
      const have = newBankItems(snap)
      return `You've added **${have}** new item${have === 1 ? '' : 's'} to the Data Bank, but this lab needs **${a.n}**.`
    }
    case 'labels': {
      const b = labelBlocks(snap).at(-1)
      if (!b) return `Add a new **🏷️ Labelled** block for this lab, then give it the labels ${a.names.map((n) => `**${n}**`).join(' and ')}.`
      const tip = labelCaseTip(b, a.names)
      if (tip) return tip
      const missing = a.names.filter((n) => !b.labels?.some((l) => sameLabel(l, n)))
      if (!missing.length) return null
      return `Your Labelled block still needs the label${missing.length > 1 ? 's' : ''} ${missing.map((n) => `**${n}**`).join(' and ')}.`
    }
    case 'allLabelled': {
      const b = biggestLabelBlock(snap)
      if (!b?.items) return 'Your Labelled block has no items yet. Drag your pictures into it.'
      if (!b.unassigned) return null
      return `**${b.unassigned}** item${b.unassigned === 1 ? ' still has' : 's still have'} no label.`
    }
    case 'name':
    case 'saved': {
      const name = a.type === 'name' ? a.value : a.name
      const last = savedNames(a.what)[0]
      return last
        ? `Your ${a.what} is saved as **${last}**, but this lab needs **${name}**.`
        : `No ${a.what} is saved yet. Save it with the name **${name}**.`
    }
    case 'dsCanvas':
      return `**${a.name}** isn't on the canvas yet. Drag it from the 📋 Datasets tab.`
    case 'train':
      return a.done ? "The model hasn't finished training yet. Wait for ✓ Training complete." : "The model hasn't been trained yet."
    case 'paste': {
      const blocks = labelBlocks(snap)
      if (blocks.length < a.k) return 'Add a new **🏷️ Labelled** block, then paste the sentences into it.'
      const b = blocks.filter((x) => !pastedBlocks(snap, a.n).some((p) => p.id === x.id)).at(-1)
      if (!b) return null
      if ((b.items ?? 0) < a.n) return `Your block has **${b.items ?? 0}** sentences, but the table has **${a.n}**. Copy the table again and paste.`
      return `**${b.unassigned}** sentence${b.unassigned === 1 ? ' has' : 's have'} no label. Give ${b.unassigned === 1 ? 'it' : 'each one'} a label.`
    }
    case 'testLink':
      return 'Your test dataset isn’t on the model’s amber dot yet. Drag from its **lower amber dot** to the model’s **amber dot**.'
    case 'runTest':
      return a.done ? 'The test hasn’t finished yet. Wait for the **% accurate** score.' : 'The model hasn’t been tested yet. Click **🔬 Run Test**.'
    default:
      return null
  }
}

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
  const blocks = allBlocks()
  const via = a.type === 'condOp' ? a.via : undefined
  const everyIf = blocks.filter((b) => b.kind === 'condition')
  // "Humidity > 70%": judge the Humidity IF, not whichever IF happens to be closest.
  const viaIfs = via ? everyIf.filter((b) => fedBy(b, via, blocks)) : []
  const all = viaIfs.length ? viaIfs : everyIf
  const conds = all.filter((b) => !takenBy(b)).length ? all.filter((b) => !takenBy(b)) : all
  if (!conds.length) return null
  const yourIf = viaIfs.length ? `Your IF Condition for ${KINDS[via!].label}` : 'Your IF Condition'
  const want = a.value
  const wantOp = a.type === 'condOp' ? a.op : undefined
  // Same words, different capitals: the classic password mistake.
  if (typeof want === 'string') {
    const near = conds.find((b) => String(b.threshold ?? '').trim().toLowerCase() === want.toLowerCase())
    if (near) return `You typed **${String(near.threshold).trim()}** but this lab needs **${want}**. Capital letters matter!`
  }
  if (wantOp && wantOp !== 'is' && !conds.some((b) => b.operator === wantOp)) {
    return `${yourIf} uses **${conds.at(-1)!.operator ?? '?'}**, but this lab needs **${wantOp}**.`
  }
  if (want === undefined) return null
  const same = conds.filter((b) => !wantOp || b.operator === wantOp)
  const pick =
    typeof want === 'number'
      ? [...same].sort((x, y) => Math.abs(Number(x.threshold) - want) - Math.abs(Number(y.threshold) - want))[0]
      : same.at(-1)
  if (!pick) return null
  return `${yourIf} says **${showValue(pick.operator, pick.threshold)}**, but this lab needs **${showValue(wantOp ?? pick.operator, want)}**.`
}

const isExperiment = (a: LabAction) => ['switch', 'motion', 'sensorValue', 'text'].includes(a.type)

export interface Diagnosis {
  /** The step to point 👆 Show me at (null = nothing to point at). */
  stepIndex: number | null
  /** Kid-friendly message, may contain **bold**. */
  text: string
}

/**
 * Motion / switch checks: tell the kid which state to try, from the check's own words.
 * "When No Motion is detected, the bulb remains OFF" → set it to No Motion (not the last step,
 * which may be "Click the No Motion button" = trigger motion). Several switches → null (no one action).
 */
function stateTip(lines: LabLine[], check: string): Diagnosis | null {
  const c = check.replace(/\*\*/g, '')
  if (/\bmotion\b/i.test(c) && lines.some((l) => l.action.type === 'motion')) {
    const want = !/\bno motion\b/i.test(c)
    const i = lines.findIndex((l) => l.action.type === 'motion' && l.action.detected === want)
    return {
      stepIndex: i >= 0 ? i : null,
      text: `Your build looks right ✔ Click the Motion Sensor's button so it says **${want ? 'Motion Detected' : 'No Motion'}**, then watch the output block.`,
    }
  }
  // "When the temperature is 32°C, the Fan turns ON" → the "Move the slider to 32°C" step.
  const numbers = (c.match(/-?\d+(\.\d+)?/g) ?? []).map(Number)
  const slider = lines.findIndex((l) => l.action.type === 'sensorValue' && numbers.includes(l.action.value))
  if (slider >= 0) {
    return { stepIndex: slider, text: `Your build looks right ✔ Try it again slowly: **${lines[slider].text}** Then watch the output block.` }
  }
  if (/\bswitch\b/i.test(c) && !/\b(both|either|one|two|three|all|switches)\b/i.test(c) && lines.some((l) => l.action.type === 'switch')) {
    const off = /\bswitch (is|was) off\b|\bturn(ed)? off the switch\b|\bswitch off\b/i.test(c)
    const i = lines.findIndex((l) => l.action.type === 'switch' && l.action.on === !off)
    return {
      stepIndex: i >= 0 ? i : null,
      text: `Your build looks right ✔ Turn the switch **${off ? 'OFF' : 'ON'}**, then watch the output block.`,
    }
  }
  return null
}

/** "Alarm remains OFF for messages that do not contain MONEY" → a "should NOT happen" check. */
const NEGATIVE = /\b(off|not|don'?t|doesn'?t|won'?t|never|other|stays? silent|remains? silent)\b/i
/** Does the check's text mention exactly this typed value (capitals count: MONEY ≠ mOneY)? */
const mentions = (text: string, value: string) =>
  new RegExp(`(^|[^A-Za-z0-9])${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^A-Za-z0-9]|$)`).test(text.replace(/\*\*/g, ''))

/**
 * Which experiment step to suggest for the check the kid said 👎 to. For typed-text labs, pick
 * the word that check is about ("contains MONEY" → type MONEY; "OFF for other words" → the word
 * no check mentions, like mOneY). Otherwise the last experiment, as before.
 */
function experimentFor(lines: LabLine[], expected?: { text: string; all: string[] }): number {
  const exps = lines.map((l, i) => ({ a: l.action, i })).filter((x) => isExperiment(x.a))
  if (!exps.length) return -1
  const texts = exps.filter((x): x is { a: Extract<LabAction, { type: 'text' }>; i: number } => x.a.type === 'text')
  if (expected && texts.length) {
    if (NEGATIVE.test(expected.text)) {
      const unmentioned = texts.find((x) => !expected.all.some((t) => mentions(t, x.a.value)))
      if (unmentioned) return unmentioned.i
    } else {
      const hit = texts.find((x) => mentions(expected.text, x.a.value))
      if (hit) return hit.i
    }
  }
  return exps.at(-1)!.i
}

/** The kid says an Expected Result didn't happen: find the most likely reason. */
export function diagnose(lines: LabLine[], snap: LabSnapshot, expected?: { text: string; all: string[] }): Diagnosis {
  for (let i = 0; i < lines.length; i++) {
    const a = lines[i].action
    if (!isStructural(a) || a.type === 'props') continue
    if (matches(a, snap)) continue
    return {
      stepIndex: i,
      text:
        conditionMismatch(a, lines.filter((_, j) => j !== i).map((l) => l.action)) ??
        dataMismatch(a, snap) ??
        `Step ${i + 1} isn't right any more: **${lines[i].text}**`,
    }
  }
  const tip = expected ? stateTip(lines, expected.text) : null
  if (tip) return tip
  const exp = experimentFor(lines, expected)
  if (exp >= 0 && expected && NEGATIVE.test(expected.text) && lines[exp].action.type === 'text') {
    const t = lines[exp].action as Extract<LabAction, { type: 'text' }>
    if (expected.all.some((x) => mentions(x, t.value))) {
      // Every typed word in this lab should set it off: try a word the rule doesn't know.
      return {
        stepIndex: null,
        text: 'Your build looks right ✔ Type a word your rule does **not** look for, like **hello**, press Send, and watch the output block.',
      }
    }
  }
  if (exp < 0 && lines.some((l) => isDataStep(l.action))) {
    return { stepIndex: null, text: 'Every step checks out ✔ Look carefully once more. If something is missing, fix it, then tap 👍.' }
  }
  return exp >= 0
    ? { stepIndex: exp, text: `Your build looks right ✔ Try it again slowly: **${lines[exp].text}** Then watch the output block.` }
    : { stepIndex: null, text: 'Your build looks right ✔ Change the inputs again, one at a time, and watch the output block.' }
}
