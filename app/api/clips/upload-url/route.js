// app/api/clips/upload-url/route.js

export const dynamic = 'force-dynamic'

import { createServiceClient } from '../../../../lib/supabase'
import { getPresignedUploadUrl } from '../../../../lib/r2'
import { nanoid } from 'nanoid'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const { cardSlug, contributorName, contentType = 'video/mp4' } = await request.json()
  if (!cardSlug) return NextResponse.json({ error: 'Missing cardSlug' }, { status: 400 })

  const sb = createServiceClient()
  const { data: card } = await sb
    .from('cards')
    .select('id, status')
    .eq('slug', cardSlug)
    .single()

  if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 })
  if (card.status !== 'live') return NextResponse.json({ error: 'Card not accepting clips' }, { status: 400 })

  const clipId = nanoid()
  const storageKey = `clips/${card.id}/${clipId}.mp4`
  const uploadUrl = await getPresignedUploadUrl(storageKey, contentType)

  // Pre-create clip row
  await sb.from('clips').insert({
    id: clipId,
    card_id: card.id,
    contributor_name: contributorName || null,
    storage_key: storageKey,
    status: 'uploading',
  })

  return NextResponse.json({ uploadUrl, clipId, storageKey })
}
