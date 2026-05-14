'use client'

import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'

export default function Home() {
  const router = useRouter()

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

        <h1 className="font-heading text-5xl font-extrabold mb-4 bg-gradient-to-r from-violet-400 via-cyan-400 to-pink-400 bg-clip-text text-transparent">
          abc of AI
        </h1>

        <p className="text-xl text-white/80 mb-3 font-heading font-semibold">
        AI Sandbox for Kids
        </p>

        <p className="text-white/60 mb-10 leading-relaxed">
        A fun and simple way for kids to build datasets, train AI models, and explore how machines learn.
        </p>

        <motion.button
          whileHover={{ scale: 1.05, boxShadow: '0 0 28px rgba(124, 58, 237, 0.6)' }}
          whileTap={{ scale: 0.97 }}
          onClick={() => router.push('/dataset-builder')}
          className="px-10 py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-cyan-500 text-white font-heading font-bold text-lg shadow-lg"
        >
          🚀 Start Building
        </motion.button>

        <p className="mt-6 text-white/30 text-sm">No sign-up needed · Works in your browser</p>
      </div>
    </main>
  )
}
