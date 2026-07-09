import { create } from 'zustand'
import { v4 as uuid } from 'uuid'
import {
  DataItem,
  Label,
  LabelledDatasetBlock,
  UnlabelledDatasetBlock,
  ValidationResult,
  SplitConfig,
  SavedDataset,
} from '@/types/dataset'
import { LABEL_PALETTE, DEFAULT_SPLIT } from '@/lib/constants'
import { validateDataset } from '@/lib/validation'

function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteString = atob(base64.split(',')[1] ?? base64)
  const buffer = new Uint8Array(byteString.length)
  for (let i = 0; i < byteString.length; i++) buffer[i] = byteString.charCodeAt(i)
  return new Blob([buffer], { type: mimeType })
}

interface DatasetState {
  bankItems: DataItem[]
  labelledBlocks: LabelledDatasetBlock[]
  unlabelledBlocks: UnlabelledDatasetBlock[]
  validationResult: ValidationResult | null
  splitConfig: SplitConfig
  currentDatasetName: string
  savedDatasets: SavedDataset[]

  addBankItem: (item: Omit<DataItem, 'id' | 'addedAt'>) => void
  removeBankItem: (id: string) => void
  bulkRemoveBankItems: (ids: string[]) => void

  addLabelledBlock: (pos?: { x: number; y: number }) => void
  removeLabelledBlock: (blockId: string) => void
  updateBlockPosition: (blockId: string, type: 'labelled' | 'unlabelled', pos: { x: number; y: number }) => void
  renameLabelledBlock: (blockId: string, name: string) => void

  addLabel: (blockId: string, name?: string) => void
  removeLabel: (blockId: string, labelId: string) => void
  renameLabel: (blockId: string, labelId: string, name: string) => void
  assignItemToLabel: (blockId: string, labelId: string, itemId: string) => void
  removeItemFromLabel: (blockId: string, labelId: string, itemId: string) => void

  // Tabular labelling actions
  addItemToBlock: (blockId: string, itemId: string) => void
  removeItemFromBlock: (blockId: string, itemId: string) => void
  bulkRemoveItemsFromBlock: (blockId: string, itemIds: string[]) => void
  assignItemLabel: (blockId: string, itemId: string, labelId: string | null) => void

  addUnlabelledBlock: (pos?: { x: number; y: number }) => void
  removeUnlabelledBlock: (blockId: string) => void
  renameUnlabelledBlock: (blockId: string, name: string) => void
  assignItemToUnlabelled: (blockId: string, itemId: string) => void
  removeItemFromUnlabelled: (blockId: string, itemId: string) => void
  bulkImportUnlabelledTexts: (blockId: string, texts: string[]) => void

  runValidation: () => void
  clearValidation: () => void
  updateSplit: (field: 'trainPercent' | 'testPercent' | 'validationPercent', value: number) => void

  bulkImportTextRows: (blockId: string, rows: Array<{ label: string; text: string }>) => void

  // Dataset naming + session save
  setDatasetName: (name: string) => void
  saveCurrentDataset: (blockId?: string, blockType?: 'labelled' | 'unlabelled') => void
  loadSavedDataset: (id: string) => void
  addDatasetToCanvas: (id: string, pos?: { x: number; y: number }) => void
  deleteSavedDataset: (id: string) => void
}

export const useDatasetStore = create<DatasetState>((set, get) => ({
  bankItems: [],
  labelledBlocks: [],
  unlabelledBlocks: [],
  validationResult: null,
  splitConfig: { ...DEFAULT_SPLIT },
  currentDatasetName: 'My Dataset',
  savedDatasets: [],

  addBankItem: (item) =>
    set((s) => ({
      bankItems: [{ ...item, id: uuid(), addedAt: Date.now() }, ...s.bankItems],
    })),

  removeBankItem: (id) =>
    set((s) => ({
      bankItems: s.bankItems.filter((i) => i.id !== id),
      labelledBlocks: s.labelledBlocks.map((b) => ({
        ...b,
        itemIds: b.itemIds.filter((i) => i !== id),
        labels: b.labels.map((l) => ({ ...l, itemIds: l.itemIds.filter((i) => i !== id) })),
      })),
      unlabelledBlocks: s.unlabelledBlocks.map((b) => ({
        ...b,
        itemIds: b.itemIds.filter((i) => i !== id),
      })),
    })),

  bulkRemoveBankItems: (ids) =>
    set((s) => {
      const idSet = new Set(ids)
      return {
        bankItems: s.bankItems.filter((i) => !idSet.has(i.id)),
        labelledBlocks: s.labelledBlocks.map((b) => ({
          ...b,
          itemIds: b.itemIds.filter((i) => !idSet.has(i)),
          labels: b.labels.map((l) => ({ ...l, itemIds: l.itemIds.filter((i) => !idSet.has(i)) })),
        })),
        unlabelledBlocks: s.unlabelledBlocks.map((b) => ({
          ...b,
          itemIds: b.itemIds.filter((i) => !idSet.has(i)),
        })),
      }
    }),

  addLabelledBlock: (pos?) =>
    set((s) => ({
      labelledBlocks: [
        ...s.labelledBlocks,
        {
          id: uuid(),
          type: 'labelled',
          position: pos ?? { x: 80 + s.labelledBlocks.length * 40, y: 80 + s.labelledBlocks.length * 40 },
          name: `Dataset ${s.labelledBlocks.length + 1}`,
          itemIds: [],
          labels: [],
        },
      ],
    })),

  removeLabelledBlock: (blockId) =>
    set((s) => ({ labelledBlocks: s.labelledBlocks.filter((b) => b.id !== blockId) })),

  updateBlockPosition: (blockId, type, pos) =>
    set((s) => {
      if (type === 'labelled') {
        return { labelledBlocks: s.labelledBlocks.map((b) => b.id === blockId ? { ...b, position: pos } : b) }
      }
      return { unlabelledBlocks: s.unlabelledBlocks.map((b) => b.id === blockId ? { ...b, position: pos } : b) }
    }),

  renameLabelledBlock: (blockId, name) =>
    set((s) => ({ labelledBlocks: s.labelledBlocks.map((b) => b.id === blockId ? { ...b, name } : b) })),

  addLabel: (blockId, name) =>
    set((s) => ({
      labelledBlocks: s.labelledBlocks.map((b) => {
        if (b.id !== blockId) return b
        const colorIndex = b.labels.length % LABEL_PALETTE.length
        const labelName = name?.trim() || `Label ${b.labels.length + 1}`
        return {
          ...b,
          labels: [...b.labels, { id: uuid(), name: labelName, color: LABEL_PALETTE[colorIndex], itemIds: [] }],
        }
      }),
    })),

  removeLabel: (blockId, labelId) =>
    set((s) => ({
      labelledBlocks: s.labelledBlocks.map((b) => {
        if (b.id !== blockId) return b
        const removedLabel = b.labels.find((l) => l.id === labelId)
        // Move items from deleted label back to unassigned pool
        const freedItemIds = removedLabel?.itemIds ?? []
        return {
          ...b,
          itemIds: [...b.itemIds, ...freedItemIds],
          labels: b.labels.filter((l) => l.id !== labelId),
        }
      }),
    })),

  renameLabel: (blockId, labelId, name) =>
    set((s) => ({
      labelledBlocks: s.labelledBlocks.map((b) =>
        b.id === blockId
          ? { ...b, labels: b.labels.map((l) => l.id === labelId ? { ...l, name } : l) }
          : b
      ),
    })),

  assignItemToLabel: (blockId, labelId, itemId) =>
    set((s) => ({
      labelledBlocks: s.labelledBlocks.map((b) => {
        if (b.id !== blockId) return b
        return {
          ...b,
          labels: b.labels.map((l) => {
            if (l.id !== labelId) return l
            if (l.itemIds.includes(itemId)) return l
            return { ...l, itemIds: [...l.itemIds, itemId] }
          }),
        }
      }),
    })),

  removeItemFromLabel: (blockId, labelId, itemId) =>
    set((s) => ({
      labelledBlocks: s.labelledBlocks.map((b) =>
        b.id === blockId
          ? { ...b, labels: b.labels.map((l) => l.id === labelId ? { ...l, itemIds: l.itemIds.filter((id) => id !== itemId) } : l) }
          : b
      ),
    })),

  // --- Tabular labelling ---

  addItemToBlock: (blockId, itemId) =>
    set((s) => ({
      labelledBlocks: s.labelledBlocks.map((b) => {
        if (b.id !== blockId) return b
        // Ignore if already anywhere in the block
        const alreadyIn = b.itemIds.includes(itemId) || b.labels.some((l) => l.itemIds.includes(itemId))
        if (alreadyIn) return b
        return { ...b, itemIds: [...b.itemIds, itemId] }
      }),
    })),

  removeItemFromBlock: (blockId, itemId) =>
    set((s) => ({
      labelledBlocks: s.labelledBlocks.map((b) => {
        if (b.id !== blockId) return b
        return {
          ...b,
          itemIds: b.itemIds.filter((id) => id !== itemId),
          labels: b.labels.map((l) => ({ ...l, itemIds: l.itemIds.filter((id) => id !== itemId) })),
        }
      }),
    })),

  bulkRemoveItemsFromBlock: (blockId, itemIds) =>
    set((s) => {
      const idSet = new Set(itemIds)
      return {
        labelledBlocks: s.labelledBlocks.map((b) => {
          if (b.id !== blockId) return b
          return {
            ...b,
            itemIds: b.itemIds.filter((id) => !idSet.has(id)),
            labels: b.labels.map((l) => ({ ...l, itemIds: l.itemIds.filter((id) => !idSet.has(id)) })),
          }
        }),
      }
    }),

  assignItemLabel: (blockId, itemId, labelId) =>
    set((s) => ({
      labelledBlocks: s.labelledBlocks.map((b) => {
        if (b.id !== blockId) return b
        // Remove from unassigned pool and all labels first
        const cleanedItemIds = b.itemIds.filter((id) => id !== itemId)
        const cleanedLabels = b.labels.map((l) => ({ ...l, itemIds: l.itemIds.filter((id) => id !== itemId) }))
        if (labelId === null) {
          // Move back to unassigned
          return { ...b, itemIds: [...cleanedItemIds, itemId], labels: cleanedLabels }
        }
        // Assign to specific label
        return {
          ...b,
          itemIds: cleanedItemIds,
          labels: cleanedLabels.map((l) => l.id === labelId ? { ...l, itemIds: [...l.itemIds, itemId] } : l),
        }
      }),
    })),

  // --- Unlabelled blocks ---

  addUnlabelledBlock: (pos?) =>
    set((s) => ({
      unlabelledBlocks: [
        ...s.unlabelledBlocks,
        {
          id: uuid(),
          type: 'unlabelled',
          position: pos ?? { x: 500 + s.unlabelledBlocks.length * 40, y: 80 + s.unlabelledBlocks.length * 40 },
          name: `Unlabelled ${s.unlabelledBlocks.length + 1}`,
          itemIds: [],
        },
      ],
    })),

  removeUnlabelledBlock: (blockId) =>
    set((s) => ({ unlabelledBlocks: s.unlabelledBlocks.filter((b) => b.id !== blockId) })),

  renameUnlabelledBlock: (blockId, name) =>
    set((s) => ({ unlabelledBlocks: s.unlabelledBlocks.map((b) => b.id === blockId ? { ...b, name } : b) })),

  assignItemToUnlabelled: (blockId, itemId) =>
    set((s) => ({
      unlabelledBlocks: s.unlabelledBlocks.map((b) => {
        if (b.id !== blockId) return b
        if (b.itemIds.includes(itemId)) return b
        return { ...b, itemIds: [...b.itemIds, itemId] }
      }),
    })),

  removeItemFromUnlabelled: (blockId, itemId) =>
    set((s) => ({
      unlabelledBlocks: s.unlabelledBlocks.map((b) =>
        b.id === blockId ? { ...b, itemIds: b.itemIds.filter((id) => id !== itemId) } : b
      ),
    })),

  bulkImportUnlabelledTexts: (blockId, texts) =>
    set((s) => {
      if (!texts.length) return s
      const now = Date.now()
      const newItems: DataItem[] = texts.map((text, i) => ({
        id: uuid(),
        type: 'text' as const,
        name: text.length > 40 ? text.slice(0, 40) + '…' : text,
        content: text,
        addedAt: now + i,
      }))
      return {
        bankItems: [...newItems, ...s.bankItems],
        unlabelledBlocks: s.unlabelledBlocks.map((b) =>
          b.id === blockId
            ? { ...b, itemIds: [...newItems.map((it) => it.id), ...b.itemIds] }
            : b
        ),
      }
    }),

  runValidation: () => {
    const state = get()
    const result = validateDataset(state.labelledBlocks, state.bankItems)
    set({ validationResult: result })
  },

  clearValidation: () => set({ validationResult: null }),

  updateSplit: (field, value) =>
    set((s) => {
      const split = { ...s.splitConfig }
      const old = split[field]
      const diff = value - old
      split[field] = value
      const others = (['trainPercent', 'testPercent', 'validationPercent'] as const).filter((f) => f !== field)
      const otherTotal = others.reduce((acc, f) => acc + split[f], 0)
      if (otherTotal > 0) {
        for (const f of others) {
          split[f] = Math.max(1, Math.round(split[f] - diff * (split[f] / otherTotal)))
        }
      }
      const total = split.trainPercent + split.testPercent + split.validationPercent
      if (total !== 100) {
        const last = others[others.length - 1]
        split[last] = Math.max(1, split[last] + (100 - total))
      }
      return { splitConfig: split }
    }),

  bulkImportTextRows: (blockId, rows) =>
    set((s) => {
      const block = s.labelledBlocks.find((b) => b.id === blockId)
      if (!block || !rows.length) return s

      const now = Date.now()
      const newBankItems: DataItem[] = rows.map((row, i) => ({
        id: uuid(),
        type: 'text' as const,
        name: row.text.length > 40 ? row.text.slice(0, 40) + '…' : row.text,
        content: row.text,
        addedAt: now + i,
      }))

      // Build label map (name → id), creating new labels for unseen names
      const labelMap: Record<string, string> = {}
      for (const l of block.labels) labelMap[l.name] = l.id

      const newLabels = block.labels.map((l) => ({ ...l, itemIds: [...l.itemIds] }))
      const uniqueNames = [...new Set(rows.map((r) => r.label))]
      for (const name of uniqueNames) {
        if (!labelMap[name]) {
          const id = uuid()
          const colorIndex = newLabels.length % LABEL_PALETTE.length
          newLabels.push({ id, name, color: LABEL_PALETTE[colorIndex], itemIds: [] })
          labelMap[name] = id
        }
      }

      // Assign each new item to its label
      for (let i = 0; i < rows.length; i++) {
        const labelId = labelMap[rows[i].label]
        const label = newLabels.find((l) => l.id === labelId)
        if (label) label.itemIds.push(newBankItems[i].id)
      }

      return {
        bankItems: [...newBankItems, ...s.bankItems],
        labelledBlocks: s.labelledBlocks.map((b) =>
          b.id === blockId ? { ...b, labels: newLabels } : b
        ),
      }
    }),

  // --- Naming + session save ---

  setDatasetName: (name) => set({ currentDatasetName: name }),

  saveCurrentDataset: (blockId?, blockType?) =>
    set((s) => {
      // Single-block save (from BlockInspector — saves only the selected block)
      if (blockId && blockType === 'labelled') {
        const block = s.labelledBlocks.find((b) => b.id === blockId)
        if (!block) return s
        const usedIds = new Set([...block.itemIds, ...block.labels.flatMap((l) => l.itemIds)])
        const bankItems = s.bankItems.filter((i) => usedIds.has(i.id)).map(({ thumbnailUrl: _, ...rest }) => rest)
        const existingIdx = s.savedDatasets.findIndex((d) => d.name === block.name)
        const snapshot: SavedDataset = {
          id: existingIdx >= 0 ? s.savedDatasets[existingIdx].id : uuid(),
          name: block.name,
          savedAt: Date.now(),
          bankItems,
          labelledBlocks: [{ ...block, itemIds: [...block.itemIds], labels: block.labels.map((l) => ({ ...l, itemIds: [...l.itemIds] })) }],
          unlabelledBlocks: [],
          splitConfig: s.splitConfig,
        }
        if (existingIdx >= 0) { const u = [...s.savedDatasets]; u[existingIdx] = snapshot; return { savedDatasets: u } }
        return { savedDatasets: [snapshot, ...s.savedDatasets] }
      }

      if (blockId && blockType === 'unlabelled') {
        const block = s.unlabelledBlocks.find((b) => b.id === blockId)
        if (!block) return s
        const usedIds = new Set(block.itemIds)
        const bankItems = s.bankItems.filter((i) => usedIds.has(i.id)).map(({ thumbnailUrl: _, ...rest }) => rest)
        const existingIdx = s.savedDatasets.findIndex((d) => d.name === block.name)
        const snapshot: SavedDataset = {
          id: existingIdx >= 0 ? s.savedDatasets[existingIdx].id : uuid(),
          name: block.name,
          savedAt: Date.now(),
          bankItems,
          labelledBlocks: [],
          unlabelledBlocks: [{ ...block, itemIds: [...block.itemIds] }],
          splitConfig: s.splitConfig,
        }
        if (existingIdx >= 0) { const u = [...s.savedDatasets]; u[existingIdx] = snapshot; return { savedDatasets: u } }
        return { savedDatasets: [snapshot, ...s.savedDatasets] }
      }

      // Legacy full-canvas save (no args)
      const existingIdx = s.savedDatasets.findIndex((d) => d.name === s.currentDatasetName)
      const snapshot: SavedDataset = {
        id: existingIdx >= 0 ? s.savedDatasets[existingIdx].id : uuid(),
        name: s.currentDatasetName,
        savedAt: Date.now(),
        bankItems: s.bankItems.map(({ thumbnailUrl: _, ...rest }) => rest),
        labelledBlocks: s.labelledBlocks.map((b) => ({
          ...b,
          itemIds: [...b.itemIds],
          labels: b.labels.map((l) => ({ ...l, itemIds: [...l.itemIds] })),
        })),
        unlabelledBlocks: s.unlabelledBlocks.map((b) => ({
          ...b,
          itemIds: [...b.itemIds],
        })),
        splitConfig: s.splitConfig,
      }
      if (existingIdx >= 0) {
        const updated = [...s.savedDatasets]
        updated[existingIdx] = snapshot
        return { savedDatasets: updated }
      }
      return { savedDatasets: [snapshot, ...s.savedDatasets] }
    }),

  loadSavedDataset: (id) =>
    set((s) => {
      const saved = s.savedDatasets.find((d) => d.id === id)
      if (!saved) return s
      const bankItems: DataItem[] = saved.bankItems.map((item) => {
        if (item.type === 'image' && item.content) {
          try {
            const blob = base64ToBlob(item.content, 'image/jpeg')
            return { ...item, thumbnailUrl: URL.createObjectURL(blob) }
          } catch { return item }
        }
        return item
      })
      return {
        bankItems,
        labelledBlocks: saved.labelledBlocks,
        unlabelledBlocks: saved.unlabelledBlocks,
        splitConfig: saved.splitConfig,
        currentDatasetName: saved.name,
        validationResult: null,
      }
    }),

  addDatasetToCanvas: (id, pos?) =>
    set((s) => {
      const saved = s.savedDatasets.find((d) => d.id === id)
      if (!saved) return s

      const itemIdMap: Record<string, string> = {}
      const newBankItems: DataItem[] = saved.bankItems.map((item) => {
        const newId = uuid()
        itemIdMap[item.id] = newId
        let thumbnailUrl: string | undefined
        if (item.type === 'image' && item.content) {
          try { thumbnailUrl = URL.createObjectURL(base64ToBlob(item.content, 'image/jpeg')) } catch {}
        }
        return { ...item, id: newId, addedAt: Date.now(), thumbnailUrl }
      })

      const n = s.labelledBlocks.length + s.unlabelledBlocks.length
      const offset = { x: n * 50, y: n * 30 }

      const allSaved = [...saved.labelledBlocks, ...saved.unlabelledBlocks]
      const minX = allSaved.length ? Math.min(...allSaved.map((b) => b.position.x)) : 0
      const minY = allSaved.length ? Math.min(...allSaved.map((b) => b.position.y)) : 0
      const blockPos = (b: { position: { x: number; y: number } }) =>
        pos
          ? { x: pos.x + (b.position.x - minX), y: pos.y + (b.position.y - minY) }
          : { x: b.position.x + offset.x, y: b.position.y + offset.y }

      const newLabelled: LabelledDatasetBlock[] = saved.labelledBlocks.map((b) => ({
        ...b,
        id: uuid(),
        position: blockPos(b),
        itemIds: b.itemIds.map((iid) => itemIdMap[iid] ?? iid),
        labels: b.labels.map((l) => ({
          ...l,
          id: uuid(),
          itemIds: l.itemIds.map((iid) => itemIdMap[iid] ?? iid),
        })),
      }))

      const newUnlabelled: UnlabelledDatasetBlock[] = saved.unlabelledBlocks.map((b) => ({
        ...b,
        id: uuid(),
        position: blockPos(b),
        itemIds: b.itemIds.map((iid) => itemIdMap[iid] ?? iid),
      }))

      return {
        bankItems: [...s.bankItems, ...newBankItems],
        labelledBlocks: [...s.labelledBlocks, ...newLabelled],
        unlabelledBlocks: [...s.unlabelledBlocks, ...newUnlabelled],
      }
    }),

  deleteSavedDataset: (id) =>
    set((s) => ({ savedDatasets: s.savedDatasets.filter((d) => d.id !== id) })),
}))
