export type ModelType = 'image-supervised' | 'image-classifier' | 'image-unsupervised'
export type ModelStatus = 'idle' | 'loading' | 'training' | 'trained' | 'error'
export type TestStatus = 'idle' | 'running' | 'done' | 'error'

export interface ModelBlock {
  id: string
  type: 'model'
  position: { x: number; y: number }
  name: string
  modelType: ModelType | null
  linkedBlockId: string | null
  status: ModelStatus
  trainedModelId: string | null
  errorMessage?: string
  testLinkedBlockId: string | null
  testStatus: TestStatus
  testResults: TestResult[] | null
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
