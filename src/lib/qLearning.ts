import { RLCellType, RLGridworldBlock } from '@/types/rl'

export type QAction = 'up' | 'down' | 'left' | 'right'
export const ACTIONS: QAction[] = ['up', 'down', 'left', 'right']

const DELTAS: Record<QAction, [number, number]> = {
  up:    [-1,  0],
  down:  [ 1,  0],
  left:  [ 0, -1],
  right: [ 0,  1],
}

export function stateKey(row: number, col: number): string {
  return `${row},${col}`
}

export function getQ(
  qTable: Record<string, Record<string, number>>,
  row: number,
  col: number,
  action: QAction
): number {
  return qTable[stateKey(row, col)]?.[action] ?? 0
}

export function getBestAction(
  qTable: Record<string, Record<string, number>>,
  row: number,
  col: number
): QAction {
  let best: QAction = 'up'
  let bestVal = -Infinity
  for (const a of ACTIONS) {
    const v = getQ(qTable, row, col, a)
    if (v > bestVal) { bestVal = v; best = a }
  }
  return best
}

export function getBestQ(
  qTable: Record<string, Record<string, number>>,
  row: number,
  col: number
): number {
  return Math.max(...ACTIONS.map((a) => getQ(qTable, row, col, a)))
}

export function applyAction(
  row: number,
  col: number,
  action: QAction,
  cells: RLCellType[][],
  gridHeight: number,
  gridWidth: number
): { row: number; col: number; hitWall: boolean } {
  const [dr, dc] = DELTAS[action]
  const nr = row + dr
  const nc = col + dc
  if (nr < 0 || nr >= gridHeight || nc < 0 || nc >= gridWidth) {
    return { row, col, hitWall: true }
  }
  if (cells[nr][nc] === 'wall') {
    return { row, col, hitWall: true }
  }
  return { row: nr, col: nc, hitWall: false }
}

export function makeDefaultCells(w: number, h: number): RLCellType[][] {
  return Array.from({ length: h }, (_, r) =>
    Array.from({ length: w }, (_, c) => {
      if (r === 0 && c === 0) return 'start'
      if (r === h - 1 && c === w - 1) return 'goal'
      return 'empty'
    })
  )
}

// Randomized DFS maze — guarantees solvable
export function generateRandomMaze(w: number, h: number): RLCellType[][] {
  // Start with all walls, carve paths using DFS
  const cells: RLCellType[][] = Array.from({ length: h }, () =>
    Array.from({ length: w }, () => 'wall' as RLCellType)
  )

  const visited: boolean[][] = Array.from({ length: h }, () => Array(w).fill(false))

  function carve(r: number, c: number) {
    visited[r][c] = true
    cells[r][c] = 'empty'
    const dirs: Array<[number, number]> = [[-1,0],[1,0],[0,-1],[0,1]]
    // Shuffle dirs
    for (let i = dirs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [dirs[i], dirs[j]] = [dirs[j], dirs[i]]
    }
    for (const [dr, dc] of dirs) {
      const nr = r + dr * 2
      const nc = c + dc * 2
      if (nr >= 0 && nr < h && nc >= 0 && nc < w && !visited[nr][nc]) {
        cells[r + dr][c + dc] = 'empty'
        carve(nr, nc)
      }
    }
  }

  carve(0, 0)

  // For odd-dimension grids DFS works cleanly; for even we just clear extra walls
  // Ensure start and goal are accessible
  cells[0][0] = 'start'
  cells[h - 1][w - 1] = 'goal'

  // Make sure the goal cell and its neighbors aren't all walls
  if (cells[h - 2]?.[w - 1] === 'wall' && cells[h - 1]?.[w - 2] === 'wall') {
    cells[h - 1][w - 2] = 'empty'
  }

  return cells
}

export interface EpisodeResult {
  totalReward: number
  steps: number
  reached: boolean
  updatedQTable: Record<string, Record<string, number>>
  updatedVisitCounts: number[][]
  path: Array<{ row: number; col: number }>
}

export function runEpisode(
  block: Pick<RLGridworldBlock, 'cells' | 'gridWidth' | 'gridHeight' | 'goalReward' | 'stepPenalty' | 'qTable' | 'visitCounts'>,
  epsilon: number,
  alpha = 0.1,
  gamma = 0.95
): EpisodeResult {
  const { cells, gridWidth, gridHeight, goalReward, stepPenalty, qTable, visitCounts } = block
  const maxSteps = gridWidth * gridHeight * 3

  // Find start position
  let row = 0, col = 0
  outer: for (let r = 0; r < gridHeight; r++) {
    for (let c = 0; c < gridWidth; c++) {
      if (cells[r][c] === 'start') { row = r; col = c; break outer }
    }
  }

  const newQ = qTable
  const newVisit = visitCounts.map((r) => [...r])
  let totalReward = 0
  let reached = false
  const path: Array<{ row: number; col: number }> = [{ row, col }]

  for (let step = 0; step < maxSteps; step++) {
    newVisit[row][col]++

    const action: QAction = Math.random() < epsilon
      ? ACTIONS[Math.floor(Math.random() * ACTIONS.length)]
      : getBestAction(newQ, row, col)

    const { row: nr, col: nc, hitWall } = applyAction(row, col, action, cells, gridHeight, gridWidth)

    let reward = hitWall ? -2 : -stepPenalty
    const isGoal = cells[nr][nc] === 'goal'
    if (isGoal) reward += goalReward

    // Q update
    const key = stateKey(row, col)
    if (!newQ[key]) newQ[key] = {}
    const oldQ = newQ[key][action] ?? 0
    const nextBest = isGoal ? 0 : getBestQ(newQ, nr, nc)
    newQ[key][action] = oldQ + alpha * (reward + gamma * nextBest - oldQ)

    row = nr
    col = nc
    totalReward += reward
    path.push({ row, col })

    if (isGoal) { reached = true; break }
  }

  return {
    totalReward,
    steps: path.length - 1,
    reached,
    updatedQTable: newQ,
    updatedVisitCounts: newVisit,
    path,
  }
}
