// app/api/replies/route.js

export const dynamic = 'force-dynamic'

import { createServiceClient } from '../../../lib/supabase'
import { Resend } from 'resend'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const { cardId, message } = await request.json()
  if (!cardId || !message) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const sb = createServiceClient()

  // Get card + submitted clips with contributor names
  const { data: card } = await sb
    .from('cards')
    .select('*, clips(*)')
    .eq('id', cardId)
    .single()

  if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 })

  // Save reply
  await sb.from('replies').insert({ card_id: cardId, message })

  // Email contributors who left their name (we don't have their emails —
  // in production you'd collect contributor emails optionally at submission)
  // For now just log it and the creator will be notified
  console.log(`Reply from ${card.recipient_name} for card ${cardId}: ${message}`)

  // Notify the card creator
  if (card.recipient_email) {
    // We store creator's email via Supabase auth — get it
    const { data: { user } } = await sb.auth.admin.getUserById(card.creator_id)
    if (user?.email) {
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: 'churpie <hello@churpie.me>',
        to: user.email,
        subject: `${card.recipient_name} sent a thank you`,
        html: `<p>${card.recipient_name} watched the video you made for them and wanted you to know:</p><blockquote>${message}</blockquote><p>— churpie.</p>`,
      }).catch(() => {})
    }
  }

  return NextResponse.json({ status: 'sent' })
}
