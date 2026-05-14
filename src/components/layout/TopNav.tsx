'use client'

import { useUIStore } from '@/store/useUIStore'
import { BADGES } from '@/lib/badges'

export default function TopNav() {
  const earnedBadges = useUIStore((s) => s.earnedBadges)

  return (
    <header className="flex items-center justify-between px-6 py-3 glass-card rounded-none border-b border-white/10 sticky top-0 z-40">
      <div className="flex items-center gap-3">
        <span className="text-2xl">🤖</span>
        <span className="font-heading font-extrabold text-lg bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
          ABCAI
        </span>
        <span className="text-white/30 text-sm hidden sm:inline">Dataset Builder</span>
      </div>

      <div className="flex items-center gap-2">
        {BADGES.map((badge) => {
          const isEarned = earnedBadges.includes(badge.id)
          return (
            <span
              key={badge.id}
              title={`${badge.name}: ${badge.description}`}
              className={`text-xl transition-all ${isEarned ? 'opacity-100' : 'opacity-20 grayscale'}`}
            >
              {badge.icon}
            </span>
          )
        })}
      </div>
    </header>
  )
}
