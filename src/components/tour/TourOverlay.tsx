'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTourStore } from '@/store/useTourStore'
import { TOUR_STEPS, StepView, TourEnv } from '@/lib/tour/steps'
import CoachBubble from './CoachBubble'
import Spotlight, { Box, measureView, placeBubble, sameBox } from './Spotlight'

const TICK_MS = 250
const IDLE_REPLAY_MS = 20000
const SUCCESS_MS = 900
const BUBBLE_H_GUESS = 190

export default function TourOverlay() {
  const status = useTourStore((s) => s.status)
  const stepIndex = useTourStore((s) => s.stepIndex)

  const [mounted, setMounted] = useState(false)
  const [isTouch, setIsTouch] = useState(false)
  const [view, setView] = useState<StepView | null>(null)
  const [targetBox, setTargetBox] = useState<Box | null>(null)
  const [dragToBox, setDragToBox] = useState<Box | null>(null)
  const [avoidBox, setAvoidBox] = useState<Box | null>(null)
  const [success, setSuccess] = useState(false)
  const [playKey, setPlayKey] = useState(0)
  const [showHand, setShowHand] = useState(true)
  const [bubbleH, setBubbleH] = useState(BUBBLE_H_GUESS)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const lastReplayRef = useRef(Date.now())
  const advancingRef = useRef(false)

  useEffect(() => {
    setMounted(true)
    setIsTouch(window.matchMedia?.('(pointer: coarse)').matches ?? false)
  }, [])

  const active = mounted && status === 'active'
  const step = TOUR_STEPS[stepIndex]

  // Reset per-step UI when the step changes.
  useEffect(() => {
    setSuccess(false)
    setView(null)
    setShowHand(true)
    setPlayKey((k) => k + 1)
    lastReplayRef.current = Date.now()
    advancingRef.current = false
  }, [stepIndex, status])

  // Main loop: run onEnter/capture, follow the target, check whether the kid did it.
  useEffect(() => {
    if (!active || !step) return
    const env: TourEnv = { isTouch, find: (sel) => document.querySelector(sel) }

    const tick = () => {
      const tour = useTourStore.getState()
      if (tour.status !== 'active' || tour.stepIndex !== stepIndex) return

      // Snapshot "before" state the first time we see this step (survives reloads).
      if (!tour.baseline || tour.baseline.step !== stepIndex) {
        step.onEnter?.()
        tour.setBaseline(stepIndex, step.capture?.() ?? null)
        // Already done before we even asked (e.g. lessons panel already open)? Move on quietly.
        if (step.skipIf?.()) {
          advancingRef.current = true
          tour.next(TOUR_STEPS.length)
        }
        return
      }
      if (step.capture && (tour.baseline.data == null || step.recaptureIf?.(tour.baseline.data))) {
        // The canvas wasn't ready when we first looked — try again.
        tour.setBaseline(stepIndex, step.capture() ?? null)
        return
      }

      const v = step.view(env, tour.baseline.data)
      setView((prev) => (prev && JSON.stringify(prev) === JSON.stringify(v) ? prev : v))
      const boxes = measureView(v)
      setTargetBox((prev) => (sameBox(prev, boxes.targetBox) ? prev : boxes.targetBox))
      setDragToBox((prev) => (sameBox(prev, boxes.dragToBox) ? prev : boxes.dragToBox))
      setAvoidBox((prev) => (sameBox(prev, boxes.avoidBox) ? prev : boxes.avoidBox))

      if (!advancingRef.current && step.isDone(tour.baseline.data)) {
        advancingRef.current = true
        setSuccess(true)
        setTimeout(() => useTourStore.getState().next(TOUR_STEPS.length), SUCCESS_MS)
        return
      }

      // Stuck for a while? Show the gesture again.
      if (Date.now() - lastReplayRef.current > IDLE_REPLAY_MS) {
        lastReplayRef.current = Date.now()
        setShowHand(true)
        setPlayKey((k) => k + 1)
      }
    }

    tick()
    const id = window.setInterval(tick, TICK_MS)
    return () => window.clearInterval(id)
  }, [active, step, stepIndex, isTouch])

  // When the target changes (menu opened, etc.) replay the hand for the new gesture.
  useEffect(() => {
    if (!active) return
    setShowHand(true)
    setPlayKey((k) => k + 1)
    lastReplayRef.current = Date.now()
  }, [active, view?.target, view?.gesture])

  useEffect(() => {
    if (bubbleRef.current) {
      const h = bubbleRef.current.offsetHeight
      if (h && Math.abs(h - bubbleH) > 2) setBubbleH(h)
    }
  }, [stepIndex, view?.text, success, bubbleH])

  if (!active || !step || !view) return null

  return createPortal(
    <>
      <Spotlight
        view={success ? { ...view, zone: undefined } : view}
        targetBox={targetBox}
        dragToBox={dragToBox}
        showHand={showHand && !success}
        playKey={playKey}
      />

      <CoachBubble
        ref={bubbleRef}
        stepNumber={stepIndex + 1}
        totalSteps={TOUR_STEPS.length}
        emoji={step.emoji}
        title={step.title}
        text={view.text}
        success={success}
        info={!!view.info}
        onNext={() => useTourStore.getState().next(TOUR_STEPS.length)}
        style={placeBubble(targetBox, avoidBox, bubbleH, view.prefer)}
        onShowMe={() => {
          setShowHand(true)
          setPlayKey((k) => k + 1)
          lastReplayRef.current = Date.now()
        }}
        onSkipStep={() => useTourStore.getState().next(TOUR_STEPS.length)}
        onExit={() => useTourStore.getState().skipTour()}
      />
    </>,
    document.body
  )
}
