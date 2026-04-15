// app/api/cards/[id]/compile/route.js

export const dynamic = 'force-dynamic'

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createServiceClient } from '../../../../../lib/supabase'
import { signWatchToken } from '../../../../../lib/watch-token'
import { NextResponse } from 'next/server'

export async function POST(request, { params }) {
  const { id: cardId } = params

  // Verify creator owns this card
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sb = createServiceClient()
  const { data: card } = await sb
    .from('cards')
    .select('*, clips(*)')
    .eq('id', cardId)
    .eq('creator_id', session.user.id)
    .single()

  if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 })
  if (card.status === 'compiled' || card.status === 'compiling') {
    return NextResponse.json({ error: 'Already compiled or compiling' }, { status: 400 })
  }

  const submittedClips = (card.clips || []).filter(c => c.status === 'submitted')
  if (submittedClips.length === 0) {
    return NextResponse.json({ error: 'No submitted clips yet' }, { status: 400 })
  }

  // Generate watch token
  const watchToken = await signWatchToken(cardId)

  // Mark card as compiling
  await sb.from('cards').update({ status: 'compiling' }).eq('id', cardId)

  // Save delivery row with watch token
  await sb.from('deliveries').upsert({
    card_id: cardId,
    watch_token: watchToken,
    status: 'compiling',
  })

  // Fire the worker — non-blocking
  const workerUrl = process.env.WORKER_URL
  fetch(`${workerUrl}/compile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cardId,
      cardSlug: card.slug,
      recipientName: card.recipient_name,
      recipientEmail: card.recipient_email,
      recipientPhone: card.recipient_phone,
      music: card.music_choice,
      watchToken,
      clips: submittedClips.map(c => ({
        storageKey: c.storage_key,
        captionText: c.caption_text,
        durationSeconds: c.duration_seconds,
        contributorName: c.contributor_name,
      })),
    }),
  }).catch(err => console.error('Worker trigger error:', err.message))

  return NextResponse.json({
    status: 'compiling',
    clipCount: submittedClips.length,
    message: `Compiling ${submittedClips.length} clips...`,
  })
}
