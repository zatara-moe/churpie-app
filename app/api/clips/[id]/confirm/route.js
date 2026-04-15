// app/api/clips/[id]/confirm/route.js

export const dynamic = 'force-dynamic'

import { createServiceClient } from '../../../../../lib/supabase'
import { getPresignedReadUrl } from '../../../../../lib/r2'
import { NextResponse } from 'next/server'

// No top-level client instantiation — everything is lazy
// so missing env vars don't crash the build

export async function POST(request, { params }) {
  const { id: clipId } = params
  const { durationSeconds } = await request.json()

  const sb = createServiceClient()
  const { data: clip } = await sb
    .from('clips')
    .update({ status: 'submitted', duration_seconds: durationSeconds || 15 })
    .eq('id', clipId)
    .select()
    .single()

  if (!clip) return NextResponse.json({ error: 'Clip not found' }, { status: 404 })

  // Transcription runs async — don't block the response
  transcribeAsync(clip, sb).catch(e => console.error('Transcription failed:', e.message))

  return NextResponse.json({ status: 'submitted' })
}

async function transcribeAsync(clip, sb) {
  if (!process.env.OPENAI_API_KEY) {
    console.log('No OPENAI_API_KEY set — skipping transcription')
    return
  }

  try {
    // Step 1: Whisper transcribes the audio
    const signedUrl = await getPresignedReadUrl(clip.storage_key, 180)
    const response = await fetch(signedUrl)
    const buffer = await response.arrayBuffer()
    const file = new File([buffer], 'clip.mp4', { type: 'video/mp4' })

    const { default: OpenAI } = await import('openai')
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const rawTranscript = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      response_format: 'text',
    })

    if (!rawTranscript?.trim()) return

    // Step 2: Claude Haiku cleans up the transcript into readable captions
    let captionText = rawTranscript.trim()

    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const Anthropic = (await import('@anthropic-ai/sdk')).default
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
        const cleaned = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 300,
          messages: [{
            role: 'user',
            content: `Clean up this video caption transcript. Add proper punctuation and capitalization. Fix run-on sentences. Keep it natural and conversational. Return only the cleaned caption text, nothing else.\n\n${rawTranscript.trim()}`
          }]
        })
        const cleanedText = cleaned.content[0]?.text?.trim()
        if (cleanedText) captionText = cleanedText
      } catch (e) {
        console.error('Claude cleanup failed, using raw transcript:', e.message)
      }
    }

    await sb.from('clips').update({ caption_text: captionText }).eq('id', clip.id)
    console.log(`✓ Transcribed clip ${clip.id}`)

  } catch (e) {
    console.error('Transcription error:', e.message)
  }
}
