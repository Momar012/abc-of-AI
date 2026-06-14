'use client'

import AbitaWordmark from '@/components/ui/AbitaWordmark'

export default function TopNav() {
  return (
    <header className="flex items-center px-6 py-3 glass-panel rounded-none border-b border-white/10 sticky top-0 z-40">
      <div className="flex items-center gap-3">
        <span className="text-2xl">🤖</span>
        <AbitaWordmark className="text-lg" />
        <span className="text-white/40 text-sm hidden sm:inline">AI Sandbox for Kids</span>
      </div>
    </header>
  )
}
