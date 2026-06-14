'use client'

import { useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core'
import TopNav from '@/components/layout/TopNav'
import DataBank from '@/components/data-bank/DataBank'
import DataItemCard from '@/components/data-bank/DataItemCard'
const DatasetCanvas = dynamic(() => import('@/components/canvas/DatasetCanvas'), { ssr: false })
import CanvasToolbar from '@/components/canvas/CanvasToolbar'
import BlockInspector from '@/components/inspector/BlockInspector'
import ModelInspector from '@/components/inspector/ModelInspector'
import RLInspector from '@/components/inspector/RLInspector'
import SensorInspector from '@/components/inspector/SensorInspector'
import ConditionInspector from '@/components/inspector/ConditionInspector'
import LogicInspector from '@/components/inspector/LogicInspector'
import TimerInspector from '@/components/inspector/TimerInspector'
import BadgeToast from '@/components/gamification/BadgeToast'
import EducationalOverlay from '@/components/feedback/EducationalOverlay'
import TestResultsModal from '@/components/inspector/TestResultsModal'
import ClusterResultsModal from '@/components/inspector/ClusterResultsModal'
import LabellingModal from '@/components/inspector/LabellingModal'
import { useDatasetStore } from '@/store/useDatasetStore'
import { useUIStore } from '@/store/useUIStore'
import { useModelStore } from '@/store/useModelStore'
import { useRLStore } from '@/store/useRLStore'
import { useWorkflowStore } from '@/store/useWorkflowStore'
import { useRuleStore } from '@/store/useRuleStore'
import { useDragFromBank } from '@/hooks/useDragFromBank'
import { saveToLocalStorage, loadFromLocalStorage } from '@/store/persistence'

function PropertiesIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="6" x2="20" y2="6" />
      <circle cx="15" cy="6" r="2" fill="currentColor" stroke="none" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <circle cx="9" cy="12" r="2" fill="currentColor" stroke="none" />
      <line x1="4" y1="18" x2="20" y2="18" />
      <circle cx="17" cy="18" r="2" fill="currentColor" stroke="none" />
    </svg>
  )
}

function PanelToggleIcon({ side }: { side: 'left' | 'right' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      {side === 'left' ? (
        <>
          <rect x="3" y="4" width="6.5" height="16" rx="2.5" fill="currentColor" fillOpacity="0.45" stroke="none" />
          <line x1="9.5" y1="4" x2="9.5" y2="20" />
        </>
      ) : (
        <>
          <rect x="14.5" y="4" width="6.5" height="16" rx="2.5" fill="currentColor" fillOpacity="0.45" stroke="none" />
          <line x1="14.5" y1="4" x2="14.5" y2="20" />
        </>
      )}
    </svg>
  )
}

function GettingStartedPanel() {
  const steps = [
    { emoji: '📸', step: '1', title: 'Feed it photos', body: <>Upload some <span className="text-pink-300 font-semibold">cat photos</span> and some <span className="text-teal-300 font-semibold">dog photos</span> using the panel on the left. Try at least 5 of each!</> },
    { emoji: '🗂️', step: '2', title: 'Teach it the names', body: <>Drag a <span className="text-violet-300 font-semibold">Labelled block</span> onto the canvas. Make two labels: <span className="text-pink-300 font-semibold">Cat 🐱</span> and <span className="text-teal-300 font-semibold">Dog 🐶</span>, then sort your photos into them.</> },
    { emoji: '🤖', step: '3', title: 'Add a Brain', body: <>Drag a <span className="text-teal-300 font-semibold">Model block</span> onto the canvas. Double-click it, link it to your labelled block, and pick <span className="text-emerald-300 font-semibold">Image Supervised</span>.</> },
    { emoji: '🚀', step: '4', title: 'Train it!', body: <>Hit <span className="text-amber-300 font-semibold">Train Model</span> and watch your AI learn! More photos = <span className="text-emerald-300 font-semibold">smarter AI</span> 🧠</> },
    { emoji: '🎯', step: '5', title: 'Can you trick it?', body: <>Drop in a photo it&apos;s never seen. Does it guess <span className="text-pink-300 font-semibold">Cat</span> or <span className="text-teal-300 font-semibold">Dog</span>? Try to fool it! 😄</> },
  ]

  return (
    <div className="glass-panel flex flex-col gap-4 p-5 min-h-full">
      <div>
        <p className="text-base font-heading font-extrabold text-white">🐱 vs 🐶</p>
        <p className="text-sm font-heading font-bold text-violet-300 mt-0.5">
          Build an AI that knows the difference!
        </p>
      </div>

      {steps.map(({ emoji, step, title, body }) => (
        <div key={step} className="flex gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-base">
            {emoji}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-heading font-bold text-white">
              Step {step}: {title}
            </p>
            <p className="text-xs text-white/55 font-body leading-relaxed mt-0.5">{body}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function DatasetBuilderPage() {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const { activeItem, activeTrainedModel, activeSavedDataset, activePaletteBlock, handleDragStart, handleDragEnd, selectionCount } = useDragFromBank()

  const bankItems = useDatasetStore((s) => s.bankItems)
  const labelledBlocks = useDatasetStore((s) => s.labelledBlocks)
  const unlabelledBlocks = useDatasetStore((s) => s.unlabelledBlocks)
  const splitConfig = useDatasetStore((s) => s.splitConfig)
  const currentDatasetName = useDatasetStore((s) => s.currentDatasetName)
  const savedDatasets = useDatasetStore((s) => s.savedDatasets)
  const earnedBadges = useUIStore((s) => s.earnedBadges)
  const firstVisit = useUIStore((s) => s.firstVisit)
  const setShowEducationalOverlay = useUIStore((s) => s.setShowEducationalOverlay)
  const selectedBlockId = useUIStore((s) => s.selectedBlockId)
  const selectedBlockType = useUIStore((s) => s.selectedBlockType)
  const clearSelectedBlock = useUIStore((s) => s.clearSelectedBlock)
  const leftPanelCollapsed = useUIStore((s) => s.leftPanelCollapsed)
  const rightPanelCollapsed = useUIStore((s) => s.rightPanelCollapsed)
  const toggleLeftPanel = useUIStore((s) => s.toggleLeftPanel)
  const toggleRightPanel = useUIStore((s) => s.toggleRightPanel)
  const modelBlocks = useModelStore((s) => s.modelBlocks)
  const trainedModels = useModelStore((s) => s.trainedModels)
  const rlBlocks = useRLStore((s) => s.rlBlocks)
  const doorBlocks = useWorkflowStore((s) => s.doorBlocks)
  const bulbBlocks = useWorkflowStore((s) => s.bulbBlocks)
  const sensorBlocks = useRuleStore((s) => s.sensorBlocks)
  const conditionBlocks = useRuleStore((s) => s.conditionBlocks)
  const switchBlocks = useRuleStore((s) => s.switchBlocks)
  const logicBlocks = useRuleStore((s) => s.logicBlocks)
  const fanBlocks = useRuleStore((s) => s.fanBlocks)
  const alarmBlocks = useRuleStore((s) => s.alarmBlocks)
  const acBlocks = useRuleStore((s) => s.acBlocks)
  const timerBlocks = useRuleStore((s) => s.timerBlocks)

  // Hydrate from localStorage on mount
  const hydrated = useRef(false)
  useEffect(() => {
    if (hydrated.current) return
    hydrated.current = true
    const saved = loadFromLocalStorage()
    if (saved) {
      useDatasetStore.setState({
        bankItems: saved.bankItems,
        labelledBlocks: saved.labelledBlocks,
        unlabelledBlocks: saved.unlabelledBlocks,
        splitConfig: saved.splitConfig,
        currentDatasetName: saved.currentDatasetName ?? 'My Dataset',
        savedDatasets: saved.savedDatasets ?? [],
      })
      useUIStore.setState({ earnedBadges: saved.earnedBadges })
      useModelStore.setState({
        modelBlocks: saved.modelBlocks ?? [],
        trainedModels: saved.trainedModels ?? [],
      })
      if (saved.rlBlocks) {
        useRLStore.setState({ rlBlocks: saved.rlBlocks })
      }
      if (saved.doorBlocks) {
        useWorkflowStore.setState({ doorBlocks: saved.doorBlocks })
      }
      if (saved.bulbBlocks) {
        useWorkflowStore.setState({ bulbBlocks: saved.bulbBlocks })
      }
      if (saved.sensorBlocks) {
        useRuleStore.setState({ sensorBlocks: saved.sensorBlocks })
      }
      if (saved.conditionBlocks) {
        useRuleStore.setState({ conditionBlocks: saved.conditionBlocks })
      }
      if (saved.switchBlocks) {
        useRuleStore.setState({ switchBlocks: saved.switchBlocks })
      }
      if (saved.logicBlocks) {
        useRuleStore.setState({ logicBlocks: saved.logicBlocks })
      }
      if (saved.fanBlocks) {
        useRuleStore.setState({ fanBlocks: saved.fanBlocks })
      }
      if (saved.alarmBlocks) {
        useRuleStore.setState({ alarmBlocks: saved.alarmBlocks })
      }
      if (saved.acBlocks) {
        useRuleStore.setState({ acBlocks: saved.acBlocks })
      }
      if (saved.timerBlocks) {
        useRuleStore.setState({ timerBlocks: saved.timerBlocks })
      }
    }

    if (firstVisit) setShowEducationalOverlay(true)
  }, [firstVisit, setShowEducationalOverlay])

  // Persist on every change
  useEffect(() => {
    if (!hydrated.current) return
    saveToLocalStorage({
      bankItems,
      labelledBlocks,
      unlabelledBlocks,
      splitConfig,
      earnedBadges,
      currentDatasetName,
      savedDatasets,
      modelBlocks,
      trainedModels,
      rlBlocks,
      doorBlocks,
      bulbBlocks,
      sensorBlocks,
      conditionBlocks,
      switchBlocks,
      logicBlocks,
      fanBlocks,
      alarmBlocks,
      acBlocks,
      timerBlocks,
    })
  }, [bankItems, labelledBlocks, unlabelledBlocks, splitConfig, earnedBadges, currentDatasetName, savedDatasets, modelBlocks, trainedModels, rlBlocks, doorBlocks, bulbBlocks, sensorBlocks, conditionBlocks, switchBlocks, logicBlocks, fanBlocks, alarmBlocks, acBlocks, timerBlocks])

  // Clear selection if its block was deleted (e.g. via the node's own × button),
  // so the right panel falls back to the Getting Started view instead of going blank.
  useEffect(() => {
    if (!selectedBlockId) return
    const exists = (() => {
      switch (selectedBlockType) {
        case 'labelled': return labelledBlocks.some((b) => b.id === selectedBlockId)
        case 'unlabelled': return unlabelledBlocks.some((b) => b.id === selectedBlockId)
        case 'model': return modelBlocks.some((b) => b.id === selectedBlockId)
        case 'rl-gridworld': return rlBlocks.some((b) => b.id === selectedBlockId)
        case 'sensor': return sensorBlocks.some((b) => b.id === selectedBlockId)
        case 'condition': return conditionBlocks.some((b) => b.id === selectedBlockId)
        case 'timer': return timerBlocks.some((b) => b.id === selectedBlockId)
        case 'switch': return switchBlocks.some((b) => b.id === selectedBlockId)
        case 'logic': return logicBlocks.some((b) => b.id === selectedBlockId)
        case 'fan': return fanBlocks.some((b) => b.id === selectedBlockId)
        case 'alarm': return alarmBlocks.some((b) => b.id === selectedBlockId)
        case 'ac': return acBlocks.some((b) => b.id === selectedBlockId)
        case 'door': return doorBlocks.some((b) => b.id === selectedBlockId)
        case 'bulb': return bulbBlocks.some((b) => b.id === selectedBlockId)
        default: return false
      }
    })()
    if (!exists) clearSelectedBlock()
  }, [selectedBlockId, selectedBlockType, labelledBlocks, unlabelledBlocks, modelBlocks, rlBlocks, sensorBlocks, conditionBlocks, timerBlocks, switchBlocks, logicBlocks, fanBlocks, alarmBlocks, acBlocks, doorBlocks, bulbBlocks, clearSelectedBlock])

  // Check data-scientist badge
  useEffect(() => {
    const { bankItems: bi, labelledBlocks: lb, validationResult, splitConfig: sc } = useDatasetStore.getState()
    const hasItems = bi.length > 0
    const hasLabelledItems = lb.some((b) => b.labels.some((l) => l.itemIds.length > 0))
    const validated = !!validationResult?.passed
    const splitCustomized = sc.trainPercent !== 70 || sc.testPercent !== 20
    if (hasItems && hasLabelledItems && validated && splitCustomized) {
      useUIStore.getState().earnBadge('data-scientist')
    }
  })

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <DragOverlay dropAnimation={null}>
        {activeItem && (
          <div className="relative">
            <DataItemCard item={activeItem} isOverlay />
            {selectionCount > 1 && (
              <span className="absolute -top-2 -right-2 bg-violet-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shadow-lg">
                {selectionCount}
              </span>
            )}
          </div>
        )}
        {activeTrainedModel && (
          <div
            className="glass-card px-3 py-2 flex items-center gap-2 shadow-xl"
            style={{ border: '1px solid rgba(52,211,153,0.4)', pointerEvents: 'none' }}
          >
            <span className="text-base">🤖</span>
            <span className="text-sm font-heading font-bold text-white">{activeTrainedModel.name}</span>
            <span className="text-xs text-emerald-400 font-body">✓ Trained</span>
          </div>
        )}
        {activeSavedDataset && (
          <div
            className="glass-card px-3 py-2 flex items-center gap-2 shadow-xl"
            style={{ border: '1px solid rgba(139,92,246,0.4)', pointerEvents: 'none' }}
          >
            <span className="text-base">💾</span>
            <span className="text-sm font-heading font-bold text-white">{activeSavedDataset.name}</span>
            <span className="text-xs text-violet-400 font-body">drop to load</span>
          </div>
        )}
        {activePaletteBlock && (
          <div
            className="glass-card px-3 py-2 flex items-center gap-2 shadow-xl"
            style={{ border: '1px solid rgba(139,92,246,0.4)', pointerEvents: 'none' }}
          >
            <span className="text-base">
              {activePaletteBlock === 'door' ? '🚪'
                : activePaletteBlock === 'bulb' ? '💡'
                : activePaletteBlock === 'fan' ? '🌀'
                : activePaletteBlock === 'alarm' ? '🚨'
                : activePaletteBlock === 'sensor-temperature' ? '🌡️'
                : activePaletteBlock === 'sensor-light' ? '💡'
                : activePaletteBlock === 'sensor-motion' ? '👁️'
                : activePaletteBlock === 'sensor-humidity' ? '💧'
                : activePaletteBlock === 'sensor-text' ? '📝'
                : activePaletteBlock === 'condition' ? '📋'
                : activePaletteBlock === 'switch' ? '🎚️'
                : activePaletteBlock === 'logic-and' ? '∧'
                : activePaletteBlock === 'logic-or' ? '∨'
                : activePaletteBlock === 'logic-not' ? '¬'
                : '📦'}
            </span>
            <span className="text-sm font-heading font-bold text-white capitalize">
              {activePaletteBlock.replace(/-/g, ' ')}
            </span>
            <span className="text-xs text-violet-400 font-body">drop on canvas</span>
          </div>
        )}
      </DragOverlay>

      <div className="h-screen flex flex-col overflow-hidden">
        <TopNav />

        <div className="relative flex-1 overflow-hidden">
          {/* Full-bleed canvas */}
          <div className="absolute inset-0">
            <DatasetCanvas />
          </div>

          {/* Floating toolbar — top center */}
          <div className="absolute top-4 left-[17rem] right-[18rem] 2xl:left-[20rem] 2xl:right-[22rem] z-20 flex justify-center pointer-events-none">
            <div className="pointer-events-auto max-w-full">
              <CanvasToolbar />
            </div>
          </div>

          {/* Floating left panel — Data Bank */}
          {leftPanelCollapsed ? (
            <button
              onClick={toggleLeftPanel}
              title="Show Data Bank"
              className="absolute top-4 left-4 z-20 glass-panel w-10 h-10 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              <PanelToggleIcon side="left" />
            </button>
          ) : (
            <div className="absolute top-4 left-4 z-20 w-60 2xl:w-72 h-[calc(100%-2rem)] flex flex-col">
              <button
                onClick={toggleLeftPanel}
                title="Hide Data Bank"
                className="absolute -top-3 -right-3 z-10 glass-panel w-7 h-7 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              >
                <PanelToggleIcon side="left" />
              </button>
              <div className="flex flex-col gap-3 overflow-y-auto min-h-0 flex-1">
                <DataBank />
              </div>
            </div>
          )}

          {/* Floating right panel — Inspector or Getting Started */}
          {rightPanelCollapsed ? (
            <button
              onClick={toggleRightPanel}
              title="Show Inspector"
              className="absolute top-4 right-4 z-20 glass-panel w-10 h-10 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              <PropertiesIcon />
            </button>
          ) : (
            <div className="absolute top-4 right-4 z-20 w-64 2xl:w-80 h-[calc(100%-2rem)] flex flex-col">
              <button
                onClick={toggleRightPanel}
                title="Hide Inspector"
                className="absolute -top-3 -left-3 z-10 glass-panel w-7 h-7 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              >
                <PropertiesIcon />
              </button>
              <div className="flex flex-col gap-3 overflow-y-auto min-h-0 flex-1">
                {selectedBlockId && selectedBlockType === 'rl-gridworld' ? (
                  <RLInspector key={selectedBlockId} />
                ) : selectedBlockId && selectedBlockType === 'model' ? (
                  <ModelInspector key={selectedBlockId} />
                ) : selectedBlockId && selectedBlockType === 'sensor' ? (
                  <SensorInspector key={selectedBlockId} />
                ) : selectedBlockId && selectedBlockType === 'condition' ? (
                  <ConditionInspector key={selectedBlockId} />
                ) : selectedBlockId && selectedBlockType === 'timer' ? (
                  <TimerInspector key={selectedBlockId} />
                ) : selectedBlockId && (selectedBlockType === 'switch' || selectedBlockType === 'logic' || selectedBlockType === 'fan' || selectedBlockType === 'alarm' || selectedBlockType === 'ac' || selectedBlockType === 'door' || selectedBlockType === 'bulb') ? (
                  <LogicInspector key={selectedBlockId} />
                ) : selectedBlockId ? (
                  <BlockInspector key={selectedBlockId} />
                ) : (
                  <GettingStartedPanel />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <BadgeToast />
      <EducationalOverlay />
      <TestResultsModal />
      <ClusterResultsModal />
      <LabellingModal />
    </DndContext>
  )
}
