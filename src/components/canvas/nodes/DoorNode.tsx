'use client'

import { NodeProps, Handle, Position } from 'reactflow'
import { motion } from 'framer-motion'
import { DoorBlock } from '@/types/workflow'
import { useWorkflowStore } from '@/store/useWorkflowStore'
import { useUIStore } from '@/store/useUIStore'

export default function DoorNode({ data, selected }: NodeProps<{ block: DoorBlock }>) {
  const { block } = data
  const removeDoorBlock = useWorkflowStore((s) => s.removeDoorBlock)
  const setSelectedBlock = useUIStore((s) => s.setSelectedBlock)

  const isOpen = block.isOpen

  return (
    <div className="flex flex-col" onDoubleClick={() => setSelectedBlock(block.id, 'door')}>
      <Handle
        type="target"
        position={Position.Left}
        id="door-in"
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
        className="glass-card w-40 flex flex-col items-center gap-3 px-4 py-3"
        style={{
          boxShadow: selected ? '0 0 0 2px rgba(139,92,246,0.9), 0 0 20px rgba(139,92,246,0.4)' : undefined,
          transition: 'box-shadow 0.2s ease',
        }}
      >
        <div className="w-full flex items-center justify-between">
          <span className="text-xs font-heading font-bold text-white/70">{block.name}</span>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => removeDoorBlock(block.id)}
            className="w-5 h-5 rounded-full bg-white/10 text-white/40 hover:text-red-400 hover:bg-red-500/20 text-xs flex items-center justify-center transition-all"
          >
            ×
          </button>
        </div>

        {/* Animated door */}
        <div className="relative" style={{ width: 72, height: 96, perspective: '400px' }}>
          {/* Door frame */}
          <div className="absolute inset-0 rounded-t-xl border-2 border-amber-700/50 bg-amber-950/40" />
          {/* Door panel */}
          <motion.div
            style={{ transformOrigin: 'left center' }}
            animate={{ rotateY: isOpen ? -75 : 0 }}
            transition={{ type: 'spring', stiffness: 150, damping: 18 }}
            className="absolute inset-0 rounded-t-xl bg-amber-700/85 border-2 border-amber-500/70 flex flex-col items-center justify-center gap-2"
          >
            <div className="w-7 h-4 rounded border border-amber-400/50 bg-amber-600/50" />
            <div className="w-7 h-4 rounded border border-amber-400/50 bg-amber-600/50" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-300/90 self-end mr-1.5" />
          </motion.div>

          {/* Room peek when open */}
          {isOpen && (
            <div className="absolute inset-0 rounded-t-xl bg-violet-900/30 flex items-center justify-center">
              <span className="text-lg">🏠</span>
            </div>
          )}
        </div>

        <p className={`text-xs font-heading font-bold ${isOpen ? 'text-emerald-400' : 'text-white/40'}`}>
          {isOpen ? '🚪 Open!' : '🔒 Closed'}
        </p>

        {!block.linkedRuleBlockId && (
          <p className="text-xs text-white/35 font-body text-center">Connect a rule</p>
        )}
      </div>
    </div>
  )
}
