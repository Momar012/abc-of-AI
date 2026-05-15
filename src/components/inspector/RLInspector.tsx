'use client'

import { useRef, useCallback } from 'react'
import { useRLStore } from '@/store/useRLStore'
import { useUIStore } from '@/store/useUIStore'
import { RLGridworldBlock, RLCellType } from '@/types/rl'
import { runEpisode, makeDefaultCells, generateRandomMaze } from '@/lib/qLearning'

// ─── Contextual instructional note ────────────────────────────────────────────

function getRLNote(block: RLGridworldBlock): string {
  const { trainingStatus, currentEpisode, episodes, firstGoalEpisode, bestSteps, inspectorStep } = block
  const pct = episodes > 0 ? currentEpisode / episodes : 0

  if (inspectorStep === 1) {
    return "The maze is the agent's world. It can't see the whole map. It only knows where it is right now."
  }
  if (inspectorStep === 2) {
    return "The reward is the only way the agent knows it did something good. Try a big reward: does it learn faster? Try zero penalty: does it take the long way around?"
  }
  if (inspectorStep === 3) {
    return "Make a guess! There's no wrong answer. We're just building your intuition about how long it takes AI to learn."
  }

  if (trainingStatus === 'idle' || trainingStatus === 'paused') {
    return "Press Start to watch the agent learn from scratch. It knows nothing yet!"
  }
  if (trainingStatus === 'done') {
    if (bestSteps !== null) {
      return `The arrows show what the agent learned: the best move from every cell. This is called a "policy." It figured this out entirely on its own!`
    }
    return "Training complete! The agent explored your maze and built a map of which moves pay off."
  }

  // During training
  if (currentEpisode <= 5) {
    return "🎲 Pure chaos right now! The agent picks moves completely randomly. It doesn't know anything yet."
  }
  if (firstGoalEpisode !== null && currentEpisode === firstGoalEpisode) {
    return "🎉 It found the goal for the first time! It'll remember this was a good path and try to repeat it."
  }
  if (pct < 0.4) {
    const epct = Math.round((1 - pct) * 100)
    return `📉 The agent still explores randomly ${epct}% of the time. Watch that number shrink as it learns more!`
  }
  if (pct < 0.7) {
    return "🧭 The path is getting smoother. It's starting to trust what it learned over random guessing."
  }
  if (pct < 0.9) {
    return "🔒 Almost done exploring. Now it mostly follows what it knows works, with just a little randomness to stay curious."
  }
  return "✅ Final stretch! The agent is nearly fully trained. Watch the path stabilise."
}

// ─── Reward mini-chart (inspector version, wider) ─────────────────────────────

function RewardChart({ history }: { history: number[] }) {
  if (history.length < 2) return null
  const min = Math.min(...history)
  const max = Math.max(...history)
  const range = max - min || 1
  const w = 200, h = 36
  const pts = history.slice(-60).map((v, i, arr) => {
    const x = (i / (arr.length - 1)) * w
    const y = h - ((v - min) / range) * (h - 4) - 2
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={w} height={h} className="w-full">
      <polyline points={pts} fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Grid editor (inspector, click to paint) ──────────────────────────────────

function GridEditor({ block }: { block: RLGridworldBlock }) {
  const setCell = useRLStore((s) => s.setCell)
  const updateRLBlock = useRLStore((s) => s.updateRLBlock)
  const isPainting = useRef(false)

  const handlePointerDown = (r: number, c: number) => {
    isPainting.current = true
    paint(r, c)
  }

  const handlePointerEnter = (r: number, c: number) => {
    if (isPainting.current) paint(r, c)
  }

  const paint = (r: number, c: number) => {
    const cell = block.cells[r][c]
    if (cell === 'start' || cell === 'goal') return
    if (block.editMode === 'wall') {
      setCell(block.id, r, c, cell === 'wall' ? 'empty' : 'wall')
    } else if (block.editMode === 'goal') {
      setCell(block.id, r, c, 'goal')
    } else if (block.editMode === 'start') {
      setCell(block.id, r, c, 'start')
    }
  }

  const CELL = 32

  return (
    <div
      className="select-none"
      onPointerLeave={() => { isPainting.current = false }}
      onPointerUp={() => { isPainting.current = false }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${block.gridWidth}, ${CELL}px)`,
          gap: 2,
          background: 'rgba(0,0,0,0.45)',
          padding: 4,
          borderRadius: 8,
          width: 'fit-content',
        }}
      >
        {block.cells.map((row, r) =>
          row.map((cell, c) => {
            let bg = 'rgba(255,255,255,0.09)'
            let borderColor = 'rgba(255,255,255,0.18)'
            let content: string | null = null
            if (cell === 'wall') { bg = 'rgba(20,18,40,0.95)'; borderColor = 'rgba(255,255,255,0.08)'; content = null }
            else if (cell === 'start') { bg = 'rgba(99,102,241,0.35)'; borderColor = 'rgba(99,102,241,0.70)'; content = '🤖' }
            else if (cell === 'goal') { bg = 'rgba(251,191,36,0.55)'; borderColor = 'rgba(251,191,36,0.90)'; content = '⭐' }

            return (
              <div
                key={`${r}-${c}`}
                onPointerDown={(e) => { e.preventDefault(); handlePointerDown(r, c) }}
                onPointerEnter={() => handlePointerEnter(r, c)}
                style={{
                  width: CELL,
                  height: CELL,
                  background: bg,
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  cursor: 'crosshair',
                  border: `1px solid ${borderColor}`,
                  transition: 'background 0.1s',
                }}
              >
                {content}
              </div>
            )
          })
        )}
      </div>

      {/* Mode & util buttons */}
      <div className="flex flex-wrap gap-2 mt-2">
        {(['wall', 'goal', 'start'] as const).map((mode) => (
          <button
            key={mode}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => updateRLBlock(block.id, { editMode: mode })}
            className={`px-2 py-1 rounded-lg text-xs font-heading font-semibold transition-all ${
              block.editMode === mode
                ? 'bg-violet-600 text-white'
                : 'bg-white/10 text-white/50 hover:bg-white/15'
            }`}
          >
            {mode === 'wall' ? '🧱 Wall' : mode === 'goal' ? '⭐ Goal' : '🤖 Start'}
          </button>
        ))}
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => {
            const maze = generateRandomMaze(block.gridWidth, block.gridHeight)
            updateRLBlock(block.id, { cells: maze })
          }}
          className="px-2 py-1 rounded-lg text-xs font-heading font-semibold bg-white/10 text-white/50 hover:bg-white/15 transition-all"
        >
          🔀 Random
        </button>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => updateRLBlock(block.id, { cells: makeDefaultCells(block.gridWidth, block.gridHeight) })}
          className="px-2 py-1 rounded-lg text-xs font-heading font-semibold bg-white/10 text-white/50 hover:bg-white/15 transition-all"
        >
          🗑 Clear
        </button>
      </div>
    </div>
  )
}

// ─── Main inspector ────────────────────────────────────────────────────────────

export default function RLInspector() {
  const selectedBlockId = useUIStore((s) => s.selectedBlockId)
  const clearSelectedBlock = useUIStore((s) => s.clearSelectedBlock)
  const addToast = useUIStore((s) => s.addToast)

  const block = useRLStore((s) => s.rlBlocks.find((b) => b.id === selectedBlockId))
  const updateRLBlock = useRLStore((s) => s.updateRLBlock)
  const resetTraining = useRLStore((s) => s.resetTraining)

  const animFrameRef = useRef<number | null>(null)
  const pausedRef = useRef(false)
  const stoppedRef = useRef(false)

  const stopTraining = useCallback(() => {
    stoppedRef.current = true
    pausedRef.current = false
    if (animFrameRef.current !== null) cancelAnimationFrame(animFrameRef.current)
  }, [])

  if (!block) return null

  const isTraining = block.trainingStatus === 'training'
  const isPaused = block.trainingStatus === 'paused'
  const isDone = block.trainingStatus === 'done'
  const isIdle = block.trainingStatus === 'idle'
  const epsilon = (() => {
    let e = 1.0
    for (let i = 0; i < block.currentEpisode; i++) e = Math.max(0.05, e * 0.997)
    return e
  })()

  const handleResizeGrid = (w: number, h: number) => {
    updateRLBlock(block.id, {
      gridWidth: w,
      gridHeight: h,
      cells: makeDefaultCells(w, h),
      visitCounts: Array.from({ length: h }, () => Array(w).fill(0)),
      qTable: {},
      rewardHistory: [],
      successHistory: [],
      currentEpisode: 0,
      trainingStatus: 'idle',
      bestSteps: null,
      firstGoalEpisode: null,
      agentPos: null,
      agentPath: [],
    })
  }

  const handleStartTraining = () => {
    stoppedRef.current = false
    pausedRef.current = false

    const id = block.id
    let ep = block.currentEpisode
    let eps = block.episodes
    let q = { ...block.qTable }
    let visits = block.visitCounts.map((r) => [...r])
    let rewardHist = [...block.rewardHistory]
    let successHist = [...block.successHistory]
    let bestSteps = block.bestSteps
    let firstGoal = block.firstGoalEpisode
    let e = epsilon

    updateRLBlock(id, { trainingStatus: 'training' })

    const currentBlock = block

    const SLOW_MS = 80
    const NORMAL_MS = 16
    const speedMode = block.speedMode
    const BATCH = speedMode === 'fast' ? 10 : 1

    function runNextEpisode() {
      if (stoppedRef.current) return
      if (pausedRef.current) {
        updateRLBlock(id, { trainingStatus: 'paused' })
        return
      }
      if (ep >= eps) {
        updateRLBlock(id, {
          trainingStatus: 'done',
          currentEpisode: ep,
          rewardHistory: rewardHist,
          successHistory: successHist,
          qTable: q,
          visitCounts: visits,
          bestSteps,
          firstGoalEpisode: firstGoal,
          agentPos: null,
          agentPath: [],
        })
        addToast(`🎮 Training done! Best path: ${bestSteps ?? '?'} steps`, 'success')
        return
      }

      // Run BATCH episodes
      for (let b = 0; b < BATCH && ep < eps; b++) {
        const result = runEpisode(
          {
            cells: currentBlock.cells,
            gridWidth: currentBlock.gridWidth,
            gridHeight: currentBlock.gridHeight,
            goalReward: currentBlock.goalReward,
            stepPenalty: currentBlock.stepPenalty,
            qTable: q,
            visitCounts: visits,
          },
          e
        )
        q = result.updatedQTable
        visits = result.updatedVisitCounts
        rewardHist.push(result.totalReward)
        successHist.push(result.reached)
        if (result.reached) {
          if (firstGoal === null) firstGoal = ep
          if (bestSteps === null || result.steps < bestSteps) bestSteps = result.steps
        }
        e = Math.max(0.05, e * 0.997)
        ep++
      }

      const lastResult = runEpisode(
        {
          cells: currentBlock.cells,
          gridWidth: currentBlock.gridWidth,
          gridHeight: currentBlock.gridHeight,
          goalReward: currentBlock.goalReward,
          stepPenalty: currentBlock.stepPenalty,
          qTable: q,
          visitCounts: visits,
        },
        e
      )

      updateRLBlock(id, {
        currentEpisode: ep,
        rewardHistory: rewardHist,
        successHistory: successHist,
        qTable: q,
        visitCounts: visits,
        bestSteps,
        firstGoalEpisode: firstGoal,
        agentPos: lastResult.path[lastResult.path.length - 1] ?? null,
        agentPath: lastResult.path.slice(0, -1),
      })

      const delay = speedMode === 'slow' ? SLOW_MS : speedMode === 'fast' ? 0 : NORMAL_MS
      if (delay === 0) {
        animFrameRef.current = requestAnimationFrame(runNextEpisode)
      } else {
        animFrameRef.current = setTimeout(runNextEpisode, delay) as unknown as number
      }
    }

    runNextEpisode()
  }

  const handlePause = () => {
    pausedRef.current = true
  }

  const handleStop = () => {
    stopTraining()
    updateRLBlock(block.id, { trainingStatus: 'idle', agentPos: null, agentPath: [] })
  }

  const handleWatchBestPath = () => {
    // Find start
    let row = 0, col = 0
    outer: for (let r = 0; r < block.gridHeight; r++) {
      for (let c = 0; c < block.gridWidth; c++) {
        if (block.cells[r][c] === 'start') { row = r; col = c; break outer }
      }
    }
    const path: Array<{ row: number; col: number }> = [{ row, col }]
    const maxSteps = block.gridWidth * block.gridHeight * 2
    for (let i = 0; i < maxSteps; i++) {
      const qRow = block.qTable[`${row},${col}`]
      if (!qRow) break
      const best = Object.entries(qRow).reduce((a, b) => a[1] > b[1] ? a : b)
      const moves: Record<string, [number, number]> = { up: [-1,0], down: [1,0], left: [0,-1], right: [0,1] }
      const [dr, dc] = moves[best[0]] ?? [0,0]
      row += dr; col += dc
      if (row < 0 || row >= block.gridHeight || col < 0 || col >= block.gridWidth) break
      path.push({ row, col })
      if (block.cells[row][col] === 'goal') break
    }
    updateRLBlock(block.id, { agentPath: path.slice(0, -1), agentPos: path[path.length - 1] })
  }

  const note = getRLNote(block)
  const successRate = block.successHistory.length >= 20
    ? Math.round(block.successHistory.slice(-20).filter(Boolean).length / 20 * 100)
    : null

  return (
    <div className="glass-card flex flex-col gap-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
        <div className="flex items-center gap-2">
          <span className={`text-base ${isTraining ? 'animate-pulse' : ''}`}>🎮</span>
          <div>
            <p className="text-sm font-heading font-bold text-white">{block.name}</p>
            <p className="text-xs text-white/40 font-body">RL Gridworld</p>
          </div>
        </div>
        <button
          onClick={clearSelectedBlock}
          className="w-7 h-7 rounded-full bg-white/10 text-white/50 hover:text-white hover:bg-white/20 text-sm flex items-center justify-center transition-all"
        >
          ×
        </button>
      </div>

      <div className="flex flex-col gap-0">

        {/* ── Step 1: Design the Maze ── */}
        <div className="px-4 py-3 border-b border-white/8">
          <p className="text-xs text-white/50 font-heading font-semibold uppercase tracking-wider mb-2">
            1 · Design Your Maze
          </p>

          {/* Grid size picker */}
          {isIdle && (
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-white/40 font-body">Size:</span>
              {([5, 6, 7] as const).map((n) => (
                <button
                  key={n}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => handleResizeGrid(n, n)}
                  className={`px-2 py-0.5 rounded-lg text-xs font-heading font-semibold transition-all ${
                    block.gridWidth === n
                      ? 'bg-violet-600 text-white'
                      : 'bg-white/10 text-white/50 hover:bg-white/15'
                  }`}
                >
                  {n}×{n}
                </button>
              ))}
            </div>
          )}

          {isIdle ? (
            <GridEditor block={block} />
          ) : (
            <p className="text-xs text-white/40 font-body">
              {isDone ? `${block.gridWidth}×${block.gridHeight} grid · trained` : `${block.gridWidth}×${block.gridHeight} grid · training…`}
            </p>
          )}

          <div className="mt-2 p-2 rounded-lg bg-violet-500/10 border border-violet-500/20">
            <p className="text-xs text-violet-200/70 font-body leading-relaxed">💡 {note}</p>
          </div>
        </div>

        {/* ── Step 2: Set the Rules ── */}
        {(isIdle || isDone) && (
          <div className="px-4 py-3 border-b border-white/8">
            <p className="text-xs text-white/50 font-heading font-semibold uppercase tracking-wider mb-2">
              2 · Set the Rules
            </p>

            <div className="flex flex-col gap-3">
              {/* Goal reward */}
              <div>
                <p className="text-xs text-white/40 font-body mb-1.5">Reward for reaching goal:</p>
                <div className="flex gap-1.5 flex-wrap">
                  {[5, 10, 20, 50].map((v) => (
                    <button
                      key={v}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => updateRLBlock(block.id, { goalReward: v })}
                      className={`px-2.5 py-1 rounded-lg text-xs font-heading font-semibold transition-all ${
                        block.goalReward === v ? 'bg-emerald-600 text-white' : 'bg-white/10 text-white/50 hover:bg-white/15'
                      }`}
                    >
                      +{v}
                    </button>
                  ))}
                </div>
              </div>

              {/* Step penalty */}
              <div>
                <p className="text-xs text-white/40 font-body mb-1.5">Penalty per step:</p>
                <div className="flex gap-1.5 flex-wrap">
                  {[0, 1, 3].map((v) => (
                    <button
                      key={v}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => updateRLBlock(block.id, { stepPenalty: v })}
                      className={`px-2.5 py-1 rounded-lg text-xs font-heading font-semibold transition-all ${
                        block.stepPenalty === v ? 'bg-red-600/80 text-white' : 'bg-white/10 text-white/50 hover:bg-white/15'
                      }`}
                    >
                      {v === 0 ? '−0' : `−${v}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Episodes */}
              <div>
                <p className="text-xs text-white/40 font-body mb-1.5">Episodes:</p>
                <div className="flex gap-1.5 flex-wrap">
                  {[50, 100, 200, 500].map((v) => (
                    <button
                      key={v}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => updateRLBlock(block.id, { episodes: v })}
                      className={`px-2.5 py-1 rounded-lg text-xs font-heading font-semibold transition-all ${
                        block.episodes === v ? 'bg-violet-600 text-white' : 'bg-white/10 text-white/50 hover:bg-white/15'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {/* Speed */}
              <div>
                <p className="text-xs text-white/40 font-body mb-1.5">Speed:</p>
                <div className="flex gap-1.5">
                  {(['slow', 'normal', 'fast'] as const).map((s) => (
                    <button
                      key={s}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => updateRLBlock(block.id, { speedMode: s })}
                      className={`px-2.5 py-1 rounded-lg text-xs font-heading font-semibold transition-all ${
                        block.speedMode === s ? 'bg-violet-600 text-white' : 'bg-white/10 text-white/50 hover:bg-white/15'
                      }`}
                    >
                      {s === 'slow' ? '🐢 Slow' : s === 'normal' ? '▶ Normal' : '⚡ Fast'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {block.inspectorStep === 2 && (
              <div className="mt-2 p-2 rounded-lg bg-violet-500/10 border border-violet-500/20">
                <p className="text-xs text-violet-200/70 font-body leading-relaxed">💡 {getRLNote({ ...block, inspectorStep: 2 })}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: Prediction ── */}
        {isIdle && (
          <div className="px-4 py-3 border-b border-white/8">
            <p className="text-xs text-white/50 font-heading font-semibold uppercase tracking-wider mb-2">
              3 · Your Prediction
            </p>
            <p className="text-xs text-white/50 font-body mb-2">
              How many steps do you think the AI will need?
            </p>
            <input
              type="number"
              min={1}
              max={999}
              value={block.userPrediction ?? ''}
              onChange={(e) => updateRLBlock(block.id, { userPrediction: parseInt(e.target.value) || null })}
              placeholder="Your guess…"
              className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/15 text-white text-sm placeholder-white/30 outline-none focus:border-violet-400 font-body mb-2"
            />
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => {
                resetTraining(block.id)
                updateRLBlock(block.id, { inspectorStep: 4 })
                setTimeout(handleStartTraining, 50)
              }}
              className="w-full py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-heading font-semibold transition-colors"
            >
              ▶ Start Training
            </button>
            <div className="mt-2 p-2 rounded-lg bg-violet-500/10 border border-violet-500/20">
              <p className="text-xs text-violet-200/70 font-body leading-relaxed">💡 {getRLNote({ ...block, inspectorStep: 3 })}</p>
            </div>
          </div>
        )}

        {/* ── Step 4: Training live ── */}
        {(isTraining || isPaused) && (
          <div className="px-4 py-3 border-b border-white/8">
            <p className="text-xs text-white/50 font-heading font-semibold uppercase tracking-wider mb-2">
              4 · Training
            </p>

            {/* Progress bar */}
            <div className="flex flex-col gap-1 mb-3">
              <div className="flex items-center justify-between text-xs font-body">
                <span className="text-white/60">Episode {block.currentEpisode} / {block.episodes}</span>
                <span className="text-violet-400">🎲 {Math.round(epsilon * 100)}% exploring</span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-2 bg-gradient-to-r from-violet-500 to-cyan-400 rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(2, (block.currentEpisode / block.episodes) * 100)}%` }}
                />
              </div>
            </div>

            {/* Reward chart */}
            {block.rewardHistory.length > 1 && (
              <div className="mb-3">
                <p className="text-xs text-white/40 font-body mb-1">Reward per episode:</p>
                <div className="bg-white/5 rounded-lg p-2 border border-white/8">
                  <RewardChart history={block.rewardHistory} />
                </div>
              </div>
            )}

            {block.bestSteps !== null && (
              <p className="text-xs text-emerald-400 font-body mb-2">🏆 Best so far: {block.bestSteps} steps to goal</p>
            )}

            {/* Controls */}
            <div className="flex gap-2">
              {isTraining ? (
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={handlePause}
                  className="flex-1 py-1.5 rounded-lg bg-amber-600/70 hover:bg-amber-500/70 text-white text-xs font-heading font-semibold transition-all"
                >
                  ⏸ Pause
                </button>
              ) : (
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => {
                    pausedRef.current = false
                    stoppedRef.current = false
                    updateRLBlock(block.id, { trainingStatus: 'training' })
                    setTimeout(handleStartTraining, 10)
                  }}
                  className="flex-1 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-heading font-semibold transition-all"
                >
                  ▶ Resume
                </button>
              )}
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={handleStop}
                className="flex-1 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white/60 text-xs font-heading font-semibold transition-all"
              >
                ⏹ Stop
              </button>
            </div>

            {/* Contextual note */}
            <div className="mt-2 p-2 rounded-lg bg-violet-500/10 border border-violet-500/20">
              <p className="text-xs text-violet-200/70 font-body leading-relaxed">💡 {note}</p>
            </div>

            {isTraining && (
              <p className="text-xs text-white/25 font-body text-center mt-2">
                Click any empty cell on the canvas to add a wall mid-training!
              </p>
            )}
          </div>
        )}

        {/* ── Step 5: Explore Results ── */}
        {isDone && (
          <div className="px-4 py-4 flex flex-col gap-3">
            <p className="text-xs text-white/50 font-heading font-semibold uppercase tracking-wider">
              5 · Explore Results
            </p>

            {/* Stats */}
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex flex-col gap-1.5">
              <p className="text-xs text-emerald-400 font-body font-semibold">✓ Training complete!</p>
              {block.bestSteps !== null && (
                <p className="text-xs text-white/60 font-body">🏆 Best path: {block.bestSteps} steps to goal</p>
              )}
              {successRate !== null && (
                <p className="text-xs text-white/60 font-body">🎯 Success rate: {successRate}% (last 20 eps)</p>
              )}
              {block.userPrediction !== null && block.bestSteps !== null && (
                <p className="text-xs text-violet-300 font-body font-semibold mt-0.5">
                  Your prediction: {block.userPrediction} · Actual: {block.bestSteps}
                  {' '}{Math.abs(block.userPrediction - block.bestSteps) <= 3 ? '→ Nice guess! 🎯' : Math.abs(block.userPrediction - block.bestSteps) <= 8 ? '→ Close!' : '→ Keep experimenting!'}
                </p>
              )}
            </div>

            {/* Reward chart */}
            {block.rewardHistory.length > 1 && (
              <div>
                <p className="text-xs text-white/40 font-body mb-1">Learning curve:</p>
                <div className="bg-white/5 rounded-lg p-2 border border-white/8">
                  <RewardChart history={block.rewardHistory} />
                </div>
              </div>
            )}

            {/* Action buttons */}
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={handleWatchBestPath}
              className="w-full py-2 rounded-lg bg-violet-600/80 hover:bg-violet-500/80 text-white text-sm font-heading font-semibold transition-colors"
            >
              ▶ Watch Best Path
            </button>

            <div className="flex gap-2">
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => updateRLBlock(block.id, {
                  viewMode: block.viewMode === 'heatmap' ? 'grid' : 'heatmap'
                })}
                className={`flex-1 py-1.5 rounded-lg text-xs font-heading font-semibold transition-all ${
                  block.viewMode === 'heatmap'
                    ? 'bg-violet-600 text-white'
                    : 'bg-white/10 text-white/50 hover:bg-white/15'
                }`}
              >
                🌡 {block.viewMode === 'heatmap' ? 'Hide Heatmap' : 'Show Heatmap'}
              </button>
            </div>

            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => {
                resetTraining(block.id)
                updateRLBlock(block.id, { inspectorStep: 2 })
              }}
              className="w-full py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white/60 text-xs font-heading font-semibold transition-all"
            >
              🔁 Change Reward &amp; Retrain
            </button>

            {/* Instructional note */}
            <div className="p-2 rounded-lg bg-violet-500/10 border border-violet-500/20">
              <p className="text-xs text-violet-200/70 font-body leading-relaxed">💡 {note}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
