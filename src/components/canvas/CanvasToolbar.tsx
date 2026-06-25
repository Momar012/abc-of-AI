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
import { Reorder, motion, AnimatePresence } from 'framer-motion'
import { exportRuleApp, validateExportSelection, exportAIModel, validateAIModelExport, getExportCards, ExportCardInfo } from '@/lib/exportRuleApp'

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
  const [instructions, setInstructions] = useState('')
  const [cardOrder, setCardOrder] = useState<ExportCardInfo[]>([])
  const [activeTab, setActiveTab] = useState(0)
  const [isExporting, setIsExporting] = useState(false)

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
      setShowNaming(false); setTheme('space'); setLayout('classic'); setCreatorName(''); setInstructions(''); setCardOrder([]); setActiveTab(0); setIsExporting(false)
    }
  }, [count, canvasSelection])

  useEffect(() => {
    if (showNaming) {
      const ids = new Set(canvasSelection.map(n => n.id))
      const hasOutputs = canvasSelection.some(n => ['fan', 'alarm', 'ac', 'door', 'bulb'].includes(n.type))
      if (hasOutputs) setCardOrder(getExportCards(ids))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showNaming])

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
    setIsExporting(true)
    setTimeout(() => {
      const name = appName.trim() || (derivedMode === 'ai-model' ? 'My AI Model' : 'My AI App')
      if (derivedMode === 'ai-model') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        exportAIModel(name, selectedIds, theme as any, creatorName.trim(), instructions.trim())
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        exportRuleApp(name, selectedIds, theme as any, layout as any, creatorName.trim(), instructions.trim(), cardOrder.map(c => c.id))
      }
      setIsExporting(false)
      setShowNaming(false)
      setAppName('My AI App')
      setTheme('space')
      setLayout('classic')
      setCreatorName('')
      setInstructions('')
      setCardOrder([])
      setActiveTab(0)
    }, 10000)
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
    const inputCards  = cardOrder.filter(c => c.category === 'input')
    const outputCards = cardOrder.filter(c => c.category === 'output')
    const inputCls = "w-full bg-white/[0.06] [color-scheme:dark] border border-white/12 rounded-lg px-2.5 py-1.5 text-xs text-white font-heading outline-none focus:border-violet-400/50 focus:bg-white/10 transition-all placeholder:text-white/25"

    const hasCards = !isAI && cardOrder.length > 0
    const tabs = hasCards
      ? [{ id: 'info', label: '📝 Info' }, { id: 'arrange', label: '📋 Arrange' }, { id: 'style', label: '🎨 Style' }]
      : [{ id: 'info', label: '📝 Info' }, { id: 'style', label: '🎨 Style' }]

    const tab = tabs[activeTab]?.id ?? 'info'

    return (
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.16, ease: 'easeOut' }}
        className="glass-panel rounded-2xl overflow-hidden shadow-2xl shadow-black/50"
        style={{ width: 'min(400px, calc(100vw - 1.5rem))' }}
      >
        {/* ── Header ─────────────────────────────────── */}
        <div className="relative flex items-center gap-2.5 px-4 py-2.5 bg-gradient-to-r from-violet-600/22 via-violet-500/10 to-teal-500/8 border-b border-white/8">
          <span className="text-base leading-none">{isAI ? '🧠' : '🚀'}</span>
          <span className="text-[10px] font-heading font-bold text-violet-300/55 uppercase tracking-[0.14em]">Export</span>
          <span className="text-white/15 text-xs">·</span>
          <span className="text-xs font-heading font-bold text-white/80">{isAI ? 'AI Model' : 'App'}</span>
          <button
            onClick={() => setShowNaming(false)}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-md text-white/28 hover:text-white/75 hover:bg-white/10 transition-colors text-xs"
          >
            ✕
          </button>
        </div>

        {/* ── Tabs ───────────────────────────────────── */}
        {!isExporting && <div className="flex gap-1 px-4 pt-3">
          {tabs.map((t, i) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(i)}
              className={`flex-1 py-1.5 rounded-lg text-[0.65rem] font-heading font-bold transition-all ${
                activeTab === i
                  ? 'bg-violet-500/20 text-white border border-violet-400/40'
                  : 'text-white/30 border border-white/8 hover:text-white/55 hover:border-white/18 hover:bg-white/5'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>}

        {/* ── Tab content — fixed height ──────────────── */}
        <div className="px-4 pt-3 pb-2 h-[172px] overflow-y-auto">
          {isExporting ? (
            <div className="h-full flex flex-col items-center justify-center gap-4">
              {(isAI
                ? [
                    { icon: '🧠', text: 'Reading your model...' },
                    { icon: '🎨', text: 'Applying your theme...' },
                    { icon: '📦', text: 'Packaging your model...' },
                  ]
                : [
                    { icon: '🧱', text: 'Assembling your blocks...' },
                    { icon: '🎨', text: 'Applying your theme...' },
                    { icon: '📦', text: 'Packaging your app...' },
                  ]
              ).map((step, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 3, duration: 0.28 }}
                  className="flex items-center gap-3 w-full"
                >
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: i * 3 + 0.15, type: 'spring', stiffness: 300 }}
                    className="text-base w-5 text-center flex-shrink-0"
                  >
                    {step.icon}
                  </motion.span>
                  <span className="text-xs font-heading text-white/60 flex-1">{step.text}</span>
                  <motion.span
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 3 + 0.38, type: 'spring', stiffness: 400 }}
                    className="text-emerald-400 text-sm font-bold flex-shrink-0"
                  >
                    ✓
                  </motion.span>
                </motion.div>
              ))}
            </div>
          ) : null}
          {!isExporting && <AnimatePresence mode="wait">
            {tab === 'info' && (
              <motion.div key="info"
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.14 }}
                className="flex flex-col gap-2.5"
              >
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-heading font-bold text-white/35 uppercase tracking-wider">
                    {isAI ? 'Model Name' : 'App Name'}
                  </label>
                  <input
                    autoFocus
                    type="text"
                    value={appName}
                    onChange={(e) => setAppName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); if (e.key === 'Escape') setShowNaming(false) }}
                    maxLength={40}
                    placeholder={isAI ? 'My AI Model' : 'My AI App'}
                    className={inputCls}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-heading font-bold text-white/35 uppercase tracking-wider">
                    Your Name <span className="normal-case font-normal text-white/22">· optional</span>
                  </label>
                  <input
                    type="text"
                    value={creatorName}
                    onChange={(e) => setCreatorName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Escape') setShowNaming(false) }}
                    maxLength={30}
                    placeholder="e.g. Alex"
                    className={inputCls}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-heading font-bold text-white/35 uppercase tracking-wider">
                    Instructions <span className="normal-case font-normal text-white/22">· optional</span>
                  </label>
                  <textarea
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    maxLength={400}
                    rows={2}
                    placeholder="What does this app do? How should someone use it?"
                    className={`${inputCls} resize-none leading-relaxed`}
                  />
                </div>
              </motion.div>
            )}

            {tab === 'arrange' && (
              <motion.div key="arrange"
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.14 }}
                className="flex flex-col gap-2"
              >
                <label className="text-[9px] font-heading font-bold text-white/35 uppercase tracking-wider">
                  Arrange Cards <span className="normal-case font-normal text-white/20">drag to reorder</span>
                </label>
                <div className="flex gap-2">
                  {inputCards.length > 0 && (
                    <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                      <p className="text-[8px] font-heading font-bold text-white/22 uppercase tracking-wider mb-0.5">Inputs</p>
                      <Reorder.Group axis="y" values={inputCards}
                        onReorder={(ni) => setCardOrder([...ni, ...outputCards])}
                        className="flex flex-col gap-0.5"
                      >
                        {inputCards.map(card => (
                          <Reorder.Item key={card.id} value={card}
                            className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/8 cursor-grab active:cursor-grabbing select-none hover:bg-white/8 transition-colors"
                          >
                            <span className="text-white/22 text-[0.55rem] select-none">⠿</span>
                            <span className="text-[0.62rem] font-heading text-white/65 truncate">{card.icon} {card.name}</span>
                          </Reorder.Item>
                        ))}
                      </Reorder.Group>
                    </div>
                  )}
                  {outputCards.length > 0 && (
                    <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                      <p className="text-[8px] font-heading font-bold text-white/22 uppercase tracking-wider mb-0.5">Outputs</p>
                      <Reorder.Group axis="y" values={outputCards}
                        onReorder={(no) => setCardOrder([...inputCards, ...no])}
                        className="flex flex-col gap-0.5"
                      >
                        {outputCards.map(card => (
                          <Reorder.Item key={card.id} value={card}
                            className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/8 cursor-grab active:cursor-grabbing select-none hover:bg-white/8 transition-colors"
                          >
                            <span className="text-white/22 text-[0.55rem] select-none">⠿</span>
                            <span className="text-[0.62rem] font-heading text-white/65 truncate">{card.icon} {card.name}</span>
                          </Reorder.Item>
                        ))}
                      </Reorder.Group>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {tab === 'style' && (
              <motion.div key="style"
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.14 }}
                className="flex flex-col gap-3"
              >
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-heading font-bold text-white/35 uppercase tracking-wider">Theme</label>
                  <div className="flex gap-1.5">
                    {SWATCHES.map((s) => (
                      <button
                        key={s.id}
                        title={s.label}
                        onClick={() => setTheme(s.id)}
                        style={{ background: `linear-gradient(135deg,${s.from},${s.to})` }}
                        className={`relative flex-1 h-12 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all ${
                          theme === s.id
                            ? 'ring-[2.5px] ring-white scale-[1.08] shadow-lg'
                            : 'opacity-35 hover:opacity-75 hover:scale-[1.03]'
                        }`}
                      >
                        {theme === s.id && (
                          <span className="absolute top-0.5 right-1 text-[0.55rem] text-white font-bold leading-none drop-shadow">✓</span>
                        )}
                        <span className="text-lg leading-none">{s.emoji}</span>
                        <span className="text-[0.48rem] text-white font-heading font-bold leading-none tracking-wide">{s.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                {!isAI && (
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-heading font-bold text-white/35 uppercase tracking-wider">Layout</label>
                    <div className="flex gap-1.5">
                      {LAYOUTS.map((l) => (
                        <button
                          key={l.id}
                          onClick={() => setLayout(l.id)}
                          className={`flex-1 py-2 rounded-lg text-[0.62rem] font-heading font-bold transition-all ${
                            layout === l.id
                              ? 'bg-violet-500/50 text-white border-2 border-violet-300/80 shadow-[0_0_10px_rgba(124,58,237,0.35)]'
                              : 'text-white/40 border border-white/12 hover:text-white/65 hover:border-white/25 hover:bg-white/5'
                          }`}
                        >
                          {l.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>}
        </div>

        {/* ── Footer ─────────────────────────────────── */}
        {isExporting ? (
          <div className="px-4 pb-3 pt-2 border-t border-white/6 flex justify-center">
            <span className="text-[10px] font-heading text-white/30 animate-pulse">Preparing download…</span>
          </div>
        ) : (
        <div className="px-4 pb-3 pt-2 flex gap-2 border-t border-white/6">
          {activeTab > 0 ? (
            <button
              onClick={() => setActiveTab(t => t - 1)}
              className="px-4 py-2 rounded-xl text-xs font-heading font-bold bg-white/5 hover:bg-white/8 text-white/38 hover:text-white/65 border border-white/8 transition-all"
            >
              ← Back
            </button>
          ) : (
            <button
              onClick={() => setShowNaming(false)}
              className="px-4 py-2 rounded-xl text-xs font-heading font-bold bg-white/5 hover:bg-white/8 text-white/38 hover:text-white/65 border border-white/8 transition-all"
            >
              Cancel
            </button>
          )}
          {activeTab < tabs.length - 1 ? (
            <button
              onClick={() => setActiveTab(t => t + 1)}
              className="flex-1 py-2 rounded-xl text-xs font-heading font-bold bg-white/10 hover:bg-white/15 text-white/80 border border-white/15 transition-all"
            >
              Next →
            </button>
          ) : (
            <button
              onClick={handleConfirm}
              className="flex-1 py-2 rounded-xl text-xs font-heading font-bold bg-gradient-to-r from-violet-500 to-teal-400 text-white hover:shadow-[0_0_18px_rgba(124,58,237,0.45)] hover:brightness-105 active:scale-[0.99] transition-all"
            >
              📥 Download {isAI ? 'Model' : 'App'}
            </button>
          )}
        </div>
        )}
      </motion.div>
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
