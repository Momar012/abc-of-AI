import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface CurriculumState {
  currentModuleId: string
  currentStepIndex: number
  completedStepIds: string[]
  panelWidth: number

  goToStep: (index: number) => void
  nextStep: (totalSteps: number) => void
  prevStep: () => void
  markStepComplete: (stepId: string) => void
  setModule: (moduleId: string) => void
  resetModule: (moduleId: string) => void
  setPanelWidth: (w: number) => void
}

export const useCurriculumStore = create<CurriculumState>()(
  persist(
    (set) => ({
      currentModuleId: 'ch1-teach-an-ai',
      currentStepIndex: 0,
      completedStepIds: [],
      // 240 was too narrow on a Chromebook: lab steps and checks wrapped almost one word a line.
      panelWidth: 300,

      goToStep: (index) => set({ currentStepIndex: index }),

      nextStep: (totalSteps) =>
        set((s) => ({
          currentStepIndex: Math.min(s.currentStepIndex + 1, totalSteps - 1),
        })),

      prevStep: () =>
        set((s) => ({
          currentStepIndex: Math.max(s.currentStepIndex - 1, 0),
        })),

      markStepComplete: (stepId) =>
        set((s) => ({
          completedStepIds: s.completedStepIds.includes(stepId)
            ? s.completedStepIds
            : [...s.completedStepIds, stepId],
        })),

      setModule: (moduleId) =>
        set({ currentModuleId: moduleId }),

      resetModule: (moduleId) =>
        set({ currentModuleId: moduleId, currentStepIndex: 0, completedStepIds: [] }),

      setPanelWidth: (w) => set({ panelWidth: w }),
    }),
    {
      name: 'abcai_curriculum_v1',
      version: 1,
      // v0 started at 240px: widen anyone still that narrow once (the page re-clamps to the screen).
      migrate: (old) => {
        const s = old as Partial<CurriculumState>
        return { ...s, panelWidth: Math.max(s.panelWidth ?? 300, 300) } as CurriculumState
      },
      partialize: (s) => ({
        currentModuleId: s.currentModuleId,
        currentStepIndex: s.currentStepIndex,
        completedStepIds: s.completedStepIds,
        panelWidth: s.panelWidth,
      }),
    }
  )
)
