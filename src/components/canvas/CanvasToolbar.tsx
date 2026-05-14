'use client'

import { useDraggable } from '@dnd-kit/core'
import { useDatasetStore } from '@/store/useDatasetStore'
import { useModelStore } from '@/store/useModelStore'
import { useRLStore } from '@/store/useRLStore'
import GlowButton from '@/components/ui/GlowButton'

type BlockType = 'labelled' | 'unlabelled' | 'model' | 'rl-gridworld'

function DraggablePaletteItem({
  blockType,
  children,
  onClick,
  variant,
}: {
  blockType: BlockType
  children: React.ReactNode
  onClick: () => void
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${blockType}`,
    data: { type: 'block-palette', blockType },
  })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ opacity: isDragging ? 0.5 : 1, touchAction: 'none' }}
    >
      <GlowButton size="sm" variant={variant} onClick={onClick}>
        {children}
      </GlowButton>
    </div>
  )
}

export default function CanvasToolbar() {
  const addLabelledBlock = useDatasetStore((s) => s.addLabelledBlock)
  const addUnlabelledBlock = useDatasetStore((s) => s.addUnlabelledBlock)
  const addModelBlock = useModelStore((s) => s.addModelBlock)
  const addRLBlock = useRLStore((s) => s.addRLBlock)

  return (
    <div className="flex items-center gap-2 p-2 glass-card-dark rounded-xl flex-wrap">
      <span className="text-xs text-white/40 font-heading">Drag or click to add:</span>
      <DraggablePaletteItem blockType="labelled" onClick={addLabelledBlock}>
        🏷️ Labelled
      </DraggablePaletteItem>
      <DraggablePaletteItem blockType="unlabelled" variant="secondary" onClick={addUnlabelledBlock}>
        📦 Unlabelled
      </DraggablePaletteItem>
      <DraggablePaletteItem blockType="model" variant="secondary" onClick={addModelBlock}>
        🤖 Model
      </DraggablePaletteItem>
      <DraggablePaletteItem blockType="rl-gridworld" variant="secondary" onClick={addRLBlock}>
        🎮 RL Gridworld
      </DraggablePaletteItem>
    </div>
  )
}
