import { useAbeeStore } from '@/store/useAbeeStore'
import { buildScreenState } from './context'
import { runTool, newStudentTurn, endTakeover } from './takeover'
import { detectLanguage, languageNote, StudentLanguage } from './language'

// Abee's voice: one OpenAI Realtime session over WebRTC. The mic track is
// only enabled while the student holds Alt (or the mic button), and each
// turn is sent with a fresh snapshot of the screen.

const REALTIME_CALLS_URL = 'https://api.openai.com/v1/realtime/calls'
/** Drop the session after this long without a question, to stop paying for it */
const IDLE_DISCONNECT_MS = 10 * 60 * 1000
/** Keep the mic open a moment after Alt is released so the last word isn't clipped */
const RELEASE_TAIL_MS = 250
/** Shorter holds are treated as an accidental tap */
const MIN_TALK_MS = 400

type ServerEvent = { type: string; [key: string]: any }

const abee = () => useAbeeStore.getState()

let pc: RTCPeerConnection | null = null
let dc: RTCDataChannel | null = null
let micTrack: MediaStreamTrack | null = null
let micSender: RTCRtpSender | null = null
let audioEl: HTMLAudioElement | null = null
let analyser: AnalyserNode | null = null
let micAnalyser: AnalyserNode | null = null
let audioCtx: AudioContext | null = null
let connecting: Promise<void> | null = null
let idleTimer: ReturnType<typeof setTimeout> | null = null

let talking = false
/** Bumped on every new question, so leftover steps from an older demo stop */
let studentTurn = 0
/** Tool rounds used on the current question */
let toolRounds = 0
/** Hard limit on how much Abee says per question, enforced here because the model doesn't always obey */
const MAX_SENTENCES = 3
/** Sentences Abee already finished saying on the current question (across its replies) */
let turnSentences = 0
/** What the reply in progress has said so far, and whether it was cut off at the limit */
let responseText = ''
let cappedResponseId: string | null = null
let briefItemId: string | null = null
/** The silent "pick what to show" step of the current question — its text is never shown or spoken */
let nextIsShowStep = false
let showStepResponseId: string | null = null
/** The language of the student's last question; kept when a transcript is slow to arrive */
let studentLanguage: StudentLanguage = 'en'
let languageItemId: string | null = null
/** Resolves with the transcript of the question just spoken */
let transcriptWaiter: ((text: string) => void) | null = null
/** How long to wait for that transcript before answering anyway */
const TRANSCRIPT_WAIT_MS = 1500
let talkStartedAt = 0
let responding = false
let audioPlaying = false
let replyResponseId: string | null = null
let contextItemId: string | null = null

export class AbeeUnavailableError extends Error {}

// ── Connection ────────────────────────────────────────────────────────────

function send(event: Record<string, unknown>) {
  if (dc?.readyState === 'open') dc.send(JSON.stringify(event))
}

function touchIdle() {
  if (idleTimer) clearTimeout(idleTimer)
  idleTimer = setTimeout(disconnect, IDLE_DISCONNECT_MS)
}

export function disconnect() {
  if (idleTimer) clearTimeout(idleTimer)
  idleTimer = null
  dc?.close()
  pc?.getSenders().forEach((s) => s.track?.stop())
  micTrack?.stop()
  pc?.close()
  audioCtx?.close().catch(() => {})
  pc = null
  dc = null
  micTrack = null
  micSender = null
  analyser = null
  micAnalyser = null
  audioCtx = null
  contextItemId = null
  languageItemId = null
  briefItemId = null
  responding = false
  audioPlaying = false
  endTakeover({ immediate: true })
  abee().set({ connection: 'idle', status: 'idle' })
}

export function ensureConnected(): Promise<void> {
  if (dc?.readyState === 'open') {
    touchIdle()
    return Promise.resolve()
  }
  if (!connecting) {
    connecting = connect().finally(() => { connecting = null })
  }
  return connecting
}

async function connect() {
  let openTimer: ReturnType<typeof setTimeout> | undefined
  if (typeof RTCPeerConnection === 'undefined') {
    throw new AbeeUnavailableError("This browser can't talk to Abee. Try Chrome!")
  }
  abee().set({ connection: 'connecting', errorMessage: null })

  try {
    const res = await fetch('/api/abee/session', { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.token) {
      throw new AbeeUnavailableError(data.message || 'Abee is napping right now. Ask your teacher to check the setup.')
    }

    const peer = new RTCPeerConnection()
    pc = peer

    audioEl = audioEl ?? new Audio()
    audioEl.autoplay = true
    peer.ontrack = (e) => {
      audioEl!.srcObject = e.streams[0]
      watchOutputLevel(e.streams[0])
    }

    // An empty audio slot the mic is plugged into on the first Alt press
    // (see ensureMic), so a typed question never waits on a mic prompt
    micSender = peer.addTransceiver('audio', { direction: 'sendrecv' }).sender

    const channel = peer.createDataChannel('oai-events')
    dc = channel
    channel.addEventListener('message', (e) => {
      try { handleEvent(JSON.parse(e.data)) } catch { /* ignore malformed events */ }
    })
    const opened = new Promise<void>((resolve, reject) => {
      channel.addEventListener('open', () => { clearTimeout(openTimer); resolve() }, { once: true })
      openTimer = setTimeout(() => reject(new Error('Timed out connecting to Abee')), 15_000)
    })
    // Awaited further down; if we bail out before then (e.g. OpenAI refuses the
    // call), a late timeout mustn't surface as an unhandled rejection
    opened.catch(() => {})

    peer.addEventListener('connectionstatechange', () => {
      if (pc === peer && (peer.connectionState === 'failed' || peer.connectionState === 'closed')) disconnect()
    })

    const offer = await peer.createOffer()
    await peer.setLocalDescription(offer)
    const sdpRes = await fetch(`${REALTIME_CALLS_URL}?model=${encodeURIComponent(data.model)}`, {
      method: 'POST',
      body: offer.sdp,
      headers: { Authorization: `Bearer ${data.token}`, 'Content-Type': 'application/sdp' },
    })
    if (!sdpRes.ok) {
      const body = await sdpRes.text()
      if (sdpRes.status === 429 && /insufficient_quota|credit/i.test(body)) {
        throw new AbeeUnavailableError('Abee is out of energy: the OpenAI account has no credits left. Ask your teacher!')
      }
      throw new Error(`Realtime connection failed (${sdpRes.status}): ${body}`)
    }
    await peer.setRemoteDescription({ type: 'answer', sdp: await sdpRes.text() })
    await opened

    abee().set({ connection: 'ready' })
    touchIdle()
  } catch (e) {
    clearTimeout(openTimer)
    console.warn('[Abee] connect failed', e)
    disconnect()
    const message = e instanceof AbeeUnavailableError ? e.message : 'Abee couldn’t connect. Check the internet and try again.'
    abee().set({ connection: 'error', errorMessage: message })
    throw e
  }
}

/** Remote voice loudness 0–1, for the avatar's speaking pulse */
export function outputLevel(): number {
  if (!analyser) return 0
  const buf = new Uint8Array(analyser.fftSize)
  analyser.getByteTimeDomainData(buf)
  let peak = 0
  for (const v of buf) peak = Math.max(peak, Math.abs(v - 128))
  return Math.min(1, peak / 64)
}

function levelContext(): AudioContext {
  audioCtx = audioCtx ?? new AudioContext()
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {})
  return audioCtx
}

function watchOutputLevel(stream: MediaStream) {
  try {
    const ctx = levelContext()
    analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    ctx.createMediaStreamSource(stream).connect(analyser)
  } catch {
    analyser = null
  }
}

function watchInputLevel(stream: MediaStream) {
  try {
    const ctx = levelContext()
    micAnalyser = ctx.createAnalyser()
    micAnalyser.fftSize = 128
    micAnalyser.smoothingTimeConstant = 0.55
    ctx.createMediaStreamSource(stream).connect(micAnalyser)
  } catch {
    micAnalyser = null
  }
}

/**
 * The student's voice as `count` bands (0–1), for the listening waveform.
 * Mirrored so the low, loud voice frequencies sit in the middle.
 */
export function inputBands(count: number): number[] {
  if (!micAnalyser || !micTrack?.enabled) return new Array(count).fill(0)
  const bins = new Uint8Array(micAnalyser.frequencyBinCount)
  micAnalyser.getByteFrequencyData(bins)
  const half = Math.ceil(count / 2)
  // Speech lives roughly in the lowest third of the spectrum
  const usable = Math.floor(bins.length / 3)
  const per = Math.max(1, Math.floor(usable / half))
  const bands: number[] = []
  for (let b = 0; b < half; b++) {
    let sum = 0
    for (let k = 0; k < per; k++) sum += bins[1 + b * per + k] ?? 0
    bands.push(Math.min(1, sum / per / 200))
  }
  const left = [...bands].reverse()
  return [...left, ...bands].slice(count % 2 ? 1 : 0, (count % 2 ? 1 : 0) + count)
}

// ── Turns ─────────────────────────────────────────────────────────────────

/** Stop Abee mid-sentence (the student started talking over it) */
function interrupt() {
  if (responding) send({ type: 'response.cancel' })
  if (audioPlaying) send({ type: 'output_audio_buffer.clear' })
}

/** Replace the last screen snapshot with a fresh one, just before a response */
function sendScreenState() {
  if (contextItemId) send({ type: 'conversation.item.delete', item_id: contextItemId })
  contextItemId = `ctx_${Date.now()}`
  send({
    type: 'conversation.item.create',
    item: {
      id: contextItemId,
      type: 'message',
      role: 'system',
      content: [{ type: 'input_text', text: `[SCREEN STATE]\n${JSON.stringify(buildScreenState())}` }],
    },
  })
}

/**
 * Tell Abee which language to answer in, as the last thing before it replies.
 * Replaces the previous note so they don't pile up.
 */
function sendLanguageNote(lang: StudentLanguage) {
  studentLanguage = lang
  if (languageItemId) send({ type: 'conversation.item.delete', item_id: languageItemId })
  languageItemId = `lang_${Date.now()}`
  send({
    type: 'conversation.item.create',
    item: { id: languageItemId, type: 'message', role: 'system', content: [{ type: 'input_text', text: languageNote(lang) }] },
  })
}

function waitForTranscript(): Promise<string> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => { transcriptWaiter = null; resolve('') }, TRANSCRIPT_WAIT_MS)
    transcriptWaiter = (text) => { clearTimeout(timer); transcriptWaiter = null; resolve(text) }
  })
}

/** Most tool rounds allowed per question — a demo needs several, a hint one; stops runaway loops */
const MAX_TOOL_ROUNDS = 8
/** Tools that only show the student something; after them Abee just talks */
const GUIDE_TOOLS = new Set(['point_at', 'show_wire', 'no_pointer', 'close_panels'])

/**
 * `showFirst`: the opening step of every question. Abee must pick what to show
 * (a pointer, a wire path, or no_pointer) and can't speak yet, so the visual is
 * always on screen before it talks about it. Its spoken answer comes next.
 */
function requestResponse({ noTools = false, showFirst = false }: { noTools?: boolean; showFirst?: boolean } = {}) {
  if (showFirst) nextIsShowStep = true
  send({
    type: 'response.create',
    response: showFirst
      ? { output_modalities: ['text'], tool_choice: 'required' }
      : {
          ...(abee().muted ? { output_modalities: ['text'] } : {}),
          ...(noTools ? { tool_choice: 'none' } : {}),
        },
  })
}

/** Ask for the mic the first time it's needed; it stays muted except while talking */
async function ensureMic(): Promise<boolean> {
  if (micTrack) return true
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    })
    const track = stream.getAudioTracks()[0]
    track.enabled = false
    if (!micSender) {
      track.stop()
      return false
    }
    await micSender.replaceTrack(track)
    micTrack = track
    watchInputLevel(stream)
    abee().set({ micAvailable: true })
    return true
  } catch {
    // No mic, or permission denied — typing still works and Abee still talks back
    abee().set({ micAvailable: false })
    return false
  }
}

export async function startTalking() {
  if (talking) return
  talking = true
  newStudentTurn()
  studentTurn++
  toolRounds = 0
  turnSentences = 0
  interrupt()
  abee().set({ status: 'listening', transcript: '', reply: '', errorMessage: null, notice: null })

  try {
    await ensureConnected()
  } catch {
    talking = false
    abee().set({ status: 'idle' })
    return
  }
  if (!(await ensureMic())) {
    talking = false
    abee().set({ status: 'idle', textOpen: true, notice: 'No microphone found, so type your question instead' })
    return
  }
  // Released while we were connecting or the mic prompt was up
  if (!talking || !micTrack) {
    abee().set({ status: 'idle' })
    return
  }
  send({ type: 'input_audio_buffer.clear' })
  micTrack.enabled = true
  talkStartedAt = Date.now()
}

/** Alt released — send what they said */
export async function stopTalking() {
  if (!talking) return
  talking = false
  if (!micTrack?.enabled) {
    abee().set({ status: 'idle' })
    return
  }
  const heldFor = Date.now() - talkStartedAt
  await new Promise((r) => setTimeout(r, RELEASE_TAIL_MS))
  micTrack.enabled = false

  if (heldFor < MIN_TALK_MS) {
    send({ type: 'input_audio_buffer.clear' })
    abee().set({ status: 'idle' })
    return
  }
  sendScreenState()
  // Listen for the transcript before committing, so it can't slip past us
  const transcript = waitForTranscript()
  const turn = studentTurn
  send({ type: 'input_audio_buffer.commit' })
  abee().set({ status: 'thinking', reply: '' })
  touchIdle()
  // Wait (briefly) to hear which language they spoke, so Abee answers in it
  const heard = await transcript
  if (turn !== studentTurn) return
  sendLanguageNote(heard ? detectLanguage(heard) : studentLanguage)
  requestResponse({ showFirst: true })
}

/** Alt turned out to be part of a shortcut (Alt+Tab…) — throw the audio away */
export function cancelTalking() {
  if (!talking) return
  talking = false
  if (micTrack) micTrack.enabled = false
  send({ type: 'input_audio_buffer.clear' })
  abee().set({ status: 'idle' })
}

export async function sendText(text: string) {
  const q = text.trim()
  if (!q) return
  newStudentTurn()
  studentTurn++
  toolRounds = 0
  turnSentences = 0
  interrupt()
  abee().set({ transcript: q, reply: '', status: 'thinking', errorMessage: null, notice: null })
  try {
    await ensureConnected()
  } catch {
    abee().set({ status: 'idle' })
    return
  }
  sendScreenState()
  send({ type: 'conversation.item.create', item: { type: 'message', role: 'user', content: [{ type: 'input_text', text: q }] } })
  sendLanguageNote(detectLanguage(q))
  requestResponse({ showFirst: true })
}

/** Stop Abee talking (Esc) */
export function hush() {
  interrupt()
  abee().set({ status: 'idle' })
}

// ── Server events ─────────────────────────────────────────────────────────

function settleStatus() {
  if (talking) return
  if (responding) abee().set({ status: audioPlaying ? 'speaking' : 'thinking' })
  else abee().set({ status: audioPlaying ? 'speaking' : 'idle' })
}

/** Finished sentences in a stretch of text (English and Urdu full stops / question marks) */
function sentenceEnds(text: string): number[] {
  const ends: number[] = []
  const re = /[.!?۔؟]+(?=\s|$|["”’)\]])/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) ends.push(m.index + m[0].length)
  return ends
}

function appendReply(responseId: string, delta: string) {
  if (responseId === showStepResponseId) return // the silent "what to show" step
  if (cappedResponseId === responseId) return // already cut off; ignore the tail
  // A demo is a chain of responses — start a fresh line for each, without blanking the bubble in between
  if (replyResponseId !== responseId) {
    replyResponseId = responseId
    responseText = delta
  } else {
    responseText += delta
  }

  // Cut Abee off cleanly once this question has had its sentences (not during a demo,
  // where each step gets a short narration line)
  const ends = sentenceEnds(responseText)
  const allowed = MAX_SENTENCES - turnSentences
  if (!abee().takeoverActive && ends.length >= allowed && allowed >= 0) {
    cappedResponseId = responseId
    responseText = allowed > 0 ? responseText.slice(0, ends[allowed - 1]) : ''
    send({ type: 'response.cancel' })
  }
  abee().set({ reply: responseText })
}

/** Before Abee speaks its answer: remind it how little it has to say */
function sendBrevityNote(somethingShown: boolean) {
  const left = Math.max(1, MAX_SENTENCES - turnSentences)
  if (briefItemId) send({ type: 'conversation.item.delete', item_id: briefItemId })
  briefItemId = `brief_${Date.now()}`
  send({
    type: 'conversation.item.create',
    item: {
      id: briefItemId, type: 'message', role: 'system',
      content: [{ type: 'input_text', text: `[NOW SPEAK] ${somethingShown ? 'The pointer is already on screen, so refer to it ("this dot", "right here"). ' : ''}Answer in at most ${left} short sentence${left === 1 ? '' : 's'}: the step first, then the why. Don't repeat yourself and don't add a next step.` }],
    },
  })
}

async function runToolCalls(calls: { name: string; call_id: string; arguments: string }[]) {
  // The student may ask something new while a demo is mid-way: drop the rest of the old one
  const turn = studentTurn
  let anyFailed = false
  for (const call of calls) {
    if (turn !== studentTurn) return
    let args: Record<string, string> = {}
    try { args = JSON.parse(call.arguments || '{}') } catch { /* leave empty */ }
    const result = await runTool(call.name, args)
    if ('error' in result) anyFailed = true
    // Dev only: which tools Abee called and what came back (window.__abeeTools)
    if (process.env.NODE_ENV === 'development') {
      const w = window as any
      w.__abeeTools = [...(w.__abeeTools ?? []).slice(-40), { name: call.name, args, result }]
    }
    send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: call.call_id, output: JSON.stringify(result) } })
  }
  if (turn !== studentTurn) return
  toolRounds++
  // A hint is one move: after pointing, Abee finishes explaining with tools
  // switched off — otherwise the model can keep pointing in a loop, one paid
  // response after another. If the pointer failed, it gets one more try.
  if (calls.every((c) => GUIDE_TOOLS.has(c.name))) {
    // Already said enough this question: the pointer speaks for itself
    if (!anyFailed && turnSentences >= MAX_SENTENCES - 1) {
      responding = false
      settleStatus()
      return
    }
    sendBrevityNote(calls.some((c) => c.name !== 'no_pointer'))
    requestResponse({ noTools: !anyFailed || toolRounds >= 2 })
    return
  }
  // Demo steps: let Abee narrate and carry on, up to the per-question cap
  requestResponse({ noTools: toolRounds >= MAX_TOOL_ROUNDS })
}

function handleEvent(event: ServerEvent) {
  // Dev only: keep a short trail of server events for debugging in the console (window.__abeeEvents)
  if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
    const w = window as any
    w.__abeeEvents = [...(w.__abeeEvents ?? []).slice(-150), event.type === 'error' ? `error: ${event.error?.message}` : event.type]
  }
  switch (event.type) {
    case 'conversation.item.input_audio_transcription.delta':
      abee().set({ transcript: abee().transcript + (event.delta ?? '') })
      break
    case 'conversation.item.input_audio_transcription.completed':
      abee().set({ transcript: event.transcript ?? abee().transcript })
      transcriptWaiter?.(event.transcript ?? '')
      break
    case 'conversation.item.input_audio_transcription.failed':
      transcriptWaiter?.('')
      break

    case 'response.created':
      responding = true
      if (nextIsShowStep) {
        nextIsShowStep = false
        showStepResponseId = event.response?.id ?? null
      }
      settleStatus()
      break
    case 'response.output_audio_transcript.delta':
    case 'response.output_text.delta':
      appendReply(event.response_id, event.delta ?? '')
      break

    case 'output_audio_buffer.started':
      audioPlaying = true
      settleStatus()
      break
    case 'output_audio_buffer.stopped':
    case 'output_audio_buffer.cleared':
      audioPlaying = false
      settleStatus()
      break

    case 'response.done': {
      responding = false
      const response = event.response ?? {}
      // Count what this reply said toward the question's sentence limit
      if (replyResponseId === response.id) {
        turnSentences += sentenceEnds(responseText).length
        responseText = ''
      }
      const calls = (response.output ?? []).filter((o: any) => o.type === 'function_call')
      if (response.status === 'completed' && calls.length) {
        responding = true // still mid-turn while the tools run
        runToolCalls(calls).catch(() => { responding = false; settleStatus() })
      } else if (response.id === showStepResponseId && response.status === 'completed') {
        // The model skipped picking something to show — just let it answer
        responding = true
        sendBrevityNote(false)
        requestResponse({ noTools: true })
      } else {
        // A reply with no further actions ends the demo, so the student always gets
        // the mouse back even if the model forgets to call end_takeover
        endTakeover()
      }
      settleStatus()
      break
    }

    case 'error':
      // Cancelling when nothing is playing etc. is harmless; only surface real failures
      if (!/cancel|no active response|not found/i.test(event.error?.message ?? '')) {
        console.warn('[Abee]', event.error)
      }
      break
  }
}
