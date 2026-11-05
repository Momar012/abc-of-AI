import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** Guided Lab progress, per lab card (curriculum step id). */
interface LabGuideState {
  /** Blocks that were on the canvas when the kid first opened each lab (so old blocks don't count). */
  snapshots: Record<string, string[]>
  /** Lab steps ticked so far (indexes into the parsed instruction lines). */
  ticked: Record<string, number[]>
  /** Expected Results the kid said 👍 to (indexes into the lab's expected items). */
  confirmed: Record<string, number[]>

  ensureSnapshot: (stepId: string, ids: string[]) => void
  tick: (stepId: string, index: number) => void
  confirm: (stepId: string, index: number) => void
  restart: (stepId: string, ids: string[]) => void
}

const add = (map: Record<string, number[]>, stepId: string, index: number) => {
  const cur = map[stepId] ?? []
  return cur.includes(index) ? null : { ...map, [stepId]: [...cur, index] }
}

export const useLabGuideStore = create<LabGuideState>()(
  persist(
    (set) => ({
      snapshots: {},
      ticked: {},
      confirmed: {},
      ensureSnapshot: (stepId, ids) =>
        set((s) => (s.snapshots[stepId] ? s : { snapshots: { ...s.snapshots, [stepId]: ids } })),
      tick: (stepId, index) =>
        set((s) => {
          const next = add(s.ticked, stepId, index)
          return next ? { ticked: next } : s
        }),
      confirm: (stepId, index) =>
        set((s) => {
          const next = add(s.confirmed, stepId, index)
          return next ? { confirmed: next } : s
        }),
      restart: (stepId, ids) =>
        set((s) => ({
          snapshots: { ...s.snapshots, [stepId]: ids },
          ticked: { ...s.ticked, [stepId]: [] },
          confirmed: { ...s.confirmed, [stepId]: [] },
        })),
    }),
    {
      name: 'abcai_labguide_v1',
      version: 2,
      // v1 had no `confirmed`; keep the kid's ticked steps.
      migrate: (old) => ({ confirmed: {}, ...(old as object) }) as LabGuideState,
    }
  )
)

/** All steps ticked and every Expected Result confirmed (labs without one only need the steps). */
export function useLabComplete(stepId: string, nSteps: number, nTests: number) {
  return useLabGuideStore(
    (s) =>
      nSteps > 0 &&
      (s.ticked[stepId]?.length ?? 0) >= nSteps &&
      (s.confirmed[stepId]?.length ?? 0) >= nTests
  )
}
