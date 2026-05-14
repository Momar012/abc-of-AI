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
import BadgeToast from '@/components/gamification/BadgeToast'
import EducationalOverlay from '@/components/feedback/EducationalOverlay'
import TestResultsModal from '@/components/inspector/TestResultsModal'
import ClusterResultsModal from '@/components/inspector/ClusterResultsModal'
import LabellingModal from '@/components/inspector/LabellingModal'
import { useDatasetStore } from '@/store/useDatasetStore'
import { useUIStore } from '@/store/useUIStore'
import { useModelStore } from '@/store/useModelStore'
import { useRLStore } from '@/store/useRLStore'
import { useDragFromBank } from '@/hooks/useDragFromBank'
import { saveToLocalStorage, loadFromLocalStorage } from '@/store/persistence'

function GettingStartedPanel() {
  const steps = [
    { emoji: '📸', step: '1', title: 'Feed it photos', body: 'Upload some cat photos and some dog photos using the panel on the left. Try at least 5 of each!' },
    { emoji: '🗂️', step: '2', title: 'Teach it the names', body: 'Drag a Labelled block onto the canvas. Make two labels: Cat 🐱 and Dog 🐶, then sort your photos into them.' },
    { emoji: '🤖', step: '3', title: 'Add a Brain', body: 'Drag a Model block onto the canvas. Double-click it, link it to your labelled block, and pick Image Supervised.' },
    { emoji: '🚀', step: '4', title: 'Train it!', body: 'Hit Train Model and watch your AI learn! More photos = smarter AI 🧠' },
    { emoji: '🎯', step: '5', title: 'Can you trick it?', body: "Drop in a photo it's never seen. Does it guess Cat or Dog? Try to fool it! 😄" },
  ]

  return (
    <div className="glass-card flex flex-col gap-4 p-5">
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
  const { activeItem, activeTrainedModel, activeSavedDataset, handleDragStart, handleDragEnd, selectionCount } = useDragFromBank()

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
  const modelBlocks = useModelStore((s) => s.modelBlocks)
  const trainedModels = useModelStore((s) => s.trainedModels)
  const rlBlocks = useRLStore((s) => s.rlBlocks)

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
    })
  }, [bankItems, labelledBlocks, unlabelledBlocks, splitConfig, earnedBadges, currentDatasetName, savedDatasets, modelBlocks, trainedModels, rlBlocks])

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
      </DragOverlay>

      <div className="h-screen flex flex-col overflow-hidden">
        <TopNav />

        <div className="flex flex-1 gap-4 p-4 overflow-hidden">
          {/* Left panel — Data Bank + My Datasets + My Models */}
          <div className="flex-shrink-0 w-72 flex flex-col gap-3 overflow-hidden min-h-0">
            <DataBank />
          </div>

          {/* Center — Canvas */}
          <div className="flex-1 flex flex-col gap-3 min-w-0">
            <CanvasToolbar />
            <div className="flex-1 glass-card overflow-hidden" style={{ minHeight: 400 }}>
              <DatasetCanvas />
            </div>
          </div>

          {/* Right panel — Model Inspector, Block Inspector, or Validation + Split */}
          <div className="flex-shrink-0 w-80 flex flex-col gap-3 overflow-y-auto">
            {selectedBlockId && selectedBlockType === 'rl-gridworld' ? (
              <RLInspector key={selectedBlockId} />
            ) : selectedBlockId && selectedBlockType === 'model' ? (
              <ModelInspector key={selectedBlockId} />
            ) : selectedBlockId ? (
              <BlockInspector key={selectedBlockId} />
            ) : (
              <GettingStartedPanel />
            )}
          </div>
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
