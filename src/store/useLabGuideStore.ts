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
  /** A fingerprint of each lab's steps when its progress was saved (ticks are step numbers). */
  versions: Record<string, string>

  ensureSnapshot: (stepId: string, ids: string[]) => void
  /** The lesson's steps changed since this progress was saved: drop the ticks (they'd land on the
   *  wrong steps) but keep the snapshot, so steps already built on the canvas tick again by themselves. */
  syncVersion: (stepId: string, version: string) => void
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
      versions: {},
      ensureSnapshot: (stepId, ids) =>
        set((s) => (s.snapshots[stepId] ? s : { snapshots: { ...s.snapshots, [stepId]: ids } })),
      syncVersion: (stepId, version) =>
        set((s) => {
          const was = s.versions[stepId]
          if (was === version) return s
          const versions = { ...s.versions, [stepId]: version }
          // No fingerprint yet (progress saved before this existed): trust it, just remember the steps.
          if (was === undefined) return { versions }
          return {
            versions,
            ticked: { ...s.ticked, [stepId]: [] },
            confirmed: { ...s.confirmed, [stepId]: [] },
          }
        }),
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
      version: 3,
      // v1 had no `confirmed`, v2 no `versions`; keep the kid's ticked steps.
      migrate: (old) => ({ confirmed: {}, versions: {}, ...(old as object) }) as LabGuideState,
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
