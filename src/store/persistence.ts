import { DataItem, LabelledDatasetBlock, UnlabelledDatasetBlock, SplitConfig, SavedDataset } from '@/types/dataset'
import { ModelBlock, TrainedModel } from '@/types/model'

const KEY = 'abcai_dataset_v1'

interface PersistedState {
  bankItems: Omit<DataItem, 'thumbnailUrl'>[]
  labelledBlocks: LabelledDatasetBlock[]
  unlabelledBlocks: UnlabelledDatasetBlock[]
  splitConfig: SplitConfig
  earnedBadges: string[]
  currentDatasetName: string
  savedDatasets: SavedDataset[]
  modelBlocks?: ModelBlock[]
  trainedModels?: TrainedModel[]
}

export function saveToLocalStorage(state: {
  bankItems: DataItem[]
  labelledBlocks: LabelledDatasetBlock[]
  unlabelledBlocks: UnlabelledDatasetBlock[]
  splitConfig: SplitConfig
  earnedBadges: string[]
  currentDatasetName: string
  savedDatasets: SavedDataset[]
  modelBlocks: ModelBlock[]
  trainedModels: TrainedModel[]
}) {
  try {
    const toSave: PersistedState = {
      bankItems: state.bankItems.map(({ thumbnailUrl: _, ...rest }) => rest),
      labelledBlocks: state.labelledBlocks,
      unlabelledBlocks: state.unlabelledBlocks,
      splitConfig: state.splitConfig,
      earnedBadges: state.earnedBadges,
      currentDatasetName: state.currentDatasetName,
      savedDatasets: state.savedDatasets,
      modelBlocks: state.modelBlocks.map(({ testResults: _, ...rest }) => rest as ModelBlock),
      trainedModels: state.trainedModels,
    }
    localStorage.setItem(KEY, JSON.stringify(toSave))
  } catch {
    // Storage quota exceeded (knnData can be large) or unavailable — silently ignore
  }
}

export function loadFromLocalStorage(): PersistedState | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed: PersistedState = JSON.parse(raw)
    const bankItems = parsed.bankItems.map((item) => {
      if (item.type === 'image' && item.content) {
        const blob = base64ToBlob(item.content, 'image/jpeg')
        return { ...item, thumbnailUrl: URL.createObjectURL(blob) }
      }
      return item
    })
    // Migrate old saved snapshots' bankItems thumbnailUrls
    const savedDatasets = (parsed.savedDatasets ?? []).map((sd) => ({
      ...sd,
      bankItems: sd.bankItems.map((item) => {
        if (item.type === 'image' && item.content) {
          try {
            const blob = base64ToBlob(item.content, 'image/jpeg')
            return { ...item, thumbnailUrl: URL.createObjectURL(blob) }
          } catch { return item }
        }
        return item
      }),
    }))
    return {
      ...parsed,
      bankItems,
      currentDatasetName: parsed.currentDatasetName ?? 'My Dataset',
      savedDatasets,
      modelBlocks: (parsed.modelBlocks ?? []).map((b) => ({
        testLinkedBlockId: null,
        testStatus: 'idle' as const,
        ...b,
        testResults: null, // never persist test results — regenerate on demand
      })),
      trainedModels: parsed.trainedModels ?? [],
    }
  } catch {
    return null
  }
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteString = atob(base64.split(',')[1] ?? base64)
  const buffer = new Uint8Array(byteString.length)
  for (let i = 0; i < byteString.length; i++) buffer[i] = byteString.charCodeAt(i)
  return new Blob([buffer], { type: mimeType })
}
