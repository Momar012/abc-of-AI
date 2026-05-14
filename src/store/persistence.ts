import { DataItem, LabelledDatasetBlock, UnlabelledDatasetBlock, SplitConfig, SavedDataset } from '@/types/dataset'
import { ModelBlock, TrainedModel } from '@/types/model'
import { RLGridworldBlock } from '@/types/rl'

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
  rlBlocks?: RLGridworldBlock[]
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
  rlBlocks: RLGridworldBlock[]
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
      modelBlocks: state.modelBlocks.map(({ testResults: _t, clusterResults: _c, ...rest }) => rest as ModelBlock),
      trainedModels: state.trainedModels,
      rlBlocks: state.rlBlocks.map(({ agentPos: _p, agentPath: _a, ...rest }) => rest as RLGridworldBlock),
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
        ...b,
        clusterCount: b.clusterCount ?? null,
        testLinkedBlockId: null,
        testStatus: 'idle' as const,
        testResults: null,
        clusterResults: null,
      })),
      trainedModels: parsed.trainedModels ?? [],
      rlBlocks: (parsed.rlBlocks ?? []).map((b) => ({
        ...b,
        agentPos: null,
        agentPath: [],
        trainingStatus: b.trainingStatus === 'training' ? 'paused' as const : b.trainingStatus,
      })),
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
