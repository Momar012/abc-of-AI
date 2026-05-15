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
import LabelledDatasetNode from './nodes/LabelledDatasetNode'
import UnlabelledDatasetNode from './nodes/UnlabelledDatasetNode'
import ValidationResultNode from './nodes/ValidationResultNode'
import DataSplitNode from './nodes/DataSplitNode'
import ModelBlockNode from './nodes/ModelBlockNode'
import RLGridworldNode from './nodes/RLGridworldNode'
import IfElseNode from './nodes/IfElseNode'
import DoorNode from './nodes/DoorNode'
import DatasetEdge from './edges/DatasetEdge'
import TestEdge from './edges/TestEdge'
import WorkflowEdge from './edges/WorkflowEdge'

function CanvasPaletteDropHandler({ canvasRef }: { canvasRef: React.RefObject<HTMLDivElement> }) {
  const { project } = useReactFlow()
  const addLabelledBlock = useDatasetStore((s) => s.addLabelledBlock)
  const addUnlabelledBlock = useDatasetStore((s) => s.addUnlabelledBlock)
  const addModelBlock = useModelStore((s) => s.addModelBlock)
  const addModelBlockFromSaved = useModelStore((s) => s.addModelBlockFromSaved)
  const addRLBlock = useRLStore((s) => s.addRLBlock)
  const addIfElseBlock = useWorkflowStore((s) => s.addIfElseBlock)
  const addDoorBlock = useWorkflowStore((s) => s.addDoorBlock)
  const addDatasetToCanvas = useDatasetStore((s) => s.addDatasetToCanvas)
  const addToast = useUIStore((s) => s.addToast)

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
        else if (blockType === 'model') addModelBlock(flowPos)
        else if (blockType === 'rl-gridworld') addRLBlock(flowPos)
        else if (blockType === 'ifelse') addIfElseBlock(flowPos)
        else if (blockType === 'door') addDoorBlock(flowPos)
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
  ifelse: IfElseNode,
  door: DoorNode,
}

const edgeTypes = {
  dataset: DatasetEdge,
  test: TestEdge,
  workflow: WorkflowEdge,
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
  const ifElseBlocks = useWorkflowStore((s) => s.ifElseBlocks)
  const updateIfElseBlockPosition = useWorkflowStore((s) => s.updateIfElseBlockPosition)
  const updateIfElseBlock = useWorkflowStore((s) => s.updateIfElseBlock)
  const doorBlocks = useWorkflowStore((s) => s.doorBlocks)
  const updateDoorBlockPosition = useWorkflowStore((s) => s.updateDoorBlockPosition)
  const updateDoorBlock = useWorkflowStore((s) => s.updateDoorBlock)

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
    setRfNodes((current) => [
      ...labelledBlocks.map((b) => {
        const existing = current.find((n) => n.id === b.id)
        return {
          id: b.id,
          type: 'labelled',
          position: existing?.position ?? b.position,
          data: { block: b },
        } as Node
      }),
      ...unlabelledBlocks.map((b) => {
        const existing = current.find((n) => n.id === b.id)
        return {
          id: b.id,
          type: 'unlabelled',
          position: existing?.position ?? b.position,
          data: { block: b },
        } as Node
      }),
      ...modelBlocks.map((b) => {
        const existing = current.find((n) => n.id === b.id)
        return {
          id: b.id,
          type: 'model',
          position: existing?.position ?? b.position,
          data: { block: b },
        } as Node
      }),
      ...rlBlocks.map((b) => {
        const existing = current.find((n) => n.id === b.id)
        return {
          id: b.id,
          type: 'rl-gridworld',
          position: existing?.position ?? b.position,
          data: { block: b },
        } as Node
      }),
      ...ifElseBlocks.map((b) => {
        const existing = current.find((n) => n.id === b.id)
        return {
          id: b.id,
          type: 'ifelse',
          position: existing?.position ?? b.position,
          data: { block: b },
        } as Node
      }),
      ...doorBlocks.map((b) => {
        const existing = current.find((n) => n.id === b.id)
        return {
          id: b.id,
          type: 'door',
          position: existing?.position ?? b.position,
          data: { block: b },
        } as Node
      }),
    ])
  }, [labelledBlocks, unlabelledBlocks, modelBlocks, rlBlocks, ifElseBlocks, doorBlocks, setRfNodes])

  // Sync model linkedBlockIds → RF edges
  useEffect(() => {
    setRfEdges([
      // Training edges: labelled → model (violet→cyan)
      ...modelBlocks
        .filter((b) => b.linkedBlockId !== null)
        .map((b) => ({
          id: `edge-${b.linkedBlockId}-${b.id}`,
          source: b.linkedBlockId!,
          sourceHandle: 'out',
          target: b.id,
          targetHandle: 'in',
          type: 'dataset',
          animated: b.status === 'loading' || b.status === 'training',
        } as Edge)),
      // Test edges: unlabelled → model (amber→orange)
      ...modelBlocks
        .filter((b) => b.testLinkedBlockId !== null)
        .map((b) => ({
          id: `test-edge-${b.testLinkedBlockId}-${b.id}`,
          source: b.testLinkedBlockId!,
          sourceHandle: 'test-out',
          target: b.id,
          targetHandle: 'test-in',
          type: 'test',
          animated: b.testStatus === 'running',
        } as Edge)),
      // Prediction edges: model prediction-out → ifelse ifelse-in (emerald)
      ...ifElseBlocks
        .filter((b) => b.linkedModelId !== null)
        .map((b) => ({
          id: `pred-${b.linkedModelId}-${b.id}`,
          source: b.linkedModelId!,
          sourceHandle: 'prediction-out',
          target: b.id,
          targetHandle: 'ifelse-in',
          type: 'workflow',
        } as Edge)),
      // Action edges: ifelse ifelse-out → door door-in (emerald)
      ...doorBlocks
        .filter((b) => b.linkedIfElseId !== null)
        .map((b) => ({
          id: `action-${b.linkedIfElseId}-${b.id}`,
          source: b.linkedIfElseId!,
          sourceHandle: 'ifelse-out',
          target: b.id,
          targetHandle: 'door-in',
          type: 'workflow',
        } as Edge)),
    ])
  }, [modelBlocks, ifElseBlocks, doorBlocks, setRfEdges])

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setRfNodes((nds) => applyNodeChanges(changes, nds))
      for (const change of changes) {
        if (change.type === 'position' && !change.dragging && change.position) {
          if (modelBlocks.some((b) => b.id === change.id)) {
            updateModelBlockPosition(change.id, change.position)
          } else if (rlBlocks.some((b) => b.id === change.id)) {
            updateRLBlockPosition(change.id, change.position)
          } else if (ifElseBlocks.some((b) => b.id === change.id)) {
            updateIfElseBlockPosition(change.id, change.position)
          } else if (doorBlocks.some((b) => b.id === change.id)) {
            updateDoorBlockPosition(change.id, change.position)
          } else {
            const type = labelledBlocks.some((b) => b.id === change.id) ? 'labelled' : 'unlabelled'
            updateBlockPosition(change.id, type, change.position)
          }
        }
      }
    },
    [labelledBlocks, modelBlocks, rlBlocks, ifElseBlocks, doorBlocks, updateBlockPosition, updateModelBlockPosition, updateRLBlockPosition, updateIfElseBlockPosition, updateDoorBlockPosition, setRfNodes]
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return

      if (connection.targetHandle === 'test-in') {
        updateModelBlock(connection.target, {
          testLinkedBlockId: connection.source,
          testStatus: 'idle',
          testResults: null,
        })
      } else if (connection.targetHandle === 'in') {
        updateModelBlock(connection.target, {
          linkedBlockId: connection.source,
          status: 'idle',
          trainedModelId: null,
        })
      } else if (connection.targetHandle === 'ifelse-in') {
        updateIfElseBlock(connection.target, { linkedModelId: connection.source, currentOutput: null })
      } else if (connection.targetHandle === 'door-in') {
        updateDoorBlock(connection.target, { linkedIfElseId: connection.source, isOpen: false })
      }
    },
    [updateModelBlock, updateIfElseBlock, updateDoorBlock]
  )

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
