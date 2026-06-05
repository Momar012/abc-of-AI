import { DataItem, LabelledDatasetBlock, UnlabelledDatasetBlock, SplitConfig, SavedDataset } from '@/types/dataset'
import { ModelBlock, TrainedModel } from '@/types/model'
import { RLGridworldBlock } from '@/types/rl'
import { IfElseBlock, DoorBlock, BulbBlock } from '@/types/workflow'
import { SensorBlock, ConditionBlock, LogicBlock, FanBlock, AlarmBlock } from '@/types/rules'

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
  ifElseBlocks?: IfElseBlock[]
  doorBlocks?: DoorBlock[]
  bulbBlocks?: BulbBlock[]
  sensorBlocks?: SensorBlock[]
  conditionBlocks?: ConditionBlock[]
  logicBlocks?: LogicBlock[]
  fanBlocks?: FanBlock[]
  alarmBlocks?: AlarmBlock[]
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
  ifElseBlocks: IfElseBlock[]
  doorBlocks: DoorBlock[]
  bulbBlocks: BulbBlock[]
  sensorBlocks: SensorBlock[]
  conditionBlocks: ConditionBlock[]
  logicBlocks: LogicBlock[]
  fanBlocks: FanBlock[]
  alarmBlocks: AlarmBlock[]
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
      ifElseBlocks: state.ifElseBlocks.map(({ currentOutput: _, ...rest }) => ({ ...rest, currentOutput: null })),
      doorBlocks: state.doorBlocks.map(({ isOpen: _, ...rest }) => ({ ...rest, isOpen: false })),
      bulbBlocks: state.bulbBlocks.map(({ isOn: _, ...rest }) => ({ ...rest, isOn: false })),
      sensorBlocks: state.sensorBlocks,
      conditionBlocks: state.conditionBlocks.map(({ currentOutput: _, ...rest }) => ({ ...rest, currentOutput: null })),
      logicBlocks: state.logicBlocks.map(({ currentOutput: _, ...rest }) => ({ ...rest, currentOutput: null })),
      fanBlocks: state.fanBlocks.map(({ isOn: _, ...rest }) => ({ ...rest, isOn: false })),
      alarmBlocks: state.alarmBlocks.map(({ isOn: _, ...rest }) => ({ ...rest, isOn: false })),
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
      ifElseBlocks: (parsed.ifElseBlocks ?? []).map((b) => ({ ...b, currentOutput: null })),
      doorBlocks: (parsed.doorBlocks ?? []).map((b) => ({ ...b, isOpen: false })),
      bulbBlocks: (parsed.bulbBlocks ?? []).map((b) => ({ ...b, isOn: false })),
      sensorBlocks: parsed.sensorBlocks ?? [],
      conditionBlocks: (parsed.conditionBlocks ?? []).map((b) => ({ ...b, currentOutput: null })),
      logicBlocks: (parsed.logicBlocks ?? []).map((b) => ({ ...b, currentOutput: null })),
      fanBlocks: (parsed.fanBlocks ?? []).map((b) => ({ ...b, isOn: false })),
      alarmBlocks: (parsed.alarmBlocks ?? []).map((b) => ({ ...b, isOn: false })),
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
