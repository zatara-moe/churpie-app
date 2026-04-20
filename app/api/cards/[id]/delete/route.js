// app/api/cards/[id]/delete/route.js
// Soft-deletes a card. Optionally revokes the recipient's watch access.

export const dynamic = 'force-dynamic'

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createServiceClient } from '../../../../../lib/supabase'
import { NextResponse } from 'next/server'

export async function POST(request, { params }) {
  const { id: cardId } = params

  let body = {}
  try {
    body = await request.json()
  } catch {}
  const revokeWatch = body.revokeWatch === true

  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = createServiceClient()

  const { data: card } = await sb
    .from('cards')
    .select('id, creator_id, deleted_at')
    .eq('id', cardId)
    .single()

  if (!card) {
    return NextResponse.json({ error: 'Card not found' }, { status: 404 })
  }
  if (card.creator_id !== session.user.id) {
    return NextResponse.json({ error: 'Not your card' }, { status: 403 })
  }
  if (card.deleted_at) {
    return NextResponse.json({ status: 'already_deleted' })
  }

  const nowIso = new Date().toISOString()
  const updates = { deleted_at: nowIso }
  if (revokeWatch) {
    updates.watch_revoked_at = nowIso
  }

  const { error: updateErr } = await sb
    .from('cards')
    .update(updates)
    .eq('id', cardId)

  if (updateErr) {
    console.error('Delete failed:', updateErr.message)
    return NextResponse.json({ error: 'Could not delete. Try again.' }, { status: 500 })
  }

  return NextResponse.json({
    status: 'deleted',
    deletedAt: nowIso,
    watchRevoked: revokeWatch,
  })
}
