import { useRuleStore } from '@/store/useRuleStore'
import { useWorkflowStore } from '@/store/useWorkflowStore'
import { useDatasetStore } from '@/store/useDatasetStore'
import { useModelStore } from '@/store/useModelStore'
import type { SensorType } from '@/types/rules'

/**
 * One registry of the blocks a guide can talk about: what kids call them in the
 * lessons, where they live in the toolbar, which dots they have, and what's wired into them.
 */

export type GuideKind =
  | 'switch' | 'bulb' | 'fan' | 'door' | 'ac' | 'alarm'
  | 'sensor-temperature' | 'sensor-motion' | 'sensor-light' | 'sensor-humidity' | 'sensor-text'
  | 'condition' | 'logic-and' | 'logic-or' | 'logic-not'
  | 'labelled' | 'unlabelled'
  | 'model-image-supervised' | 'model-image-unsupervised' | 'model-text-supervised' | 'model-text-unsupervised'

export type Menu = 'rule' | 'actions' | 'data' | 'model'

export interface KindInfo {
  /** Names used in lesson text (lower-case, singular). */
  names: string[]
  label: string
  menu: Menu
  /** Out dot id, if it has one. */
  out?: string
  /** In dot ids, in the order to fill them. */
  in?: string[]
}

export const KINDS: Record<GuideKind, KindInfo> = {
  switch: { names: ['switch', 'switch a', 'switch b', 'switch c'], label: '🎚️ Switch', menu: 'rule', out: 'rule-out' },
  bulb: { names: ['bulb', 'light bulb'], label: '💡 Bulb', menu: 'actions', in: ['bulb-in'] },
  fan: { names: ['fan'], label: '🌀 Fan', menu: 'actions', in: ['fan-in'] },
  door: { names: ['door'], label: '🚪 Door', menu: 'actions', in: ['door-in'] },
  ac: { names: ['ac', 'air conditioner'], label: '❄️ AC', menu: 'actions', in: ['ac-in'] },
  alarm: { names: ['alarm'], label: '🚨 Alarm', menu: 'actions', in: ['alarm-in'] },
  'sensor-temperature': { names: ['temperature sensor', 'temperature'], label: '🌡️ Temperature', menu: 'rule', out: 'sensor-out' },
  'sensor-motion': { names: ['motion sensor', 'motion'], label: '👁️ Motion', menu: 'rule', out: 'sensor-out' },
  'sensor-light': { names: ['light sensor', 'light level', 'light level sensor'], label: '💡 Light Level', menu: 'rule', out: 'sensor-out' },
  'sensor-humidity': { names: ['humidity sensor', 'humidity'], label: '💧 Humidity', menu: 'rule', out: 'sensor-out' },
  'sensor-text': { names: ['text input', 'text input component', 'text input sensor'], label: '📝 Text Input', menu: 'rule', out: 'sensor-out' },
  condition: { names: ['if condition', 'condition', 'if', 'if gate'], label: '📋 IF Condition', menu: 'rule', out: 'rule-out', in: ['condition-in'] },
  'logic-and': { names: ['and condition', 'and', 'and gate'], label: '∧ AND', menu: 'rule', out: 'rule-out', in: ['logic-in-1', 'logic-in-2'] },
  'logic-or': { names: ['or condition', 'or', 'or gate'], label: '∨ OR', menu: 'rule', out: 'rule-out', in: ['logic-in-1', 'logic-in-2'] },
  'logic-not': { names: ['not condition', 'not', 'not gate'], label: '¬ NOT', menu: 'rule', out: 'rule-out', in: ['logic-in'] },
  // The toolbar calls it "Labelled" and its settings say "Labelled Block", so hints use that word too.
  labelled: { names: ['labelled', 'label data', 'label data block', 'labelled block', 'labelled dataset block'], label: '🏷️ Labelled', menu: 'data', out: 'out' },
  unlabelled: { names: ['unlabelled block', 'unlabelled data', 'unlabelled dataset', 'unlabelled dataset block'], label: '📦 Unlabelled', menu: 'data', out: 'out' },
  'model-image-supervised': { names: ['image supervised model', 'image supervised'], label: '🖼️ Image Supervised Model', menu: 'model', in: ['in'] },
  'model-image-unsupervised': { names: ['image unsupervised model', 'image unsupervised'], label: '🧩 Image Unsupervised Model', menu: 'model', in: ['in'] },
  'model-text-supervised': { names: ['text supervised model', 'text supervised'], label: '📝 Text Supervised Model', menu: 'model', in: ['in'] },
  'model-text-unsupervised': { names: ['text unsupervised model', 'text unsupervised'], label: '🔤 Text Unsupervised Model', menu: 'model', in: ['in'] },
}

export const isModelKind = (k: GuideKind) => k.startsWith('model-')

export const MENU_SEL: Record<Menu, string> = {
  rule: '[data-tour="menu-rule"]',
  actions: '[data-tour="menu-actions"]',
  data: '[data-tour="menu-data"]',
  model: '[data-tour="menu-model"]',
}
export const MENU_LABEL: Record<Menu, string> = { rule: '🔌 Rule-Based', actions: '⚡ Actions', data: '🗂️ Datasets', model: '🤖 Model' }
export const paletteSel = (k: GuideKind) => `[data-tour="palette-${k}"]`
export const nodeSel = (id: string | undefined | null) => (id ? `.react-flow__node[data-id="${id}"]` : null)
export const handleSel = (id: string | undefined | null, handle: string) =>
  id ? `.react-flow__handle[data-nodeid="${id}"][data-handleid="${handle}"]` : null

/** Match a name from lesson text ("the first IF Conditions" → condition). */
export function kindFromName(raw: string): GuideKind | null {
  const n = raw.toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim()
  const variants = [n, n.replace(/s$/, ''), n.replace(/es$/, '')]
  // Longest names first so "temperature sensor" wins over "temperature".
  const all = (Object.keys(KINDS) as GuideKind[])
    .flatMap((k) => KINDS[k].names.map((name) => ({ k, name })))
    .sort((a, b) => b.name.length - a.name.length)
  for (const v of variants) {
    const hit = all.find((x) => v === x.name || v.endsWith(' ' + x.name))
    if (hit) return hit.k
  }
  return null
}

// ── reading the stores ───────────────────────────────────────────────────────

export interface AnyBlock {
  id: string
  kind: GuideKind
  inputs: string[]
  isOn?: boolean
  value?: unknown
  operator?: string
  threshold?: unknown
  /** Dataset and model blocks: the name shown on the block. */
  name?: string
  /** Label Data: its label names, how many items it holds, and how many still have no label. */
  labels?: string[]
  items?: number
  unassigned?: number
  /** Models: idle / loading / training / trained / error. */
  status?: string
  /** Models: the dataset plugged into the amber test dot, and how testing is going (idle / running / done). */
  testInput?: string | null
  testStatus?: string
}

const SENSOR_KIND: Partial<Record<SensorType, GuideKind>> = {
  temperature: 'sensor-temperature',
  motion: 'sensor-motion',
  light: 'sensor-light',
  humidity: 'sensor-humidity',
  'text-input': 'sensor-text',
}

/** Every guide-relevant block on the canvas, with what's wired into it. */
export function allBlocks(): AnyBlock[] {
  const r = useRuleStore.getState()
  const w = useWorkflowStore.getState()
  const out: AnyBlock[] = []
  const linked = (id: string | null | undefined) => (id ? [id] : [])
  r.switchBlocks.forEach((b) => out.push({ id: b.id, kind: 'switch', inputs: [], isOn: b.isOn }))
  w.bulbBlocks.forEach((b) => out.push({ id: b.id, kind: 'bulb', inputs: linked(b.linkedRuleBlockId), isOn: b.isOn }))
  w.doorBlocks.forEach((b) => out.push({ id: b.id, kind: 'door', inputs: linked(b.linkedRuleBlockId) }))
  r.fanBlocks.forEach((b) => out.push({ id: b.id, kind: 'fan', inputs: linked(b.linkedRuleBlockId), isOn: b.isOn }))
  r.acBlocks.forEach((b) => out.push({ id: b.id, kind: 'ac', inputs: linked(b.linkedRuleBlockId), isOn: b.isOn }))
  r.alarmBlocks.forEach((b) => out.push({ id: b.id, kind: 'alarm', inputs: linked(b.linkedRuleBlockId), isOn: b.isOn }))
  r.sensorBlocks.forEach((b) => {
    const kind = SENSOR_KIND[b.sensorType]
    if (kind) out.push({ id: b.id, kind, inputs: [], value: b.value })
  })
  r.conditionBlocks.forEach((b) =>
    out.push({ id: b.id, kind: 'condition', inputs: [...linked(b.linkedSensorId), ...linked(b.linkedModelId)], operator: b.operator, threshold: b.threshold })
  )
  r.logicBlocks.forEach((b) =>
    out.push({ id: b.id, kind: `logic-${b.logicType}` as GuideKind, inputs: b.linkedInputIds.filter((x): x is string => !!x) })
  )
  const d = useDatasetStore.getState()
  d.labelledBlocks.forEach((b) => {
    const labelled = b.labels.reduce((n, l) => n + l.itemIds.length, 0)
    out.push({
      id: b.id, kind: 'labelled', inputs: [], name: b.name,
      labels: b.labels.map((l) => l.name), items: b.itemIds.length + labelled, unassigned: b.itemIds.length,
    })
  })
  d.unlabelledBlocks.forEach((b) => out.push({ id: b.id, kind: 'unlabelled', inputs: [], name: b.name, items: b.itemIds.length }))
  useModelStore.getState().modelBlocks.forEach((b) => {
    const kind = `model-${b.modelType}` as GuideKind
    if (KINDS[kind]) {
      out.push({
        id: b.id, kind, inputs: linked(b.linkedBlockId), name: b.name, status: b.status,
        testInput: b.testLinkedBlockId, testStatus: b.testStatus,
      })
    }
  })
  return out
}

export const idsOf = (kind: GuideKind) => allBlocks().filter((b) => b.kind === kind).map((b) => b.id)
