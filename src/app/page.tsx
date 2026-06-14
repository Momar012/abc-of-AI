'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import AbitaWordmark from '@/components/ui/AbitaWordmark'

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <div className="max-w-xl">
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className="text-7xl mb-6"
        >
          🤖
        </motion.div>

        <h1 className="mb-4">
          <AbitaWordmark className="text-5xl" />
        </h1>

        <p className="text-xl text-white/80 mb-3 font-heading font-semibold">
        AI Sandbox for Kids
        </p>

        <p className="text-white/60 mb-10 leading-relaxed">
        A fun and simple way for kids to build datasets, train AI models, and explore how machines learn.
        </p>

        <Link href="/dataset-builder">
          <motion.button
            whileHover={{ scale: 1.05, boxShadow: '0 0 28px rgba(124, 58, 237, 0.6)' }}
            whileTap={{ scale: 0.97 }}
            className="px-10 py-4 rounded-2xl bg-gradient-to-r from-violet-500 to-teal-400 text-white font-heading font-bold text-lg shadow-lg"
          >
            🚀 Start Building
          </motion.button>
        </Link>

        <p className="mt-6 text-white/40 text-sm">No sign-up needed · Works in your browser</p>
      </div>
    </main>
  )
}
