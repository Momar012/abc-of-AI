'use client'

import { useEffect, useRef, useState } from 'react'
import { NodeProps, Handle, Position } from 'reactflow'
import { motion, useAnimationControls } from 'framer-motion'
import { BinBlock } from '@/types/rules'
import { useRuleStore } from '@/store/useRuleStore'
import { BIN_COLORS } from '@/lib/binColors'

const SPARKLES = [
  { x: -34, y: -18 }, { x: 34, y: -22 }, { x: -26, y: 14 }, { x: 28, y: 10 },
]

export default function BinNode({ data, selected }: NodeProps<{ block: BinBlock }>) {
  const { block } = data
  const removeBinBlock = useRuleStore((s) => s.removeBinBlock)
  const evaluateGraph = useRuleStore((s) => s.evaluateGraph)

  const isOn = block.isOn
  const c = BIN_COLORS[block.color] ?? BIN_COLORS.blue
  const bodyControls = useAnimationControls()

  // Each time the condition turns true, drop an item in and count it.
  // Starting from the mounted value means a reload doesn't replay the drop.
  const wasOn = useRef(isOn)
  const [dropKey, setDropKey] = useState(0)
  const [sortedCount, setSortedCount] = useState(0)
  useEffect(() => {
    if (isOn && !wasOn.current) {
      setDropKey((k) => k + 1)
      setSortedCount((n) => n + 1)
      bodyControls.start({
        scaleX: [1, 1, 1.1, 0.95, 1],
        scaleY: [1, 1, 0.86, 1.05, 1],
        transition: { duration: 0.9, times: [0, 0.45, 0.6, 0.8, 1] },
      })
    }
    wasOn.current = isOn
  }, [isOn, bodyControls])

  return (
    <div className="flex flex-col">
      <Handle
        type="target"
        position={Position.Left}
        id="bin-in"
        style={{ background: '#10B981', border: '2px solid #064E3B', width: 12, height: 12, left: -6, top: '50%' }}
      />

      <div className="drag-handle flex justify-center items-center py-1.5 px-4 rounded-t-xl cursor-grab active:cursor-grabbing hover:bg-white/5 transition-colors">
        <div className="flex gap-1">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="w-1 h-1 rounded-full bg-white/20" />
          ))}
        </div>
      </div>

      <div
        className="glass-card w-40 flex flex-col items-center gap-2 px-4 py-3"
        style={{
          boxShadow: selected ? '0 0 0 2px rgba(139,92,246,0.9), 0 0 20px rgba(139,92,246,0.4)' : undefined,
          transition: 'box-shadow 0.2s ease',
        }}
      >
        <div className="w-full flex items-center justify-between">
          <span className="text-xs font-heading font-bold text-white/70 truncate">{block.name}</span>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => { removeBinBlock(block.id); evaluateGraph() }}
            className="w-5 h-5 rounded-full bg-white/10 text-white/40 hover:text-red-400 hover:bg-red-500/20 text-xs flex items-center justify-center transition-all shrink-0"
          >
            ×
          </button>
        </div>

        <div className="relative w-20 h-24 flex items-end justify-center">
          {/* Coloured glow while the condition is true */}
          <motion.div
            className="absolute inset-x-1 bottom-0 h-16 rounded-full blur-xl"
            animate={{ opacity: isOn ? [0.45, 0.85, 0.45] : 0 }}
            transition={isOn ? { repeat: Infinity, duration: 1.6, ease: 'easeInOut' } : { duration: 0.3 }}
            style={{ background: c.glow }}
          />

          {/* Trash item dropping in */}
          {dropKey > 0 && (
            <motion.span
              key={`item-${dropKey}`}
              className="absolute left-1/2 top-0 text-xl pointer-events-none z-10"
              style={{ x: '-50%' }}
              initial={{ y: -28, opacity: 0, rotate: -20 }}
              animate={{ y: [-28, -6, 34], opacity: [0, 1, 0], rotate: [-20, 10, 40] }}
              transition={{ duration: 0.75, times: [0, 0.35, 1], ease: 'easeIn' }}
            >
              {c.item}
            </motion.span>
          )}

          {/* Sparkles */}
          {dropKey > 0 && SPARKLES.map((p, i) => (
            <motion.span
              key={`spark-${dropKey}-${i}`}
              className="absolute left-1/2 top-1/2 text-xs pointer-events-none z-10"
              initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
              animate={{ x: p.x, y: p.y, opacity: [0, 1, 0], scale: [0.4, 1.2, 0.6] }}
              transition={{ duration: 0.7, delay: 0.6 + i * 0.05 }}
            >
              ✨
            </motion.span>
          ))}

          <motion.div animate={bodyControls} style={{ originY: 1 }} className="relative">
            <svg width="64" height="80" viewBox="0 0 64 80" aria-hidden>
              {/* Body */}
              <path d="M8 22 L56 22 L51 76 Q50.5 79 47 79 L17 79 Q13.5 79 13 76 Z" fill={c.fill} stroke={c.dark} strokeWidth="2" />
              {[22, 32, 42].map((x) => (
                <line key={x} x1={x} y1="30" x2={x + (x - 32) * 0.08} y2="70" stroke={c.dark} strokeOpacity="0.45" strokeWidth="2" strokeLinecap="round" />
              ))}
              <text x="32" y="58" textAnchor="middle" fontSize="18" fill="#fff" fillOpacity="0.9">♻</text>
              {/* Lid, hinged at its back-left corner */}
              <motion.g
                animate={{ rotate: isOn ? -38 : 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 14 }}
                style={{ transformBox: 'fill-box', transformOrigin: '0% 100%' }}
              >
                <rect x="4" y="14" width="56" height="8" rx="3" fill={c.fill} stroke={c.dark} strokeWidth="2" />
                <rect x="25" y="9" width="14" height="6" rx="2" fill={c.dark} />
              </motion.g>
            </svg>
          </motion.div>
        </div>

        <p className={`text-xs font-heading font-bold ${isOn ? 'text-emerald-400' : 'text-white/40'}`}>
          {isOn ? '♻️ Sorting!' : '🗑️ Waiting…'}
        </p>
        {sortedCount > 0 && (
          <p className="text-[10px] text-white/45 font-body">
            {sortedCount} item{sortedCount === 1 ? '' : 's'} sorted
          </p>
        )}

        {!block.linkedRuleBlockId && (
          <p className="text-xs text-white/35 font-body text-center">Connect a rule</p>
        )}
      </div>
    </div>
  )
}
