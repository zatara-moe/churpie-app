// app/api/cards/[id]/send/route.js
// Marks a compiled card as sent. Supports two delivery modes:
//   - 'email': we fire the delivery email via Resend (requires recipient_email)
//   - 'link':  we just mark it sent; creator will share the watch link manually

export const dynamic = 'force-dynamic'

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createServiceClient } from '../../../../../lib/supabase'
import { signWatchToken } from '../../../../../lib/watch-token'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'

export async function POST(request, { params }) {
  const { id: cardId } = params

  // Parse request body — defaults to 'email' for backwards compatibility
  let body = {}
  try {
    body = await request.json()
  } catch {
    // No body — fine, defaults apply
  }
  const sentVia = body.sentVia === 'link' ? 'link' : 'email'
  const recipientEmailOverride = typeof body.recipientEmail === 'string'
    ? body.recipientEmail.trim()
    : null

  // Auth check
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = createServiceClient()

  // Fetch card + delivery
  const { data: card } = await sb
    .from('cards')
    .select('*, deliveries(*)')
    .eq('id', cardId)
    .eq('creator_id', session.user.id)
    .single()

  if (!card) {
    return NextResponse.json({ error: 'Card not found' }, { status: 404 })
  }
  if (card.status === 'sent') {
    return NextResponse.json({ error: 'Already sent' }, { status: 400 })
  }
  if (card.status !== 'compiled') {
    return NextResponse.json({ error: 'Card not ready to send yet' }, { status: 400 })
  }

  let delivery = card.deliveries?.[0]

  // Self-healing: if no delivery row or missing watch_token, generate one now.
  // This prevents dead-ends from older cards whose compile didn't write a token.
  if (!delivery?.watch_token) {
    try {
      const newToken = await signWatchToken(cardId)
      const { data: healed } = await sb
        .from('deliveries')
        .upsert({
          card_id: cardId,
          watch_token: newToken,
          status: 'compiled',
        }, { onConflict: 'card_id' })
        .select()
        .single()
      delivery = healed || { watch_token: newToken, card_id: cardId }
    } catch (err) {
      console.error('Watch token heal failed:', err.message)
      return NextResponse.json({
        error: 'Could not generate watch link. Try compiling again.',
      }, { status: 500 })
    }
  }

  // Figure out app URL for the watch link
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.churpie.me'
  const watchUrl = `${appUrl}/watch/${delivery.watch_token}`

  // Resolve which email address to use, if any
  const emailToUse = recipientEmailOverride || card.recipient_email

  // Email path — requires an email address and the Resend key
  if (sentVia === 'email') {
    if (!emailToUse) {
      return NextResponse.json({
        error: 'No recipient email provided. Add one or pick the link option.',
      }, { status: 400 })
    }
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({
        error: 'Email not configured. Use the link option instead.',
      }, { status: 500 })
    }

    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const firstName = card.recipient_name.split(' ')[0]

      await resend.emails.send({
        from: 'churpie <hello@churpie.me>',
        to: emailToUse,
        subject: `${firstName}, everyone who loves you made something for you.`,
        html: renderDeliveryEmail({
          firstName,
          watchUrl,
          clipCount: (card.clips?.length || 0),
        }),
      })

      // If they entered a new email inline, save it back to the card
      if (recipientEmailOverride && recipientEmailOverride !== card.recipient_email) {
        await sb
          .from('cards')
          .update({ recipient_email: recipientEmailOverride })
          .eq('id', cardId)
      }
    } catch (err) {
      console.error('Delivery email failed:', err.message)
      return NextResponse.json({
        error: 'Email could not send. Try again or use the link option.',
      }, { status: 500 })
    }
  }

  // Mark the card + delivery as sent
  const nowIso = new Date().toISOString()
  await sb
    .from('cards')
    .update({ status: 'sent' })
    .eq('id', cardId)

  await sb
    .from('deliveries')
    .update({
      status: 'sent',
      sent_at: nowIso,
      sent_via: sentVia,
    })
    .eq('card_id', cardId)

  return NextResponse.json({
    status: 'sent',
    sentVia,
    watchUrl,
  })
}

// ─── Email template (bulletin-board aesthetic, email-client-safe) ─
function renderDeliveryEmail({ firstName, watchUrl, clipCount }) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0; padding:0; background:#F5F0E8; font-family: Georgia, 'Times New Roman', serif;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F5F0E8;">
  <tr><td align="center" style="padding:0;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#D4266A;">
      <tr><td height="4" style="background:repeating-linear-gradient(90deg,#D4266A 0,#D4266A 12px,#0B9D
