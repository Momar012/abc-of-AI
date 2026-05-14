'use client'

import { NodeProps } from 'reactflow'
import { RLGridworldBlock } from '@/types/rl'
import { useRLStore } from '@/store/useRLStore'
import { useUIStore } from '@/store/useUIStore'

const CELL_SIZE = 26 // px per cell on canvas node

function MiniRewardChart({ history }: { history: number[] }) {
  if (history.length < 2) return null
  const min = Math.min(...history)
  const max = Math.max(...history)
  const range = max - min || 1
  const w = 120
  const h = 22
  const pts = history.slice(-40).map((v, i, arr) => {
    const x = (i / (arr.length - 1)) * w
    const y = h - ((v - min) / range) * (h - 2) - 1
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width={w} height={h} className="opacity-70">
      <polyline points={pts} fill="none" stroke="#8B5CF6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function RLGridworldNode({ data }: NodeProps<{ block: RLGridworldBlock }>) {
  const removeRLBlock = useRLStore((s) => s.removeRLBlock)
  const setCell = useRLStore((s) => s.setCell)
  const setSelectedBlock = useUIStore((s) => s.setSelectedBlock)
  const { block } = data

  const isTraining = block.trainingStatus === 'training'
  const isDone = block.trainingStatus === 'done'
  const epsilon = (() => {
    if (!block.currentEpisode) return 1.0
    let e = 1.0
    for (let i = 0; i < block.currentEpisode; i++) e = Math.max(0.05, e * 0.997)
    return e
  })()

  // Heatmap: normalize visit counts
  const maxVisit = block.viewMode === 'heatmap'
    ? Math.max(1, ...block.visitCounts.flat())
    : 1

  const handleCellClick = (r: number, c: number) => {
    if (!isTraining) return
    const cell = block.cells[r][c]
    if (cell === 'start' || cell === 'goal') return
    setCell(block.id, r, c, cell === 'wall' ? 'empty' : 'wall')
  }

  return (
    <div className="flex flex-col">
      <div className="drag-handle flex justify-center items-center py-1.5 px-4 rounded-t-xl cursor-grab active:cursor-grabbing hover:bg-white/5 transition-colors">
        <div className="flex gap-1">
          {[0,1,2,3,4,5].map((i) => (
            <div key={i} className="w-1 h-1 rounded-full bg-white/20" />
          ))}
        </div>
      </div>

      <div
        className="glass-card flex flex-col gap-2 px-3 py-3"
        style={{
          width: block.gridWidth * CELL_SIZE + 28,
          borderColor: isDone ? 'rgba(52,211,153,0.3)' : isTraining ? 'rgba(139,92,246,0.4)' : undefined,
        }}
        onDoubleClick={() => setSelectedBlock(block.id, 'rl-gridworld')}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className={`text-sm flex-shrink-0 ${isTraining ? 'animate-pulse' : ''}`}>🎮</span>
            <span className="text-xs font-heading font-bold text-white truncate">{block.name}</span>
          </div>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => removeRLBlock(block.id)}
            className="w-5 h-5 rounded-full bg-white/10 text-white/40 hover:text-red-400 hover:bg-red-500/20 text-xs flex items-center justify-center transition-all flex-shrink-0"
          >
            ×
          </button>
        </div>

        {/* Training progress row */}
        {(isTraining || isDone) && (
          <div className="flex items-center justify-between text-xs font-body">
            <span className="text-white/60">
              {isTraining ? `Ep ${block.currentEpisode}/${block.episodes}` : `✓ ${block.episodes} eps`}
            </span>
            {isTraining && (
              <span className="text-violet-400">
                🎲 {Math.round(epsilon * 100)}%
              </span>
            )}
            {isDone && block.bestSteps !== null && (
              <span className="text-emerald-400">🏆 {block.bestSteps} steps</span>
            )}
          </div>
        )}

        {/* Grid */}
        <div
          className="relative"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${block.gridWidth}, ${CELL_SIZE}px)`,
            gap: 1,
            background: 'rgba(0,0,0,0.45)',
            borderRadius: 6,
            padding: 2,
          }}
        >
          {block.cells.map((row, r) =>
            row.map((cell, c) => {
              const isAgent = block.agentPos?.row === r && block.agentPos?.col === c
              const isOnPath = !isAgent && block.agentPath.some((p) => p.row === r && p.col === c)
              const visitRatio = block.visitCounts[r]?.[c] / maxVisit

              // Policy arrows (done + grid mode)
              const policyAction = isDone && block.viewMode !== 'heatmap'
                ? block.qTable[`${r},${c}`]
                : null
              const bestDir = policyAction
                ? Object.entries(policyAction).reduce((a, b) => a[1] > b[1] ? a : b)?.[0]
                : null
              const arrowMap: Record<string, string> = { up: '↑', down: '↓', left: '←', right: '→' }

              let bg = 'rgba(255,255,255,0.09)'
              let borderColor = 'rgba(255,255,255,0.18)'
              if (cell === 'wall') { bg = 'rgba(20,18,40,0.95)'; borderColor = 'rgba(255,255,255,0.08)' }
              else if (cell === 'start') { bg = 'rgba(99,102,241,0.35)'; borderColor = 'rgba(99,102,241,0.70)' }
              else if (cell === 'goal') { bg = 'rgba(251,191,36,0.55)'; borderColor = 'rgba(251,191,36,0.90)' }
              else if (block.viewMode === 'heatmap' && visitRatio > 0) {
                bg = `rgba(249,115,22,${Math.min(0.87, 0.12 + visitRatio * 0.75)})`
              }

              return (
                <div
                  key={`${r}-${c}`}
                  onPointerDown={(e) => { e.stopPropagation(); handleCellClick(r, c) }}
                  style={{
                    width: CELL_SIZE,
                    height: CELL_SIZE,
                    background: bg,
                    borderRadius: 3,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    cursor: isTraining ? 'crosshair' : 'default',
                    position: 'relative',
                    transition: 'background 0.1s',
                    border: isAgent ? '2px solid rgba(239,68,68,1.0)' : `1px solid ${borderColor}`,
                  }}
                >
                  {cell === 'goal' ? '⭐' :
                   cell === 'wall' ? '' :
                   isAgent ? '🔴' :
                   isOnPath ? <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(34,211,153,0.80)', display: 'block' }} /> :
                   (bestDir && cell !== 'start') ? <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: 700 }}>{arrowMap[bestDir]}</span> :
                   cell === 'start' ? '🤖' :
                   null
                  }
                </div>
              )
            })
          )}
        </div>

        {/* Reward chart */}
        {block.rewardHistory.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/30 font-body">reward</span>
            <MiniRewardChart history={block.rewardHistory} />
          </div>
        )}

        {/* Status / hint */}
        {block.trainingStatus === 'idle' && (
          <p className="text-xs text-white/25 font-body text-center">Double-click to configure</p>
        )}
        {block.trainingStatus === 'paused' && (
          <p className="text-xs text-amber-400/70 font-body text-center">⏸ Paused</p>
        )}
      </div>
    </div>
  )
}
