'use client'

import { useEffect } from 'react'
import { NodeProps, Handle, Position } from 'reactflow'
import { ModelBlock } from '@/types/model'
import type { DataItem } from '@/types/dataset'
import { useModelStore } from '@/store/useModelStore'
import { useRuleStore } from '@/store/useRuleStore'
import { useUIStore } from '@/store/useUIStore'
import { runTextInference } from '@/lib/textLearner'

const MODEL_TYPE_LABELS: Record<string, string> = {
  'image-supervised': 'Image Supervised',
  'image-classifier': 'Image Classifier',
  'image-unsupervised': 'Image Unsupervised',
  'text-supervised': 'Text Supervised',
  'text-unsupervised': 'Text Unsupervised',
}

const STATUS_STYLES: Record<string, { color: string; label: string }> = {
  idle: { color: 'text-white/40', label: 'Not trained' },
  loading: { color: 'text-teal-400', label: 'Loading…' },
  training: { color: 'text-amber-400', label: 'Training…' },
  trained: { color: 'text-emerald-400', label: 'Trained ✓' },
  error: { color: 'text-red-400', label: 'Error' },
}

export default function ModelBlockNode({ data, selected }: NodeProps<{ block: ModelBlock }>) {
  const removeModelBlock = useModelStore((s) => s.removeModelBlock)
  const updateModelBlock = useModelStore((s) => s.updateModelBlock)
  const trainedModels = useModelStore((s) => s.trainedModels)
  const sensorBlocks = useRuleStore((s) => s.sensorBlocks)
  const setSelectedBlock = useUIStore((s) => s.setSelectedBlock)
  const { block } = data

  const trainedModel = trainedModels.find((m) => m.id === block.trainedModelId)
  const liveSensor = sensorBlocks.find((s) => s.id === block.liveLinkedSensorId)

  // Keep liveResult updated as the sensor text changes
  useEffect(() => {
    if (!block.liveLinkedSensorId || !trainedModel?.nbWordLogProbs) {
      if (block.liveResult != null) updateModelBlock(block.id, { liveResult: null })
      return
    }
    const text = typeof liveSensor?.value === 'string' ? liveSensor.value.trim() : ''
    if (!text) {
      if (block.liveResult != null) updateModelBlock(block.id, { liveResult: null })
      return
    }
    const fakeItem: DataItem = { id: 'live', type: 'text', name: 'live', content: text, addedAt: 0 }
    const results = runTextInference(trainedModel, [fakeItem], () => {})
    const r = results[0]
    if (r) {
      updateModelBlock(block.id, {
        liveResult: {
          predictedLabel: r.predictedLabel,
          predictedLabelId: r.predictedLabelId,
          confidence: r.confidence,
          allConfidences: r.allConfidences,
        },
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveSensor?.value, block.liveLinkedSensorId, block.trainedModelId])

  const statusStyle = STATUS_STYLES[block.status] ?? STATUS_STYLES.idle
  const isActive = block.status === 'loading' || block.status === 'training'
  const isTesting = block.testStatus === 'running'

  return (
    <div className="flex flex-col">
      {/* Target handle — top-left, receives training data from Labelled block */}
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        style={{ background: '#2DD4BF', border: '2px solid #134E4A', width: 12, height: 12, left: -6, top: '38%' }}
      />
      {/* Target handle — middle-left, receives test data from Unlabelled block */}
      <Handle
        type="target"
        position={Position.Left}
        id="test-in"
        style={{ background: '#F59E0B', border: '2px solid #78350F', width: 12, height: 12, left: -6, top: '65%' }}
      />
      {/* Target handle — bottom-left, receives live text from a Text-Input sensor (text-supervised only) */}
      {block.modelType === 'text-supervised' && (
        <Handle
          type="target"
          position={Position.Left}
          id="live-in"
          title="Connect a 📝 Text-Input sensor for live prediction"
          style={{ background: '#7C3AED', border: '2px solid #4C1D95', width: 12, height: 12, left: -6, top: '88%' }}
        />
      )}
      {/* Source handle — right, emits prediction output to IF/Else block */}
      <Handle
        type="source"
        position={Position.Right}
        id="prediction-out"
        style={{ background: '#10B981', border: '2px solid #064E3B', width: 10, height: 10, right: -5, top: '85%' }}
      />

      <div className="drag-handle flex justify-center items-center py-1.5 px-4 rounded-t-xl cursor-grab active:cursor-grabbing hover:bg-white/5 transition-colors">
        <div className="flex gap-1">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="w-1 h-1 rounded-full bg-white/20" />
          ))}
        </div>
      </div>

      <div
        className="glass-card w-56 flex flex-col gap-2 px-4 py-3"
        onClick={() => setSelectedBlock(block.id, 'model')}
        style={{
          borderColor: block.status === 'trained' ? 'rgba(52,211,153,0.3)' : undefined,
          boxShadow: selected ? '0 0 0 2px rgba(139,92,246,0.9), 0 0 20px rgba(139,92,246,0.4)' : undefined,
          transition: 'box-shadow 0.2s ease',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className={`text-base flex-shrink-0 ${isActive || isTesting ? 'animate-pulse' : ''}`}>🤖</span>
            <span className="text-sm font-heading font-bold text-white truncate">{block.name}</span>
          </div>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => removeModelBlock(block.id)}
            className="w-5 h-5 rounded-full bg-white/10 text-white/40 hover:text-red-400 hover:bg-red-500/20 text-xs flex items-center justify-center transition-all flex-shrink-0"
          >
            ×
          </button>
        </div>

        {/* Model type + train status */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {block.modelType ? (
            <span className="text-xs font-body px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
              {MODEL_TYPE_LABELS[block.modelType] ?? block.modelType}
            </span>
          ) : (
            <span className="text-xs text-white/40 font-body">No model selected</span>
          )}
          <span className={`text-xs font-body ${statusStyle.color}`}>
            · {statusStyle.label}
          </span>
        </div>

        {/* Test status chip */}
        {block.testLinkedBlockId && (
          <div className="flex items-center gap-1">
            <span className="text-xs font-body px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {block.testStatus === 'running'
                ? '⏳ Testing…'
                : block.testStatus === 'done'
                ? '✓ Test done'
                : '📦 Test linked'}
            </span>
          </div>
        )}

        {/* Live prediction chip */}
        {block.liveResult && (
          <div
            className="text-[10px] font-body text-center py-0.5 px-2 rounded-full"
            style={{ background: 'rgba(124,58,237,0.2)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.3)' }}
          >
            Live: &quot;{block.liveResult.predictedLabel}&quot; ({Math.round(block.liveResult.confidence * 100)}%)
          </div>
        )}

        {/* Hint */}
        <p className="text-xs text-white/35 font-body text-center mt-1">
          Click to inspect
        </p>
      </div>
    </div>
  )
}
