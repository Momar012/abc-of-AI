import { NextResponse } from 'next/server'
import { ABEE_INSTRUCTIONS } from '@/lib/abee/prompt'
import { ABEE_TOOLS } from '@/lib/abee/tools'

// Mints a short-lived OpenAI Realtime token for the browser. The real API key
// never leaves the server, and the session setup (instructions, tools, voice)
// is fixed here so the browser can't change it.

export const dynamic = 'force-dynamic'

const MODEL = process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime-2.1-mini'
const VOICE = process.env.OPENAI_REALTIME_VOICE || 'marin'

export async function POST() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'missing-key', message: 'Abee is napping: no OpenAI key is set up yet. Ask your teacher!' },
      { status: 503 },
    )
  }

  const res = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      // Only needs to live long enough to open the connection
      expires_after: { anchor: 'created_at', seconds: 120 },
      session: {
        type: 'realtime',
        model: MODEL,
        instructions: ABEE_INSTRUCTIONS,
        output_modalities: ['audio'],
        max_output_tokens: 1024,
        audio: {
          input: {
            // Push-to-talk: the browser decides when a turn ends (Alt released)
            turn_detection: null,
            transcription: {
              model: 'gpt-4o-mini-transcribe',
              // Kids here often mix Urdu and English; keep Urdu in Urdu script so it's detected right
              prompt: 'A child learning AI. They may speak English, Urdu, or a mix of both. Write Urdu in Urdu script and English words in English.',
            },
            noise_reduction: { type: 'near_field' },
          },
          output: { voice: VOICE },
        },
        tools: ABEE_TOOLS,
        tool_choice: 'auto',
      },
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.value) {
    console.error('[abee] client_secrets failed', res.status, data?.error?.message)
    return NextResponse.json(
      { error: 'session-failed', message: 'Abee couldn’t wake up. Please try again in a moment.' },
      { status: 502 },
    )
  }

  return NextResponse.json({ token: data.value, model: MODEL, expiresAt: data.expires_at })
}
