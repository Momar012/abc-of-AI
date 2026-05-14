'use client'

export default function TopNav() {
  return (
    <header className="flex items-center px-6 py-3 glass-card rounded-none border-b border-white/10 sticky top-0 z-40">
      <div className="flex items-center gap-3">
        <span className="text-2xl">🤖</span>
        <span className="font-heading font-extrabold text-lg bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
          ABCAI
        </span>
        <span className="text-white/30 text-sm hidden sm:inline">Dataset Builder</span>
      </div>
    </header>
  )
}
