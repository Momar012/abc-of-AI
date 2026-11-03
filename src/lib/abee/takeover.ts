import { useAbeeStore } from '@/store/useAbeeStore'
import { useUIStore, ToolbarMenu } from '@/store/useUIStore'
import { useRuleStore } from '@/store/useRuleStore'
import { useWorkflowStore } from '@/store/useWorkflowStore'
import { useModelStore } from '@/store/useModelStore'
import { useDatasetStore } from '@/store/useDatasetStore'
import { useRLStore } from '@/store/useRLStore'
import { useCanvasStore } from '@/store/useCanvasStore'
import { useCurriculumStore } from '@/store/useCurriculumStore'
import { CURRICULUM } from '@/data/curriculum'
import { BlockType, RuleOperator } from '@/types/rules'
import { applyConnection, inferConnectionHandles, isConnectionAllowed, SENSOR_BLOCKED_HANDLES } from '@/lib/canvasConnect'
import { planConnectionLayout, moveBlock, frameBlocks, syncFlowPositions } from '@/lib/canvasLayout'
import { findBlock, listBlocks, currentStep, resolveBlockId, normalizeTarget } from './context'
import { revealTarget, findTargetElement, menuForBlockType, onCanvasScreen, blockParts, MENU_ITEMS } from './targets'

// Runs Abee's tool calls in the browser. Abee is a guide: pointing and laser
// paths show the student what to do, and they do it. A demo (Abee doing it)
// is a last resort, and is always undone afterwards so the student repeats it.

type ToolResult = Record<string, unknown>

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const abee = () => useAbeeStore.getState()

/** Time the pointer rests on something before Abee acts on it, so the student can follow */
const DWELL_MS = 700
/** How long a finished demo stays on screen before it's undone */
const SHOW_RESULT_MS = 2500
/** How long a hint waits for the student to open a menu or panel */
const GUIDE_WAIT_MS = 20_000

const YOUR_TURN = 'Your turn! I put it back so you can try it yourself.'

let aborted = false

// ── Demo snapshot (so every demo can be undone) ───────────────────────────

let restoreSnapshot: (() => void) | null = null
let restoreTimer: ReturnType<typeof setTimeout> | null = null

function takeSnapshot() {
  const r = useRuleStore.getState()
  const w = useWorkflowStore.getState()
  const m = useModelStore.getState()
  const d = useDatasetStore.getState()
  const rl = useRLStore.getState()
  const c = useCanvasStore.getState()
  // Store updates replace arrays rather than mutating them, so holding these references is a snapshot
  const rules = {
    sensorBlocks: r.sensorBlocks, conditionBlocks: r.conditionBlocks, switchBlocks: r.switchBlocks,
    logicBlocks: r.logicBlocks, fanBlocks: r.fanBlocks, alarmBlocks: r.alarmBlocks, acBlocks: r.acBlocks,
    phoneUnlockBlocks: r.phoneUnlockBlocks, displayBlocks: r.displayBlocks, binBlocks: r.binBlocks, timerBlocks: r.timerBlocks,
  }
  const workflow = { doorBlocks: w.doorBlocks, bulbBlocks: w.bulbBlocks }
  const models = { modelBlocks: m.modelBlocks, trainedModels: m.trainedModels }
  const datasets = { labelledBlocks: d.labelledBlocks, unlabelledBlocks: d.unlabelledBlocks }
  const rlBlocks = rl.rlBlocks
  const notes = { textBlocks: c.textBlocks, imageBlocks: c.imageBlocks }

  restoreSnapshot = () => {
    useRuleStore.setState(rules)
    useWorkflowStore.setState(workflow)
    useModelStore.setState(models)
    useDatasetStore.setState(datasets)
    useRLStore.setState({ rlBlocks })
    useCanvasStore.setState(notes)
    useRuleStore.getState().evaluateGraph()
    syncFlowPositions()
  }
}

// ── Taking and returning control ──────────────────────────────────────────

function startTakeover() {
  stopGuidance()
  takeSnapshot()
  useUIStore.getState().setCanvasInteractive(false)
  abee().set({ takeoverActive: true })
}

function releaseControl() {
  useUIStore.getState().setCanvasInteractive(true)
  useUIStore.getState().setOpenToolbarMenu(null)
  abee().set({ takeoverActive: false })
  abee().clearLaser()
}

/** Put the canvas back the way it was before the demo, and hand it to the student. */
function undoDemo() {
  if (restoreTimer) clearTimeout(restoreTimer)
  restoreTimer = null
  const restore = restoreSnapshot
  restoreSnapshot = null
  if (restore) {
    useUIStore.getState().clearSelectedBlock()
    restore()
    abee().set({ notice: YOUR_TURN })
  }
  releaseControl()
}

/**
 * Finish the demo: leave the result on screen briefly (the "see?" moment),
 * then undo it so the student does it themselves. `immediate` skips the pause.
 * Safe to call any number of times.
 */
export function endTakeover({ immediate = false }: { immediate?: boolean } = {}) {
  if (!abee().takeoverActive) return
  if (immediate || !restoreSnapshot) {
    undoDemo()
    return
  }
  if (restoreTimer) return // already showing the result
  useUIStore.getState().setOpenToolbarMenu(null)
  abee().clearLaser()
  restoreTimer = setTimeout(undoDemo, SHOW_RESULT_MS)
}

/** The student pressed Esc or started talking — stop the demo now. */
export function abortTakeover() {
  if (!abee().takeoverActive) return
  aborted = true
  endTakeover({ immediate: true })
}

/** A new question from the student: stop any demo or hint, and let the next one start fresh. */
export function newStudentTurn() {
  stopGuidance()
  abortTakeover()
  aborted = false
}

// ── Pointer ───────────────────────────────────────────────────────────────

let stopWatching: (() => void) | null = null

/** Stop a hint that's waiting for the student, and clear the pointer. */
export function stopGuidance() {
  stopWatching?.()
  stopWatching = null
}

/** Wait (up to GUIDE_WAIT_MS) for the student to do something, then run `then`. */
function watchFor(done: () => boolean, then: () => void) {
  stopGuidance()
  const unsubscribe = useUIStore.subscribe(() => {
    if (done()) {
      cleanup()
      then()
    }
  })
  const timer = setTimeout(() => { cleanup(); abee().clearLaser() }, GUIDE_WAIT_MS)
  const cleanup = () => {
    unsubscribe()
    clearTimeout(timer)
    if (stopWatching === cleanup) stopWatching = null
  }
  stopWatching = cleanup
}

/**
 * A hint: point at something without ever opening or changing anything.
 * If it's a menu item, point at its menu first and hop to the item once the
 * student opens it; if it's a Properties-panel field, point at the block
 * ("double-click") and hop to the field once the student opens the panel.
 */
async function guidePoint(target: string, note?: string, blockId?: string): Promise<ToolResult> {
  stopGuidance()

  // Be forgiving about how the field + block are written: "block:<id>:inspector.x"
  // means field inspector.x on that block
  const glued = target.match(/^block:([^:]+):(inspector\..+)$/)
  if (glued) {
    blockId = blockId ?? glued[1]
    target = normalizeTarget(glued[2])
  }
  // A Properties field with no block named: if there's only one block of that kind, it's that one
  if (target.startsWith('inspector.') && !blockId) {
    const kind = target.split('.')[1]
    const candidates = listBlocks().filter((b) => b.type === kind)
    if (candidates.length === 1) blockId = candidates[0].id
  }

  if (target.startsWith('menu.item.') && !findTargetElement(target)) {
    const menu = menuForBlockType(target.slice('menu.item.'.length))
    if (!menu) return { error: `Unknown menu item "${target}".` }
    abee().pointAt(`toolbar.${menu}`, 'Open this', true)
    watchFor(
      () => useUIStore.getState().openToolbarMenu === menu,
      () => setTimeout(() => abee().pointAt(target, note ?? 'This one'), 150),
    )
    return { ok: true, waitingFor: 'menu', note: `Pointing at the ${menu} menu. When the student opens it, the pointer moves to the item.` }
  }

  if (target.startsWith('inspector.') && blockId && useUIStore.getState().selectedBlockId !== blockId) {
    if (!findBlock(blockId)) return { error: 'That block id is not on the canvas.' }
    await revealTarget(`block:${blockId}`, { openMenus: false })
    abee().pointAt(`block:${blockId}`, 'Double-click', true)
    watchFor(
      () => useUIStore.getState().selectedBlockId === blockId,
      () => setTimeout(() => abee().pointAt(target, note), 350),
    )
    return { ok: true, waitingFor: 'panel', note: 'Pointing at the block. When the student double-clicks it, the pointer moves to the field.' }
  }

  if (!(await revealTarget(target, { openMenus: false }))) {
    return { error: `"${target}" isn't on screen. Tell the student where to find it instead.` }
  }
  abee().pointAt(target, note)
  return { ok: true }
}

/** A dotted laser line from one thing to another, e.g. "drag a wire from this dot to that dot". */
async function showPath(from: string, to: string, note?: string): Promise<ToolResult> {
  stopGuidance()
  const blockOf = (t: string) => (/^(block|handle|control):/.test(t) ? t.split(':')[1] : null)
  const blocks = [blockOf(from), blockOf(to)].filter((b): b is string => !!b)
  if (blocks.length && (!onCanvasScreen(from) || !onCanvasScreen(to))) {
    frameBlocks(blocks)
    await wait(450)
  }
  if (!findTargetElement(from) || !findTargetElement(to)) {
    return { error: 'One end of that path is not on screen. Use the inDots/outDots listed for each block.' }
  }
  abee().showPath(from, to, note)
  return { ok: true }
}

/** Why a wire isn't allowed, in words Abee can teach from */
function wireRefusal(targetHandle?: string | null): string {
  const blocked = targetHandle && SENSOR_BLOCKED_HANDLES[targetHandle]
  return blocked
    ? `Sensors can't plug straight into ${blocked}. The sensor has to go into an IF Condition first.`
    : 'Only a Sensor (or a trained Model) can plug into an IF Condition.'
}

/**
 * Show how to wire two blocks: a dotted laser line from the right dot on the
 * first block to the right dot on the second. The app picks the dots (the
 * same way a real connection does), so Abee only names the blocks.
 */
async function showWire(fromId: string, toId: string, note?: string): Promise<ToolResult> {
  const from = findBlock(fromId)
  const to = findBlock(toId)
  if (!from || !to) return { error: 'One of those block ids is not on the canvas.' }
  const conn = inferConnectionHandles(fromId, toId)
  if (!conn?.targetHandle) return { error: `${to.name} has no input to plug a wire into.` }
  if (!isConnectionAllowed(conn)) return { error: wireRefusal(conn.targetHandle), teachThis: true }

  const fromDot = conn.sourceHandle
    ? `handle:${fromId}:${conn.sourceHandle}`
    : blockParts(fromId).outDots[0]
  if (!fromDot) return { error: `${from.name} has no output dot.` }
  const shown = await showPath(fromDot, `handle:${toId}:${conn.targetHandle}`, note ?? 'Drag from here')
  return 'error' in shown ? shown : { ok: true, from: from.name, to: to.name, say: `drag from the dot on the right of ${from.name} to the dot on the left of ${to.name}` }
}

async function point(target: string, note?: string, sticky = false): Promise<boolean> {
  const visible = await revealTarget(target)
  if (!visible) return false
  abee().pointAt(target, note, sticky)
  return true
}

async function demoPoint(target: string, note?: string) {
  if (await point(target, note, true)) await wait(DWELL_MS)
}

// ── Demo actions ──────────────────────────────────────────────────────────

const MENUS: ToolbarMenu[] = ['datasets', 'model', 'actions', 'rules']

const INSPECTABLE = new Set([
  'labelled', 'unlabelled', 'model', 'rl-gridworld', 'sensor', 'condition', 'timer', 'logic', 'switch',
  'fan', 'alarm', 'ac', 'phoneunlock', 'display', 'bin', 'door', 'bulb',
])

const OPERATORS: RuleOperator[] = ['>', '<', '>=', '<=', '==', '!=', 'contains', 'is']

function parseValue(raw: string): number | boolean | string {
  const t = raw.trim()
  if (t === 'true') return true
  if (t === 'false') return false
  if (t !== '' && !Number.isNaN(Number(t))) return Number(t)
  return t
}

async function addBlock(blockType: string): Promise<ToolResult> {
  const menu = menuForBlockType(blockType)
  if (!menu) return { error: `Unknown block type "${blockType}". Pick one of: ${Object.values(MENU_ITEMS).flat().join(', ')}` }

  await demoPoint(`toolbar.${menu}`, 'Open menu')
  useUIStore.getState().setOpenToolbarMenu(menu)
  await wait(150)
  await demoPoint(`menu.item.${blockType}`, 'Add this')

  const before = new Set(listBlocks().map((b) => b.id))
  useUIStore.getState().requestQuickAdd(blockType as BlockType)
  useUIStore.getState().setOpenToolbarMenu(null)

  // The canvas places the block on its next render
  for (let i = 0; i < 20; i++) {
    await wait(50)
    const added = listBlocks().find((b) => !before.has(b.id))
    if (added) {
      await wait(250)
      await point(`block:${added.id}`, added.name, true)
      return { ok: true, id: added.id, name: added.name, type: added.type }
    }
  }
  return { error: 'The block did not appear. Is the canvas showing?' }
}

async function connect(sourceId: string, targetId: string, input?: string): Promise<ToolResult> {
  const source = findBlock(sourceId)
  const target = findBlock(targetId)
  if (!source || !target) return { error: 'One of those block ids is not on the canvas.' }

  const conn = inferConnectionHandles(sourceId, targetId, input)
  if (!conn) return { error: `A ${target.type} block has no input to connect to.` }
  if (!isConnectionAllowed(conn)) return { error: wireRefusal(conn.targetHandle) }

  // Tidy up first: bring the two blocks side by side (signal flowing left to
  // right) so the wire is short and easy to follow, not stretched across the canvas
  const blocks = listBlocks()
  const wires = (id: string) =>
    (blocks.find((b) => b.id === id)?.inputs.length ?? 0) + blocks.filter((b) => b.inputs.includes(id)).length
  const plan = planConnectionLayout(sourceId, targetId, wires)
  let tidied: string | undefined
  if (plan) {
    tidied = findBlock(plan.id)?.name
    // Show both blocks first so the student can watch one slide over to the other
    frameBlocks([sourceId, targetId])
    await wait(450)
    abee().pointAt(`block:${plan.id}`, 'Moving closer', true)
    await wait(350)
    await moveBlock(plan.id, plan.to)
  }
  frameBlocks([sourceId, targetId])
  await wait(450)

  await demoPoint(`block:${sourceId}`, 'From here…')
  await demoPoint(`block:${targetId}`, '…to here')
  applyConnection(conn)
  return {
    ok: true,
    connected: `${source.name} → ${target.name}`,
    ...(tidied ? { tidied: `moved ${tidied} next to the other block first, so the wire is easy to follow` } : {}),
  }
}

async function toggleSwitch(id: string): Promise<ToolResult> {
  const sw = useRuleStore.getState().switchBlocks.find((b) => b.id === id)
  if (!sw) return { error: 'That is not a Switch on the canvas.' }
  await demoPoint(`block:${id}`, sw.isOn ? 'Turn off' : 'Turn on')
  useRuleStore.getState().updateSwitchBlock(id, { isOn: !sw.isOn })
  useRuleStore.getState().evaluateGraph()
  return { ok: true, isOn: !sw.isOn }
}

async function setProperty(id: string, field: string, raw: string): Promise<ToolResult> {
  const rules = useRuleStore.getState()
  const value = parseValue(raw)
  await demoPoint(`block:${id}`)

  const sensor = rules.sensorBlocks.find((b) => b.id === id)
  const condition = rules.conditionBlocks.find((b) => b.id === id)
  const display = rules.displayBlocks.find((b) => b.id === id)

  if (sensor && field === 'value') {
    if (sensor.sensorType === 'text-input') rules.updateSensorBlock(id, { value: raw, hasSent: true })
    else if (sensor.sensorType === 'motion') rules.updateSensorBlock(id, { value: value === true })
    else if (typeof value === 'number') rules.updateSensorBlock(id, { value })
    else return { error: 'This sensor needs a number.' }
  } else if (condition && field === 'operator') {
    if (!OPERATORS.includes(raw as RuleOperator)) return { error: `Operator must be one of ${OPERATORS.join(' ')}` }
    rules.updateConditionBlock(id, { operator: raw as RuleOperator })
  } else if (condition && field === 'threshold') {
    rules.updateConditionBlock(id, { threshold: value })
  } else if (display && field === 'message') {
    rules.updateDisplayBlock(id, { message: raw })
  } else {
    return { error: `Can't set "${field}" on that block.` }
  }
  rules.evaluateGraph()
  return { ok: true }
}

async function openProperties(id: string): Promise<ToolResult> {
  const block = findBlock(id)
  if (!block || !INSPECTABLE.has(block.type)) return { error: 'That block has no Properties panel.' }
  await demoPoint(`block:${id}`, 'Double-click')
  useUIStore.getState().setSelectedBlock(id, block.type as Parameters<ReturnType<typeof useUIStore.getState>['setSelectedBlock']>[1])
  return { ok: true }
}

async function clickTarget(target: string): Promise<ToolResult> {
  if (target.startsWith('block:') || target.startsWith('curriculum.prev') || target.startsWith('curriculum.next')) {
    return { error: 'Use the dedicated tool for that (open_properties or go_to_step).' }
  }
  if (!(await revealTarget(target, { openMenus: false }))) return { error: `"${target}" isn't on screen.` }
  await demoPoint(target, 'Click')
  const el = findTargetElement(target)
  if (!el || (el as HTMLButtonElement).disabled) return { error: `"${target}" can't be pressed right now.` }
  el.click()
  return { ok: true }
}

function goToStep(direction: 'next' | 'prev'): ToolResult {
  const cur = useCurriculumStore.getState()
  const { module, step, index, total } = currentStep()
  if (direction === 'prev') {
    if (index === 0) return { error: 'Already on the first step.' }
    cur.prevStep()
  } else {
    cur.markStepComplete(step.id)
    if (index < total - 1) {
      cur.nextStep(total)
    } else {
      const next = CURRICULUM[CURRICULUM.findIndex((m) => m.id === module.id) + 1]
      if (!next) return { error: 'This is the very last step!' }
      cur.setModule(next.id)
      cur.goToStep(0)
    }
  }
  return { ok: true, nowOn: currentStep().step.title }
}

// ── Dispatcher ────────────────────────────────────────────────────────────

const DEMO_TOOLS = new Set(['open_menu', 'add_block', 'connect', 'toggle_switch', 'set_property', 'open_properties', 'click'])

const BLOCK_ARGS = ['id', 'sourceId', 'targetId', 'from_block', 'to_block', 'block']
const TARGET_ARGS = ['target', 'from', 'to']

/** Map the model's way of naming blocks and targets onto the real ones */
function normalizeArgs(args: Record<string, string>): Record<string, string> {
  const out = { ...args }
  for (const k of BLOCK_ARGS) if (out[k]) out[k] = resolveBlockId(out[k]) ?? out[k]
  for (const k of TARGET_ARGS) if (out[k]) out[k] = normalizeTarget(out[k])
  return out
}

export async function runTool(name: string, rawArgs: Record<string, string>): Promise<ToolResult> {
  const args = normalizeArgs(rawArgs ?? {})
  try {
    if (DEMO_TOOLS.has(name)) {
      if (aborted) return { error: 'The student took back control. Stop the demo and say "Your turn!".' }
      if (!abee().takeoverActive) {
        return { error: 'Guide instead: tell the student the step and point at it (point_at / show_path). Only demo if they already tried, are still stuck, and asked you to show them — then call start_takeover first.' }
      }
    }

    switch (name) {
      case 'point_at': return await guidePoint(args.target, args.note, args.block)
      case 'show_wire': return await showWire(args.from_block, args.to_block, args.note)
      case 'no_pointer': return { ok: true }
      case 'start_takeover':
        if (aborted) return { error: 'The student took back control. Stop and say "Your turn!".' }
        startTakeover()
        return { ok: true, note: 'When the demo ends, the canvas is put back automatically so the student can do it themselves.' }
      case 'open_menu': {
        const menu = args.menu as ToolbarMenu
        if (!MENUS.includes(menu)) return { error: `Menu must be one of ${MENUS.join(', ')}` }
        await demoPoint(`toolbar.${menu}`, 'Click')
        useUIStore.getState().setOpenToolbarMenu(menu)
        return { ok: true, items: MENU_ITEMS[menu] }
      }
      case 'add_block': return await addBlock(args.blockType)
      case 'connect': return await connect(args.sourceId, args.targetId, args.input)
      case 'toggle_switch': return await toggleSwitch(args.id)
      case 'set_property': return await setProperty(args.id, args.field, String(args.value ?? ''))
      case 'open_properties': return await openProperties(args.id)
      case 'click': return await clickTarget(args.target)
      case 'close_panels':
        useUIStore.getState().setOpenToolbarMenu(null)
        useUIStore.getState().clearSelectedBlock()
        return { ok: true }
      case 'go_to_step': return goToStep(args.direction === 'prev' ? 'prev' : 'next')
      case 'end_takeover':
        endTakeover()
        return { ok: true }
      default:
        return { error: `Unknown tool ${name}` }
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}
