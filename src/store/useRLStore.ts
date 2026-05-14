import { create } from 'zustand'
import { v4 as uuid } from 'uuid'
import { RLGridworldBlock, RLCellType } from '@/types/rl'
import { makeDefaultCells } from '@/lib/qLearning'

interface RLState {
  rlBlocks: RLGridworldBlock[]
  addRLBlock: (pos?: { x: number; y: number }) => void
  removeRLBlock: (id: string) => void
  updateRLBlock: (id: string, updates: Partial<RLGridworldBlock>) => void
  updateRLBlockPosition: (id: string, pos: { x: number; y: number }) => void
  setCell: (id: string, row: number, col: number, cellType: RLCellType) => void
  resetTraining: (id: string) => void
}

function makeDefaultBlock(pos: { x: number; y: number }, index: number): RLGridworldBlock {
  const w = 6, h = 6
  return {
    id: uuid(),
    type: 'rl-gridworld',
    position: pos,
    name: `RL Gridworld ${index + 1}`,
    gridWidth: w,
    gridHeight: h,
    cells: makeDefaultCells(w, h),
    goalReward: 10,
    stepPenalty: 1,
    episodes: 200,
    speedMode: 'normal',
    userPrediction: null,
    trainingStatus: 'idle',
    currentEpisode: 0,
    rewardHistory: [],
    successHistory: [],
    bestSteps: null,
    qTable: {},
    visitCounts: Array.from({ length: h }, () => Array(w).fill(0)),
    firstGoalEpisode: null,
    agentPos: null,
    agentPath: [],
    viewMode: 'grid',
    editMode: 'wall',
    inspectorStep: 1,
  }
}

export const useRLStore = create<RLState>((set) => ({
  rlBlocks: [],

  addRLBlock: (pos?) =>
    set((s) => ({
      rlBlocks: [
        ...s.rlBlocks,
        makeDefaultBlock(
          pos ?? { x: 400 + s.rlBlocks.length * 40, y: 200 + s.rlBlocks.length * 40 },
          s.rlBlocks.length
        ),
      ],
    })),

  removeRLBlock: (id) =>
    set((s) => ({ rlBlocks: s.rlBlocks.filter((b) => b.id !== id) })),

  updateRLBlock: (id, updates) =>
    set((s) => ({
      rlBlocks: s.rlBlocks.map((b) => (b.id === id ? { ...b, ...updates } : b)),
    })),

  updateRLBlockPosition: (id, pos) =>
    set((s) => ({
      rlBlocks: s.rlBlocks.map((b) => (b.id === id ? { ...b, position: pos } : b)),
    })),

  setCell: (id, row, col, cellType) =>
    set((s) => ({
      rlBlocks: s.rlBlocks.map((b) => {
        if (b.id !== id) return b
        const newCells = b.cells.map((r, ri) =>
          r.map((c, ci) => {
            if (ri === row && ci === col) return cellType
            // Clear old start/goal if placing a new one
            if (cellType === 'start' && c === 'start') return 'empty' as RLCellType
            if (cellType === 'goal' && c === 'goal') return 'empty' as RLCellType
            return c
          })
        )
        return { ...b, cells: newCells }
      }),
    })),

  resetTraining: (id) =>
    set((s) => ({
      rlBlocks: s.rlBlocks.map((b) => {
        if (b.id !== id) return b
        return {
          ...b,
          trainingStatus: 'idle',
          currentEpisode: 0,
          rewardHistory: [],
          successHistory: [],
          bestSteps: null,
          qTable: {},
          visitCounts: Array.from({ length: b.gridHeight }, () => Array(b.gridWidth).fill(0)),
          firstGoalEpisode: null,
          agentPos: null,
          agentPath: [],
          viewMode: 'grid',
        }
      }),
    })),
}))
