export interface DataItem {
  id: string
  type: 'image' | 'text'
  name: string
  content: string // base64 for image, raw string for text
  thumbnailUrl?: string // object URL, not persisted
  addedAt: number
}

export interface Label {
  id: string
  name: string
  color: string
  itemIds: string[]
}

export interface LabelledDatasetBlock {
  id: string
  type: 'labelled'
  position: { x: number; y: number }
  name: string
  itemIds: string[] // unassigned items (not yet given a label)
  labels: Label[]
}

export interface UnlabelledDatasetBlock {
  id: string
  type: 'unlabelled'
  position: { x: number; y: number }
  name: string
  itemIds: string[]
}

export interface ValidationCheck {
  id: string
  label: string
  status: 'pass' | 'warn' | 'tip'
  message: string
  educationalNote: string
}

export interface ValidationResult {
  passed: boolean
  checks: ValidationCheck[]
  earnedBadges: string[]
}

export interface SplitConfig {
  trainPercent: number
  testPercent: number
  validationPercent: number
  locked: boolean
}

export interface SavedDataset {
  id: string
  name: string
  savedAt: number
  bankItems: Omit<DataItem, 'thumbnailUrl'>[]
  labelledBlocks: LabelledDatasetBlock[]
  unlabelledBlocks: UnlabelledDatasetBlock[]
  splitConfig: SplitConfig
}
