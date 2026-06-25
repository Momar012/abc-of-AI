export type ModelType = 'image-supervised' | 'image-classifier' | 'image-unsupervised' | 'text-corpus' | 'text-supervised' | 'text-unsupervised'

export interface ChatMessage {
  role: 'user' | 'ai'
  text: string
}
export type ModelStatus = 'idle' | 'loading' | 'training' | 'trained' | 'error'
export type TestStatus = 'idle' | 'running' | 'done' | 'error'

export interface ClusterResult {
  itemId: string
  clusterId: number
}

export interface ModelBlock {
  id: string
  type: 'model'
  position: { x: number; y: number }
  name: string
  modelType: ModelType | null
  linkedBlockId: string | null
  status: ModelStatus
  trainedModelId: string | null
  trainedLinkedBlockId: string | null
  errorMessage?: string
  testLinkedBlockId: string | null
  testStatus: TestStatus
  testResults: TestResult[] | null
  clusterCount: number | null
  clusterResults: ClusterResult[] | null
  textSentences?: string[]
  liveLinkedSensorId?: string | null
  liveResult?: {
    predictedLabel: string
    predictedLabelId: string
    confidence: number
    allConfidences: Record<string, number>
  } | null
}

export interface TrainedModel {
  id: string
  name: string
  trainedAt: number
  modelType: ModelType
  labels: string[]
  labelIds: string[]
  itemCount: number
  knnData: Record<string, { values: number[]; shape: number[] }>
  textVocab?: string[]
  textIdfWeights?: number[]
  textAllVectors?: Array<{ labelId: string; itemId?: string; vec: number[] }>
  nbWordLogProbs?: Record<string, number[]>
  nbClassLogPriors?: Record<string, number>
  clusterCentroids?: number[][]
  clusterVocab?: string[]
  clusterIdfWeights?: number[]
}

export interface TestResult {
  itemId: string
  predictedLabel: string
  predictedLabelId: string
  confidence: number
  allConfidences: Record<string, number>
  actualLabelId: string | null
  actualLabel: string | null
}
