export type RLCellType = 'empty' | 'wall' | 'start' | 'goal'
export type RLTrainingStatus = 'idle' | 'training' | 'paused' | 'done'
export type RLEditMode = 'wall' | 'goal' | 'start'
export type RLViewMode = 'grid' | 'heatmap' | 'policy'
export type RLSpeedMode = 'slow' | 'normal' | 'fast'

export interface RLGridworldBlock {
  id: string
  type: 'rl-gridworld'
  position: { x: number; y: number }
  name: string
  // Environment
  gridWidth: number
  gridHeight: number
  cells: RLCellType[][]
  // Config
  goalReward: number
  stepPenalty: number
  episodes: number
  speedMode: RLSpeedMode
  userPrediction: number | null
  // Training state
  trainingStatus: RLTrainingStatus
  currentEpisode: number
  rewardHistory: number[]
  successHistory: boolean[]
  bestSteps: number | null
  qTable: Record<string, Record<string, number>>
  visitCounts: number[][]
  firstGoalEpisode: number | null
  // Live animation (not persisted)
  agentPos: { row: number; col: number } | null
  agentPath: Array<{ row: number; col: number }>
  // UI
  viewMode: RLViewMode
  editMode: RLEditMode
  inspectorStep: 1 | 2 | 3 | 4 | 5
}
