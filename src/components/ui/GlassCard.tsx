'use client'

import { motion, HTMLMotionProps } from 'framer-motion'
import { ReactNode } from 'react'

interface GlassCardProps extends HTMLMotionProps<'div'> {
  children: ReactNode
  className?: string
  dark?: boolean
}

export default function GlassCard({ children, className = '', dark = false, ...props }: GlassCardProps) {
  return (
    <motion.div
      className={`${dark ? 'glass-card-dark' : 'glass-card'} ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  )
}
