import { CURRICULUM } from '@/data/curriculum'
import { useCurriculumStore } from '@/store/useCurriculumStore'
import { useRuleStore } from '@/store/useRuleStore'
import { useWorkflowStore } from '@/store/useWorkflowStore'
import { useModelStore } from '@/store/useModelStore'
import { useDatasetStore } from '@/store/useDatasetStore'
import { useRLStore } from '@/store/useRLStore'
import { useCanvasStore } from '@/store/useCanvasStore'
import { useUIStore } from '@/store/useUIStore'
import { recentActivity } from './activity'
import { visibleTargets, MENU_ITEMS, blockParts } from './targets'

/** One canvas block, flattened to what Abee needs to reason about it. */
export interface BlockSummary {
  id: string
  /** The node type the canvas uses ('sensor', 'bulb', 'logic'…) */
  type: string
  name: string
  /** Block ids feeding into this block */
  inputs: string[]
  /** Live state worth talking about — on/off, sensor value, training status… */
  state: Record<string, unknown>
}

export function listBlocks(): BlockSummary[] {
  const r = useRuleStore.getState()
  const w = useWorkflowStore.getState()
  const m = useModelStore.getState()
  const d = useDatasetStore.getState()
  const rl = useRLStore.getState()
  const c = useCanvasStore.getState()
  const links = (...ids: (string | null | undefined)[]) => ids.filter((x): x is string => !!x)

  return [
    ...r.sensorBlocks.map((b) => ({ id: b.id, type: 'sensor', name: b.name, inputs: [], state: { sensorType: b.sensorType, value: b.value, unit: b.unit } })),
    ...r.switchBlocks.map((b) => ({ id: b.id, type: 'switch', name: b.name, inputs: [], state: { isOn: b.isOn } })),
    ...r.conditionBlocks.map((b) => ({
      id: b.id, type: 'condition', name: b.name, inputs: links(b.linkedSensorId, b.linkedModelId),
      state: { operator: b.operator, threshold: b.threshold, modelCondition: b.modelCondition ?? null, output: b.currentOutput },
    })),
    ...r.logicBlocks.map((b) => ({ id: b.id, type: 'logic', name: b.name, inputs: links(...b.linkedInputIds), state: { logicType: b.logicType, output: b.currentOutput } })),
    ...r.timerBlocks.map((b) => ({
      id: b.id, type: 'timer', name: b.name, inputs: links(b.linkedRuleBlockId),
      state: { mode: b.timerMode ?? 'duration', seconds: b.durationMinutes * 60 + b.durationSeconds, running: b.isRunning, output: b.currentOutput },
    })),
    ...r.fanBlocks.map((b) => ({ id: b.id, type: 'fan', name: b.name, inputs: links(b.linkedRuleBlockId), state: { isOn: b.isOn } })),
    ...r.alarmBlocks.map((b) => ({ id: b.id, type: 'alarm', name: b.name, inputs: links(b.linkedRuleBlockId), state: { isOn: b.isOn } })),
    ...r.acBlocks.map((b) => ({ id: b.id, type: 'ac', name: b.name, inputs: links(b.linkedRuleBlockId), state: { isOn: b.isOn } })),
    ...r.phoneUnlockBlocks.map((b) => ({ id: b.id, type: 'phoneunlock', name: b.name, inputs: links(b.linkedRuleBlockId), state: { isOn: b.isOn } })),
    ...r.displayBlocks.map((b) => ({ id: b.id, type: 'display', name: b.name, inputs: links(b.linkedRuleBlockId), state: { isOn: b.isOn, message: b.message } })),
    ...r.binBlocks.map((b) => ({ id: b.id, type: 'bin', name: b.name, inputs: links(b.linkedRuleBlockId), state: { isOn: b.isOn, color: b.color } })),
    ...w.doorBlocks.map((b) => ({ id: b.id, type: 'door', name: b.name, inputs: links(b.linkedRuleBlockId), state: { isOpen: b.isOpen } })),
    ...w.bulbBlocks.map((b) => ({ id: b.id, type: 'bulb', name: b.name, inputs: links(b.linkedRuleBlockId), state: { isOn: b.isOn } })),
    ...m.modelBlocks.map((b) => ({
      id: b.id, type: 'model', name: b.name, inputs: links(b.linkedBlockId, b.testLinkedBlockId, b.liveLinkedSensorId),
      state: {
        modelType: b.modelType, status: b.status, trainingData: b.linkedBlockId, testData: b.testLinkedBlockId,
        testStatus: b.testStatus, testsRun: b.testResults?.length ?? 0,
        testAccuracy: b.testResults?.length
          ? Math.round((b.testResults.filter((t) => t.actualLabelId && t.actualLabelId === t.predictedLabelId).length / b.testResults.length) * 100)
          : null,
        livePrediction: b.liveResult?.predictedLabel ?? null,
      },
    })),
    ...d.labelledBlocks.map((b) => ({
      id: b.id, type: 'labelled', name: b.name, inputs: [],
      state: { labels: b.labels.map((l) => `${l.name} (${l.itemIds.length})`), unsortedItems: b.itemIds.length },
    })),
    ...d.unlabelledBlocks.map((b) => ({ id: b.id, type: 'unlabelled', name: b.name, inputs: [], state: { items: b.itemIds.length } })),
    ...rl.rlBlocks.map((b) => ({
      id: b.id, type: 'rl-gridworld', name: b.name, inputs: [],
      state: { size: `${b.gridWidth}x${b.gridHeight}`, training: b.trainingStatus, episode: b.currentEpisode, of: b.episodes },
    })),
    ...c.textBlocks.map((b) => ({ id: b.id, type: 'text', name: 'Text note', inputs: [], state: { text: b.text.slice(0, 80) } })),
    ...c.imageBlocks.map((b) => ({ id: b.id, type: 'image', name: 'Picture', inputs: [], state: {} })),
  ]
}

// Abee sees short block ids (the first 8 characters) — the model copies long
// ids badly, often trimming them or adding a "block:" prefix. Anything it
// sends back goes through resolveBlockId, which accepts all of those forms.
const SHORT = 8
export const shortId = (id: string) => id.slice(0, SHORT)

/** Turn whatever Abee called a block (full id, short id, "block:<id>", or its name) into the real id */
export function resolveBlockId(raw?: string | null): string | null {
  if (!raw) return null
  const r = String(raw).trim().replace(/^block:/i, '')
  if (!r) return null
  const blocks = listBlocks()
  if (blocks.some((b) => b.id === r)) return r
  const byPrefix = blocks.filter((b) => b.id.startsWith(r))
  if (r.length >= 4 && byPrefix.length === 1) return byPrefix[0].id
  const byName = blocks.filter((b) => b.name.toLowerCase() === r.toLowerCase())
  if (byName.length === 1) return byName[0].id
  return null
}

/** Field names the model tends to guess, mapped to the real targets */
const FIELD_ALIASES: Record<string, string> = {
  'inspector.condition.threshold': 'inspector.condition.value',
  'inspector.condition.condition': 'inspector.condition.operator',
  'inspector.condition.comparison': 'inspector.condition.operator',
  'inspector.sensor.slider': 'inspector.sensor.value',
}

/** Fix up a pointer target: real block ids inside block:/handle:/control: targets, known field names */
export function normalizeTarget(target?: string | null): string {
  const t = String(target ?? '').trim()
  const m = t.match(/^(block|handle|control):([^:]+)(:.*)?$/i)
  if (m) {
    const id = resolveBlockId(m[2])
    if (id) return `${m[1].toLowerCase()}:${id}${m[3] ?? ''}`
  }
  return FIELD_ALIASES[t] ?? t
}

export function findBlock(id: string): BlockSummary | undefined {
  const real = resolveBlockId(id)
  return real ? listBlocks().find((b) => b.id === real) : undefined
}

export function currentStep() {
  const { currentModuleId, currentStepIndex } = useCurriculumStore.getState()
  const module = CURRICULUM.find((m) => m.id === currentModuleId) ?? CURRICULUM[0]
  const step = module.steps[currentStepIndex] ?? module.steps[0]
  return { module, step, index: currentStepIndex, total: module.steps.length }
}

const tidy = (md: string | undefined) => (md ?? '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 4000)

/**
 * Everything Abee knows about the student's screen, sent along with each
 * question. Built on demand — nothing here listens to the student.
 */
export function buildScreenState() {
  const { module, step, index, total } = currentStep()
  const ui = useUIStore.getState()
  const bankItems = useDatasetStore.getState().bankItems

  const lesson =
    step.type === 'learn' ? tidy(step.body) + (step.tip ? `\n\nTip: ${step.tip}` : '')
    : step.type === 'lab' ? tidy(step.instruction) + (step.canvasHint ? `\n\nCanvas hint: ${step.canvasHint}` : '')
    : tidy(step.prompt) + (step.successHint ? `\n\nSuccess hint: ${step.successHint}` : '')

  return {
    step: {
      chapter: `${module.title}: ${module.subtitle}`,
      kind: step.type,
      title: step.title,
      position: `${index + 1} of ${total}`,
      text: lesson,
      curriculumPanelOpen: !ui.curriculumCollapsed,
    },
    // Each block with the connection dots and controls Abee can point at
    canvas: listBlocks().map((b) => {
      const { inDots, outDots, controls } = blockParts(b.id)
      const short = (t: string) => t.replace(b.id, shortId(b.id))
      return {
        ...b,
        id: shortId(b.id),
        inputs: b.inputs.map(shortId),
        ...(inDots.length ? { inDots: inDots.map(short) } : {}),
        ...(outDots.length ? { outDots: outDots.map(short) } : {}),
        ...(controls.length ? { controls: controls.map(short) } : {}),
      }
    }),
    dataBank: { items: bankItems.length, open: !ui.leftPanelCollapsed },
    ui: {
      propertiesPanelFor: ui.selectedBlockId ? shortId(ui.selectedBlockId) : null,
      openMenu: ui.openToolbarMenu,
      tool: ui.canvasTool,
    },
    recentActivity: recentActivity(),
    targets: {
      visibleNow: visibleTargets(),
      menuItems: MENU_ITEMS,
      blocks: 'block:<blockId> for any canvas block; each block lists its inDots/outDots (connection dots) and controls (like its on/off toggle)',
    },
  }
}
