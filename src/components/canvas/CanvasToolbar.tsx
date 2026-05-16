'use client'

import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useDraggable, useDndMonitor } from '@dnd-kit/core'
import { useDatasetStore } from '@/store/useDatasetStore'
import { useModelStore } from '@/store/useModelStore'
import { useRLStore } from '@/store/useRLStore'
import { useWorkflowStore } from '@/store/useWorkflowStore'
import GlowButton from '@/components/ui/GlowButton'

type BlockType = 'labelled' | 'unlabelled' | 'model' | 'rl-gridworld' | 'ifelse' | 'door' | 'bulb'

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

function DraggableActionItem({
  blockType,
  label,
  onAdd,
}: {
  blockType: 'door' | 'bulb'
  label: string
  onAdd: () => void
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
      onClick={onAdd}
      style={{ opacity: isDragging ? 0.4 : 1, touchAction: 'none' }}
      className="text-left px-3 py-2 rounded-lg text-xs font-heading font-semibold text-white/80 hover:bg-white/10 hover:text-white transition-colors whitespace-nowrap cursor-grab active:cursor-grabbing select-none"
    >
      {label}
    </div>
  )
}

function ActionsMenu() {
  const [open, setOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const wrapperRef = useRef<HTMLDivElement>(null)
  const addDoorBlock = useWorkflowStore((s) => s.addDoorBlock)
  const addBulbBlock = useWorkflowStore((s) => s.addBulbBlock)

  // On drag start: remove only the backdrop so pointer events reach the canvas,
  // but keep the portal mounted so dnd-kit can still track the draggable node.
  // On drag end/cancel: close the dropdown.
  useDndMonitor({
    onDragStart:  () => setDragging(true),
    onDragEnd:    () => { setDragging(false); setOpen(false) },
    onDragCancel: () => { setDragging(false); setOpen(false) },
  })

  const handleToggle = () => {
    if (!open && wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 4, left: rect.left })
    }
    setOpen((o) => !o)
  }

  return (
    <div ref={wrapperRef}>
      {open && createPortal(
        <>
          {!dragging && (
            <div className="fixed inset-0 z-[9999]" onPointerDown={() => setOpen(false)} />
          )}
          <div
            className="fixed z-[10000] glass-card-dark rounded-xl overflow-hidden flex flex-col p-1 min-w-32 shadow-xl"
            style={{ top: pos.top, left: pos.left }}
          >
            <DraggableActionItem
              blockType="door"
              label="🚪 Door"
              onAdd={() => { addDoorBlock(); setOpen(false) }}
            />
            <DraggableActionItem
              blockType="bulb"
              label="💡 Bulb"
              onAdd={() => { addBulbBlock(); setOpen(false) }}
            />
          </div>
        </>,
        document.body
      )}
      <GlowButton size="sm" variant="secondary" onClick={handleToggle}>
        ⚡ Actions {open ? '▴' : '▾'}
      </GlowButton>
    </div>
  )
}

export default function CanvasToolbar() {
  const addLabelledBlock = useDatasetStore((s) => s.addLabelledBlock)
  const addUnlabelledBlock = useDatasetStore((s) => s.addUnlabelledBlock)
  const addModelBlock = useModelStore((s) => s.addModelBlock)
  const addRLBlock = useRLStore((s) => s.addRLBlock)
  const addIfElseBlock = useWorkflowStore((s) => s.addIfElseBlock)

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
      <DraggablePaletteItem blockType="ifelse" variant="secondary" onClick={addIfElseBlock}>
        🔀 If / Else
      </DraggablePaletteItem>
      <ActionsMenu />
    </div>
  )
}
