'use client'

import { useDatasetStore } from '@/store/useDatasetStore'
import { useUIStore } from '@/store/useUIStore'

export function useValidation() {
  const runValidation = useDatasetStore((s) => s.runValidation)
  const validationResult = useDatasetStore((s) => s.validationResult)
  const earnBadge = useUIStore((s) => s.earnBadge)
  const addToast = useUIStore((s) => s.addToast)

  const check = async () => {
    await new Promise((r) => setTimeout(r, 600))
    runValidation()

    const result = useDatasetStore.getState().validationResult
    if (result?.passed) {
      addToast('🎉 Dataset passed all checks!', 'success')
      earnBadge('label-master')
    }
    if (result?.earnedBadges.includes('balanced-dataset')) {
      earnBadge('balanced-dataset')
    }
  }

  return { check, validationResult }
}
