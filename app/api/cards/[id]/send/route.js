// app/api/cards/[id]/send/route.js
// Sends the video to the recipient via email.
// Email copy adapts to card theme for emotional match.

export const dynamic = 'force-dynamic'

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createServiceClient } from '../../../../../lib/supabase'
import { signWatchToken } from '../../../../../lib/watch-token'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const THEME_MESSAGES = {
  milestone: {
    subject: (firstName) => `${firstName}, your people marked this one.`,
    opening: `they got together to mark this with you.`,
  },
  recovery: {
    subject: (firstName) => `${firstName}, we've got you.`,
    opening: `they got together to let you know you're not going through this alone.`,
  },
  welcome_home: {
    subject: (firstName) => `${firstName}, welcome home.`,
    opening: `they got together the moment they knew you were coming back.`,
  },
  hard_stretch: {
    subject: (firstName) => `${firstName}, you're not alone in this.`,
    opening: `they got together because they wanted you to feel them with you.`,
  },
  honoring_service: {
    subject: (firstName) => `${firstName}, thank you doesn't cover it.`,
    opening: `they got together to say what words alone can't.`,
  },
  injured_athlete: {
    subject: (firstName) => `${firstName}, the team's still with you.`,
    opening: `they got together while you heal up.`,
  },
  birthday: {
    subject: (firstName) => `${firstName}, they made this one for you.`,
    opening: `they got together to celebrate you.`,
  },
  something_else: {
    subject: (firstName) => `${firstName}, you've been on our minds.`,
    opening: `they got together because you matter to them.`,
  },
  getwell: 'recovery',
  homecoming: 'welcome_home',
  veteran: 'honoring_service',
  athlete: 'injured_athlete',
  grief: 'hard_stretch',
  other: 'something_else',
  support: 'hard_stretch',
  graduation: 'milestone',
  justbecause: 'something_else',
}

function resolveTheme(theme) {
  const t = theme || 'something_else'
  const entry = THEME_MESSAGES[t]
  if (typeof entry === 'string') {
    return THEME_MESSAGES[entry] || THEME_MESSAGES.something_else
  }
  return entry || THEME_MESSAGES.something_else
}

function humanLength(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds || 0))
  if (s < 45) return `about ${s} seconds`
  if (s < 75) return `about a minute`
  if (s < 105) return `a minute and a half`
  const mins = Math.round(s / 60)
  if (s % 60 >= 30 && s % 60 < 50) return `about ${mins} and a half minutes`
  return `about ${mins} minutes`
}

function humanClipCount(n) {
  if (!n || n <= 0) return 'your people'
  if (n === 1) return 'one of your people'
  const words = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve']
  if (n <= 12) return `${words[n]} of your people`
  return `${n} of your people`
}

export async function POST(request, { params }) {
  const { id: cardId } = params

  let body = {}
  try {
    body = await request.json()
  } catch {}
  const recipientEmailOverride = typeof body.recipientEmail === 'string'
    ? body.recipientEmail.trim()
    : null

  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = createServiceClient()

  const { data: card } = await sb
    .from('cards')
    .select('*, deliveries(*), clips(*)')
    .eq('id', cardId)
    .eq('creator_id', session.user.id)
    .single()

  if (!card) {
    return NextResponse.json({ error: 'Card not found' }, { status: 404 })
  }
  if (card.status !== 'compiled' && card.status !== 'sent') {
    return NextResponse.json({ error: 'Card not ready to send yet' }, { status: 400 })
  }

  let delivery = card.deliveries?.[0]

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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.churpie.me'
  const watchUrl = `${appUrl}/watch/${delivery.watch_token}`

  const emailToUse = recipientEmailOverride || card.recipient_email

  if (!emailToUse) {
    return NextResponse.json({
      error: 'No recipient email. Add one or just share the link directly.',
    }, { status: 400 })
  }
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({
      error: 'Email not configured. Share the link directly for now.',
    }, { status: 500 })
  }

  const submittedClips = (card.clips || []).filter(c =>
    c.status === 'submitted' || c.status === 'processed'
  )
  const clipCount = submittedClips.length
  const totalSeconds = submittedClips.reduce(
    (sum, c) => sum + (c.duration_seconds || 0),
    0
  )

  const themeCopy = resolveTheme(card.theme)
  const firstName = card.recipient_name.split(' ')[0]
  const subject = themeCopy.subject(firstName)
  const opening = themeCopy.opening

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)

    await resend.emails.send({
      from: 'churpie <hello@churpie.me>',
      to: emailToUse,
      subject,
      html: renderDeliveryEmail({
        firstName,
        watchUrl,
        opening,
        clipCountText: humanClipCount(clipCount),
        lengthText: humanLength(totalSeconds),
      }),
    })

    if (recipientEmailOverride && recipientEmailOverride !== card.recipient_email) {
      await sb
        .from('cards')
        .update({ recipient_email: recipientEmailOverride })
        .eq('id', cardId)
    }
  } catch (err) {
    console.error('Delivery email failed:', err.message)
    return NextResponse.json({
      error: 'Email could not send. Try again or share the link directly.',
    }, { status: 500 })
  }

  const nowIso = new Date().toISOString()
  await sb
    .from('deliveries')
    .update({
      status: 'sent',
      sent_at: nowIso,
      sent_via: 'email',
      email_sent_at: nowIso,
      email_sent_to: emailToUse,
    })
    .eq('card_id', cardId)

  if (card.status !== 'sent') {
    await sb
      .from('cards')
      .update({ status: 'sent' })
      .eq('id', cardId)
  }

  return NextResponse.json({
    status: 'emailed',
    emailedTo: emailToUse,
    emailedAt: nowIso,
    watchUrl,
  })
}

function renderDeliveryEmail({ firstName, watchUrl, opening, clipCountText, lengthText }) {
  const safeName = escapeHtml(firstName)
  const safeOpening = escapeHtml(opening)
  const safeClipCount = escapeHtml(clipCountText)
  const safeLength = escapeHtml(lengthText)

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
</head>
<body style="margin:0; padding:0; background:#F5F0E8; font-family: Georgia, 'Times New Roman', serif;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F5F0E8;">
  <tr><td align="center" style="padding:0;">

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#D4266A;">
      <tr><td height="4" style="background:repeating-linear-gradient(90deg,#D4266A 0,#D4266A 12px,#0B9DAA 12px,#0B9DAA 24px); line-height:4px; font-size:0;">&nbsp;</td></tr>
    </table>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px; width:100%;">

      <tr><td align="center" style="padding:32px 36px 8px;">
        <div style="font-family:'Permanent Marker', cursive; font-size:22px; color:#1A1410; line-height:1;">
          churpie<span style="color:#D4266A;">.</span>
        </div>
        <div style="font-family:'Courier New', monospace; font-size:10px; letter-spacing:2px; text-transform:uppercase; color:#7A6E5C; font-weight:bold; margin-top:8px;">
          a video for you
        </div>
      </td></tr>

      <tr><td style="padding:24px 36px 8px;">
        <h1 style="margin:0; font-family:Georgia, serif; font-size:36px; line-height:1.1; color:#1A1410; font-weight:normal;">
          ${safeName},
        </h1>
        <p style="margin:14px 0 0; font-family:Georgia, serif; font-size:20px; color:#4A3F30; font-style:italic; line-height:1.4;">
          ${safeOpening}
        </p>
      </td></tr>

      <tr><td style="padding:24px 36px 8px;">
        <p style="margin:0; font-family:'Courier New', monospace; font-size:14px; line-height:1.75; color:#1A1410;">
          It&rsquo;s <strong>${safeLength}</strong>, made by ${safeClipCount}.<br>
          Put it somewhere quiet. Watch when you can.
        </p>
      </td></tr>

      <tr><td align="center" style="padding:28px 36px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="center" style="background:#D4266A; border-radius:2px;">
              <a href="${watchUrl}" style="display:inline-block; padding:16px 40px; font-family:'Courier New', monospace; font-size:13px; font-weight:bold; letter-spacing:1.5px; text-transform:uppercase; color:#ffffff; text-decoration:none;">
                Watch it &rarr;
              </a>
            </td>
          </tr>
        </table>
      </td></tr>

      <tr><td align="center" style="padding:8px 36px 24px;">
        <p style="margin:0; font-family:cursive; font-size:22px; color:#0B9DAA; font-style:italic;">
          p.s. it&rsquo;s yours to keep.
        </p>
      </td></tr>

      <tr><td align="center" style="padding:16px 36px 32px; border-top:1px dashed #D4C9A8;">
        <p style="margin:0; font-family:'Courier New', monospace; font-size:10px; color:#7A6E5C; line-height:1.5;">
          If the button doesn&rsquo;t work, paste this:<br>
          <a href="${watchUrl}" style="color:#0B9DAA; word-break:break-all;">${watchUrl}</a>
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
