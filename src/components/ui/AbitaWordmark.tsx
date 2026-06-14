'use client'

const LETTERS: { char: string; className: string }[] = [
  { char: 'A', className: 'text-cyan-300' },
  { char: 'B', className: 'text-amber-300' },
  { char: 'I', className: 'text-emerald-300' },
  { char: 'T', className: 'text-orange-400' },
  { char: 'A', className: 'text-pink-400' },
]

export default function AbitaWordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`font-heading font-extrabold ${className}`}>
      {LETTERS.map((l, i) => (
        <span key={i} className={l.className}>{l.char}</span>
      ))}
    </span>
  )
}
