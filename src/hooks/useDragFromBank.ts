'use client'

import { useState } from 'react'
import { DragStartEvent, DragEndEvent } from '@dnd-kit/core'
import { DataItem, SavedDataset } from '@/types/dataset'
import { TrainedModel } from '@/types/model'
import { useDatasetStore } from '@/store/useDatasetStore'
import { useModelStore } from '@/store/useModelStore'
import { useUIStore } from '@/store/useUIStore'

export function useDragFromBank() {
  const [activeItem, setActiveItem] = useState<DataItem | null>(null)
  const [activeTrainedModel, setActiveTrainedModel] = useState<TrainedModel | null>(null)
  const [activeSavedDataset, setActiveSavedDataset] = useState<SavedDataset | null>(null)

  const addItemToBlock = useDatasetStore((s) => s.addItemToBlock)
  const assignItemToUnlabelled = useDatasetStore((s) => s.assignItemToUnlabelled)
  const addDatasetToCanvas = useDatasetStore((s) => s.addDatasetToCanvas)
  const labelledBlocks = useDatasetStore((s) => s.labelledBlocks)
  const addModelBlockFromSaved = useModelStore((s) => s.addModelBlockFromSaved)
  const earnBadge = useUIStore((s) => s.earnBadge)
  const addToast = useUIStore((s) => s.addToast)

  const handleDragStart = (event: DragStartEvent) => {
    const dragType = event.active.data.current?.type
    if (dragType === 'trained-model') {
      setActiveTrainedModel(event.active.data.current?.model as TrainedModel)
      return
    }
    if (dragType === 'saved-dataset') {
      setActiveSavedDataset(event.active.data.current?.dataset as SavedDataset)
      return
    }
    const item = event.active.data.current?.item as DataItem | undefined
    if (item) setActiveItem(item)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    // Handle trained-model drag onto canvas
    if (active.data.current?.type === 'trained-model') {
      setActiveTrainedModel(null)
      if (over?.id === 'canvas-drop') {
        const model = active.data.current?.model as TrainedModel
        if (model) addModelBlockFromSaved(model)
      }
      return
    }

    // Handle saved-dataset drag onto canvas
    if (active.data.current?.type === 'saved-dataset') {
      setActiveSavedDataset(null)
      if (over?.id === 'canvas-drop') {
        const dataset = active.data.current?.dataset as SavedDataset
        if (dataset) {
          addDatasetToCanvas(dataset.id)
          addToast(`📂 "${dataset.name}" loaded!`, 'success')
        }
      }
      return
    }

    setActiveItem(null)
    if (!over) return

    const itemId = active.id as string
    const dropData = over.data.current as {
      blockId?: string
      labelId?: string
      unlabelled?: boolean
      blockDrop?: boolean
    } | undefined
    if (!dropData?.blockId) return

    // Determine which items to drop — all selected if dragged item is in selection
    const { selectedBankItemIds, clearBankSelection } = useUIStore.getState()
    const idsToAdd =
      selectedBankItemIds.includes(itemId) && selectedBankItemIds.length > 1
        ? selectedBankItemIds
        : [itemId]

    for (const id of idsToAdd) {
      if (dropData.unlabelled) {
        assignItemToUnlabelled(dropData.blockId, id)
      } else if (dropData.blockDrop) {
        addItemToBlock(dropData.blockId, id)
      }
    }

    if (idsToAdd.length > 0) {
      clearBankSelection()
      earnBadge('dataset-builder')
    }

    const block = labelledBlocks.find((b) => b.id === dropData.blockId)
    if (block && block.labels.length >= 3) earnBadge('label-master')
  }

  const selectionCount = useUIStore((s) => s.selectedBankItemIds.length)

  return { activeItem, activeTrainedModel, activeSavedDataset, handleDragStart, handleDragEnd, selectionCount }
}
