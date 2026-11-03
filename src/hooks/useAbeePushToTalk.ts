'use client'

import { useEffect } from 'react'
import { useAbeeStore } from '@/store/useAbeeStore'
import { startTalking, stopTalking, cancelTalking, hush } from '@/lib/abee/realtime'
import { abortTakeover, stopGuidance } from '@/lib/abee/takeover'

/** How long Alt must be held alone before Abee starts listening */
const ARM_MS = 250
/** Two quick Alt taps within this window open the type-a-question bar */
const DOUBLE_TAP_MS = 400

const isTyping = (el: EventTarget | null) => {
  const t = el as HTMLElement | null
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
}

/**
 * While Abee is switched on: hold Alt (on its own) to talk, release to send;
 * double-tap Alt to type instead. Alt is also a shortcut modifier (Alt+Tab…),
 * so pressing any other key or clicking while it's down cancels the turn and
 * lets the shortcut through untouched. Esc stops Abee talking or ends a demo.
 */
export function useAbeePushToTalk() {
  useEffect(() => {
    let armTimer: ReturnType<typeof setTimeout> | null = null
    let live = false
    // Alt was combined with something else this press — don't treat its release as ours
    let usedAsModifier = false
    let pressedAt = 0
    let lastTapAt = 0

    const abee = () => useAbeeStore.getState()

    const disarm = () => {
      if (armTimer) clearTimeout(armTimer)
      armTimer = null
    }
    const cancel = () => {
      disarm()
      if (live) {
        live = false
        cancelTalking()
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (!abee().active) return

      if (e.key === 'Escape') {
        if (abee().textOpen) abee().set({ textOpen: false })
        abortTakeover()
        stopGuidance()
        abee().clearLaser()
        hush()
        return
      }
      if (e.key !== 'Alt') {
        // Alt+<key> is a shortcut, not a question
        if (e.altKey) {
          usedAsModifier = true
          cancel()
        }
        return
      }
      if (e.repeat || e.shiftKey || e.ctrlKey || e.metaKey || isTyping(e.target)) return
      // A lone Alt tap moves focus to Chrome's menu on Windows — keep focus in the app
      e.preventDefault()
      usedAsModifier = false
      pressedAt = Date.now()
      disarm()
      armTimer = setTimeout(() => {
        armTimer = null
        live = true
        abee().dismissHint()
        startTalking()
      }, ARM_MS)
    }

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key !== 'Alt' || !abee().active) return
      if (!usedAsModifier) e.preventDefault()
      disarm()
      if (live) {
        live = false
        stopTalking()
        return
      }
      // A quick tap — two of them in a row opens the type bar
      if (!usedAsModifier && Date.now() - pressedAt < ARM_MS) {
        const now = Date.now()
        if (now - lastTapAt < DOUBLE_TAP_MS) {
          lastTapAt = 0
          abee().dismissHint()
          abee().set({ textOpen: true })
        } else {
          lastTapAt = now
        }
      }
    }

    // Alt+click and Alt+wheel aren't questions either
    const onPointer = (e: MouseEvent) => {
      if (e.altKey) {
        usedAsModifier = true
        cancel()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('pointerdown', onPointer, true)
    window.addEventListener('wheel', onPointer, { capture: true, passive: true })
    window.addEventListener('blur', cancel)
    return () => {
      cancel()
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('pointerdown', onPointer, true)
      window.removeEventListener('wheel', onPointer, { capture: true } as EventListenerOptions)
      window.removeEventListener('blur', cancel)
    }
  }, [])
}
