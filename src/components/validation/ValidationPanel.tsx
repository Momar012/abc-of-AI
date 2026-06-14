'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDatasetStore } from '@/store/useDatasetStore'
import { useUIStore } from '@/store/useUIStore'
import GlowButton from '@/components/ui/GlowButton'
import ValidationResult from './ValidationResult'

export default function ValidationPanel() {
  const runValidation = useDatasetStore((s) => s.runValidation)
  const validationResult = useDatasetStore((s) => s.validationResult)
  const clearValidation = useDatasetStore((s) => s.clearValidation)
  const earnBadge = useUIStore((s) => s.earnBadge)
  const addToast = useUIStore((s) => s.addToast)
  const [loading, setLoading] = useState(false)

  const handleCheck = async () => {
    setLoading(true)
    await new Promise((r) => setTimeout(r, 600)) // satisfying "thinking" delay
    runValidation()
    setLoading(false)

    const result = useDatasetStore.getState().validationResult
    if (result?.passed) {
      addToast('🎉 Dataset passed all checks!', 'success')
      earnBadge('label-master')
    }
    if (result?.earnedBadges.includes('balanced-dataset')) {
      earnBadge('balanced-dataset')
      addToast('🏆 Balanced Dataset badge earned!', 'success')
    }
  }

  return (
    <div className="glass-card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-heading font-bold text-white text-sm flex items-center gap-2">
          ✅ Validate Dataset
        </h3>
        {validationResult && (
          <button
            onClick={clearValidation}
            className="text-xs text-white/40 hover:text-white/60 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      <GlowButton onClick={handleCheck} disabled={loading} className="w-full justify-center">
        {loading ? '🔍 Checking…' : '🔍 Check My Dataset'}
      </GlowButton>

      <AnimatePresence>
        {validationResult && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            {validationResult.passed ? (
              <div className="rounded-xl p-3 bg-mint-500/10 border border-emerald-500/30 text-center">
                <p className="text-emerald-400 font-heading font-bold text-sm">🎉 All checks passed!</p>
                <p className="text-white/50 text-xs mt-1 font-body">Your dataset looks great. Time to split it!</p>
              </div>
            ) : (
              <div className="rounded-xl p-3 bg-amber-500/10 border border-amber-500/30 text-center mb-2">
                <p className="text-amber-400 font-heading font-bold text-sm">⚠️ Some issues found</p>
                <p className="text-white/50 text-xs mt-1 font-body">Fix the warnings below to improve your dataset.</p>
              </div>
            )}
            <ValidationResult checks={validationResult.checks} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
