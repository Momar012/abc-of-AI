'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAbeeStore } from '@/store/useAbeeStore'
import { useUIStore } from '@/store/useUIStore'
import { useAbeePushToTalk } from '@/hooks/useAbeePushToTalk'
import { startActivityTracking } from '@/lib/abee/activity'
import { startTalking, stopTalking, sendText, hush, disconnect, inputBands } from '@/lib/abee/realtime'
import { abortTakeover, stopGuidance } from '@/lib/abee/takeover'
import AbeeCursor from './AbeeCursor'

const THINKING_MESSAGES = [
  'Looking at your canvas',
  'Checking your lab goals',
  'Finding a good hint',
  'Thinking it through',
]

/** Keep captions up this long after Abee goes quiet, plus a little per word */
const CAPTION_LINGER_MS = 5000

function useRotatingMessage(active: boolean, messages: string[], everyMs = 1600) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (!active) { setI(0); return }
    const t = setInterval(() => setI((n) => (n + 1) % messages.length), everyMs)
    return () => clearInterval(t)
  }, [active, messages.length, everyMs])
  return messages[i]
}

const Key = ({ children }: { children: React.ReactNode }) => (
  <kbd className="px-1.5 py-px rounded border border-white/20 bg-white/5 text-[10px] font-heading font-semibold text-white/70">
    {children}
  </kbd>
)

/** Turns Abee's on-screen captions on or off (they're off by default) */
function CaptionsToggle() {
  const captionsOn = useAbeeStore((s) => s.captionsOn)
  const set = useAbeeStore((s) => s.set)
  return (
    <button
      onClick={() => set({ captionsOn: !captionsOn })}
      data-abee="abee.captions"
      aria-pressed={captionsOn}
      aria-label={captionsOn ? 'Hide captions' : 'Show captions'}
      title={captionsOn ? 'Hide captions' : 'Show captions'}
      className={`h-6 px-1.5 rounded-md text-[10px] font-heading font-extrabold tracking-wider backdrop-blur-md transition-colors ${
        captionsOn
          ? 'bg-cyan-300/90 text-slate-950'
          : 'bg-slate-950/50 border border-white/15 text-white/50 hover:text-white/80 hover:border-white/30'
      }`}
    >
      CC
    </button>
  )
}

/** Abee's on/off switch. Tap to toggle; on touchscreens, press and hold it to talk. */
function AbeeSwitch() {
  const active = useAbeeStore((s) => s.active)
  const status = useAbeeStore((s) => s.status)
  const inspectorOpen = useUIStore((s) => !!s.selectedBlockId)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const talking = useRef(false)
  // A press-and-hold to talk shouldn't also count as a tap on the switch
  const suppressClick = useRef(false)

  const toggle = () => {
    const abee = useAbeeStore.getState()
    if (abee.active) {
      abortTakeover()
      stopGuidance()
      hush()
      disconnect()
      abee.set({ active: false, textOpen: false, reply: '', transcript: '', notice: null, errorMessage: null, laser: null })
    } else {
      abee.set({
        active: true,
        notice: abee.hintSeen ? null : 'hint',
      })
    }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch' || !active) return
    holdTimer.current = setTimeout(() => {
      talking.current = true
      startTalking()
    }, 350)
  }
  const onPointerUp = (e: React.PointerEvent) => {
    if (holdTimer.current) clearTimeout(holdTimer.current)
    holdTimer.current = null
    if (talking.current) {
      talking.current = false
      suppressClick.current = true
      stopTalking()
    }
  }

  return (
    <div
      className={`group fixed bottom-4 z-[10002] flex items-center gap-2 transition-all duration-300 ${
        inspectorOpen ? 'right-[15rem] lg:right-[16rem] xl:right-[18rem] 2xl:right-[22rem]' : 'right-4'
      }`}
    >
      <span className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity text-[11px] font-heading font-semibold tracking-wide text-white/60 whitespace-nowrap">
        {active ? 'Abee is on' : 'Turn on Abee'}
      </span>
      {active && <CaptionsToggle />}
      <button
        onClick={() => {
          if (suppressClick.current) { suppressClick.current = false; return }
          toggle()
        }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onContextMenu={(e) => e.preventDefault()}
        data-abee="abee"
        aria-label={active ? 'Turn off Abee' : 'Turn on Abee, your AI tutor'}
        aria-pressed={active}
        className={`relative w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md transition-all duration-300 touch-none select-none ${
          active
            ? 'bg-slate-950/60 border border-cyan-300/40 shadow-[0_0_18px_rgba(103,232,249,0.25)]'
            : 'bg-slate-950/40 border border-white/15 hover:border-white/30'
        }`}
      >
        <motion.span
          className={`rounded-full ${active ? 'bg-cyan-100 shadow-[0_0_10px_3px_rgba(103,232,249,0.7)]' : 'bg-white/35'}`}
          animate={
            active
              ? { width: 8, height: 8, opacity: status === 'idle' ? [0.7, 1, 0.7] : 1 }
              : { width: 6, height: 6, opacity: 1 }
          }
          transition={active && status === 'idle' ? { duration: 2.4, repeat: Infinity } : { duration: 0.3 }}
        />
      </button>
    </div>
  )
}

const WAVE_BARS = 15

/** Shown while the student holds Alt: live voice bars, like a voice-dictation pill */
function ListeningPill() {
  const bars = useRef<(HTMLSpanElement | null)[]>([])
  useEffect(() => {
    let raf = 0
    const tick = () => {
      inputBands(WAVE_BARS).forEach((v, i) => {
        const el = bars.current[i]
        if (el) el.style.transform = `scaleY(${0.18 + v * 0.82})`
      })
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <motion.div
      key="listening"
      initial={{ opacity: 0, y: 8, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
      className="flex items-center gap-3 h-10 pl-4 pr-4 rounded-full bg-slate-950/85 backdrop-blur-md border border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.45)]"
    >
      <div className="flex items-center gap-[3px] h-5" aria-hidden>
        {Array.from({ length: WAVE_BARS }).map((_, i) => (
          <span
            key={i}
            ref={(el) => { bars.current[i] = el }}
            className="w-[3px] h-full rounded-full bg-cyan-100 shadow-[0_0_6px_rgba(103,232,249,0.6)] transition-transform duration-75 ease-out"
            style={{ transform: 'scaleY(0.18)' }}
          />
        ))}
      </div>
      <span className="text-[12px] font-heading font-semibold tracking-wide text-white/85">Listening</span>
    </motion.div>
  )
}

/** Subtitle-style captions at the bottom of the screen, plus the type bar */
function AbeeCaptions() {
  const active = useAbeeStore((s) => s.active)
  const status = useAbeeStore((s) => s.status)
  const connection = useAbeeStore((s) => s.connection)
  const transcript = useAbeeStore((s) => s.transcript)
  const reply = useAbeeStore((s) => s.reply)
  const errorMessage = useAbeeStore((s) => s.errorMessage)
  const notice = useAbeeStore((s) => s.notice)
  const textOpen = useAbeeStore((s) => s.textOpen)
  const captionsOn = useAbeeStore((s) => s.captionsOn)
  const set = useAbeeStore((s) => s.set)

  const thinking = status === 'thinking' || connection === 'connecting'
  const thinkingMessage = useRotatingMessage(thinking && !reply, THINKING_MESSAGES)
  const [draft, setDraft] = useState('')
  const [visible, setVisible] = useState(false)

  // Show while anything is happening; fade out a while after Abee goes quiet
  const busy = status !== 'idle' || connection === 'connecting' || textOpen
  const hasContent = !!((captionsOn && (transcript || reply)) || errorMessage || notice)
  useEffect(() => {
    if (busy) { setVisible(true); return }
    if (!hasContent) { setVisible(false); return }
    setVisible(true)
    const t = setTimeout(() => setVisible(false), CAPTION_LINGER_MS + reply.length * 30)
    return () => clearTimeout(t)
  }, [busy, hasContent, reply, transcript, errorMessage, notice, captionsOn])

  const submit = () => {
    if (!draft.trim()) return
    sendText(draft)
    setDraft('')
    set({ textOpen: false })
  }

  if (!active) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[10002] w-[min(38rem,calc(100vw-2rem))] flex flex-col items-center gap-2 pointer-events-none text-center">
      <AnimatePresence mode="popLayout">
        {visible && (
          <motion.div
            key="captions"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center gap-1.5"
          >
            {captionsOn && transcript && status !== 'listening' && (
              <p dir="auto" className="text-[13px] font-body text-white/45 italic">“{transcript}”</p>
            )}

            {!captionsOn ? null : reply ? (
              <p dir="auto" className="px-4 py-2 rounded-2xl bg-slate-950/55 backdrop-blur-md text-[16px] leading-snug font-body text-white/95 [text-shadow:0_1px_10px_rgba(0,0,0,0.5)]">
                {reply}
              </p>
            ) : thinking ? (
              <p className="text-[11px] font-heading font-semibold uppercase tracking-[0.25em] text-cyan-200/70 animate-pulse">
                {thinkingMessage}
              </p>
            ) : null}

            {errorMessage && connection === 'error' && (
              <p className="text-[13px] font-body text-amber-200/90">{errorMessage}</p>
            )}

            {notice === 'hint' ? (
              <p className="px-3 py-1.5 rounded-full bg-slate-950/55 backdrop-blur-md text-[12px] font-body text-white/70 flex items-center gap-2">
                Abee is on · hold <Key>Alt</Key> to talk · double-tap <Key>Alt</Key> to type · <Key>CC</Key> for captions
              </p>
            ) : notice ? (
              <p className="text-[12px] font-body text-white/55">{notice}</p>
            ) : null}

          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {status === 'listening' && <ListeningPill />}
      </AnimatePresence>

      <AnimatePresence>
        {textOpen && (
          <motion.div
            key="type-bar"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-auto w-full max-w-md flex items-center gap-3 h-11 px-4 rounded-full bg-slate-950/70 backdrop-blur-md border border-cyan-300/25 shadow-[0_0_30px_rgba(103,232,249,0.12)]"
          >
            <span className="w-2 h-2 rounded-full bg-cyan-100 shadow-[0_0_8px_2px_rgba(103,232,249,0.7)] flex-shrink-0" />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit()
                if (e.key === 'Escape') set({ textOpen: false })
              }}
              onBlur={() => { if (!draft.trim()) set({ textOpen: false }) }}
              dir="auto"
              placeholder="Ask Abee anything…"
              maxLength={500}
              autoFocus
              className="flex-1 min-w-0 bg-transparent outline-none text-[14px] font-body text-white placeholder:text-white/35"
            />
            <Key>Enter</Key>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** A quiet note at the top while Abee demonstrates, plus a shield against stray clicks */
function TakeoverIndicator() {
  const takeoverActive = useAbeeStore((s) => s.takeoverActive)
  return (
    <AnimatePresence>
      {takeoverActive && (
        <>
          <div className="fixed inset-0 z-[9998] cursor-not-allowed" onPointerDown={(e) => e.stopPropagation()} />
          <motion.button
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            onClick={abortTakeover}
            className="fixed top-3 left-1/2 -translate-x-1/2 z-[10002] flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-950/70 backdrop-blur-md border border-cyan-300/30 text-[12px] font-heading font-semibold tracking-wide text-cyan-100/90"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-200 animate-pulse" />
            Abee is showing you
            <span className="text-white/40">·</span>
            <span className="text-white/60">Esc to take over</span>
          </motion.button>
        </>
      )}
    </AnimatePresence>
  )
}

export default function AbeeDock() {
  useAbeePushToTalk()
  useEffect(() => startActivityTracking(), [])

  // Dev only: drive Abee's tools from the browser console without an OpenAI key,
  // e.g. __abee.runTool('point_at', { target: 'toolbar.actions' })
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return
    Promise.all([
      import('@/lib/abee/takeover'),
      import('@/lib/abee/context'),
      import('@/store/useRuleStore'),
      import('@/store/useWorkflowStore'),
    ]).then(([{ runTool }, { buildScreenState }, { useRuleStore }, { useWorkflowStore }]) => {
      ;(window as any).__abee = { runTool, buildScreenState, store: useAbeeStore, rules: useRuleStore, workflow: useWorkflowStore }
    })
  }, [])

  return (
    <>
      <TakeoverIndicator />
      <AbeeCaptions />
      <AbeeSwitch />
      <AbeeCursor />
    </>
  )
}
