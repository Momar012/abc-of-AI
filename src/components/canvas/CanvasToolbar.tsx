'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useDraggable, useDndMonitor } from '@dnd-kit/core'
import { useDatasetStore } from '@/store/useDatasetStore'
import { useModelStore } from '@/store/useModelStore'
import { useRLStore } from '@/store/useRLStore'
import { useWorkflowStore } from '@/store/useWorkflowStore'
import { useRuleStore } from '@/store/useRuleStore'
import { useCanvasStore } from '@/store/useCanvasStore'
import { useUIStore } from '@/store/useUIStore'
import { SensorType } from '@/types/rules'
import { MODEL_CATALOG } from '@/lib/modelCatalog'
import GlowButton from '@/components/ui/GlowButton'
import { exportRuleApp, validateExportSelection, exportAIModel, validateAIModelExport } from '@/lib/exportRuleApp'

type BlockType =
  | 'labelled' | 'unlabelled' | 'rl-gridworld' | 'door' | 'bulb'
  | 'sensor-temperature' | 'sensor-light' | 'sensor-motion' | 'sensor-humidity' | 'sensor-text'
  | 'condition' | 'switch' | 'logic-and' | 'logic-or' | 'logic-not'
  | 'fan' | 'alarm' | 'ac' | 'timer'
  | 'model-image-supervised' | 'model-image-unsupervised' | 'model-text-corpus'

function ToolButton({
  active,
  title,
  onClick,
  children,
}: {
  active: boolean
  title: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-8 h-8 flex items-center justify-center rounded-lg text-base font-heading transition-all ${
        active
          ? 'bg-violet-500/30 border border-violet-400 text-white'
          : 'text-white/60 border border-transparent hover:bg-white/10 hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

function CanvasToolGroup() {
  const canvasTool = useUIStore((s) => s.canvasTool)
  const setCanvasTool = useUIStore((s) => s.setCanvasTool)

  return (
    <div className="flex items-center gap-1">
      <ToolButton active={canvasTool === 'pan'} title="Hand tool (H)" onClick={() => setCanvasTool('pan')}>
        ✋
      </ToolButton>
      <ToolButton active={canvasTool === 'select'} title="Selection (V)" onClick={() => setCanvasTool('select')}>
        🖱️
      </ToolButton>
      <ToolButton active={canvasTool === 'text'} title="Text (T)" onClick={() => setCanvasTool('text')}>
        🔤
      </ToolButton>
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

function useDropdownPosition() {
  const [pos, setPos] = useState({ top: 0, left: 0, maxHeight: 400 })
  const wrapperRef = useRef<HTMLDivElement>(null)
  const computePos = () => {
    if (!wrapperRef.current) return
    const rect = wrapperRef.current.getBoundingClientRect()
    setPos({
      top: rect.bottom + 4,
      left: rect.left,
      maxHeight: Math.max(160, window.innerHeight - rect.bottom - 4 - 16),
    })
  }
  return { pos, wrapperRef, computePos }
}

function DataMenu() {
  const [open, setOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const { pos, wrapperRef, computePos } = useDropdownPosition()

  const addLabelledBlock = useDatasetStore((s) => s.addLabelledBlock)
  const addUnlabelledBlock = useDatasetStore((s) => s.addUnlabelledBlock)

  useDndMonitor({
    onDragStart:  () => setDragging(true),
    onDragEnd:    () => { setDragging(false); setOpen(false) },
    onDragCancel: () => { setDragging(false); setOpen(false) },
  })

  const handleToggle = () => {
    if (!open) computePos()
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
            className="fixed z-[10000] glass-panel rounded-xl overflow-y-auto flex flex-col p-1 min-w-36 shadow-xl"
            style={{ top: pos.top, left: pos.left, maxHeight: pos.maxHeight }}
          >
            <p className="px-3 pt-1 pb-0.5 text-[10px] text-violet-400/70 font-heading uppercase tracking-wider">🗂️ Data</p>
            <DraggableActionItem blockType="labelled" label="🏷️ Labelled" onAdd={() => { addLabelledBlock(); setOpen(false) }} />
            <DraggableActionItem blockType="unlabelled" label="📦 Unlabelled" onAdd={() => { addUnlabelledBlock(); setOpen(false) }} />
          </div>
        </>,
        document.body
      )}
      <GlowButton size="xs" variant="primary" onClick={handleToggle}>
        🗂️ Data {open ? '▴' : '▾'}
      </GlowButton>
    </div>
  )
}

function ActionsMenu() {
  const [open, setOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const { pos, wrapperRef, computePos } = useDropdownPosition()
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
    if (!open) computePos()
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
            className="fixed z-[10000] glass-panel rounded-xl overflow-y-auto flex flex-col p-1 min-w-32 shadow-xl"
            style={{ top: pos.top, left: pos.left, maxHeight: pos.maxHeight }}
          >
            <p className="px-3 pt-1 pb-0.5 text-[10px] text-white/40 font-heading uppercase tracking-wider">ML Actions</p>
            <DraggableActionItem blockType="door" label="🚪 Door" onAdd={() => { addDoorBlock(); setOpen(false) }} />
            <DraggableActionItem blockType="bulb" label="💡 Bulb" onAdd={() => { addBulbBlock(); setOpen(false) }} />
            <div className="my-1 border-t border-white/10" />
            <p className="px-3 pt-1 pb-0.5 text-[10px] text-white/40 font-heading uppercase tracking-wider">Rule Actions</p>
            <DraggableActionItem blockType="fan" label="🌀 Fan" onAdd={() => { addFanBlock(); setOpen(false) }} />
            <DraggableActionItem blockType="alarm" label="🚨 Alarm" onAdd={() => { addAlarmBlock(); setOpen(false) }} />
            <DraggableActionItem blockType="ac" label="❄️ AC" onAdd={() => { addACBlock(); setOpen(false) }} />
          </div>
        </>,
        document.body
      )}
      <GlowButton size="xs" variant="secondary" onClick={handleToggle}>
        ⚡ Actions {open ? '▴' : '▾'}
      </GlowButton>
    </div>
  )
}

function ModelMenu() {
  const [open, setOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const { pos, wrapperRef, computePos } = useDropdownPosition()

  const addModelBlockWithType = useModelStore((s) => s.addModelBlockWithType)
  const addRLBlock = useRLStore((s) => s.addRLBlock)

  useDndMonitor({
    onDragStart:  () => setDragging(true),
    onDragEnd:    () => { setDragging(false); setOpen(false) },
    onDragCancel: () => { setDragging(false); setOpen(false) },
  })

  const handleToggle = () => {
    if (!open) computePos()
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
            className="fixed z-[10000] glass-panel rounded-xl overflow-y-auto flex flex-col p-1 min-w-44 shadow-xl"
            style={{ top: pos.top, left: pos.left, maxHeight: pos.maxHeight }}
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

            <div className="my-1 border-t border-white/10" />

            <p className="px-3 pt-1 pb-0.5 text-[10px] text-violet-400/70 font-heading uppercase tracking-wider">🎮 Reinforcement Learning</p>
            <DraggableActionItem blockType="rl-gridworld" label="🎮 RL Gridworld" onAdd={() => { addRLBlock(); setOpen(false) }} />
          </div>
        </>,
        document.body
      )}
      <GlowButton size="xs" variant="secondary" onClick={handleToggle}>
        🤖 Model {open ? '▴' : '▾'}
      </GlowButton>
    </div>
  )
}

function RuleBasedMenu() {
  const [open, setOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const { pos, wrapperRef, computePos } = useDropdownPosition()

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
    if (!open) computePos()
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
            className="fixed z-[10000] glass-panel rounded-xl overflow-y-auto flex flex-col p-1 min-w-40 shadow-xl"
            style={{ top: pos.top, left: pos.left, maxHeight: pos.maxHeight }}
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
      <GlowButton size="xs" variant="ghost" onClick={handleToggle}>
        🔌 Rule-Based {open ? '▴' : '▾'}
      </GlowButton>
    </div>
  )
}

const EXPORT_TOOLTIPS: Record<string, string> = {
  ok:                       'Export selection as interactive app',
  'no-outputs':             'Select at least one output device (fan, bulb, door, alarm, AC)',
  'unconnected-output':     'An output has nothing connected — wire it up first',
  'incomplete-chain':       'Select the full connected flow — some nodes in the chain are missing',
  'untrained-model':        "A model in the flow hasn't been trained yet",
  'unsupported-model-type': 'This model type cannot be used in exports — connect a text or image classifier model',
}
const AI_EXPORT_TOOLTIPS: Record<string, string> = {
  ok:               'Export your AI model as a standalone app',
  'no-model':       'Select a trained model to export',
  'untrained-model':'This model hasn\'t been trained yet',
  'unsupported-type':'Text corpus models cannot be exported yet',
  'legacy-model':   'This model was trained with an older version — please retrain it first',
}

function SelectionBar() {
  const canvasSelection = useUIStore((s) => s.canvasSelection)
  const setCanvasSelection = useUIStore((s) => s.setCanvasSelection)

  const [showNaming, setShowNaming] = useState(false)
  const [appName, setAppName] = useState('My AI App')
  const [theme, setTheme] = useState('space')
  const [layout, setLayout] = useState('classic')
  const [creatorName, setCreatorName] = useState('')

  // Rule store removers
  const removeSensorBlock    = useRuleStore((s) => s.removeSensorBlock)
  const removeConditionBlock = useRuleStore((s) => s.removeConditionBlock)
  const removeSwitchBlock    = useRuleStore((s) => s.removeSwitchBlock)
  const removeLogicBlock     = useRuleStore((s) => s.removeLogicBlock)
  const removeFanBlock       = useRuleStore((s) => s.removeFanBlock)
  const removeAlarmBlock     = useRuleStore((s) => s.removeAlarmBlock)
  const removeACBlock        = useRuleStore((s) => s.removeACBlock)
  const removeTimerBlock     = useRuleStore((s) => s.removeTimerBlock)
  // Workflow store removers
  const removeDoorBlock      = useWorkflowStore((s) => s.removeDoorBlock)
  const removeBulbBlock      = useWorkflowStore((s) => s.removeBulbBlock)
  // Other store removers
  const removeLabelledBlock   = useDatasetStore((s) => s.removeLabelledBlock)
  const removeUnlabelledBlock = useDatasetStore((s) => s.removeUnlabelledBlock)
  const removeModelBlock      = useModelStore((s) => s.removeModelBlock)
  const removeRLBlock         = useRLStore((s) => s.removeRLBlock)
  const removeTextBlock       = useCanvasStore((s) => s.removeTextBlock)

  const count = canvasSelection.length
  const isSingleModel = count === 1 && canvasSelection[0]?.type === 'model'

  useEffect(() => {
    if (count === 0 || (count === 1 && canvasSelection[0]?.type !== 'model')) {
      setShowNaming(false); setTheme('space'); setLayout('classic'); setCreatorName('')
    }
  }, [count, canvasSelection])

  if (count <= 1 && !isSingleModel) return null

  const selectedIds = new Set(canvasSelection.map((n) => n.id))

  const OUTPUT_DEVICE_TYPES = new Set(['fan', 'alarm', 'ac', 'door', 'bulb'])
  const hasOutputDevices = canvasSelection.some(n => OUTPUT_DEVICE_TYPES.has(n.type))
  const hasModelBlocks   = canvasSelection.some(n => n.type === 'model')
  const derivedMode: 'app' | 'ai-model' =
    hasOutputDevices ? 'app' : (hasModelBlocks ? 'ai-model' : 'app')

  const activeCheck    = derivedMode === 'app'
    ? validateExportSelection(selectedIds)
    : validateAIModelExport(selectedIds)
  const activeTooltips = derivedMode === 'app' ? EXPORT_TOOLTIPS : AI_EXPORT_TOOLTIPS

  const SWATCHES = [
    { id: 'space',  emoji: '🚀', label: 'Space',     from: '#8b5cf6', to: '#2dd4bf' },
    { id: 'ocean',  emoji: '🌊', label: 'Ocean',     from: '#06b6d4', to: '#0ea5e9' },
    { id: 'jungle', emoji: '🌴', label: 'Jungle',    from: '#22c55e', to: '#10b981' },
    { id: 'neon',   emoji: '🏙️', label: 'Neon',      from: '#ec4899', to: '#f97316' },
    { id: 'candy',  emoji: '🍬', label: 'Candy',     from: '#e879f9', to: '#fbbf24' },
  ]
  const LAYOUTS = [
    { id: 'classic',   label: '🖥️ Classic'   },
    { id: 'dashboard', label: '🏠 Dashboard' },
    { id: 'mobile',    label: '📱 Mobile'    },
  ]

  function handleConfirm() {
    const name = appName.trim() || (derivedMode === 'ai-model' ? 'My AI Model' : 'My AI App')
    if (derivedMode === 'ai-model') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      exportAIModel(name, selectedIds, theme as any, creatorName.trim())
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      exportRuleApp(name, selectedIds, theme as any, layout as any, creatorName.trim())
    }
    setShowNaming(false)
    setAppName('My AI App')
    setTheme('space')
    setLayout('classic')
    setCreatorName('')
  }

  function handleDelete() {
    for (const { id, type } of canvasSelection) {
      switch (type) {
        case 'sensor':      removeSensorBlock(id);    break
        case 'condition':   removeConditionBlock(id); break
        case 'switch':      removeSwitchBlock(id);    break
        case 'logic':       removeLogicBlock(id);     break
        case 'fan':         removeFanBlock(id);       break
        case 'alarm':       removeAlarmBlock(id);     break
        case 'ac':          removeACBlock(id);        break
        case 'timer':       removeTimerBlock(id);     break
        case 'door':        removeDoorBlock(id);      break
        case 'bulb':        removeBulbBlock(id);      break
        case 'labelled':    removeLabelledBlock(id);  break
        case 'unlabelled':  removeUnlabelledBlock(id);break
        case 'model':       removeModelBlock(id);     break
        case 'rl-gridworld':removeRLBlock(id);        break
        case 'text':        removeTextBlock(id);      break
      }
    }
    setCanvasSelection([])
  }

  if (showNaming) {
    const isAI = derivedMode === 'ai-model'
    return (
      <div className="flex flex-col gap-2 px-3 py-2.5 glass-panel rounded-xl">
        {/* row 1: name + download + close */}
        <div className="flex items-center gap-2">
          <span className="text-base leading-none">{isAI ? '🧠' : '🚀'}</span>
          <span className="text-xs font-heading text-white/55 whitespace-nowrap">{isAI ? 'Model name:' : 'App name:'}</span>
          <input
            type="text"
            value={appName}
            onChange={(e) => setAppName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleConfirm()
              if (e.key === 'Escape') setShowNaming(false)
            }}
            autoFocus
            maxLength={40}
            placeholder={isAI ? 'My AI Model' : 'My AI App'}
            className="bg-white/10 border border-white/20 rounded-lg px-2.5 py-1 text-xs text-white font-heading outline-none focus:border-violet-400/60 focus:bg-white/15 w-36 transition-all"
          />
          <button
            onClick={handleConfirm}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-heading font-semibold bg-gradient-to-r from-violet-500/20 to-teal-500/20 border border-violet-500/40 text-white hover:from-violet-500/30 hover:to-teal-500/30 transition-all whitespace-nowrap"
          >
            📥 Download
          </button>
          <button
            onClick={() => setShowNaming(false)}
            className="text-white/35 hover:text-white/70 text-xs font-heading transition-colors px-0.5"
          >
            ✕
          </button>
        </div>
        {/* row 1.5: creator name */}
        <div className="flex items-center gap-2 pl-7">
          <span className="text-xs font-heading text-white/55 whitespace-nowrap">Your name:</span>
          <input
            type="text"
            value={creatorName}
            onChange={(e) => setCreatorName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleConfirm()
              if (e.key === 'Escape') setShowNaming(false)
            }}
            maxLength={30}
            placeholder="optional"
            className="bg-white/10 border border-white/20 rounded-lg px-2.5 py-1 text-xs text-white font-heading outline-none focus:border-violet-400/60 focus:bg-white/15 w-28 transition-all"
          />
          <span className="text-[0.63rem] text-white/20 italic">appears in your app</span>
        </div>
        {/* row 2: theme + (layout only for app mode) */}
        <div className="flex items-center gap-3 pl-7">
          <span className="text-[0.6rem] font-heading font-bold text-white/30 uppercase tracking-widest whitespace-nowrap">Theme</span>
          <div className="flex items-center gap-1.5">
            {SWATCHES.map((s) => (
              <button
                key={s.id}
                title={s.label}
                onClick={() => setTheme(s.id)}
                style={{ background: `linear-gradient(135deg,${s.from},${s.to})` }}
                className={`w-5 h-5 rounded-full transition-all flex items-center justify-center text-[0.55rem] ${
                  theme === s.id
                    ? 'ring-2 ring-white ring-offset-1 ring-offset-transparent scale-110'
                    : 'opacity-55 hover:opacity-85'
                }`}
              >
                {s.emoji}
              </button>
            ))}
          </div>
          {!isAI && (
            <>
              <span className="text-white/15 text-xs">·</span>
              <span className="text-[0.6rem] font-heading font-bold text-white/30 uppercase tracking-widest whitespace-nowrap">Layout</span>
              <div className="flex items-center gap-1">
                {LAYOUTS.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setLayout(l.id)}
                    className={`px-2 py-0.5 rounded-md text-[0.65rem] font-heading font-semibold transition-all whitespace-nowrap ${
                      layout === l.id
                        ? 'bg-white/15 text-white border border-white/30'
                        : 'text-white/35 border border-white/10 hover:text-white/60 hover:border-white/20'
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 glass-panel rounded-xl">
      {!isSingleModel && (
        <>
          <span className="text-xs text-white/40 font-heading whitespace-nowrap">
            {count} node{count !== 1 ? 's' : ''} selected
          </span>
          <div className="w-px h-4 bg-white/10 self-center" />
        </>
      )}
      <button
        onClick={() => setShowNaming(true)}
        disabled={!activeCheck.valid}
        title={activeTooltips[activeCheck.reason]}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-heading font-semibold transition-all ${
          activeCheck.valid
            ? 'bg-gradient-to-r from-violet-500/20 to-teal-500/20 border border-violet-500/40 text-white hover:from-violet-500/30 hover:to-teal-500/30'
            : 'border border-white/10 text-white/25 cursor-not-allowed'
        }`}
      >
        {derivedMode === 'app' ? '📱 Export App' : '🧠 Export AI Model'}
      </button>
      {!isSingleModel && (
        <button
          onClick={handleDelete}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-heading font-semibold border border-red-500/30 text-red-400/70 hover:bg-red-500/10 hover:text-red-300 transition-all"
        >
          🗑️ Delete
        </button>
      )}
    </div>
  )
}

export default function CanvasToolbar() {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex items-center gap-1.5 p-1.5 glass-panel rounded-xl flex-wrap">
        <CanvasToolGroup />
        <div className="w-px h-5 bg-white/10 self-center" />
        <span className="hidden xl:inline text-xs text-white/40 font-heading">Drag or click to add:</span>
        <DataMenu />
        <ModelMenu />
        <ActionsMenu />
        <div className="w-px h-5 bg-white/10 self-center" />
        <RuleBasedMenu />
      </div>
      <SelectionBar />
    </div>
  )
}
