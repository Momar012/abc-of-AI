'use client'

import { motion } from 'framer-motion'
import { ReactNode, ButtonHTMLAttributes } from 'react'

interface GlowButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'xs' | 'sm' | 'md' | 'lg'
}

const variantStyles = {
  primary: 'bg-gradient-to-r from-violet-500 to-teal-400 text-white shadow-lg hover:shadow-violet-500/30',
  secondary: 'bg-white/10 text-white border border-white/20 hover:bg-white/20',
  danger: 'bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30',
  ghost: 'text-white/70 hover:text-white hover:bg-white/10',
}

const sizeStyles = {
  // Min heights keep small buttons easy to hit with a finger on touchscreen Chromebooks
  xs: 'px-2 py-1 text-xs min-h-[32px]',
  sm: 'px-3 py-1.5 text-sm min-h-[36px]',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-8 py-3.5 text-base',
}

export default function GlowButton({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled,
  ...props
}: GlowButtonProps) {
  return (
    <motion.button
      whileHover={disabled ? {} : { scale: 1.03 }}
      whileTap={disabled ? {} : { scale: 0.97 }}
      className={`
        rounded-xl font-heading font-semibold transition-all duration-150 cursor-pointer
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${disabled ? 'opacity-40 cursor-not-allowed' : ''}
        ${className}
      `}
      disabled={disabled}
      {...(props as any)}
    >
      {children}
    </motion.button>
  )
}
