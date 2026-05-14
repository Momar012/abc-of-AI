'use client'

import { motion } from 'framer-motion'

interface IconBadgeProps {
  icon: string
  label: string
  color: string
  earned?: boolean
}

export default function IconBadge({ icon, label, color, earned = false }: IconBadgeProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.08 }}
      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all
        ${earned
          ? 'bg-white/10 border-white/20'
          : 'bg-white/3 border-white/8 opacity-40 grayscale'
        }`}
    >
      <span className="text-2xl">{icon}</span>
      <span
        className="text-xs font-heading font-semibold text-center leading-tight"
        style={{ color: earned ? color : '#888' }}
      >
        {label}
      </span>
    </motion.div>
  )
}
