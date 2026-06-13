'use client'

import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useDraggable, useDndMonitor } from '@dnd-kit/core'
import { useDatasetStore } from '@/store/useDatasetStore'
import { useModelStore } from '@/store/useModelStore'
import { useRLStore } from '@/store/useRLStore'
import { useWorkflowStore } from '@/store/useWorkflowStore'
import { useRuleStore } from '@/store/useRuleStore'
import { SensorType } from '@/types/rules'
import { MODEL_CATALOG } from '@/lib/modelCatalog'
import GlowButton from '@/components/ui/GlowButton'

type BlockType =
  | 'labelled' | 'unlabelled' | 'rl-gridworld' | 'door' | 'bulb'
  | 'sensor-temperature' | 'sensor-light' | 'sensor-motion' | 'sensor-humidity' | 'sensor-text'
  | 'condition' | 'switch' | 'logic-and' | 'logic-or' | 'logic-not'
  | 'fan' | 'alarm' | 'ac' | 'timer'
  | 'model-image-supervised' | 'model-image-unsupervised' | 'model-text-corpus'

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
  blockType: BlockType
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
  const addFanBlock = useRuleStore((s) => s.addFanBlock)
  const addAlarmBlock = useRuleStore((s) => s.addAlarmBlock)
  const addACBlock = useRuleStore((s) => s.addACBlock)

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
            <p className="px-3 pt-1 pb-0.5 text-[10px] text-white/30 font-heading uppercase tracking-wider">ML Actions</p>
            <DraggableActionItem blockType="door" label="🚪 Door" onAdd={() => { addDoorBlock(); setOpen(false) }} />
            <DraggableActionItem blockType="bulb" label="💡 Bulb" onAdd={() => { addBulbBlock(); setOpen(false) }} />
            <div className="my-1 border-t border-white/10" />
            <p className="px-3 pt-1 pb-0.5 text-[10px] text-white/30 font-heading uppercase tracking-wider">Rule Actions</p>
            <DraggableActionItem blockType="fan" label="🌀 Fan" onAdd={() => { addFanBlock(); setOpen(false) }} />
            <DraggableActionItem blockType="alarm" label="🚨 Alarm" onAdd={() => { addAlarmBlock(); setOpen(false) }} />
            <DraggableActionItem blockType="ac" label="❄️ AC" onAdd={() => { addACBlock(); setOpen(false) }} />
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

function ModelMenu() {
  const [open, setOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const wrapperRef = useRef<HTMLDivElement>(null)

  const addModelBlockWithType = useModelStore((s) => s.addModelBlockWithType)

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
            className="fixed z-[10000] glass-card-dark rounded-xl overflow-hidden flex flex-col p-1 min-w-44 shadow-xl"
            style={{ top: pos.top, left: pos.left }}
          >
            <p className="px-3 pt-1 pb-0.5 text-[10px] text-violet-400/70 font-heading uppercase tracking-wider">🤖 Models</p>
            {MODEL_CATALOG.filter((m) => m.available).map((m) => (
              <DraggableActionItem
                key={m.type}
                blockType={`model-${m.type}` as BlockType}
                label={`${m.icon} ${m.name}`}
                onAdd={() => { addModelBlockWithType(m.type); setOpen(false) }}
              />
            ))}
          </div>
        </>,
        document.body
      )}
      <GlowButton size="sm" variant="secondary" onClick={handleToggle}>
        🤖 Model {open ? '▴' : '▾'}
      </GlowButton>
    </div>
  )
}

function RuleBasedMenu() {
  const [open, setOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const wrapperRef = useRef<HTMLDivElement>(null)

  const addSensorBlock = useRuleStore((s) => s.addSensorBlock)
  const addConditionBlock = useRuleStore((s) => s.addConditionBlock)
  const addSwitchBlock = useRuleStore((s) => s.addSwitchBlock)
  const addLogicBlock = useRuleStore((s) => s.addLogicBlock)
  const addTimerBlock = useRuleStore((s) => s.addTimerBlock)

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

  const addSensor = (type: SensorType) => { addSensorBlock(type); setOpen(false) }
  const addCond   = () => { addConditionBlock(); setOpen(false) }
  const addLogic  = (t: 'and' | 'or' | 'not') => { addLogicBlock(t); setOpen(false) }
  const addTimer  = () => { addTimerBlock(); setOpen(false) }

  return (
    <div ref={wrapperRef}>
      {open && createPortal(
        <>
          {!dragging && (
            <div className="fixed inset-0 z-[9999]" onPointerDown={() => setOpen(false)} />
          )}
          <div
            className="fixed z-[10000] glass-card-dark rounded-xl overflow-hidden flex flex-col p-1 min-w-40 shadow-xl"
            style={{ top: pos.top, left: pos.left }}
          >
            {/* Sensors */}
            <p className="px-3 pt-1 pb-0.5 text-[10px] text-orange-400/70 font-heading uppercase tracking-wider">📡 Sensors</p>
            <DraggableActionItem blockType="sensor-temperature" label="🌡️ Temperature" onAdd={() => addSensor('temperature')} />
            <DraggableActionItem blockType="sensor-light" label="💡 Light Level" onAdd={() => addSensor('light')} />
            <DraggableActionItem blockType="sensor-motion" label="👁️ Motion" onAdd={() => addSensor('motion')} />
            <DraggableActionItem blockType="sensor-humidity" label="💧 Humidity" onAdd={() => addSensor('humidity')} />
            <DraggableActionItem blockType="sensor-text" label="📝 Text Input" onAdd={() => addSensor('text-input')} />

            <div className="my-1 border-t border-white/10" />

            {/* Manual Input */}
            <p className="px-3 pt-1 pb-0.5 text-[10px] text-lime-400/70 font-heading uppercase tracking-wider">🎚️ Manual Input</p>
            <DraggableActionItem blockType="switch" label="🎚️ Switch" onAdd={() => { addSwitchBlock(); setOpen(false) }} />

            <div className="my-1 border-t border-white/10" />

            {/* Logic */}
            <p className="px-3 pt-1 pb-0.5 text-[10px] text-yellow-400/70 font-heading uppercase tracking-wider">🔢 Logic</p>
            <DraggableActionItem blockType="condition" label="📋 IF Condition" onAdd={addCond} />
            <DraggableActionItem blockType="logic-and" label="∧ AND" onAdd={() => addLogic('and')} />
            <DraggableActionItem blockType="logic-or" label="∨ OR" onAdd={() => addLogic('or')} />
            <DraggableActionItem blockType="logic-not" label="¬ NOT" onAdd={() => addLogic('not')} />

            <div className="my-1 border-t border-white/10" />

            {/* Timer */}
            <p className="px-3 pt-1 pb-0.5 text-[10px] text-violet-400/70 font-heading uppercase tracking-wider">⏱️ Timer</p>
            <DraggableActionItem blockType="timer" label="⏱️ Timer" onAdd={addTimer} />
          </div>
        </>,
        document.body
      )}
      <GlowButton size="sm" variant="ghost" onClick={handleToggle}>
        🔌 Rule-Based {open ? '▴' : '▾'}
      </GlowButton>
    </div>
  )
}

export default function CanvasToolbar() {
  const addLabelledBlock = useDatasetStore((s) => s.addLabelledBlock)
  const addUnlabelledBlock = useDatasetStore((s) => s.addUnlabelledBlock)
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
      <ModelMenu />
      <DraggablePaletteItem blockType="rl-gridworld" variant="secondary" onClick={addRLBlock}>
        🎮 RL Gridworld
      </DraggablePaletteItem>
      <ActionsMenu />
      <div className="w-px h-5 bg-white/10 self-center" />
      <RuleBasedMenu />
    </div>
  )
}
