import { useRuleStore } from '@/store/useRuleStore'
import { useWorkflowStore } from '@/store/useWorkflowStore'
import type { SensorType } from '@/types/rules'

/**
 * One registry of the rule-based blocks a guide can talk about: what kids call them in the
 * lessons, where they live in the toolbar, which dots they have, and what's wired into them.
 */

export type GuideKind =
  | 'switch' | 'bulb' | 'fan' | 'door' | 'ac' | 'alarm'
  | 'sensor-temperature' | 'sensor-motion' | 'sensor-light' | 'sensor-humidity' | 'sensor-text'
  | 'condition' | 'logic-and' | 'logic-or' | 'logic-not'

export interface KindInfo {
  /** Names used in lesson text (lower-case, singular). */
  names: string[]
  label: string
  menu: 'rule' | 'actions'
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
}

export const MENU_SEL = { rule: '[data-tour="menu-rule"]', actions: '[data-tour="menu-actions"]' } as const
export const MENU_LABEL = { rule: '🔌 Rule-Based', actions: '⚡ Actions' } as const
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

interface AnyBlock {
  id: string
  kind: GuideKind
  inputs: string[]
  isOn?: boolean
  value?: unknown
  operator?: string
  threshold?: unknown
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
  return out
}

export const idsOf = (kind: GuideKind) => allBlocks().filter((b) => b.kind === kind).map((b) => b.id)
