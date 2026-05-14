'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useEffect } from 'react'
import { useUIStore, Toast } from '@/store/useUIStore'

function ToastItem({ toast }: { toast: Toast }) {
  const removeToast = useUIStore((s) => s.removeToast)

  useEffect(() => {
    const timer = setTimeout(() => removeToast(toast.id), 4000)
    return () => clearTimeout(timer)
  }, [toast.id, removeToast])

  const colors = {
    info: 'bg-white/10 border-white/20 text-white',
    success: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300',
    warn: 'bg-amber-500/15 border-amber-500/40 text-amber-300',
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85, y: 20 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      className={`px-4 py-3 rounded-xl border backdrop-blur-lg text-sm font-heading font-semibold cursor-pointer shadow-xl
        ${colors[toast.type]}`}
      onClick={() => removeToast(toast.id)}
    >
      {toast.message}
    </motion.div>
  )
}

export default function BadgeToast() {
  const toasts = useUIStore((s) => s.toasts)

  return (
    <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-50 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem toast={toast} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  )
}
