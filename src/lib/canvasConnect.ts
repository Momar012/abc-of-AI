import { useModelStore } from '@/store/useModelStore'
import { useWorkflowStore } from '@/store/useWorkflowStore'
import { useRuleStore } from '@/store/useRuleStore'

export interface CanvasConnection {
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
}

// Rule-graph handles that expect a boolean-producing block (Condition/Logic/
// Timer/Switch) as their source — a raw Sensor id never resolves here.
export const SENSOR_BLOCKED_HANDLES: Record<string, string> = {
  'logic-in-1': 'a Logic gate', 'logic-in-2': 'a Logic gate', 'logic-in': 'a Logic gate',
  'timer-in': 'a Timer',
  'door-in': 'a Door', 'bulb-in': 'a Bulb', 'fan-in': 'a Fan', 'alarm-in': 'an Alarm', 'ac-in': 'an AC', 'phoneunlock-in': 'a Phone Unlock', 'display-in': 'a Display', 'bin-in': 'a Waste Bin',
}

// Kids sometimes wire a Switch into an IF block's sensor-input handle by habit —
// that silently stores the Switch's id as linkedSensorId, which never resolves
// against sensorBlocks in evaluateGraph(), leaving the condition stuck forever.
// Sensors have the mirror-image problem: wired straight into a Logic gate,
// Timer, or actuator, their raw value never appears in evaluateGraph()'s
// resolved boolean map, so the block is silently dead forever too. Refuse
// both at the connection layer instead.
export function isConnectionAllowed(connection: CanvasConnection): boolean {
  const { sensorBlocks } = useRuleStore.getState()
  if (connection.targetHandle === 'condition-in') {
    if (connection.sourceHandle === 'prediction-out') return true
    return sensorBlocks.some((b) => b.id === connection.source)
  }
  if (connection.targetHandle && SENSOR_BLOCKED_HANDLES[connection.targetHandle]) {
    return !sensorBlocks.some((b) => b.id === connection.source)
  }
  return true
}

/** Store a connection as the link field on the target block — the canvas edges are derived from those. */
export function applyConnection({ source, target, targetHandle, sourceHandle }: CanvasConnection): void {
  const rules = useRuleStore.getState()
  const workflow = useWorkflowStore.getState()
  const models = useModelStore.getState()
  const { evaluateGraph } = rules

  // ── ML pipeline ──────────────────────────────────────────────────────
  if (targetHandle === 'test-in') {
    models.updateModelBlock(target, { testLinkedBlockId: source, testStatus: 'idle', testResults: null })
  } else if (targetHandle === 'in') {
    const current = models.modelBlocks.find((b) => b.id === target)
    if (current?.trainedModelId) {
      // Model already trained — just update the linked block. Don't auto-reset;
      // the user must explicitly retrain if they want to update the model.
      models.updateModelBlock(target, { linkedBlockId: source })
    } else {
      models.updateModelBlock(target, { linkedBlockId: source, status: 'idle', trainedModelId: null, trainedLinkedBlockId: null, testStatus: 'idle', testResults: null })
    }
  } else if (targetHandle === 'door-in') {
    workflow.updateDoorBlock(target, { linkedRuleBlockId: source, isOpen: false })
    evaluateGraph()
  } else if (targetHandle === 'bulb-in') {
    workflow.updateBulbBlock(target, { linkedRuleBlockId: source, isOn: false })
    evaluateGraph()
  }

  // ── Rule pipeline ────────────────────────────────────────────────────
  else if (targetHandle === 'condition-in') {
    if (sourceHandle === 'prediction-out') {
      rules.updateConditionBlock(target, { linkedModelId: source, linkedSensorId: null, currentOutput: null })
    } else {
      const sensor = rules.sensorBlocks.find((b) => b.id === source)
      if (sensor?.sensorType === 'motion') {
        rules.updateConditionBlock(target, { linkedSensorId: source, linkedModelId: null, currentOutput: null, operator: 'is', threshold: null })
      } else if (sensor?.sensorType === 'text-input') {
        rules.updateConditionBlock(target, { linkedSensorId: source, linkedModelId: null, currentOutput: null, operator: '==', threshold: '' })
      } else {
        rules.updateConditionBlock(target, { linkedSensorId: source, linkedModelId: null, currentOutput: null, operator: '>', threshold: null })
      }
    }
    evaluateGraph()
  } else if (targetHandle === 'logic-in-1' || targetHandle === 'logic-in-2') {
    const block = rules.logicBlocks.find((b) => b.id === target)
    if (block) {
      const ids = [...block.linkedInputIds]
      ids[targetHandle === 'logic-in-1' ? 0 : 1] = source
      rules.updateLogicBlock(target, { linkedInputIds: ids })
      evaluateGraph()
    }
  } else if (targetHandle === 'logic-in') {
    rules.updateLogicBlock(target, { linkedInputIds: [source] })
    evaluateGraph()
  } else if (targetHandle === 'fan-in') {
    rules.updateFanBlock(target, { linkedRuleBlockId: source, isOn: false })
    evaluateGraph()
  } else if (targetHandle === 'alarm-in') {
    rules.updateAlarmBlock(target, { linkedRuleBlockId: source, isOn: false })
    evaluateGraph()
  } else if (targetHandle === 'ac-in') {
    rules.updateACBlock(target, { linkedRuleBlockId: source, isOn: false })
    evaluateGraph()
  } else if (targetHandle === 'phoneunlock-in') {
    rules.updatePhoneUnlockBlock(target, { linkedRuleBlockId: source, isOn: false })
    evaluateGraph()
  } else if (targetHandle === 'display-in') {
    rules.updateDisplayBlock(target, { linkedRuleBlockId: source, isOn: false })
    evaluateGraph()
  } else if (targetHandle === 'bin-in') {
    rules.updateBinBlock(target, { linkedRuleBlockId: source, isOn: false })
    evaluateGraph()
  } else if (targetHandle === 'timer-in') {
    rules.updateTimerBlock(target, { linkedRuleBlockId: source, isRunning: false, currentOutput: null, lastTriggerInput: null })
    evaluateGraph()
  } else if (targetHandle === 'live-in') {
    const sensor = rules.sensorBlocks.find((b) => b.id === source)
    if (sensor?.sensorType === 'text-input') {
      models.updateModelBlock(target, { liveLinkedSensorId: source, liveResult: null })
      evaluateGraph()
    }
  }
}

/**
 * Work out which handles to use when wiring `source` → `target` without a
 * drag (e.g. Abee demonstrating), from the target block's type. `hint` picks
 * between a model's training ('in') and test ('test-in') inputs.
 */
export function inferConnectionHandles(source: string, target: string, hint?: string | null): CanvasConnection | null {
  const rules = useRuleStore.getState()
  const workflow = useWorkflowStore.getState()
  const models = useModelStore.getState()
  const sourceIsModel = models.modelBlocks.some((b) => b.id === source)

  if (hint) return { source, target, targetHandle: hint, sourceHandle: sourceIsModel ? 'prediction-out' : null }

  if (rules.conditionBlocks.some((b) => b.id === target)) {
    return { source, target, targetHandle: 'condition-in', sourceHandle: sourceIsModel ? 'prediction-out' : null }
  }
  const logic = rules.logicBlocks.find((b) => b.id === target)
  if (logic) {
    if (logic.logicType === 'not') return { source, target, targetHandle: 'logic-in' }
    return { source, target, targetHandle: logic.linkedInputIds[0] ? 'logic-in-2' : 'logic-in-1' }
  }
  if (models.modelBlocks.some((b) => b.id === target)) {
    if (rules.sensorBlocks.some((b) => b.id === source)) return { source, target, targetHandle: 'live-in' }
    return { source, target, targetHandle: 'in' }
  }
  const byType: Array<[{ id: string }[], string]> = [
    [workflow.doorBlocks, 'door-in'], [workflow.bulbBlocks, 'bulb-in'],
    [rules.fanBlocks, 'fan-in'], [rules.alarmBlocks, 'alarm-in'], [rules.acBlocks, 'ac-in'],
    [rules.phoneUnlockBlocks, 'phoneunlock-in'], [rules.displayBlocks, 'display-in'],
    [rules.binBlocks, 'bin-in'], [rules.timerBlocks, 'timer-in'],
  ]
  for (const [blocks, handle] of byType) {
    if (blocks.some((b) => b.id === target)) return { source, target, targetHandle: handle }
  }
  return null
}
