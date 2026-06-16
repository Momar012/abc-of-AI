'use client'

import { useDraggable } from '@dnd-kit/core'
import { useModelStore } from '@/store/useModelStore'
import { useUIStore } from '@/store/useUIStore'
import { TrainedModel } from '@/types/model'

const MODEL_TYPE_LABELS: Record<string, string> = {
  'image-supervised': 'Image Supervised',
  'image-classifier': 'Image Classifier',
  'image-unsupervised': 'Image Unsupervised',
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function DraggableModelCard({ model, onDelete }: { model: TrainedModel; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `trained-model-${model.id}`,
    data: { type: 'trained-model', model },
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="glass-card p-3 flex flex-col gap-2 cursor-grab active:cursor-grabbing transition-opacity"
      style={{
        borderColor: 'rgba(52,211,153,0.2)',
        opacity: isDragging ? 0.4 : 1,
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-heading font-bold text-white truncate">{model.name}</p>
          <p className="text-xs text-white/40 font-body">{timeAgo(model.trainedAt)}</p>
        </div>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onDelete}
          className="w-6 h-6 rounded-full bg-white/10 text-white/40 hover:text-red-400 hover:bg-red-500/20 text-xs flex items-center justify-center transition-all flex-shrink-0"
        >
          ×
        </button>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs font-body px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
          {MODEL_TYPE_LABELS[model.modelType] ?? model.modelType}
        </span>
        <span className="text-xs text-white/40 font-body">{model.itemCount} images</span>
      </div>

      <div className="flex flex-wrap gap-1">
        {model.labels.map((label, i) => (
          <span
            key={i}
            className="text-xs font-body px-2 py-0.5 rounded-full bg-white/10 text-white/60 border border-white/15"
          >
            {label}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-emerald-400/80 font-body font-semibold">✓ Trained</span>
        <span className="text-xs text-white/35 font-body">drag to canvas ↗</span>
      </div>
    </div>
  )
}

export default function TrainedModelsList() {
  const trainedModels = useModelStore((s) => s.trainedModels)
  const deleteTrainedModel = useModelStore((s) => s.deleteTrainedModel)
  const addToast = useUIStore((s) => s.addToast)

  if (trainedModels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 px-4 text-center gap-3">
        <span className="text-4xl">🤖</span>
        <p className="text-white/50 text-sm font-heading font-semibold">No trained models yet</p>
        <p className="text-white/40 text-xs font-body leading-relaxed">
          Add a <span className="text-violet-400">🤖 Model</span> block, link a labelled dataset, and hit Train!
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {trainedModels.map((model) => (
        <DraggableModelCard
          key={model.id}
          model={model}
          onDelete={() => {
            deleteTrainedModel(model.id)
            addToast(`🗑 Deleted "${model.name}"`, 'info')
          }}
        />
      ))}
    </div>
  )
}
