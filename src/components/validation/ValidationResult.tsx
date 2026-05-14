'use client'

import { motion } from 'framer-motion'
import { ValidationCheck } from '@/types/dataset'

const statusConfig = {
  pass: { icon: '✅', color: '#10B981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.25)' },
  warn: { icon: '⚠️', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)' },
  tip: { icon: '💡', color: '#06B6D4', bg: 'rgba(6,182,212,0.1)', border: 'rgba(6,182,212,0.25)' },
}

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
}

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
}

interface ValidationResultProps {
  checks: ValidationCheck[]
}

export default function ValidationResult({ checks }: ValidationResultProps) {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-2"
    >
      {checks.map((check) => {
        const cfg = statusConfig[check.status]
        return (
          <motion.div
            key={check.id}
            variants={item}
            className="rounded-xl p-3"
            style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
          >
            <div className="flex items-start gap-2">
              <span className="text-base flex-shrink-0 mt-0.5">{cfg.icon}</span>
              <div className="min-w-0">
                <p className="text-sm font-heading font-semibold" style={{ color: cfg.color }}>
                  {check.label}
                </p>
                <p className="text-xs text-white/70 mt-0.5 font-body">{check.message}</p>
                <p className="text-xs text-white/40 mt-1.5 italic font-body leading-relaxed">
                  {check.educationalNote}
                </p>
              </div>
            </div>
          </motion.div>
        )
      })}
    </motion.div>
  )
}
