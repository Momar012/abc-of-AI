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
import LabelledDatasetNode from './nodes/LabelledDatasetNode'
import UnlabelledDatasetNode from './nodes/UnlabelledDatasetNode'
import ValidationResultNode from './nodes/ValidationResultNode'
import DataSplitNode from './nodes/DataSplitNode'
import ModelBlockNode from './nodes/ModelBlockNode'
import DatasetEdge from './edges/DatasetEdge'
import TestEdge from './edges/TestEdge'

function CanvasPaletteDropHandler({ canvasRef }: { canvasRef: React.RefObject<HTMLDivElement> }) {
  const { project } = useReactFlow()
  const addLabelledBlock = useDatasetStore((s) => s.addLabelledBlock)
  const addUnlabelledBlock = useDatasetStore((s) => s.addUnlabelledBlock)
  const addModelBlock = useModelStore((s) => s.addModelBlock)

  useDndMonitor({
    onDragEnd(event) {
      if (event.active.data.current?.type !== 'block-palette') return
      if (!event.over || event.over.id !== 'canvas-drop') return

      const translated = event.active.rect.current.translated
      if (!translated || !canvasRef.current) return

      const bounds = canvasRef.current.getBoundingClientRect()
      const flowPos = project({
        x: translated.left + translated.width / 2 - bounds.left,
        y: translated.top + translated.height / 2 - bounds.top,
      })

      const blockType = event.active.data.current?.blockType
      if (blockType === 'labelled') addLabelledBlock(flowPos)
      else if (blockType === 'unlabelled') addUnlabelledBlock(flowPos)
      else if (blockType === 'model') addModelBlock(flowPos)
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
}

const edgeTypes = {
  dataset: DatasetEdge,
  test: TestEdge,
}

export default function DatasetCanvas() {
  const labelledBlocks = useDatasetStore((s) => s.labelledBlocks)
  const unlabelledBlocks = useDatasetStore((s) => s.unlabelledBlocks)
  const updateBlockPosition = useDatasetStore((s) => s.updateBlockPosition)
  const modelBlocks = useModelStore((s) => s.modelBlocks)
  const updateModelBlockPosition = useModelStore((s) => s.updateModelBlockPosition)
  const updateModelBlock = useModelStore((s) => s.updateModelBlock)

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
    ])
  }, [labelledBlocks, unlabelledBlocks, modelBlocks, setRfNodes])

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
    ])
  }, [modelBlocks, setRfEdges])

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setRfNodes((nds) => applyNodeChanges(changes, nds))
      for (const change of changes) {
        if (change.type === 'position' && !change.dragging && change.position) {
          if (modelBlocks.some((b) => b.id === change.id)) {
            updateModelBlockPosition(change.id, change.position)
          } else {
            const type = labelledBlocks.some((b) => b.id === change.id) ? 'labelled' : 'unlabelled'
            updateBlockPosition(change.id, type, change.position)
          }
        }
      }
    },
    [labelledBlocks, modelBlocks, updateBlockPosition, updateModelBlockPosition, setRfNodes]
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return
      if (!modelBlocks.some((b) => b.id === connection.target)) return

      if (connection.targetHandle === 'test-in') {
        updateModelBlock(connection.target, {
          testLinkedBlockId: connection.source,
          testStatus: 'idle',
          testResults: null,
        })
      } else {
        updateModelBlock(connection.target, {
          linkedBlockId: connection.source,
          status: 'idle',
          trainedModelId: null,
        })
      }
    },
    [modelBlocks, updateModelBlock]
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
