'use client'

import { useCallback, useEffect, useRef } from 'react'
import ReactFlow, {
  Background,
  Controls,
  Node,
  Edge,
  NodeChange,
  Connection,
  ConnectionMode,
  applyNodeChanges,
  useNodesState,
  useEdgesState,
  useReactFlow,
} from 'reactflow'
import { useDndMonitor, useDroppable } from '@dnd-kit/core'
import { useDatasetStore } from '@/store/useDatasetStore'
import { useModelStore } from '@/store/useModelStore'
import { useUIStore } from '@/store/useUIStore'
import { useRLStore } from '@/store/useRLStore'
import { useWorkflowStore } from '@/store/useWorkflowStore'
import { useRuleStore } from '@/store/useRuleStore'
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
}

const edgeTypes = {
  dataset: DatasetEdge,
  test: TestEdge,
  workflow: WorkflowEdge,
  rule: RuleEdge,
}

export default function DatasetCanvas() {
  const labelledBlocks = useDatasetStore((s) => s.labelledBlocks)
  const unlabelledBlocks = useDatasetStore((s) => s.unlabelledBlocks)
  const updateBlockPosition = useDatasetStore((s) => s.updateBlockPosition)
  const modelBlocks = useModelStore((s) => s.modelBlocks)
  const updateModelBlockPosition = useModelStore((s) => s.updateModelBlockPosition)
  const updateModelBlock = useModelStore((s) => s.updateModelBlock)
  const rlBlocks = useRLStore((s) => s.rlBlocks)
  const updateRLBlockPosition = useRLStore((s) => s.updateRLBlockPosition)
  const doorBlocks = useWorkflowStore((s) => s.doorBlocks)
  const updateDoorBlockPosition = useWorkflowStore((s) => s.updateDoorBlockPosition)
  const updateDoorBlock = useWorkflowStore((s) => s.updateDoorBlock)
  const bulbBlocks = useWorkflowStore((s) => s.bulbBlocks)
  const updateBulbBlockPosition = useWorkflowStore((s) => s.updateBulbBlockPosition)
  const updateBulbBlock = useWorkflowStore((s) => s.updateBulbBlock)

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
  const updateConditionBlockPosition = useRuleStore((s) => s.updateConditionBlockPosition)
  const updateConditionBlock = useRuleStore((s) => s.updateConditionBlock)
  const updateSwitchBlockPosition = useRuleStore((s) => s.updateSwitchBlockPosition)
  const updateLogicBlockPosition = useRuleStore((s) => s.updateLogicBlockPosition)
  const updateLogicBlock = useRuleStore((s) => s.updateLogicBlock)
  const updateFanBlockPosition = useRuleStore((s) => s.updateFanBlockPosition)
  const updateFanBlock = useRuleStore((s) => s.updateFanBlock)
  const updateAlarmBlockPosition = useRuleStore((s) => s.updateAlarmBlockPosition)
  const updateAlarmBlock = useRuleStore((s) => s.updateAlarmBlock)
  const updateACBlockPosition = useRuleStore((s) => s.updateACBlockPosition)
  const updateACBlock = useRuleStore((s) => s.updateACBlock)
  const updateTimerBlockPosition = useRuleStore((s) => s.updateTimerBlockPosition)
  const updateTimerBlock = useRuleStore((s) => s.updateTimerBlock)
  const evaluateGraph = useRuleStore((s) => s.evaluateGraph)
  const tickTimers = useRuleStore((s) => s.tickTimers)

  const setSelectedBlock = useUIStore((s) => s.setSelectedBlock)

  const { setNodeRef: setCanvasDropRef, isOver: isModelDragOver } = useDroppable({ id: 'canvas-drop' })
  const canvasRef = useRef<HTMLDivElement>(null)

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
      ]
    })
  }, [labelledBlocks, unlabelledBlocks, modelBlocks, rlBlocks, doorBlocks, bulbBlocks,
      sensorBlocks, conditionBlocks, switchBlocks, logicBlocks, fanBlocks, alarmBlocks, acBlocks, timerBlocks, setRfNodes])

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
          else {
            const type = labelledBlocks.some((b) => b.id === id) ? 'labelled' : 'unlabelled'
            updateBlockPosition(id, type, p)
          }
        }
      }
    },
    [
      labelledBlocks, modelBlocks, rlBlocks, doorBlocks, bulbBlocks,
      sensorBlocks, conditionBlocks, switchBlocks, logicBlocks, fanBlocks, alarmBlocks, acBlocks, timerBlocks,
      updateBlockPosition, updateModelBlockPosition, updateRLBlockPosition,
      updateDoorBlockPosition, updateBulbBlockPosition,
      updateSensorBlockPosition, updateConditionBlockPosition, updateSwitchBlockPosition, updateLogicBlockPosition,
      updateFanBlockPosition, updateAlarmBlockPosition, updateACBlockPosition, updateTimerBlockPosition, setRfNodes,
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
        if (current?.trainedModelId && current.trainedLinkedBlockId === source) {
          // Reconnecting the same data the saved model was trained on — keep trained state.
          updateModelBlock(target, { linkedBlockId: source })
        } else {
          updateModelBlock(target, { linkedBlockId: source, status: 'idle', trainedModelId: null, trainedLinkedBlockId: null })
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
            updateConditionBlock(target, { linkedSensorId: source, linkedModelId: null, currentOutput: null, operator: 'is', threshold: true })
          } else if (sensor?.sensorType === 'text-input') {
            updateConditionBlock(target, { linkedSensorId: source, linkedModelId: null, currentOutput: null, operator: '==', threshold: '' })
          } else {
            updateConditionBlock(target, { linkedSensorId: source, linkedModelId: null, currentOutput: null, operator: '>', threshold: 0 })
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
      }
    },
    [
      updateModelBlock, updateDoorBlock, updateBulbBlock,
      updateConditionBlock, updateLogicBlock, updateFanBlock, updateAlarmBlock,
      updateACBlock, updateTimerBlock,
      logicBlocks, sensorBlocks, evaluateGraph, modelBlocks,
    ]
  )

  // Tick running timer blocks once per second
  useEffect(() => {
    const interval = setInterval(() => tickTimers(), 1000)
    return () => clearInterval(interval)
  }, [tickTimers])

  return (
    <div
      ref={(el) => { setCanvasDropRef(el); (canvasRef as React.MutableRefObject<HTMLDivElement | null>).current = el }}
      className="flex-1 rounded-xl overflow-hidden"
      style={{
        width: '100%',
        height: '100%',
        boxShadow: isModelDragOver ? '0 0 0 2px rgba(139,92,246,0.6), inset 0 0 40px rgba(139,92,246,0.08)' : undefined,
        transition: 'box-shadow 0.15s ease',
      }}
      onPointerDown={(e) => {
        if (isDraggingRef.current) e.stopPropagation()
      }}
    >
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onConnect={onConnect}
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
        deleteKeyCode={null}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="rgba(255,255,255,0.03)" gap={24} />
        <Controls className="!bg-white/10 !border-white/10 !rounded-xl" />
        <CanvasPaletteDropHandler canvasRef={canvasRef} />
      </ReactFlow>
    </div>
  )
}
