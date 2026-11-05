import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface MissionResult {
  /** Best stars ever earned on this mission (1–3). */
  stars: number
  doneAt: number
}

interface MissionState {
  /** Mission being played right now, if any. */
  activeId: string | null
  /** The active mission was just completed (its card shows the result until closed). */
  activeDone: boolean
  /** Snapshot taken when the active mission started (e.g. block ids already on the canvas). */
  baseline: unknown
  /** Hints used in the current attempt — fewer hints, more stars. */
  hintsUsed: number
  results: Record<string, MissionResult>
  panelOpen: boolean
  /** Milestone celebrations already shown (see lib/missions/milestones). */
  celebrated: string[]
  trophyOpen: boolean

  setTrophyOpen: (open: boolean) => void
  markCelebrated: (id: string) => void
  openPanel: () => void
  closePanel: () => void
  start: (id: string, baseline: unknown) => void
  takeHint: () => void
  /** Records the attempt (keeping the best stars) and returns the stars for this attempt. */
  complete: (id: string) => number
  quit: () => void
}

/** 3 stars with no hints, 2 with one, 1 with two or more. */
export const starsFor = (hintsUsed: number) => Math.max(1, 3 - hintsUsed)

export const useMissionStore = create<MissionState>()(
  persist(
    (set, get) => ({
      activeId: null,
      activeDone: false,
      baseline: null,
      hintsUsed: 0,
      results: {},
      panelOpen: false,
      celebrated: [],
      trophyOpen: false,

      setTrophyOpen: (open) => set({ trophyOpen: open, panelOpen: open ? false : get().panelOpen }),

      markCelebrated: (id) => set((s) => (s.celebrated.includes(id) ? s : { celebrated: [...s.celebrated, id] })),
      openPanel: () => set({ panelOpen: true }),
      closePanel: () => set({ panelOpen: false }),

      start: (id, baseline) => set({ activeId: id, activeDone: false, baseline, hintsUsed: 0, panelOpen: false }),

      takeHint: () => set((s) => ({ hintsUsed: s.hintsUsed + 1 })),

      complete: (id) => {
        const stars = starsFor(get().hintsUsed)
        set((s) => {
          const prev = s.results[id]
          return {
            activeDone: true,
            results: {
              ...s.results,
              [id]: { stars: Math.max(stars, prev?.stars ?? 0), doneAt: prev?.doneAt ?? Date.now() },
            },
          }
        })
        return stars
      },

      quit: () => set({ activeId: null, activeDone: false, baseline: null, hintsUsed: 0 }),
    }),
    {
      name: 'abcai_missions_v1',
      partialize: (s) => ({
        activeId: s.activeDone ? null : s.activeId,
        baseline: s.baseline,
        hintsUsed: s.hintsUsed,
        results: s.results,
        celebrated: s.celebrated,
      }),
    }
  )
)

/** Points per mission: 10 with no hints (⭐⭐⭐), 7 with one (⭐⭐), 5 with more (⭐). 13 missions → 130 max. */
export const POINTS_PER_MISSION = 10
export const pointsForStars = (stars: number) => (stars >= 3 ? 10 : stars === 2 ? 7 : stars >= 1 ? 5 : 0)
export const totalPoints = (results: Record<string, MissionResult>) =>
  Object.values(results).reduce((n, r) => n + pointsForStars(r.stars), 0)
