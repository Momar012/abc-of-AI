'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { tableToTsv, type LabLine, type LabSections, type LabTable } from '@/lib/guide/parseLab'
import { diagnose, Diagnosis, hintFor, isDone, isStructural, matches, recordCopy, recordEvents, takeSnapshot } from '@/lib/guide/labGuide'
import { useLabComplete, useLabGuideStore } from '@/store/useLabGuideStore'
import { useMissionStore } from '@/store/useMissionStore'
import { useTourStore } from '@/store/useTourStore'
import type { StepView } from '@/lib/tour/steps'
import HintOverlay from '@/components/tour/HintOverlay'
import SimpleContent, { renderInline } from './SimpleContent'

const TICK_MS = 300
const NUDGE_AFTER_MS = 30000
const EMPTY: number[] = []
/** How many upcoming steps to show under the current one before "+N more". */
const PEEK = 2

// One calm look for every part of the card: soft panel, no borders, readable text.
const CARD = 'rounded-2xl bg-white/[0.045] p-3.5'
const TITLE = 'text-[13px] font-heading font-extrabold text-white/90'
const BTN = 'min-h-[34px] px-3 rounded-xl text-[12px] font-heading font-bold transition-colors'

/** A short fingerprint of a lab's steps and checks (changes when the lesson is edited). */
function labVersion(lines: LabLine[], expected: string[]): string {
  const s = [...lines.map((l) => l.text), '|', ...expected].join('\n')
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return `${lines.length}.${expected.length}.${(h >>> 0).toString(36)}`
}

/** Put text on the clipboard; falls back to the old way where the Clipboard API isn't allowed (plain http). */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  }
}

/** A step's table (sentences to paste), with one big button that copies it, so kids don't have to
 *  drag-select a table with a mouse. Copies rows only (no header), tab-separated for 📋 Paste. */
function CopyTable({ table }: { table: LabTable }) {
  const [copied, setCopied] = useState(false)
  const onCopy = async () => {
    if (await copyText(tableToTsv(table))) {
      recordCopy()
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    }
  }
  return (
    <div className="mt-2.5">
      <div className="max-h-44 overflow-y-auto rounded-lg ring-1 ring-white/10">
        <table className="w-full text-[11.5px] font-body">
          <thead className="sticky top-0 bg-[#1b1840]">
            <tr>
              {table.head.map((h, i) => (
                <th key={i} className="text-left px-2 py-1 font-heading font-bold text-white/60">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r, i) => (
              <tr key={i} className="border-t border-white/5">
                {r.map((c, j) => (
                  <td key={j} className={`px-2 py-1 ${j === r.length - 1 ? 'text-teal-200 font-semibold whitespace-nowrap' : 'text-white/80'}`}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        data-tour="lab-copy-table"
        onClick={onCopy}
        className={`${BTN} mt-2 w-full ${copied ? 'text-emerald-950 bg-emerald-300' : 'text-violet-50 bg-violet-500/40 hover:bg-violet-500/55'}`}
      >
        {copied ? `✓ Copied ${table.rows.length} rows!` : '📋 Copy table'}
      </button>
    </div>
  )
}

interface Props {
  stepId: string
  lines: LabLine[]
  /** The lab's sections (goal, problem, expected results, what you learned). */
  parts: LabSections
  /** Curriculum Admin preview: show the layout only, no live checking, hints or saved progress. */
  preview?: boolean
}

/**
 * A Guided Lab, laid out for a kid working alone:
 *  🎯 Mission — goal, what you'll learn, the problem (folds away once building starts)
 *  🧭 Build   — the current step big, with 👆 Show me; it ticks itself as the kid builds
 *  🧪 Test it — each Expected Result as 👍/👎; 👎 says what to fix (opens when the build is done)
 *  🎉 Finish  — celebration + what you learned
 */
export default function LabGuide({ stepId, lines, parts, preview = false }: Props) {
  const expected = parts.expected
  const learned = parts.learned
  const ticked = useLabGuideStore((s) => (preview ? EMPTY : s.ticked[stepId] ?? EMPTY))
  const confirmed = useLabGuideStore((s) => (preview ? EMPTY : s.confirmed[stepId] ?? EMPTY))
  const complete = useLabComplete(stepId, lines.length, expected.length) && !preview
  const missionActive = useMissionStore((s) => !!s.activeId)
  const tourActive = useTourStore((s) => s.status === 'active')

  const [mounted, setMounted] = useState(false)
  /** Which step 👆 Show me is pointing at (the current one, or the one a 👎 blamed). */
  const [hintStep, setHintStep] = useState<number | null>(null)
  const [hintView, setHintView] = useState<StepView | null>(null)
  const [playKey, setPlayKey] = useState(0)
  const [stuck, setStuck] = useState(false)
  const [showDone, setShowDone] = useState(false)
  const [showAllNext, setShowAllNext] = useState(false)
  /** null = automatic (open until the kid starts building). */
  const [problemOpen, setProblemOpen] = useState<boolean | null>(null)
  const [diag, setDiag] = useState<(Diagnosis & { test: number }) | null>(null)
  const sinceRef = useRef(Date.now())
  const lastProgressRef = useRef(Date.now())

  const tickedSet = new Set(ticked)
  const current = lines.findIndex((_, i) => !tickedSet.has(i))
  const stepsDone = current === -1
  const count = tickedSet.size
  const busy = missionActive || tourActive

  useEffect(() => setMounted(true), [])

  // Ctrl + C (or right-click → Copy) counts for "copy the table" steps too, not just 📋 Copy table.
  useEffect(() => {
    if (preview) return
    document.addEventListener('copy', recordCopy)
    return () => document.removeEventListener('copy', recordCopy)
  }, [preview])

  // Snapshot the canvas the first time this lab is opened.
  useEffect(() => {
    if (!preview) useLabGuideStore.getState().ensureSnapshot(stepId, takeSnapshot())
  }, [stepId, preview])

  // Ticks are step numbers: if the lesson's steps or checks were edited since, start the ticks over
  // (steps already built on the canvas tick again by themselves).
  const version = labVersion(lines, expected)
  useEffect(() => {
    if (!preview) useLabGuideStore.getState().syncVersion(stepId, version)
  }, [stepId, version, preview])

  // A new current step: restart its clock, drop the hint and the nudge.
  useEffect(() => {
    sinceRef.current = Date.now()
    lastProgressRef.current = Date.now()
    setHintStep(null)
    setHintView(null)
    setStuck(false)
  }, [current, stepId])

  useEffect(() => {
    setDiag(null)
    setProblemOpen(null)
    setShowDone(false)
    setShowAllNext(false)
  }, [stepId])

  // Watch the canvas and tick steps.
  useEffect(() => {
    if (!mounted || preview) return
    const id = window.setInterval(() => {
      recordEvents()
      const store = useLabGuideStore.getState()
      const snap = store.snapshots[stepId] ?? []
      const have = new Set(store.ticked[stepId] ?? [])
      const cur = lines.findIndex((_, i) => !have.has(i))
      lines.forEach((l, i) => {
        if (have.has(i)) return
        // Building steps can tick in any order; "try it out" steps only when they're the current one.
        const ok = isStructural(l.action) ? matches(l.action, snap) : i === cur && isDone(l.action, snap, sinceRef.current)
        if (ok) {
          store.tick(stepId, i)
          lastProgressRef.current = Date.now()
        }
      })
      if (cur !== -1 && Date.now() - lastProgressRef.current > NUDGE_AFTER_MS) setStuck(true)
    }, TICK_MS)
    return () => window.clearInterval(id)
  }, [mounted, preview, lines, stepId])

  // Keep the hint pointing at the right thing while it's on.
  useEffect(() => {
    if (hintStep === null || !lines[hintStep]) return
    const update = () => {
      const snap = useLabGuideStore.getState().snapshots[stepId] ?? []
      const v = hintFor(lines[hintStep].action, snap, lines[hintStep].text)
      setHintView((prev) => (prev && JSON.stringify(prev) === JSON.stringify(v) ? prev : v))
    }
    update()
    const id = window.setInterval(update, TICK_MS)
    return () => window.clearInterval(id)
  }, [hintStep, lines, stepId])

  useEffect(() => {
    if (hintView) setPlayKey((k) => k + 1)
  }, [hintView?.target, hintView?.gesture]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!mounted) return null

  const showMe = (i: number) => {
    setHintStep(i)
    setStuck(false)
    setPlayKey((k) => k + 1)
    lastProgressRef.current = Date.now()
  }
  /** Put the hint away (× on the bubble, Escape, or tapping "Hide hint"). Show me brings it back. */
  const hideHint = () => {
    setHintStep(null)
    setHintView(null)
  }
  const startOver = () => {
    useLabGuideStore.getState().restart(stepId, takeSnapshot())
    setDiag(null)
    setShowDone(false)
    setProblemOpen(null)
  }
  const sayNo = (test: number) => {
    const snap = useLabGuideStore.getState().snapshots[stepId] ?? []
    setDiag({ test, ...diagnose(lines, snap, { text: expected[test] ?? '', all: expected }) })
  }
  const sayYes = (test: number) => {
    useLabGuideStore.getState().confirm(stepId, test)
    if (diag?.test === test) setDiag(null)
    setHintStep(null)
  }

  const goal = [parts.intro, parts.goal].filter(Boolean).join('\n\n')
  const goalIsShort = goal && !goal.includes('\n') && goal.length < 220
  const problemShown = problemOpen ?? count === 0
  // Steps already ticked out of order (e.g. a block connected early) are in "done" — don't list them twice.
  const upcoming = stepsDone ? [] : lines.map((l, i) => ({ l, i })).filter(({ i }) => i > current && !tickedSet.has(i))
  const peek = showAllNext ? upcoming : upcoming.slice(0, PEEK)
  const cur = current >= 0 ? lines[current] : null

  return (
    <div className={`flex flex-col gap-3 ${preview ? 'pointer-events-none select-none' : ''}`}>
      {preview && (
        <p className="text-[11px] font-heading text-white/35">Preview: in the app, steps tick by themselves as kids build.</p>
      )}

      {/* ── 🎯 Mission ──────────────────────────────────────────────────────── */}
      {(goal || learned.length > 0 || parts.problem) && (
        <section className={`${CARD} flex flex-col gap-3`}>
          {goal &&
            (goalIsShort ? (
              <p className="text-[14px] leading-snug font-heading font-bold text-violet-100">🎯 {renderInline(goal)}</p>
            ) : (
              <div>
                <p className={`${TITLE} mb-1`}>🎯 Goal</p>
                <SimpleContent body={goal} className="text-[13px]" />
              </div>
            ))}

          {learned.length > 0 && (
            <div>
              <p className="text-[11.5px] font-heading font-bold text-violet-200/70 mb-1">You&apos;ll learn</p>
              <ul className="flex flex-col gap-1">
                {learned.map((t, i) => (
                  <li key={i} className="flex gap-2 text-[12.5px] leading-snug font-body text-white/70">
                    <span className="flex-shrink-0">✨</span>
                    <span>{renderInline(t)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {parts.problem && (
            <div className={goal || learned.length ? 'border-t border-white/[0.06] pt-3' : ''}>
              <button
                type="button"
                onClick={() => setProblemOpen(!problemShown)}
                className={`w-full flex items-center gap-2 text-left ${TITLE}`}
              >
                🧩 The problem
                <span className="ml-auto text-[11px] font-heading font-semibold text-white/35">
                  {problemShown ? 'Hide' : 'Read again'}
                </span>
              </button>
              <AnimatePresence initial={false}>
                {problemShown && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <SimpleContent body={parts.problem} className="pt-1.5 text-[13px]" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </section>
      )}

      {/* ── 🧭 Build it ─────────────────────────────────────────────────────── */}
      <section className={`${CARD} flex flex-col gap-2.5`}>
        <div className="flex items-baseline gap-2">
          <span className={TITLE}>🧭 Build it</span>
          <span className="ml-auto text-[11.5px] font-heading font-bold text-teal-200/70">
            {stepsDone ? `All ${lines.length} steps done ✅` : `Step ${current + 1} of ${lines.length}`}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-teal-400 to-cyan-300"
            initial={false}
            animate={{ width: `${Math.round((count / lines.length) * 100)}%` }}
          />
        </div>

        {/* Finished steps, folded */}
        {count > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowDone((v) => !v)}
              className="text-[12px] font-heading font-semibold text-teal-200/60 hover:text-teal-200"
            >
              ✅ {count} done {showDone ? '· hide' : '· show'}
            </button>
            {showDone && (
              <ol className="mt-1 flex flex-col gap-0.5">
                {lines.map((l, i) =>
                  tickedSet.has(i) ? (
                    <li key={i} className="flex gap-2 text-[12px] leading-snug text-teal-100/45">
                      <span className="w-4 flex-shrink-0 text-right font-heading">{i + 1}</span>
                      <span className="line-through decoration-teal-400/30">{l.text}</span>
                    </li>
                  ) : null
                )}
              </ol>
            )}
          </div>
        )}

        {/* The step the kid is on: big and clear */}
        {cur && (
          <motion.div
            key={current}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl bg-teal-400/[0.09] ring-1 ring-teal-300/40 p-3"
          >
            {/* The number, so the list above and below reads 13 → 14 → 15 with no gap. */}
            <p className="text-[10.5px] font-heading font-bold uppercase tracking-wider text-teal-200/70 mb-0.5">Step {current + 1}</p>
            <p className="text-[14px] leading-relaxed font-body text-white">{renderInline(cur.md)}</p>
            {cur.note && <p className="mt-1 text-[12px] leading-snug font-body text-white/50">👀 {renderInline(cur.note)}</p>}
            {cur.table && <CopyTable table={cur.table} />}
            <div className="flex flex-wrap items-center gap-2 mt-2.5">
              {cur.action.type === 'manual' ? (
                <button
                  type="button"
                  onClick={() => useLabGuideStore.getState().tick(stepId, current)}
                  className={`${BTN} text-teal-950 bg-teal-300 hover:bg-teal-200`}
                >
                  ✓ I did it
                </button>
              ) : (
                <>
                  {!busy && (
                    <button
                      type="button"
                      onClick={() => (hintStep === current ? hideHint() : showMe(current))}
                      className={`${BTN} ${
                        stuck
                          ? 'text-amber-950 bg-amber-300 shadow-[0_0_14px_rgba(252,211,77,0.55)]'
                          : 'text-cyan-50 bg-cyan-500/20 hover:bg-cyan-500/30'
                      }`}
                    >
                      {hintStep === current ? '🙈 Hide hint' : '👆 Show me'}
                    </button>
                  )}
                  <span className={`text-[11.5px] font-body ${stuck ? 'text-amber-200 font-bold' : 'text-white/40'}`}>
                    {stuck && !busy ? '← Stuck? Tap Show me!' : current === 0 || count === 0 ? 'Ticks by itself when you do it' : ''}
                  </span>
                </>
              )}
            </div>
          </motion.div>
        )}

        {/* A peek at what's next */}
        {peek.length > 0 && (
          <ol className="flex flex-col gap-1 px-1">
            {peek.map(({ l, i }) => (
              <li key={i} className="flex gap-2 text-[12px] leading-snug text-white/35">
                <span className="w-4 flex-shrink-0 text-right font-heading">{i + 1}</span>
                <span>{l.text}</span>
              </li>
            ))}
            {upcoming.length > PEEK && (
              <li>
                <button
                  type="button"
                  onClick={() => setShowAllNext((v) => !v)}
                  className="ml-6 text-[11.5px] font-heading font-semibold text-white/35 hover:text-white/60"
                >
                  {showAllNext ? 'Show less' : `+ ${upcoming.length - PEEK} more steps`}
                </button>
              </li>
            )}
          </ol>
        )}

        {count > 0 && (
          <button
            type="button"
            onClick={startOver}
            className="self-end text-[11px] font-heading text-white/30 hover:text-white/60"
            title="Start this lab's checklist again"
          >
            ↺ Start over
          </button>
        )}
      </section>

      {/* ── 🧪 Test it ──────────────────────────────────────────────────────── */}
      {expected.length > 0 &&
        (!stepsDone ? (
          <p className="rounded-2xl bg-white/[0.025] px-3.5 py-2.5 text-[12px] font-heading text-white/35">
            🔒 🧪 Test it opens when your build is done
          </p>
        ) : (
          <motion.section initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`${CARD} flex flex-col gap-1`}>
            <div className="flex items-baseline gap-2">
              <span className={TITLE}>🧪 Test it</span>
              <span className="ml-auto text-[11.5px] font-heading font-bold text-amber-200/70">
                {confirmed.length} of {expected.length}
              </span>
            </div>
            <p className="text-[12px] font-body text-white/45 mb-1">
              {lines.some((l) => ['switch', 'motion', 'sensorValue', 'text'].includes(l.action.type))
                ? 'Try each one on the canvas. Did it happen?'
                : 'Check each one. Is it true?'}
            </p>
            <ul className="flex flex-col">
              {expected.map((e, i) => {
                const ok = confirmed.includes(i)
                const d = diag?.test === i ? diag : null
                return (
                  <li key={i} className="py-2 border-t border-white/[0.05] first:border-t-0">
                    {/* In a narrow panel the 👍/👎 drop below the sentence instead of squeezing it to one word a line. */}
                    <div className="flex flex-wrap items-center justify-end gap-x-2.5 gap-y-1.5">
                      <span className={`flex-1 min-w-[150px] text-[13px] leading-snug font-body ${ok ? 'text-teal-100/55' : 'text-white/80'}`}>
                        {ok && '✅ '}
                        {renderInline(e)}
                      </span>
                      {!ok && (
                        <span className="flex gap-1.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => sayYes(i)}
                            aria-label="Yes, it happened"
                            className="w-10 h-9 rounded-xl text-[15px] bg-teal-400/15 hover:bg-teal-400/30"
                          >
                            👍
                          </button>
                          <button
                            type="button"
                            onClick={() => sayNo(i)}
                            aria-label="No, it didn't happen"
                            className="w-10 h-9 rounded-xl text-[15px] bg-rose-400/10 hover:bg-rose-400/25"
                          >
                            👎
                          </button>
                        </span>
                      )}
                    </div>
                    <AnimatePresence>
                      {d && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-2 rounded-xl bg-rose-400/10 px-3 py-2">
                            <p className="text-[12.5px] leading-snug font-body text-rose-50/90">🤔 {renderInline(d.text)}</p>
                            {d.stepIndex !== null && !busy && lines[d.stepIndex].action.type !== 'manual' && (
                              <button
                                type="button"
                                onClick={() => showMe(d.stepIndex!)}
                                className={`${BTN} mt-2 text-cyan-50 bg-cyan-500/20 hover:bg-cyan-500/30`}
                              >
                                👆 Show me
                              </button>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </li>
                )
              })}
            </ul>
          </motion.section>
        ))}

      {/* ── 🎉 Finish ───────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {complete && (
          <motion.section
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            className="rounded-2xl bg-gradient-to-br from-teal-500/20 to-violet-500/20 p-4 text-center"
          >
            <motion.div
              className="text-3xl"
              animate={{ rotate: [0, -12, 12, -6, 0], scale: [1, 1.2, 1] }}
              transition={{ duration: 0.9 }}
            >
              🎉
            </motion.div>
            <p className="text-[15px] font-heading font-extrabold text-white mt-1">Lab complete! You built it yourself.</p>
            {learned.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1.5 text-left">
                {learned.map((t, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 + i * 0.15 }}
                    className="flex gap-2 text-[12.5px] leading-snug font-body text-white/80"
                  >
                    <span className="flex-shrink-0">✅</span>
                    <span>{renderInline(t)}</span>
                  </motion.li>
                ))}
              </ul>
            )}
            {parts.outro.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1.5 text-left">
                {parts.outro.map((t, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 + (learned.length + i) * 0.15 }}
                    className="flex gap-2 text-[12.5px] leading-snug font-body text-white/75"
                  >
                    <span className="flex-shrink-0">🤔</span>
                    <span>{renderInline(t)}</span>
                  </motion.li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[12.5px] font-heading font-bold text-teal-200">Press Next → when you&apos;re ready.</p>
          </motion.section>
        )}
      </AnimatePresence>

      {!busy && !preview && (
        <HintOverlay view={hintStep !== null && !complete ? hintView : null} playKey={playKey} onClose={hideHint} />
      )}
    </div>
  )
}
