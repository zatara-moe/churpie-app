// app/api/cards/[id]/send/route.js
// Marks a compiled card as sent and fires the delivery email to the recipient.

export const dynamic = 'force-dynamic'

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createServiceClient } from '../../../../../lib/supabase'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'

export async function POST(request, { params }) {
  const { id: cardId } = params

  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = createServiceClient()

  // Fetch card + delivery (to get watch token)
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

  const delivery = card.deliveries?.[0]
  if (!delivery?.watch_token) {
    return NextResponse.json({ error: 'Watch token missing — try recompiling' }, { status: 500 })
  }

  // Figure out app URL for the watch link
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.churpie.me'
  const watchUrl = `${appUrl}/watch/${delivery.watch_token}`

  // Fire the delivery email (non-blocking — failure shouldn't block status change)
  if (card.recipient_email && process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const firstName = card.recipient_name.split(' ')[0]

      await resend.emails.send({
        from: 'churpie <hello@churpie.me>',
        to: card.recipient_email,
        subject: `${firstName}, everyone who loves you made something for you.`,
        html: renderDeliveryEmail({
          firstName,
          watchUrl,
          clipCount: (card.clips?.length || 0),
        }),
      })
    } catch (err) {
      console.error('Delivery email failed:', err.message)
      // Don't block — creator can resend via support if needed
    }
  }

  // Mark card as sent
  await sb
    .from('cards')
    .update({ status: 'sent' })
    .eq('id', cardId)

  await sb
    .from('deliveries')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('card_id', cardId)

  return NextResponse.json({ status: 'sent', watchUrl })
}

// Inline email template (bulletin-board aesthetic, email-client-safe)
function renderDeliveryEmail({ firstName, watchUrl, clipCount }) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0; padding:0; background:#F5F0E8; font-family: Georgia, 'Times New Roman', serif;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F5F0E8;">
  <tr><td align="center" style="padding:0;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#D4266A;">
      <tr><td height="4" style="background:repeating-linear-gradient(90deg,#D4266A 0,#D4266A 12px,#0B9DAA 12px,#0B9DAA 24px); line-height:4px; font-size:0;">&nbsp;</td></tr>
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px; width:100%;">
      <tr><td style="padding:40px 36px 12px;">
        <h1 style="margin:0; font-family:Georgia, serif; font-size:34px; line-height:1.1; color:#1A1410; font-weight:normal;">
          ${escapeHtml(firstName)},
        </h1>
        <p style="margin:16px 0 0; font-family:Georgia, serif; font-size:26px; color:#1A1410; font-style:italic;">
          something&rsquo;s waiting for you.
        </p>
      </td></tr>
      <tr><td style="padding:24px 36px 8px;">
        <p style="margin:0 0 16px; font-family:'Courier New', monospace; font-size:16px; line-height:1.7; color:#1A1410;">
          ${clipCount} people made a video for you.
        </p>
        <p style="margin:0 0 16px; font-family:'Courier New', monospace; font-size:16px; line-height:1.7; color:#1A1410;">
          It&rsquo;s about three minutes long.<br>
          <strong>Find a quiet moment. Put it on your phone. Press play.</strong>
        </p>
      </td></tr>
      <tr><td align="center" style="padding:24px 36px 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr><td align="center" style="background:#D4266A; border:2px solid #1A1410;">
            <a href="${watchUrl}" style="display:inline-block; padding:16px 36px; font-family:'Courier New', monospace; font-size:14px; font-weight:bold; letter-spacing:1.5px; text-transform:uppercase; color:#ffffff; text-decoration:none;">
              Press play &rarr;
            </a>
          </td></tr>
        </table>
      </td></tr>
      <tr><td align="center" style="padding:12px 36px 32px;">
        <p style="margin:0; font-family:cursive; font-size:22px; color:#0B9DAA; font-style:italic;">
          p.s. it&rsquo;s yours to keep forever.
        </p>
      </td></tr>
      <tr><td align="center" style="padding:0 36px 32px;">
        <p style="margin:0; font-family:'Courier New', monospace; font-size:11px; color:#7A6E5C;">
          If the button doesn&rsquo;t work, paste this: <a href="${watchUrl}" style="color:#0B9DAA; word-break:break-all;">${watchUrl}</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[ch])
}
