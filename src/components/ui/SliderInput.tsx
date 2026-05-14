'use client'

interface SliderInputProps {
  label: string
  value: number
  min?: number
  max?: number
  color?: string
  onChange: (value: number) => void
}

export default function SliderInput({
  label,
  value,
  min = 1,
  max = 98,
  color = '#7C3AED',
  onChange,
}: SliderInputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-white/70 font-heading font-medium">{label}</span>
        <span className="font-heading font-bold" style={{ color }}>{value}%</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, ${color} ${value}%, rgba(255,255,255,0.15) ${value}%)`,
          accentColor: color,
        }}
      />
    </div>
  )
}
