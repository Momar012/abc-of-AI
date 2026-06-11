import { create } from 'zustand'
import { v4 as uuid } from 'uuid'
import {
  SensorBlock, SensorType, ConditionBlock, RuleOperator,
  LogicBlock, FanBlock, AlarmBlock,
} from '@/types/rules'

const SENSOR_DEFAULTS: Record<SensorType, Partial<SensorBlock>> = {
  temperature: { value: 25, min: -20, max: 100, unit: '°C' },
  light:       { value: 50,  min: 0,   max: 100, unit: '%'  },
  motion:      { value: false },
  humidity:    { value: 60,  min: 0,   max: 100, unit: '%'  },
  'text-input':{ value: '' },
}

const SENSOR_LABELS: Record<SensorType, string> = {
  temperature: '🌡️ Temperature',
  light:       '💡 Light Level',
  motion:      '👁️ Motion',
  humidity:    '💧 Humidity',
  'text-input':'📝 Text Input',
}

function evalCondition(
  value: number | boolean | string,
  op: RuleOperator,
  threshold: number | boolean | string,
): boolean {
  switch (op) {
    case '>':        return Number(value) > Number(threshold)
    case '<':        return Number(value) < Number(threshold)
    case '>=':       return Number(value) >= Number(threshold)
    case '<=':       return Number(value) <= Number(threshold)
    case '==':       return String(value) === String(threshold)
    case '!=':       return String(value) !== String(threshold)
    case 'contains': return String(value).toLowerCase().includes(String(threshold).toLowerCase())
    case 'is':       return Boolean(value) === (threshold === true || threshold === 'true')
    default:         return false
  }
}

interface RuleState {
  sensorBlocks: SensorBlock[]
  conditionBlocks: ConditionBlock[]
  logicBlocks: LogicBlock[]
  fanBlocks: FanBlock[]
  alarmBlocks: AlarmBlock[]

  addSensorBlock: (sensorType: SensorType, pos?: { x: number; y: number }) => void
  removeSensorBlock: (id: string) => void
  updateSensorBlock: (id: string, updates: Partial<SensorBlock>) => void
  updateSensorBlockPosition: (id: string, pos: { x: number; y: number }) => void

  addConditionBlock: (pos?: { x: number; y: number }) => void
  removeConditionBlock: (id: string) => void
  updateConditionBlock: (id: string, updates: Partial<ConditionBlock>) => void
  updateConditionBlockPosition: (id: string, pos: { x: number; y: number }) => void

  addLogicBlock: (logicType: 'and' | 'or' | 'not', pos?: { x: number; y: number }) => void
  removeLogicBlock: (id: string) => void
  updateLogicBlock: (id: string, updates: Partial<LogicBlock>) => void
  updateLogicBlockPosition: (id: string, pos: { x: number; y: number }) => void

  addFanBlock: (pos?: { x: number; y: number }) => void
  removeFanBlock: (id: string) => void
  updateFanBlock: (id: string, updates: Partial<FanBlock>) => void
  updateFanBlockPosition: (id: string, pos: { x: number; y: number }) => void

  addAlarmBlock: (pos?: { x: number; y: number }) => void
  removeAlarmBlock: (id: string) => void
  updateAlarmBlock: (id: string, updates: Partial<AlarmBlock>) => void
  updateAlarmBlockPosition: (id: string, pos: { x: number; y: number }) => void

  evaluateGraph: () => void
}

export const useRuleStore = create<RuleState>((set, get) => ({
  sensorBlocks: [],
  conditionBlocks: [],
  logicBlocks: [],
  fanBlocks: [],
  alarmBlocks: [],

  // ── Sensors ──────────────────────────────────────────────────────────────
  addSensorBlock: (sensorType, pos?) =>
    set((s) => ({
      sensorBlocks: [
        ...s.sensorBlocks,
        {
          id: uuid(), type: 'sensor', sensorType,
          position: pos ?? { x: 200 + s.sensorBlocks.length * 40, y: 300 + s.sensorBlocks.length * 40 },
          name: SENSOR_LABELS[sensorType],
          ...SENSOR_DEFAULTS[sensorType],
        } as SensorBlock,
      ],
    })),

  removeSensorBlock: (id) =>
    set((s) => ({ sensorBlocks: s.sensorBlocks.filter((b) => b.id !== id) })),

  updateSensorBlock: (id, updates) =>
    set((s) => ({ sensorBlocks: s.sensorBlocks.map((b) => (b.id === id ? { ...b, ...updates } : b)) })),

  updateSensorBlockPosition: (id, pos) =>
    set((s) => ({ sensorBlocks: s.sensorBlocks.map((b) => (b.id === id ? { ...b, position: pos } : b)) })),

  // ── Conditions ───────────────────────────────────────────────────────────
  addConditionBlock: (pos?) =>
    set((s) => ({
      conditionBlocks: [
        ...s.conditionBlocks,
        {
          id: uuid(), type: 'condition',
          position: pos ?? { x: 450 + s.conditionBlocks.length * 40, y: 300 + s.conditionBlocks.length * 40 },
          name: `IF ${s.conditionBlocks.length + 1}`,
          linkedSensorId: null, operator: '>' as RuleOperator, threshold: 0, currentOutput: null,
        },
      ],
    })),

  removeConditionBlock: (id) =>
    set((s) => ({ conditionBlocks: s.conditionBlocks.filter((b) => b.id !== id) })),

  updateConditionBlock: (id, updates) =>
    set((s) => ({ conditionBlocks: s.conditionBlocks.map((b) => (b.id === id ? { ...b, ...updates } : b)) })),

  updateConditionBlockPosition: (id, pos) =>
    set((s) => ({ conditionBlocks: s.conditionBlocks.map((b) => (b.id === id ? { ...b, position: pos } : b)) })),

  // ── Logic ─────────────────────────────────────────────────────────────────
  addLogicBlock: (logicType, pos?) =>
    set((s) => ({
      logicBlocks: [
        ...s.logicBlocks,
        {
          id: uuid(), type: 'logic', logicType,
          position: pos ?? { x: 650 + s.logicBlocks.length * 40, y: 300 + s.logicBlocks.length * 40 },
          name: logicType === 'and' ? '∧ AND' : logicType === 'or' ? '∨ OR' : '¬ NOT',
          linkedInputIds: logicType === 'not' ? [null] : [null, null],
          currentOutput: null,
        },
      ],
    })),

  removeLogicBlock: (id) =>
    set((s) => ({ logicBlocks: s.logicBlocks.filter((b) => b.id !== id) })),

  updateLogicBlock: (id, updates) =>
    set((s) => ({ logicBlocks: s.logicBlocks.map((b) => (b.id === id ? { ...b, ...updates } : b)) })),

  updateLogicBlockPosition: (id, pos) =>
    set((s) => ({ logicBlocks: s.logicBlocks.map((b) => (b.id === id ? { ...b, position: pos } : b)) })),

  // ── Fan ──────────────────────────────────────────────────────────────────
  addFanBlock: (pos?) =>
    set((s) => ({
      fanBlocks: [
        ...s.fanBlocks,
        {
          id: uuid(), type: 'fan',
          position: pos ?? { x: 850 + s.fanBlocks.length * 40, y: 300 + s.fanBlocks.length * 40 },
          name: `Fan ${s.fanBlocks.length + 1}`,
          linkedRuleBlockId: null, isOn: false,
        },
      ],
    })),

  removeFanBlock: (id) =>
    set((s) => ({ fanBlocks: s.fanBlocks.filter((b) => b.id !== id) })),

  updateFanBlock: (id, updates) =>
    set((s) => ({ fanBlocks: s.fanBlocks.map((b) => (b.id === id ? { ...b, ...updates } : b)) })),

  updateFanBlockPosition: (id, pos) =>
    set((s) => ({ fanBlocks: s.fanBlocks.map((b) => (b.id === id ? { ...b, position: pos } : b)) })),

  // ── Alarm ────────────────────────────────────────────────────────────────
  addAlarmBlock: (pos?) =>
    set((s) => ({
      alarmBlocks: [
        ...s.alarmBlocks,
        {
          id: uuid(), type: 'alarm',
          position: pos ?? { x: 900 + s.alarmBlocks.length * 40, y: 350 + s.alarmBlocks.length * 40 },
          name: `Alarm ${s.alarmBlocks.length + 1}`,
          linkedRuleBlockId: null, isOn: false,
        },
      ],
    })),

  removeAlarmBlock: (id) =>
    set((s) => ({ alarmBlocks: s.alarmBlocks.filter((b) => b.id !== id) })),

  updateAlarmBlock: (id, updates) =>
    set((s) => ({ alarmBlocks: s.alarmBlocks.map((b) => (b.id === id ? { ...b, ...updates } : b)) })),

  updateAlarmBlockPosition: (id, pos) =>
    set((s) => ({ alarmBlocks: s.alarmBlocks.map((b) => (b.id === id ? { ...b, position: pos } : b)) })),

  // ── Graph evaluation ──────────────────────────────────────────────────────
  evaluateGraph: () => {
    const { sensorBlocks, conditionBlocks, logicBlocks, fanBlocks, alarmBlocks } = get()

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { modelBlocks } = require('@/store/useModelStore').useModelStore.getState()

    // 1. Evaluate condition blocks
    const newConditions = conditionBlocks.map((c) => {
      if (c.linkedModelId) {
        // Model prediction path
        const modelBlock = modelBlocks.find((m: { id: string; testResults?: { predictedLabel: string }[] }) => m.id === c.linkedModelId)
        if (!modelBlock?.testResults?.length || !c.modelCondition) return { ...c, currentOutput: null }
        return { ...c, currentOutput: modelBlock.testResults[0].predictedLabel === c.modelCondition }
      }
      if (!c.linkedSensorId) return { ...c, currentOutput: null }
      const sensor = sensorBlocks.find((s) => s.id === c.linkedSensorId)
      if (!sensor) return { ...c, currentOutput: null }
      return { ...c, currentOutput: evalCondition(sensor.value, c.operator, c.threshold) }
    })

    // 2. Evaluate logic blocks (iterative topological pass, max 10 rounds)
    const resolved = new Map<string, boolean | null>()
    newConditions.forEach((c) => resolved.set(c.id, c.currentOutput))
    const newLogic = logicBlocks.map((b) => ({ ...b }))

    for (let iter = 0; iter < 10; iter++) {
      let changed = false
      for (const block of newLogic) {
        const inputs = block.linkedInputIds.map((id) => (id ? (resolved.get(id) ?? null) : null))
        let out: boolean | null = null
        if (block.logicType === 'and') {
          if (inputs[0] !== null && inputs[1] !== null) out = inputs[0] === true && inputs[1] === true
        } else if (block.logicType === 'or') {
          if (inputs[0] !== null || inputs[1] !== null)
            out = inputs[0] === true || inputs[1] === true
        } else if (block.logicType === 'not') {
          if (inputs[0] !== null) out = !inputs[0]
        }
        if (out !== block.currentOutput) { block.currentOutput = out; changed = true }
        resolved.set(block.id, block.currentOutput)
      }
      if (!changed) break
    }

    // 3. Update fan/alarm blocks
    const newFans = fanBlocks.map((f) => ({
      ...f, isOn: f.linkedRuleBlockId ? (resolved.get(f.linkedRuleBlockId) === true) : false,
    }))
    const newAlarms = alarmBlocks.map((a) => ({
      ...a, isOn: a.linkedRuleBlockId ? (resolved.get(a.linkedRuleBlockId) === true) : false,
    }))

    // 4. Update door/bulb blocks in workflow store
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const wfStore = require('@/store/useWorkflowStore').useWorkflowStore
    const { doorBlocks, bulbBlocks, updateDoorBlock, updateBulbBlock } = wfStore.getState()
    ;(doorBlocks as { id: string; linkedRuleBlockId: string | null }[]).forEach((d) => {
      if (d.linkedRuleBlockId) {
        updateDoorBlock(d.id, { isOpen: resolved.get(d.linkedRuleBlockId) === true })
      }
    })
    ;(bulbBlocks as { id: string; linkedRuleBlockId: string | null }[]).forEach((b) => {
      if (b.linkedRuleBlockId) {
        updateBulbBlock(b.id, { isOn: resolved.get(b.linkedRuleBlockId) === true })
      }
    })

    set({ conditionBlocks: newConditions, logicBlocks: newLogic, fanBlocks: newFans, alarmBlocks: newAlarms })
  },
}))
