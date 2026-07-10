'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  Node,
  Edge,
  NodeChange,
  Connection,
  ConnectionMode,
  ReactFlowInstance,
  SelectionMode,
  applyNodeChanges,
  useNodesState,
  useEdgesState,
  useReactFlow,
  OnSelectionChangeParams,
} from 'reactflow'
import { useDndMonitor, useDroppable } from '@dnd-kit/core'
import { useDatasetStore } from '@/store/useDatasetStore'
import { useModelStore } from '@/store/useModelStore'
import { useUIStore } from '@/store/useUIStore'
import { useRLStore } from '@/store/useRLStore'
import { useWorkflowStore } from '@/store/useWorkflowStore'
import { useRuleStore } from '@/store/useRuleStore'
import { useCanvasStore } from '@/store/useCanvasStore'
import LabelledDatasetNode from './nodes/LabelledDatasetNode'
import UnlabelledDatasetNode from './nodes/UnlabelledDatasetNode'
import ValidationResultNode from './nodes/ValidationResultNode'
import DataSplitNode from './nodes/DataSplitNode'
import ModelBlockNode from './nodes/ModelBlockNode'
import RLGridworldNode from './nodes/RLGridworldNode'
import DoorNode from './nodes/DoorNode'
import BulbNode from './nodes/BulbNode'
import SensorNode from './nodes/SensorNode'
import ConditionNode from './nodes/ConditionNode'
import SwitchNode from './nodes/SwitchNode'
import LogicNode from './nodes/LogicNode'
import FanNode from './nodes/FanNode'
import AlarmNode from './nodes/AlarmNode'
import ACNode from './nodes/ACNode'
import TimerNode from './nodes/TimerNode'
import TextNode from './nodes/TextNode'
import DatasetEdge from './edges/DatasetEdge'
import TestEdge from './edges/TestEdge'
import WorkflowEdge from './edges/WorkflowEdge'
import RuleEdge from './edges/RuleEdge'

function CanvasPaletteDropHandler({ canvasRef }: { canvasRef: React.RefObject<HTMLDivElement> }) {
  const { project } = useReactFlow()
  const addLabelledBlock = useDatasetStore((s) => s.addLabelledBlock)
  const addUnlabelledBlock = useDatasetStore((s) => s.addUnlabelledBlock)
  const addModelBlockWithType = useModelStore((s) => s.addModelBlockWithType)
  const addModelBlockFromSaved = useModelStore((s) => s.addModelBlockFromSaved)
  const addRLBlock = useRLStore((s) => s.addRLBlock)
  const addDoorBlock = useWorkflowStore((s) => s.addDoorBlock)
  const addBulbBlock = useWorkflowStore((s) => s.addBulbBlock)
  const addDatasetToCanvas = useDatasetStore((s) => s.addDatasetToCanvas)
  const addToast = useUIStore((s) => s.addToast)
  const addSensorBlock = useRuleStore((s) => s.addSensorBlock)
  const addConditionBlock = useRuleStore((s) => s.addConditionBlock)
  const addSwitchBlock = useRuleStore((s) => s.addSwitchBlock)
  const addLogicBlock = useRuleStore((s) => s.addLogicBlock)
  const addFanBlock = useRuleStore((s) => s.addFanBlock)
  const addAlarmBlock = useRuleStore((s) => s.addAlarmBlock)
  const addACBlock = useRuleStore((s) => s.addACBlock)
  const addTimerBlock = useRuleStore((s) => s.addTimerBlock)

  useDndMonitor({
    onDragEnd(event) {
      if (!event.over || event.over.id !== 'canvas-drop') return
      const dragType = event.active.data.current?.type

      if (!canvasRef.current) return
      const bounds = canvasRef.current.getBoundingClientRect()
      const activator = event.activatorEvent as MouseEvent
      const flowPos = project({
        x: activator.clientX + event.delta.x - bounds.left,
        y: activator.clientY + event.delta.y - bounds.top,
      })

      if (dragType === 'block-palette') {
        const blockType = event.active.data.current?.blockType
        if (blockType === 'labelled') addLabelledBlock(flowPos)
        else if (blockType === 'unlabelled') addUnlabelledBlock(flowPos)
        else if (blockType === 'model-image-supervised') addModelBlockWithType('image-supervised', flowPos)
        else if (blockType === 'model-image-unsupervised') addModelBlockWithType('image-unsupervised', flowPos)
        else if (blockType === 'model-text-corpus') addModelBlockWithType('text-corpus', flowPos)
        else if (blockType === 'model-text-supervised') addModelBlockWithType('text-supervised', flowPos)
        else if (blockType === 'model-text-unsupervised') addModelBlockWithType('text-unsupervised', flowPos)
        else if (blockType === 'rl-gridworld') addRLBlock(flowPos)
        else if (blockType === 'door') addDoorBlock(flowPos)
        else if (blockType === 'bulb') addBulbBlock(flowPos)
        else if (blockType === 'sensor-temperature') addSensorBlock('temperature', flowPos)
        else if (blockType === 'sensor-light') addSensorBlock('light', flowPos)
        else if (blockType === 'sensor-motion') addSensorBlock('motion', flowPos)
        else if (blockType === 'sensor-humidity') addSensorBlock('humidity', flowPos)
        else if (blockType === 'sensor-text') addSensorBlock('text-input', flowPos)
        else if (blockType === 'condition') addConditionBlock(flowPos)
        else if (blockType === 'switch') addSwitchBlock(flowPos)
        else if (blockType === 'logic-and') addLogicBlock('and', flowPos)
        else if (blockType === 'logic-or') addLogicBlock('or', flowPos)
        else if (blockType === 'logic-not') addLogicBlock('not', flowPos)
        else if (blockType === 'fan') addFanBlock(flowPos)
        else if (blockType === 'alarm') addAlarmBlock(flowPos)
        else if (blockType === 'ac') addACBlock(flowPos)
        else if (blockType === 'timer') addTimerBlock(flowPos)
        return
      }

      if (dragType === 'trained-model') {
        const model = event.active.data.current?.model
        if (model) addModelBlockFromSaved(model, flowPos)
        return
      }

      if (dragType === 'saved-dataset') {
        const dataset = event.active.data.current?.dataset
        if (dataset) {
          addDatasetToCanvas(dataset.id, flowPos)
          addToast(`📂 "${dataset.name}" loaded!`, 'success')
        }
        return
      }
    },
  })

  return null
}

const nodeTypes = {
  labelled: LabelledDatasetNode,
  unlabelled: UnlabelledDatasetNode,
  validation: ValidationResultNode,
  split: DataSplitNode,
  model: ModelBlockNode,
  'rl-gridworld': RLGridworldNode,
  door: DoorNode,
  bulb: BulbNode,
  sensor: SensorNode,
  condition: ConditionNode,
  switch: SwitchNode,
  logic: LogicNode,
  fan: FanNode,
  alarm: AlarmNode,
  ac: ACNode,
  timer: TimerNode,
  text: TextNode,
}

const edgeTypes = {
  dataset: DatasetEdge,
  test: TestEdge,
  workflow: WorkflowEdge,
  rule: RuleEdge,
}

// Rule-graph handles that expect a boolean-producing block (Condition/Logic/
// Timer/Switch) as their source — a raw Sensor id never resolves here.
const SENSOR_BLOCKED_HANDLES: Record<string, string> = {
  'logic-in-1': 'a Logic gate', 'logic-in-2': 'a Logic gate', 'logic-in': 'a Logic gate',
  'timer-in': 'a Timer',
  'door-in': 'a Door', 'bulb-in': 'a Bulb', 'fan-in': 'a Fan', 'alarm-in': 'an Alarm', 'ac-in': 'an AC',
}

export default function DatasetCanvas() {
  const labelledBlocks = useDatasetStore((s) => s.labelledBlocks)
  const unlabelledBlocks = useDatasetStore((s) => s.unlabelledBlocks)
  const updateBlockPosition = useDatasetStore((s) => s.updateBlockPosition)
  const removeLabelledBlock = useDatasetStore((s) => s.removeLabelledBlock)
  const removeUnlabelledBlock = useDatasetStore((s) => s.removeUnlabelledBlock)
  const modelBlocks = useModelStore((s) => s.modelBlocks)
  const updateModelBlockPosition = useModelStore((s) => s.updateModelBlockPosition)
  const updateModelBlock = useModelStore((s) => s.updateModelBlock)
  const removeModelBlock = useModelStore((s) => s.removeModelBlock)
  const rlBlocks = useRLStore((s) => s.rlBlocks)
  const updateRLBlockPosition = useRLStore((s) => s.updateRLBlockPosition)
  const removeRLBlock = useRLStore((s) => s.removeRLBlock)
  const doorBlocks = useWorkflowStore((s) => s.doorBlocks)
  const updateDoorBlockPosition = useWorkflowStore((s) => s.updateDoorBlockPosition)
  const updateDoorBlock = useWorkflowStore((s) => s.updateDoorBlock)
  const removeDoorBlock = useWorkflowStore((s) => s.removeDoorBlock)
  const bulbBlocks = useWorkflowStore((s) => s.bulbBlocks)
  const updateBulbBlockPosition = useWorkflowStore((s) => s.updateBulbBlockPosition)
  const updateBulbBlock = useWorkflowStore((s) => s.updateBulbBlock)
  const removeBulbBlock = useWorkflowStore((s) => s.removeBulbBlock)

  // Rule store
  const sensorBlocks = useRuleStore((s) => s.sensorBlocks)
  const conditionBlocks = useRuleStore((s) => s.conditionBlocks)
  const switchBlocks = useRuleStore((s) => s.switchBlocks)
  const logicBlocks = useRuleStore((s) => s.logicBlocks)
  const fanBlocks = useRuleStore((s) => s.fanBlocks)
  const alarmBlocks = useRuleStore((s) => s.alarmBlocks)
  const acBlocks = useRuleStore((s) => s.acBlocks)
  const timerBlocks = useRuleStore((s) => s.timerBlocks)
  const updateSensorBlockPosition = useRuleStore((s) => s.updateSensorBlockPosition)
  const removeSensorBlock = useRuleStore((s) => s.removeSensorBlock)
  const updateConditionBlockPosition = useRuleStore((s) => s.updateConditionBlockPosition)
  const updateConditionBlock = useRuleStore((s) => s.updateConditionBlock)
  const removeConditionBlock = useRuleStore((s) => s.removeConditionBlock)
  const updateSwitchBlockPosition = useRuleStore((s) => s.updateSwitchBlockPosition)
  const removeSwitchBlock = useRuleStore((s) => s.removeSwitchBlock)
  const updateLogicBlockPosition = useRuleStore((s) => s.updateLogicBlockPosition)
  const updateLogicBlock = useRuleStore((s) => s.updateLogicBlock)
  const removeLogicBlock = useRuleStore((s) => s.removeLogicBlock)
  const updateFanBlockPosition = useRuleStore((s) => s.updateFanBlockPosition)
  const updateFanBlock = useRuleStore((s) => s.updateFanBlock)
  const removeFanBlock = useRuleStore((s) => s.removeFanBlock)
  const updateAlarmBlockPosition = useRuleStore((s) => s.updateAlarmBlockPosition)
  const updateAlarmBlock = useRuleStore((s) => s.updateAlarmBlock)
  const removeAlarmBlock = useRuleStore((s) => s.removeAlarmBlock)
  const updateACBlockPosition = useRuleStore((s) => s.updateACBlockPosition)
  const updateACBlock = useRuleStore((s) => s.updateACBlock)
  const removeACBlock = useRuleStore((s) => s.removeACBlock)
  const updateTimerBlockPosition = useRuleStore((s) => s.updateTimerBlockPosition)
  const updateTimerBlock = useRuleStore((s) => s.updateTimerBlock)
  const removeTimerBlock = useRuleStore((s) => s.removeTimerBlock)
  const evaluateGraph = useRuleStore((s) => s.evaluateGraph)
  const tickTimers = useRuleStore((s) => s.tickTimers)

  // Canvas annotations (text)
  const textBlocks = useCanvasStore((s) => s.textBlocks)
  const addTextBlock = useCanvasStore((s) => s.addTextBlock)
  const updateTextBlockPosition = useCanvasStore((s) => s.updateTextBlockPosition)
  const removeTextBlock = useCanvasStore((s) => s.removeTextBlock)

  const setSelectedBlock = useUIStore((s) => s.setSelectedBlock)
  const selectedBlockId = useUIStore((s) => s.selectedBlockId)
  const clearSelectedBlock = useUIStore((s) => s.clearSelectedBlock)
  const leftPanelCollapsed = useUIStore((s) => s.leftPanelCollapsed)
  const canvasTool = useUIStore((s) => s.canvasTool)
  const setCanvasTool = useUIStore((s) => s.setCanvasTool)
  const canvasInteractive = useUIStore((s) => s.canvasInteractive)
  const setCanvasInteractive = useUIStore((s) => s.setCanvasInteractive)
  const setCanvasSelection = useUIStore((s) => s.setCanvasSelection)
  const addToast = useUIStore((s) => s.addToast)

  const { setNodeRef: setCanvasDropRef, isOver: isModelDragOver } = useDroppable({ id: 'canvas-drop' })
  const canvasRef = useRef<HTMLDivElement>(null)
  const rfInstanceRef = useRef<ReactFlowInstance | null>(null)

  const isDraggingRef = useRef(false)
  useDndMonitor({
    onDragStart: () => { isDraggingRef.current = true },
    onDragEnd: () => { isDraggingRef.current = false },
    onDragCancel: () => { isDraggingRef.current = false },
  })

  const [rfNodes, setRfNodes] = useNodesState([])
  const [rfEdges, setRfEdges] = useEdgesState<Edge[]>([])

  // Sync Zustand blocks → RF nodes
  useEffect(() => {
    setRfNodes((current) => {
      const pos = (id: string) => current.find((n) => n.id === id)?.position
      return [
        ...labelledBlocks.map((b) => ({ id: b.id, type: 'labelled', position: pos(b.id) ?? b.position, data: { block: b } } as Node)),
        ...unlabelledBlocks.map((b) => ({ id: b.id, type: 'unlabelled', position: pos(b.id) ?? b.position, data: { block: b } } as Node)),
        ...modelBlocks.map((b) => ({ id: b.id, type: 'model', position: pos(b.id) ?? b.position, data: { block: b } } as Node)),
        ...rlBlocks.map((b) => ({ id: b.id, type: 'rl-gridworld', position: pos(b.id) ?? b.position, data: { block: b } } as Node)),
        ...doorBlocks.map((b) => ({ id: b.id, type: 'door', position: pos(b.id) ?? b.position, data: { block: b } } as Node)),
        ...bulbBlocks.map((b) => ({ id: b.id, type: 'bulb', position: pos(b.id) ?? b.position, data: { block: b } } as Node)),
        ...sensorBlocks.map((b) => ({ id: b.id, type: 'sensor', position: pos(b.id) ?? b.position, data: { block: b } } as Node)),
        ...conditionBlocks.map((b) => ({ id: b.id, type: 'condition', position: pos(b.id) ?? b.position, data: { block: b } } as Node)),
        ...switchBlocks.map((b) => ({ id: b.id, type: 'switch', position: pos(b.id) ?? b.position, data: { block: b } } as Node)),
        ...logicBlocks.map((b) => ({ id: b.id, type: 'logic', position: pos(b.id) ?? b.position, data: { block: b } } as Node)),
        ...fanBlocks.map((b) => ({ id: b.id, type: 'fan', position: pos(b.id) ?? b.position, data: { block: b } } as Node)),
        ...alarmBlocks.map((b) => ({ id: b.id, type: 'alarm', position: pos(b.id) ?? b.position, data: { block: b } } as Node)),
        ...acBlocks.map((b) => ({ id: b.id, type: 'ac', position: pos(b.id) ?? b.position, data: { block: b } } as Node)),
        ...timerBlocks.map((b) => ({ id: b.id, type: 'timer', position: pos(b.id) ?? b.position, data: { block: b } } as Node)),
        ...textBlocks.map((b) => ({ id: b.id, type: 'text', position: pos(b.id) ?? b.position, data: { block: b } } as Node)),
      ]
    })
  }, [labelledBlocks, unlabelledBlocks, modelBlocks, rlBlocks, doorBlocks, bulbBlocks,
      sensorBlocks, conditionBlocks, switchBlocks, logicBlocks, fanBlocks, alarmBlocks, acBlocks, timerBlocks, textBlocks, setRfNodes])

  // Sync linked IDs → RF edges
  useEffect(() => {
    setRfEdges([
      // Training edges: labelled → model
      ...modelBlocks.filter((b) => b.linkedBlockId !== null).map((b) => ({
        id: `edge-${b.linkedBlockId}-${b.id}`,
        source: b.linkedBlockId!, sourceHandle: 'out',
        target: b.id, targetHandle: 'in',
        type: 'dataset',
        animated: b.status === 'loading' || b.status === 'training',
      } as Edge)),
      // Test edges: unlabelled → model
      ...modelBlocks.filter((b) => b.testLinkedBlockId !== null).map((b) => ({
        id: `test-edge-${b.testLinkedBlockId}-${b.id}`,
        source: b.testLinkedBlockId!, sourceHandle: 'test-out',
        target: b.id, targetHandle: 'test-in',
        type: 'test',
        animated: b.testStatus === 'running',
      } as Edge)),
      // sensor → model (live text inference)
      ...modelBlocks.filter((b) => b.liveLinkedSensorId != null).map((b) => ({
        id: `live-${b.liveLinkedSensorId}-${b.id}`,
        source: b.liveLinkedSensorId!, sourceHandle: 'sensor-out',
        target: b.id, targetHandle: 'live-in',
        type: 'workflow',
      } as Edge)),
      // model → condition (unified IF block in model mode)
      ...conditionBlocks.filter((b) => b.linkedModelId != null).map((b) => ({
        id: `model-cond-${b.linkedModelId}-${b.id}`,
        source: b.linkedModelId!, sourceHandle: 'prediction-out',
        target: b.id, targetHandle: 'condition-in',
        type: 'workflow',
      } as Edge)),

      // ── Rule edges ──────────────────────────────────────────────────────
      // sensor → condition
      ...conditionBlocks.filter((b) => b.linkedSensorId !== null).map((b) => ({
        id: `rule-sense-${b.linkedSensorId}-${b.id}`,
        source: b.linkedSensorId!, sourceHandle: 'sensor-out',
        target: b.id, targetHandle: 'condition-in',
        type: 'rule',
      } as Edge)),
      // condition/logic → logic input 1
      ...logicBlocks.filter((b) => b.linkedInputIds[0] !== null).map((b) => ({
        id: `rule-logic1-${b.linkedInputIds[0]}-${b.id}`,
        source: b.linkedInputIds[0]!, sourceHandle: 'rule-out',
        target: b.id, targetHandle: b.logicType === 'not' ? 'logic-in' : 'logic-in-1',
        type: 'rule',
      } as Edge)),
      // condition/logic → logic input 2
      ...logicBlocks.filter((b) => b.linkedInputIds[1] !== null).map((b) => ({
        id: `rule-logic2-${b.linkedInputIds[1]}-${b.id}`,
        source: b.linkedInputIds[1]!, sourceHandle: 'rule-out',
        target: b.id, targetHandle: 'logic-in-2',
        type: 'rule',
      } as Edge)),
      // rule → fan
      ...fanBlocks.filter((b) => b.linkedRuleBlockId !== null).map((b) => ({
        id: `rule-fan-${b.linkedRuleBlockId}-${b.id}`,
        source: b.linkedRuleBlockId!, sourceHandle: 'rule-out',
        target: b.id, targetHandle: 'fan-in',
        type: 'rule',
      } as Edge)),
      // rule → alarm
      ...alarmBlocks.filter((b) => b.linkedRuleBlockId !== null).map((b) => ({
        id: `rule-alarm-${b.linkedRuleBlockId}-${b.id}`,
        source: b.linkedRuleBlockId!, sourceHandle: 'rule-out',
        target: b.id, targetHandle: 'alarm-in',
        type: 'rule',
      } as Edge)),
      // rule/logic → timer (trigger)
      ...timerBlocks.filter((b) => b.linkedRuleBlockId !== null).map((b) => ({
        id: `rule-timer-${b.linkedRuleBlockId}-${b.id}`,
        source: b.linkedRuleBlockId!, sourceHandle: 'rule-out',
        target: b.id, targetHandle: 'timer-in',
        type: 'rule',
      } as Edge)),
      // rule/timer → AC
      ...acBlocks.filter((b) => b.linkedRuleBlockId !== null).map((b) => ({
        id: `rule-ac-${b.linkedRuleBlockId}-${b.id}`,
        source: b.linkedRuleBlockId!, sourceHandle: 'rule-out',
        target: b.id, targetHandle: 'ac-in',
        type: 'rule',
      } as Edge)),
      // rule → door (rule-based)
      ...doorBlocks.filter((b) => b.linkedRuleBlockId != null).map((b) => ({
        id: `rule-door-${b.linkedRuleBlockId}-${b.id}`,
        source: b.linkedRuleBlockId!, sourceHandle: 'rule-out',
        target: b.id, targetHandle: 'door-in',
        type: 'rule',
      } as Edge)),
      // rule → bulb (rule-based)
      ...bulbBlocks.filter((b) => b.linkedRuleBlockId != null).map((b) => ({
        id: `rule-bulb-${b.linkedRuleBlockId}-${b.id}`,
        source: b.linkedRuleBlockId!, sourceHandle: 'rule-out',
        target: b.id, targetHandle: 'bulb-in',
        type: 'rule',
      } as Edge)),
    ])
  }, [modelBlocks, doorBlocks, bulbBlocks,
      conditionBlocks, logicBlocks, fanBlocks, alarmBlocks, acBlocks, timerBlocks, setRfEdges])

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setRfNodes((nds) => applyNodeChanges(changes, nds))
      for (const change of changes) {
        if (change.type === 'position' && !change.dragging && change.position) {
          const { id, position: p } = change
          if (modelBlocks.some((b) => b.id === id)) updateModelBlockPosition(id, p)
          else if (rlBlocks.some((b) => b.id === id)) updateRLBlockPosition(id, p)
          else if (doorBlocks.some((b) => b.id === id)) updateDoorBlockPosition(id, p)
          else if (bulbBlocks.some((b) => b.id === id)) updateBulbBlockPosition(id, p)
          else if (sensorBlocks.some((b) => b.id === id)) updateSensorBlockPosition(id, p)
          else if (conditionBlocks.some((b) => b.id === id)) updateConditionBlockPosition(id, p)
          else if (switchBlocks.some((b) => b.id === id)) updateSwitchBlockPosition(id, p)
          else if (logicBlocks.some((b) => b.id === id)) updateLogicBlockPosition(id, p)
          else if (fanBlocks.some((b) => b.id === id)) updateFanBlockPosition(id, p)
          else if (alarmBlocks.some((b) => b.id === id)) updateAlarmBlockPosition(id, p)
          else if (acBlocks.some((b) => b.id === id)) updateACBlockPosition(id, p)
          else if (timerBlocks.some((b) => b.id === id)) updateTimerBlockPosition(id, p)
          else if (textBlocks.some((b) => b.id === id)) updateTextBlockPosition(id, p)
          else {
            const type = labelledBlocks.some((b) => b.id === id) ? 'labelled' : 'unlabelled'
            updateBlockPosition(id, type, p)
          }
        }
      }
    },
    [
      labelledBlocks, modelBlocks, rlBlocks, doorBlocks, bulbBlocks,
      sensorBlocks, conditionBlocks, switchBlocks, logicBlocks, fanBlocks, alarmBlocks, acBlocks, timerBlocks, textBlocks,
      updateBlockPosition, updateModelBlockPosition, updateRLBlockPosition,
      updateDoorBlockPosition, updateBulbBlockPosition,
      updateSensorBlockPosition, updateConditionBlockPosition, updateSwitchBlockPosition, updateLogicBlockPosition,
      updateFanBlockPosition, updateAlarmBlockPosition, updateACBlockPosition, updateTimerBlockPosition, updateTextBlockPosition, setRfNodes,
    ]
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return
      const { source, target, targetHandle, sourceHandle } = connection

      // ── ML pipeline ──────────────────────────────────────────────────────
      if (targetHandle === 'test-in') {
        updateModelBlock(target, { testLinkedBlockId: source, testStatus: 'idle', testResults: null })
      } else if (targetHandle === 'in') {
        const current = modelBlocks.find((b) => b.id === target)
        if (current?.trainedModelId) {
          // Model already trained — just update the linked block. Don't auto-reset;
          // the user must explicitly retrain if they want to update the model.
          updateModelBlock(target, { linkedBlockId: source })
        } else {
          updateModelBlock(target, { linkedBlockId: source, status: 'idle', trainedModelId: null, trainedLinkedBlockId: null, testStatus: 'idle', testResults: null })
        }
      } else if (targetHandle === 'door-in') {
        updateDoorBlock(target, { linkedRuleBlockId: source, isOpen: false })
        evaluateGraph()
      } else if (targetHandle === 'bulb-in') {
        updateBulbBlock(target, { linkedRuleBlockId: source, isOn: false })
        evaluateGraph()
      }

      // ── Rule pipeline ────────────────────────────────────────────────────
      else if (targetHandle === 'condition-in') {
        if (sourceHandle === 'prediction-out') {
          updateConditionBlock(target, { linkedModelId: source, linkedSensorId: null, currentOutput: null })
        } else {
          const sensor = sensorBlocks.find((b) => b.id === source)
          if (sensor?.sensorType === 'motion') {
            updateConditionBlock(target, { linkedSensorId: source, linkedModelId: null, currentOutput: null, operator: 'is', threshold: null })
          } else if (sensor?.sensorType === 'text-input') {
            updateConditionBlock(target, { linkedSensorId: source, linkedModelId: null, currentOutput: null, operator: '==', threshold: '' })
          } else {
            updateConditionBlock(target, { linkedSensorId: source, linkedModelId: null, currentOutput: null, operator: '>', threshold: null })
          }
        }
        evaluateGraph()
      } else if (targetHandle === 'logic-in-1') {
        const block = logicBlocks.find((b) => b.id === target)
        if (block) {
          const ids = [...block.linkedInputIds]
          ids[0] = source
          updateLogicBlock(target, { linkedInputIds: ids })
          evaluateGraph()
        }
      } else if (targetHandle === 'logic-in-2') {
        const block = logicBlocks.find((b) => b.id === target)
        if (block) {
          const ids = [...block.linkedInputIds]
          ids[1] = source
          updateLogicBlock(target, { linkedInputIds: ids })
          evaluateGraph()
        }
      } else if (targetHandle === 'logic-in') {
        updateLogicBlock(target, { linkedInputIds: [source] })
        evaluateGraph()
      } else if (targetHandle === 'fan-in') {
        updateFanBlock(target, { linkedRuleBlockId: source, isOn: false })
        evaluateGraph()
      } else if (targetHandle === 'alarm-in') {
        updateAlarmBlock(target, { linkedRuleBlockId: source, isOn: false })
        evaluateGraph()
      } else if (targetHandle === 'ac-in') {
        updateACBlock(target, { linkedRuleBlockId: source, isOn: false })
        evaluateGraph()
      } else if (targetHandle === 'timer-in') {
        updateTimerBlock(target, { linkedRuleBlockId: source, isRunning: false, currentOutput: null, lastTriggerInput: null })
        evaluateGraph()
      } else if (targetHandle === 'live-in') {
        const sensor = sensorBlocks.find((b) => b.id === source)
        if (sensor?.sensorType === 'text-input') {
          updateModelBlock(target, { liveLinkedSensorId: source, liveResult: null })
          evaluateGraph()
        }
      }
    },
    [
      updateModelBlock, updateDoorBlock, updateBulbBlock,
      updateConditionBlock, updateLogicBlock, updateFanBlock, updateAlarmBlock,
      updateACBlock, updateTimerBlock,
      logicBlocks, sensorBlocks, evaluateGraph, modelBlocks,
    ]
  )

  // Kids sometimes wire a Switch into an IF block's sensor-input handle by habit —
  // that silently stores the Switch's id as linkedSensorId, which never resolves
  // against sensorBlocks in evaluateGraph(), leaving the condition stuck forever.
  // Sensors have the mirror-image problem: wired straight into a Logic gate,
  // Timer, or actuator, their raw value never appears in evaluateGraph()'s
  // resolved boolean map, so the block is silently dead forever too. Refuse
  // both at the connection layer instead.
  const isValidConnection = useCallback(
    (connection: Connection | Edge) => {
      if (connection.targetHandle === 'condition-in') {
        if (connection.sourceHandle === 'prediction-out') return true
        return sensorBlocks.some((b) => b.id === connection.source)
      }
      if (connection.targetHandle && SENSOR_BLOCKED_HANDLES[connection.targetHandle]) {
        return !sensorBlocks.some((b) => b.id === connection.source)
      }
      return true
    },
    [sensorBlocks]
  )

  // Let kids know *why* a drag onto an IF block's input got refused, instead of
  // it just silently snapping back. isValidConnection fires continuously while
  // dragging (for handle hover-styling), so we can't toast from inside it — we
  // capture the drag's source on start, then resolve what was actually under
  // the pointer on release (onConnectEnd fires for every outcome: valid drop,
  // invalid drop, or cancel onto empty canvas) and only toast for a confirmed
  // rejected condition-in drop.
  const connectionStartRef = useRef<{ nodeId: string | null; handleId: string | null }>({ nodeId: null, handleId: null })

  const onConnectStart = useCallback((_event: unknown, params: { nodeId: string | null; handleId: string | null }) => {
    connectionStartRef.current = { nodeId: params.nodeId, handleId: params.handleId }
  }, [])

  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent) => {
      const { nodeId: sourceId, handleId: sourceHandleId } = connectionStartRef.current
      connectionStartRef.current = { nodeId: null, handleId: null }

      const target = event.target as HTMLElement | null
      const handleEl = target?.closest?.('.react-flow__handle') as HTMLElement | null
      if (!handleEl || !handleEl.classList.contains('target')) return
      const targetHandleId = handleEl.getAttribute('data-handleid')
      const sourceIsSensor = !!sourceId && sensorBlocks.some((b) => b.id === sourceId)

      if (targetHandleId === 'condition-in') {
        if (sourceHandleId === 'prediction-out' || sourceIsSensor) return
        const sourceIsSwitch = !!sourceId && switchBlocks.some((b) => b.id === sourceId)
        addToast(
          sourceIsSwitch
            ? '❌ Switches can’t plug into an IF block, try a Sensor instead!'
            : '❌ Only a Sensor (or a trained Model) can plug into an IF block!',
          'warn'
        )
        return
      }

      if (targetHandleId && SENSOR_BLOCKED_HANDLES[targetHandleId] && sourceIsSensor) {
        addToast(`❌ Sensors can’t plug straight into ${SENSOR_BLOCKED_HANDLES[targetHandleId]} — wire it through an IF block first!`, 'warn')
      }
    },
    [sensorBlocks, switchBlocks, addToast]
  )

  // Delete selected nodes — dispatch to each block's owning store
  const onNodesDelete = useCallback(
    (deleted: Node[]) => {
      for (const node of deleted) {
        switch (node.type) {
          case 'labelled': removeLabelledBlock(node.id); break
          case 'unlabelled': removeUnlabelledBlock(node.id); break
          case 'model': removeModelBlock(node.id); break
          case 'rl-gridworld': removeRLBlock(node.id); break
          case 'door': removeDoorBlock(node.id); break
          case 'bulb': removeBulbBlock(node.id); break
          case 'sensor': removeSensorBlock(node.id); break
          case 'condition': removeConditionBlock(node.id); break
          case 'switch': removeSwitchBlock(node.id); break
          case 'logic': removeLogicBlock(node.id); break
          case 'fan': removeFanBlock(node.id); break
          case 'alarm': removeAlarmBlock(node.id); break
          case 'ac': removeACBlock(node.id); break
          case 'timer': removeTimerBlock(node.id); break
          case 'text': removeTextBlock(node.id); break
        }
        if (node.id === selectedBlockId) clearSelectedBlock()
      }
      evaluateGraph()
    },
    [
      removeLabelledBlock, removeUnlabelledBlock, removeModelBlock, removeRLBlock, removeDoorBlock, removeBulbBlock,
      removeSensorBlock, removeConditionBlock, removeSwitchBlock, removeLogicBlock, removeFanBlock, removeAlarmBlock,
      removeACBlock, removeTimerBlock, removeTextBlock, evaluateGraph, selectedBlockId, clearSelectedBlock,
    ]
  )

  // Delete selected (or cascaded) edges — unlink the corresponding block reference
  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      for (const edge of deleted) {
        const { target, targetHandle, type } = edge
        if (targetHandle === 'in') {
          const current = modelBlocks.find((b) => b.id === target)
          if (current?.trainedModelId) {
            // Model already trained — keep the trained artifact, just drop the live link.
            updateModelBlock(target, { linkedBlockId: null })
          } else {
            updateModelBlock(target, { linkedBlockId: null, status: 'idle', trainedModelId: null, trainedLinkedBlockId: null, testStatus: 'idle', testResults: null })
          }
        } else if (targetHandle === 'test-in') {
          updateModelBlock(target, { testLinkedBlockId: null, testStatus: 'idle', testResults: null })
        } else if (targetHandle === 'condition-in') {
          if (type === 'workflow') {
            updateConditionBlock(target, { linkedModelId: null, currentOutput: null })
          } else {
            updateConditionBlock(target, { linkedSensorId: null, currentOutput: null })
          }
        } else if (targetHandle === 'logic-in-1') {
          const block = logicBlocks.find((b) => b.id === target)
          if (block) {
            const ids = [...block.linkedInputIds]
            ids[0] = null
            updateLogicBlock(target, { linkedInputIds: ids, currentOutput: null })
          }
        } else if (targetHandle === 'logic-in-2') {
          const block = logicBlocks.find((b) => b.id === target)
          if (block) {
            const ids = [...block.linkedInputIds]
            ids[1] = null
            updateLogicBlock(target, { linkedInputIds: ids, currentOutput: null })
          }
        } else if (targetHandle === 'logic-in') {
          updateLogicBlock(target, { linkedInputIds: [null], currentOutput: null })
        } else if (targetHandle === 'fan-in') {
          updateFanBlock(target, { linkedRuleBlockId: null, isOn: false })
        } else if (targetHandle === 'alarm-in') {
          updateAlarmBlock(target, { linkedRuleBlockId: null, isOn: false })
        } else if (targetHandle === 'ac-in') {
          updateACBlock(target, { linkedRuleBlockId: null, isOn: false })
        } else if (targetHandle === 'timer-in') {
          updateTimerBlock(target, { linkedRuleBlockId: null, isRunning: false, remainingSeconds: 0, currentOutput: null, lastTriggerInput: null })
        } else if (targetHandle === 'door-in') {
          updateDoorBlock(target, { linkedRuleBlockId: null, isOpen: false })
        } else if (targetHandle === 'bulb-in') {
          updateBulbBlock(target, { linkedRuleBlockId: null, isOn: false })
        }
      }
      evaluateGraph()
    },
    [
      logicBlocks, modelBlocks, updateModelBlock, updateConditionBlock, updateLogicBlock, updateFanBlock,
      updateAlarmBlock, updateACBlock, updateTimerBlock, updateDoorBlock, updateBulbBlock, evaluateGraph,
    ]
  )

  // Hold Space for a temporary "open hand" pan cursor (standard Figma/Photoshop behavior)
  const [isSpacePressed, setIsSpacePressed] = useState(false)

  // Drag-to-draw a text box while the Text tool is active. A simple click
  // (no meaningful drag distance) falls back to placing a default-size box.
  const textDragRef = useRef<{ startX: number; startY: number } | null>(null)
  const [textDragRect, setTextDragRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null)

  const onTextToolMouseDown = useCallback(
    (event: React.MouseEvent) => {
      if (canvasTool !== 'text' || isSpacePressed || event.button !== 0 || !canvasRef.current) return

      const bounds = canvasRef.current.getBoundingClientRect()
      const startX = event.clientX - bounds.left
      const startY = event.clientY - bounds.top
      textDragRef.current = { startX, startY }
      setTextDragRect({ x: startX, y: startY, width: 0, height: 0 })

      const handleMouseMove = (e: MouseEvent) => {
        if (!textDragRef.current) return
        const x = e.clientX - bounds.left
        const y = e.clientY - bounds.top
        const { startX: sx, startY: sy } = textDragRef.current
        setTextDragRect({
          x: Math.min(sx, x),
          y: Math.min(sy, y),
          width: Math.abs(x - sx),
          height: Math.abs(y - sy),
        })
      }

      const handleMouseUp = (e: MouseEvent) => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)

        const dragInfo = textDragRef.current
        textDragRef.current = null
        setTextDragRect(null)
        if (!dragInfo || !rfInstanceRef.current) return

        const endX = e.clientX - bounds.left
        const endY = e.clientY - bounds.top
        const dragDistance = Math.hypot(endX - dragInfo.startX, endY - dragInfo.startY)

        if (dragDistance < 4) {
          const pos = rfInstanceRef.current.screenToFlowPosition({ x: e.clientX, y: e.clientY })
          addTextBlock(pos)
        } else {
          const topLeftScreen = {
            x: bounds.left + Math.min(dragInfo.startX, endX),
            y: bounds.top + Math.min(dragInfo.startY, endY),
          }
          const bottomRightScreen = {
            x: bounds.left + Math.max(dragInfo.startX, endX),
            y: bounds.top + Math.max(dragInfo.startY, endY),
          }
          const topLeftFlow = rfInstanceRef.current.screenToFlowPosition(topLeftScreen)
          const bottomRightFlow = rfInstanceRef.current.screenToFlowPosition(bottomRightScreen)
          const width = Math.max(60, bottomRightFlow.x - topLeftFlow.x)
          const height = Math.max(24, bottomRightFlow.y - topLeftFlow.y)
          addTextBlock(topLeftFlow, { width, height })
        }
        setCanvasTool('select')
      }

      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    },
    [canvasTool, isSpacePressed, addTextBlock, setCanvasTool]
  )

  // Tick running timer blocks once per second
  useEffect(() => {
    const interval = setInterval(() => tickTimers(), 1000)
    return () => clearInterval(interval)
  }, [tickTimers])

  // Keyboard shortcuts: H = hand/pan tool, V = selection tool, T = text tool, Escape = back to selection tool
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      if (e.key === 'h' || e.key === 'H') {
        setCanvasTool('pan')
      } else if (e.key === 'v' || e.key === 'V') {
        setCanvasTool('select')
      } else if (e.key === 't' || e.key === 'T') {
        setCanvasTool('text')
      } else if (e.key === 'Escape') {
        setCanvasTool('select')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setCanvasTool])

  // Hold Space for a temporary "open hand" pan cursor (standard Figma/Photoshop behavior)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      e.preventDefault()
      setIsSpacePressed(true)
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setIsSpacePressed(false)
    }
    const handleBlur = () => setIsSpacePressed(false)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
    }
  }, [])

  return (
    <div
      ref={(el) => { setCanvasDropRef(el); (canvasRef as React.MutableRefObject<HTMLDivElement | null>).current = el }}
      data-canvas-tool={canvasTool}
      data-space-pressed={isSpacePressed}
      className={`relative w-full h-full overflow-hidden ${
        canvasTool === 'pan' ? 'cursor-grab' : canvasTool === 'text' && !isSpacePressed ? 'cursor-crosshair' : ''
      }`}
      style={{
        width: '100%',
        height: '100%',
        boxShadow: isModelDragOver ? '0 0 0 2px rgba(139,92,246,0.6), inset 0 0 40px rgba(139,92,246,0.08)' : undefined,
        transition: 'box-shadow 0.15s ease',
      }}
      onPointerDown={(e) => {
        if (isDraggingRef.current) e.stopPropagation()
      }}
      onMouseDown={onTextToolMouseDown}
    >
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onSelectionChange={({ nodes }: OnSelectionChangeParams) =>
          setCanvasSelection(nodes.map((n) => ({ id: n.id, type: n.type ?? '' })))
        }
        onInit={(instance) => { rfInstanceRef.current = instance }}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        connectionLineStyle={{ stroke: '#8B5CF6', strokeWidth: 2, strokeDasharray: '5 5' }}
        onNodeDoubleClick={(_, node) => {
          const ruleTypes = ['sensor', 'condition', 'switch', 'logic', 'fan', 'alarm', 'ac', 'timer']
          if (ruleTypes.includes(node.type ?? '')) {
            setSelectedBlock(node.id, node.type as 'sensor' | 'condition' | 'switch' | 'logic' | 'fan' | 'alarm' | 'ac' | 'timer')
          }
        }}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={1.5}
        panOnDrag={canvasTool === 'pan' || isSpacePressed ? true : canvasTool === 'text' ? false : [1, 2]}
        selectionOnDrag={canvasTool === 'select' && !isSpacePressed}
        selectionMode={SelectionMode.Partial}
        nodesDraggable={canvasInteractive && canvasTool === 'select' && !isSpacePressed}
        nodesConnectable={canvasInteractive}
        elementsSelectable={canvasInteractive && canvasTool !== 'pan'}
        deleteKeyCode={['Delete', 'Backspace']}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} color="rgba(255,255,255,0.18)" gap={24} size={1.5} />
        <Controls
          position="bottom-left"
          onInteractiveChange={setCanvasInteractive}
          className={`!bg-white/10 !border-white/10 !rounded-xl !bottom-4 transition-[left] duration-200 ease-out ${
            leftPanelCollapsed ? '!left-[4.5rem]' : '!left-[17rem] 2xl:!left-[20rem]'
          }`}
        />
        <CanvasPaletteDropHandler canvasRef={canvasRef} />
      </ReactFlow>
      {textDragRect && (
        <div
          className="absolute pointer-events-none z-50 rounded"
          style={{
            left: textDragRect.x,
            top: textDragRect.y,
            width: textDragRect.width,
            height: textDragRect.height,
            border: '2px dashed #8B5CF6',
            background: 'rgba(139,92,246,0.1)',
          }}
        />
      )}
    </div>
  )
}
