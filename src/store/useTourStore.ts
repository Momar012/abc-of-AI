import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type TourStatus = 'unseen' | 'active' | 'done' | 'skipped'

interface TourState {
  status: TourStatus
  stepIndex: number
  /** Snapshot taken when the current step started (block ids, zoom, …). */
  baseline: { step: number; data: unknown } | null
  /** The switch + bulb the kid built during the tour, so later steps point at them. */
  refs: { switchId?: string; bulbId?: string }
  /** Set when the tour just finished, to show the celebration card once. */
  justFinished: boolean

  start: () => void
  next: (totalSteps: number) => void
  skipTour: () => void
  setBaseline: (step: number, data: unknown) => void
  setRef: (key: 'switchId' | 'bulbId', id: string) => void
  dismissFinish: () => void
}

export const useTourStore = create<TourState>()(
  persist(
    (set) => ({
      status: 'unseen',
      stepIndex: 0,
      baseline: null,
      refs: {},
      justFinished: false,

      start: () => set({ status: 'active', stepIndex: 0, baseline: null, refs: {}, justFinished: false }),

      next: (totalSteps) =>
        set((s) => {
          const nextIndex = s.stepIndex + 1
          if (nextIndex >= totalSteps) {
            return { status: 'done', stepIndex: 0, baseline: null, justFinished: true }
          }
          return { stepIndex: nextIndex, baseline: null }
        }),

      skipTour: () => set({ status: 'skipped', stepIndex: 0, baseline: null }),

      setBaseline: (step, data) => set({ baseline: { step, data } }),

      setRef: (key, id) => set((s) => ({ refs: { ...s.refs, [key]: id } })),

      dismissFinish: () => set({ justFinished: false }),
    }),
    {
      name: 'abcai_tour_v1',
      partialize: (s) => ({
        status: s.status,
        stepIndex: s.stepIndex,
        baseline: s.baseline,
        refs: s.refs,
      }),
    }
  )
)
