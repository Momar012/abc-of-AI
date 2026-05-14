'use client'

import { useUIStore } from '@/store/useUIStore'
import { BADGES } from '@/lib/badges'
import IconBadge from '@/components/ui/IconBadge'

export default function BadgeCollection() {
  const earnedBadges = useUIStore((s) => s.earnedBadges)

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-heading font-bold text-white text-sm flex items-center gap-2">
        🏆 Your Badges
        <span className="text-xs text-white/40 font-normal">{earnedBadges.length}/{BADGES.length}</span>
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {BADGES.map((badge) => (
          <IconBadge
            key={badge.id}
            icon={badge.icon}
            label={badge.name}
            color={badge.color}
            earned={earnedBadges.includes(badge.id)}
          />
        ))}
      </div>
    </div>
  )
}
