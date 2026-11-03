import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type AbeeConnection = 'idle' | 'connecting' | 'ready' | 'error'
export type AbeeStatus = 'idle' | 'listening' | 'thinking' | 'speaking'

export interface AbeeLaser {
  target: string
  note?: string
  /** Changes on every point, so pointing at the same spot twice replays the animation */
  nonce: number
  /** During a demo the dot stays on its target instead of drifting back to the cursor */
  sticky?: boolean
}

/** A dotted laser line between two things, e.g. "drag a wire from this dot to that dot" */
export interface AbeeLaserPath {
  from: string
  to: string
  note?: string
  nonce: number
}

interface AbeeState {
  /** Abee is switched on: the dot follows the cursor and Alt talks to it */
  active: boolean
  connection: AbeeConnection
  status: AbeeStatus
  errorMessage: string | null
  /** A short system line under the captions ("No microphone, so double-tap Alt to type") */
  notice: string | null
  /** What the student said or typed last */
  transcript: string
  /** What Abee is saying right now */
  reply: string
  laser: AbeeLaser | null
  laserPath: AbeeLaserPath | null
  takeoverActive: boolean
  micAvailable: boolean
  /** The type-a-question bar */
  textOpen: boolean

  // Persisted preferences
  /** Show Abee's words on screen as subtitles (off by default; the voice carries it) */
  captionsOn: boolean
  muted: boolean
  hintSeen: boolean

  set: (partial: Partial<AbeeState>) => void
  pointAt: (target: string, note?: string, sticky?: boolean) => void
  showPath: (from: string, to: string, note?: string) => void
  clearLaser: () => void
  setMuted: (muted: boolean) => void
  dismissHint: () => void
}

export const useAbeeStore = create<AbeeState>()(persist((set) => ({
  active: false,
  connection: 'idle',
  status: 'idle',
  errorMessage: null,
  notice: null,
  transcript: '',
  reply: '',
  laser: null,
  laserPath: null,
  takeoverActive: false,
  micAvailable: true,
  textOpen: false,
  captionsOn: false,
  muted: false,
  hintSeen: false,

  set: (partial) => set(partial),
  pointAt: (target, note, sticky) => set({ laser: { target, note, sticky, nonce: Date.now() + Math.random() }, laserPath: null }),
  showPath: (from, to, note) => set({ laserPath: { from, to, note, nonce: Date.now() + Math.random() }, laser: null }),
  clearLaser: () => set({ laser: null, laserPath: null }),
  setMuted: (muted) => set({ muted }),
  dismissHint: () => set({ hintSeen: true }),
}), {
  name: 'abcai_abee_v1',
  partialize: (s) => ({ active: s.active, captionsOn: s.captionsOn, muted: s.muted, hintSeen: s.hintSeen }),
}))
