export type StepType = 'learn' | 'lab' | 'challenge'

export interface LearnStep {
  type: 'learn'
  id: string
  title: string
  icon: string
  body: string
  tip?: string
}

export interface LabStep {
  type: 'lab'
  id: string
  title: string
  icon: string
  instruction: string
  canvasHint?: string
}

export interface ChallengeStep {
  type: 'challenge'
  id: string
  title: string
  icon: string
  prompt: string
  successHint?: string
}

export type CurriculumStep = LearnStep | LabStep | ChallengeStep

export interface CurriculumModule {
  id: string
  title: string
  subtitle: string
  emoji: string
  steps: CurriculumStep[]
}

// Content lives in curriculum-content.json — edit that file and redeploy to update the app.
import rawData from './curriculum-content.json'
export const CURRICULUM: CurriculumModule[] = rawData as unknown as CurriculumModule[]
