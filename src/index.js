// churpie · one Worker: pages + API + nightly sweep
// No accounts. The host link is the account. Everything in R2 self-deletes.

import { Hono } from 'hono'
import { isBusinessEmail, newId, newToken, plusDays, nowIso, sanitize, escapeHtml } from './lib.js'
import { MOMENTS, VIBES, vibesFor } from './catalog.js'

const app = new Hono()

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const bad = (c, msg, status = 400) => c.json({ error: msg }, status)

async function getCard(db, where, value) {
  return db.prepare(`SELECT * FROM cards WHERE ${where} = ?`).bind(value).first()
}

async function listClips(db, cardId, { includeHidden = false } = {}) {
  const sql = includeHidden
    ? `SELECT * FROM clips WHERE card_id = ? AND status IN ('ready','hidden') ORDER BY COALESCE(position, 999999), created_at`
    : `SELECT * FROM clips WHERE card_id = ? AND status = 'ready' ORDER BY COALESCE(position, 999999), created_at`
  const { results } = await db.prepare(sql).bind(cardId).all()
  return results.map(parseClip)
}

function parseClip(row) {
  return { ...row, flags: row.flags ? JSON.parse(row.flags) : [] }
}

async function logEvent(db, cardId, type) {
  await db.prepare(`INSERT INTO events (card_id, type) VALUES (?, ?)`).bind(cardId, type).run()
}

// When the card last went into the queue, and when a reel maker last picked it up.
// Read from the events log, so no schema change is needed.
async function queueTimes(db, cardId) {
  // claims count only since the host last pressed "make the reel", so a fresh try starts fresh
  const row = await db.prepare(
    `WITH q AS (SELECT MAX(at) AS queuedAt FROM events WHERE card_id = ?1 AND type = 'sent')
     SELECT q.queuedAt, MAX(e.at) AS claimedAt, COUNT(e.id) AS claims
       FROM q LEFT JOIN events e ON e.card_id = ?1 AND e.type = 'claimed' AND e.at >= q.queuedAt`
  ).bind(cardId).first()
  return { queuedAt: row?.queuedAt || null, claimedAt: row?.claimedAt || null, claims: Number(row?.claims || 0) }
}

// The host's "last day to add a message" is a real close, not just a label.
function pastDeadline(card) {
  return card.status === 'open' && !!card.deadline_at && card.deadline_at < nowIso()
}

// Unfinished cards: kept while people are still adding, then let go.
// After IDLE_DAYS with nothing new, the card gets a delete date GRACE_DAYS out (shown on the board).
// Any new message, or the host pressing "keep it", clears that date. No schema change: uses expires_at and the events log.
const IDLE_DAYS = 30
const GRACE_DAYS = 14

function publicCard(card, clipCount) {
  return {
    id: card.id,
    recipientName: card.recipient_name,
    hostName: card.host_name,
    moment: card.moment,
    vibe: card.vibe,
    prompt: card.prompt,
    tone: card.tone,
    rules: card.rules ? JSON.parse(card.rules) : [],
    clipSeconds: card.clip_seconds,
    status: card.status,
    deadlineAt: card.deadline_at,
    deadlinePassed: pastDeadline(card),
    hasIntro: !!card.host_intro_key,
    clipCount,
  }
}

function stitchAuth(c) {
  const token = c.env.STITCH_TOKEN
  const given = c.req.header('authorization')?.replace(/^Bearer\s+/i, '')
  return token && given === token
}

// Streams an R2 object with HTTP range support (video scrubbing on phones needs it).
async function streamObject(c, key, contentTypeFallback = 'video/mp4', extra = {}) {
  const range = c.req.header('range')
  let obj
  if (range) {
    const m = /bytes=(\d+)-(\d*)/.exec(range)
    if (m) {
      const start = Number(m[1])
      const end = m[2] ? Number(m[2]) : undefined
      obj = await c.env.CLIPS.get(key, { range: { offset: start, length: end !== undefined ? end - start + 1 : undefined } })
      if (!obj) return c.notFound()
      const total = obj.size
      const length = end !== undefined ? end - start + 1 : total - start
      return new Response(obj.body, {
        status: 206,
        headers: {
          'content-type': obj.httpMetadata?.contentType || contentTypeFallback,
          'content-range': `bytes ${start}-${start + length - 1}/${total}`,
          'content-length': String(length),
          'accept-ranges': 'bytes',
          'cache-control': 'private, max-age=3600',
          ...extra,
        },
      })
    }
  }
  obj = await c.env.CLIPS.get(key)
  if (!obj) return c.notFound()
  return new Response(obj.body, {
    headers: {
      'content-type': obj.httpMetadata?.contentType || contentTypeFallback,
      'content-length': String(obj.size),
      'accept-ranges': 'bytes',
      'cache-control': 'private, max-age=3600',
      ...extra,
    },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Catalog (moments, vibes, ready-made prompts)
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/catalog', (c) => c.json({ moments: MOMENTS, vibes: VIBES, turnstile: c.env.TURNSTILE_SITE_KEY || null, email: emailOn(c.env), google: c.env.GOOGLE_CLIENT_ID || null, keepDays: LIFETIME(c.env) }))

// ── email: the host's board link, the finished reel, and a reminder before it's deleted ─────────────
// Sent through Resend. Off until RESEND_API_KEY (secret) is set; then hosts give a verified email.
const emailOn = (env) => !!env.RESEND_API_KEY
const LIFETIME = (env) => Number(env.CLIP_LIFETIME_DAYS || 14)
const looksLikeEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e || '')

async function sendEmail(env, { to, subject, lines, button, after = [] }) {
  if (!emailOn(env) || !to) return { skipped: true }
  const esc = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]))
  const p = (t) => `<p style="margin:0 0 14px;font:16px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1A1410">${esc(t)}</p>`
  const html = `<div style="background:#F5F0E8;padding:28px 16px"><div style="max-width:480px;margin:0 auto;background:#fff;border-radius:18px;padding:28px 24px">`
    + `<p style="margin:0 0 18px;font:italic 26px Georgia,serif;color:#1A1410">churpie<span style="color:#D4266A">.</span> <span style="font:italic 15px Georgia,serif;color:#7A6E5C">so they know they're loved</span></p>`
    + lines.map(p).join('')
    + (button ? `<p style="margin:22px 0"><a href="${esc(button.url)}" style="display:inline-block;background:#D4266A;color:#fff;text-decoration:none;font:700 16px -apple-system,Segoe UI,Helvetica,Arial,sans-serif;padding:14px 22px;border-radius:999px">${esc(button.label)}</a></p>` : '')
    + after.map(p).join('')
    + `<p style="margin:18px 0 0;font:13px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#7A6E5C">Made by Sherwood Digital in Flagstaff, Arizona. You're getting this because you made a card on churpie.me.</p></div></div>`
  const text = [...lines, ...(button ? [`${button.label}: ${button.url}`] : []), ...after].join('\n\n')
  const r = await fetch(env.RESEND_URL || 'https://api.resend.com/emails', { // RESEND_URL only for local testing
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: env.EMAIL_FROM || 'churpie <cards@churpie.me>', to: [to], subject, html, text }),
  }).catch((e) => ({ ok: false, status: 0, text: async () => String(e) }))
  if (!r.ok) console.error('email failed', r.status, await r.text().catch(() => ''))
  return { ok: r.ok }
}

// A card made with email on stays closed to messages until the host opens the board link from their email.
async function needsVerify(db, cardId) {
  const row = await db.prepare(`SELECT
      EXISTS(SELECT 1 FROM events WHERE card_id = ?1 AND type = 'needs_verify') AS needs,
      EXISTS(SELECT 1 FROM events WHERE card_id = ?1 AND type = 'verified') AS done`).bind(cardId).first()
  return !!row?.needs && !row?.done
}

// The first email: the board link. Opening it confirms the address and opens the card.
function sendBoardEmail(env, { to, recipientName, hostName, hostToken }) {
  const first = recipientName.split(' ')[0]
  return sendEmail(env, {
    to,
    subject: `Your card for ${first}: open it to get your invite link`,
    lines: [`Hi ${hostName.split(' ')[0]},`, `Your card for ${first} is ready to go. Open it to get the invite link, then send it to everyone who loves ${first}.`],
    button: { label: 'Open my card', url: `${env.APP_URL}/h/${hostToken}` },
    after: ['Keep this email. Your card page is private to you, and this link is how you get back to it from any phone or computer.'],
  })
}

// ── bounces: Resend tells us by webhook when an address can't take mail ──────
// One-time setup: Resend > Webhooks > add https://churpie.me/api/resend/webhook with events
// email.bounced and email.complained, then save its signing secret as the Worker secret RESEND_WEBHOOK_SECRET.
async function resendSignatureOk(env, req, body) {
  const secret = env.RESEND_WEBHOOK_SECRET
  const id = req.header('svix-id'), ts = req.header('svix-timestamp'), sigs = req.header('svix-signature')
  if (!secret || !id || !ts || !sigs) return false
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false // older than 5 minutes: a replay
  const raw = Uint8Array.from(atob(secret.replace(/^whsec_/, '')), (ch) => ch.charCodeAt(0))
  const key = await crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${ts}.${body}`)))
  const want = btoa(String.fromCharCode(...mac))
  return sigs.split(' ').some((s) => s.split(',')[1] === want)
}

app.post('/api/resend/webhook', async (c) => {
  const body = await c.req.text()
  if (!(await resendSignatureOk(c.env, c.req, body))) return bad(c, 'Bad signature.', 401)
  let ev = {}; try { ev = JSON.parse(body) } catch {}
  const type = { 'email.bounced': 'email_bounced', 'email.complained': 'email_complained' }[ev.type]
  if (!type) return c.json({ ok: true })
  console.log('email problem', ev.type, ev.data?.bounce?.type || '', ev.data?.bounce?.message || '')
  for (const to of [].concat(ev.data?.to || [])) {
    const email = String(to).toLowerCase()
    // only cards still using this address, so a host who already fixed it isn't flagged again
    const { results } = await c.env.DB.prepare(`SELECT id FROM cards WHERE host_email = ?`).bind(email).all()
    for (const r of results) await logEvent(c.env.DB, r.id, type)
  }
  return c.json({ ok: true })
})

const hasBounced = async (db, email) => !!(await db.prepare(
  `SELECT 1 FROM events e JOIN cards c ON c.id = e.card_id WHERE c.host_email = ? AND e.type = 'email_bounced'
     AND e.at > COALESCE((SELECT MAX(at) FROM events WHERE card_id = c.id AND type = 'email_changed'), '') LIMIT 1`).bind(email).first())

// The "check your email" screen asks this, so a bounce shows up there instead of leaving the host waiting.
// Only says yes/no; never shows the address.
app.get('/api/cards/:id/email', async (c) => {
  const id = c.req.param('id')
  const row = await c.env.DB.prepare(`SELECT
      EXISTS(SELECT 1 FROM events WHERE card_id = ?1 AND type = 'verified') AS verified,
      (SELECT MAX(at) FROM events WHERE card_id = ?1 AND type = 'email_bounced') AS bouncedAt,
      (SELECT MAX(at) FROM events WHERE card_id = ?1 AND type = 'email_changed') AS changedAt`).bind(id).first()
  const bounced = !!row?.bouncedAt && (!row.changedAt || row.bouncedAt > row.changedAt)
  return c.json({ verified: !!row?.verified, bounced })
})

// Fix the address and send the board link again. Only before the card is opened: until then the
// card id is known only to the person who just made it (the invite link isn't shown yet).
app.post('/api/cards/:id/email', async (c) => {
  const b = await c.req.json().catch(() => ({}))
  if (!(await isPerson(c, b.turnstile))) return bad(c, NOT_A_PERSON, 403)
  const card = await getCard(c.env.DB, 'id', c.req.param('id'))
  if (!card) return bad(c, "We can't find that card. Start a new one.", 404)
  if (!(await needsVerify(c.env.DB, card.id))) return bad(c, 'This card is already open. Use the link in your email.', 409)
  const email = sanitize(b.email, 120)?.toLowerCase()
  if (!looksLikeEmail(email)) return bad(c, 'Check the email address.')
  if (await hasBounced(c.env.DB, email)) return bad(c, "Email to that address bounces. Check it for a typo, or use a different one.")
  const tries = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM events WHERE card_id = ? AND type = 'email_changed'`).bind(card.id).first()
  if ((tries?.n || 0) >= 5) return bad(c, 'That is a lot of tries. Start a new card with an address you know works.', 429)
  await c.env.DB.prepare(`UPDATE cards SET host_email = ?, account_type = ? WHERE id = ?`)
    .bind(email, isBusinessEmail(email) ? 'business' : 'personal', card.id).run()
  await logEvent(c.env.DB, card.id, 'email_changed')
  const sent = await sendBoardEmail(c.env, { to: email, recipientName: card.recipient_name, hostName: card.host_name, hostToken: card.host_token })
  if (!sent.ok) return bad(c, "We couldn't send the email. Check the address and try once more.", 502)
  return c.json({ ok: true, email })
})

// ── "Continue with Google": Google vouches for the email, so the card opens right away ──
// Needs only GOOGLE_CLIENT_ID (a public value in wrangler.toml). No secret, no stored Google data:
// we check Google's signature on the sign-in token and keep just the email.
let googleKeys = { at: 0, keys: [] }
const b64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)), (ch) => ch.charCodeAt(0))
async function googleEmail(env, credential) {
  try {
    if (!env.GOOGLE_CLIENT_ID || typeof credential !== 'string') return null
    const [h, p, sig] = credential.split('.'); if (!sig) return null
    const header = JSON.parse(new TextDecoder().decode(b64url(h)))
    const claims = JSON.parse(new TextDecoder().decode(b64url(p)))
    if (header.alg !== 'RS256') return null
    let jwk = googleKeys.keys.find((k) => k.kid === header.kid)
    if (!jwk || Date.now() - googleKeys.at > 6 * 3600e3) {
      const r = await fetch('https://www.googleapis.com/oauth2/v3/certs')
      googleKeys = { at: Date.now(), keys: (await r.json()).keys || [] }
      jwk = googleKeys.keys.find((k) => k.kid === header.kid)
    }
    if (!jwk) return null
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'])
    if (!(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64url(sig), new TextEncoder().encode(`${h}.${p}`)))) return null
    if (!['accounts.google.com', 'https://accounts.google.com'].includes(claims.iss)) return null
    if (claims.aud !== env.GOOGLE_CLIENT_ID || claims.exp * 1000 < Date.now() || !claims.email_verified) return null
    return String(claims.email).toLowerCase()
  } catch { return null }
}

// Waiting on an email that bounced (or never came)? The browser that made the card can sign in with
// Google instead: Google vouches for the new address and the card opens. Only before it's opened,
// when the card id is known only to whoever just made it.
app.post('/api/cards/:id/google', async (c) => {
  const b = await c.req.json().catch(() => ({}))
  const card = await getCard(c.env.DB, 'id', c.req.param('id'))
  if (!card) return bad(c, "We can't find that card. Start a new one.", 404)
  if (!(await needsVerify(c.env.DB, card.id))) return bad(c, 'This card is already open. Use the link in your email.', 409)
  const email = await googleEmail(c.env, b.credential)
  if (!email) return bad(c, "Google sign-in didn't go through. Tap the Google button again.", 401)
  await c.env.DB.prepare(`UPDATE cards SET host_email = ?, account_type = ? WHERE id = ?`)
    .bind(email, isBusinessEmail(email) ? 'business' : 'personal', card.id).run()
  await logEvent(c.env.DB, card.id, 'email_changed')
  await logEvent(c.env.DB, card.id, 'verified')
  c.executionCtx.waitUntil(sendBoardEmail(c.env, { to: email, recipientName: card.recipient_name, hostName: card.host_name, hostToken: card.host_token }))
  return c.json({ host: `${c.env.APP_URL}/h/${card.host_token}` })
})

// "Lost your card?" with Google: no email round trip, straight to the boards made with that address
app.post('/api/lost/google', async (c) => {
  const b = await c.req.json().catch(() => ({}))
  const email = await googleEmail(c.env, b.credential)
  if (!email) return bad(c, "Google sign-in didn't go through. Tap the Google button again.", 401)
  const { results } = await c.env.DB.prepare(`SELECT recipient_name, host_token, status FROM cards WHERE host_email = ? ORDER BY created_at DESC LIMIT 20`).bind(email).all()
  return c.json({ email, cards: results.map((r) => ({ name: r.recipient_name, status: r.status, url: `${c.env.APP_URL}/h/${r.host_token}` })) })
})

// Cloudflare Turnstile: an invisible "are you a person" check on making cards and sending messages.
// Off until both TURNSTILE_SITE_KEY (variable) and TURNSTILE_SECRET (secret) are set.
async function isPerson(c, token) {
  if (!c.env.TURNSTILE_SECRET || !c.env.TURNSTILE_SITE_KEY) return true
  if (!token) return false
  const form = new FormData()
  form.append('secret', c.env.TURNSTILE_SECRET)
  form.append('response', String(token))
  const ip = c.req.header('cf-connecting-ip'); if (ip) form.append('remoteip', ip)
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form }).then((x) => x.json()).catch(() => ({ success: false }))
  return !!r.success
}
const NOT_A_PERSON = "We couldn't confirm you're a person. Refresh the page and try once more."


// ─────────────────────────────────────────────────────────────────────────────
// Host: create a card
// ─────────────────────────────────────────────────────────────────────────────

app.post('/api/cards', async (c) => {
  const b = await c.req.json().catch(() => ({}))
  if (!(await isPerson(c, b.turnstile))) return bad(c, NOT_A_PERSON, 403)
  const recipientName = sanitize(b.recipientName, 60)
  const hostName = sanitize(b.hostName, 60)
  const prompt = sanitize(b.prompt, 240)
  const moment = MOMENTS.find((m) => m.id === b.moment) ? b.moment : 'birthday'
  // only a theme that suits the moment; anything else falls back to the moment's own
  const fits = vibesFor(moment)
  const vibe = fits.find((v) => v.id === b.vibe) ? b.vibe : (fits[0]?.id || 'postcard')
  let tone = ['funny', 'heartfelt', 'hype', 'quiet'].includes(b.tone) ? b.tone : null
  if (moment === 'memory' && tone === 'hype') tone = 'quiet' // big energy never fits a memorial
  const rules = Array.isArray(b.rules) ? b.rules.map((r) => sanitize(r, 80)).filter(Boolean).slice(0, 5) : []
  const clipSeconds = Number(b.clipSeconds) === 30 ? 30 : 15
  let hostEmail = sanitize(b.hostEmail, 120)?.toLowerCase() || null
  const byGoogle = !!b.googleCredential
  if (byGoogle) {
    hostEmail = await googleEmail(c.env, b.googleCredential)
    if (!hostEmail) return bad(c, "Google sign-in didn't go through. Tap the Google button again, or use your email instead.", 401)
  }
  const deadlineAt = b.deadlineAt ? new Date(b.deadlineAt).toISOString() : null

  if (!recipientName) return bad(c, "Who's it for? Even just a first name.")
  if (!hostName) return bad(c, "Add your name so people know who's asking.")
  if (!prompt) return bad(c, 'Write the one question everyone will answer.')
  if (emailOn(c.env) && !looksLikeEmail(hostEmail)) return bad(c, "Add your email. It's where the link to your card and the finished reel go.")
  if (emailOn(c.env) && !byGoogle && (await hasBounced(c.env.DB, hostEmail))) return bad(c, "Email to that address bounces. Check it for a typo, or use a different one.")

  const id = newId(8)
  const hostToken = newToken()
  const watchToken = newToken()
  const accountType = hostEmail && isBusinessEmail(hostEmail) ? 'business' : 'personal'

  await c.env.DB.prepare(
    `INSERT INTO cards (id, host_token, watch_token, recipient_name, moment, vibe, prompt, tone, rules, host_name, host_email, account_type, clip_seconds, deadline_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, hostToken, watchToken, recipientName, moment, vibe, prompt, tone, JSON.stringify(rules), hostName, hostEmail, accountType, clipSeconds, deadlineAt)
    .run()
  await logEvent(c.env.DB, id, 'created')

  const base = c.env.APP_URL
  if (emailOn(c.env) && byGoogle) {
    // Google already confirmed the address: open the card now, and email the board link as a keepsake
    c.executionCtx.waitUntil(sendBoardEmail(c.env, { to: hostEmail, recipientName, hostName, hostToken }))
  } else if (emailOn(c.env)) {
    // the board link is the key, so it only goes to the inbox; opening it confirms the email and opens the card
    await logEvent(c.env.DB, id, 'needs_verify')
    const sent = await sendBoardEmail(c.env, { to: hostEmail, recipientName, hostName, hostToken })
    if (!sent.ok) return bad(c, "We couldn't send the email. Check the address and try once more.", 502)
    return c.json({ id, checkEmail: true, email: hostEmail })
  }
  return c.json({
    id,
    hostToken,
    links: {
      host: `${base}/h/${hostToken}`,
      invite: `${base}/c/${id}`,
      watch: `${base}/w/${watchToken}`,
    },
    accountType,
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Contributor: what the invite link shows, and submitting a clip
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/cards/:id/public', async (c) => {
  const card = await getCard(c.env.DB, 'id', c.req.param('id'))
  if (!card) return bad(c, "This card isn't here anymore.", 404)
  const { count } = await c.env.DB.prepare(`SELECT COUNT(*) AS count FROM clips WHERE card_id = ? AND status = 'ready'`).bind(card.id).first()
  // who's already in, names as they typed them, so a guest can see the crowd (never the messages)
  const { results: inRows } = await c.env.DB.prepare(`SELECT contributor_name FROM clips WHERE card_id = ? AND status = 'ready' ORDER BY created_at DESC LIMIT 5`).bind(card.id).all()
  const names = inRows.map((r) => String(r.contributor_name || '').trim().slice(0, 24)).filter(Boolean)
  // full is checked up front, so nobody records a message that can't go in
  return c.json({ ...publicCard(card, count), names, full: count >= Number(c.env.MAX_CLIPS_PER_CARD || 50), notYet: await needsVerify(c.env.DB, card.id) })
})

app.get('/api/cards/:id/intro', async (c) => {
  const card = await getCard(c.env.DB, 'id', c.req.param('id'))
  if (!card?.host_intro_key) return c.notFound()
  return streamObject(c, card.host_intro_key)
})

// Step 1: register the clip, get an upload target.
app.post('/api/cards/:id/clips', async (c) => {
  const card = await getCard(c.env.DB, 'id', c.req.param('id'))
  if (!card) return bad(c, "This card isn't here anymore.", 404)
  if (card.status !== 'open') return bad(c, card.status === 'ready' || card.status === 'sent' || card.status === 'expired' ? `${card.host_name} already made the reel, so this card is closed.` : `${card.host_name} closed messages to make the reel.`, 409)

  if (pastDeadline(card)) return bad(c, `The last day to add a message for ${card.recipient_name} has passed.`, 409)
  if (await needsVerify(c.env.DB, card.id)) return bad(c, `${card.host_name} hasn't opened this card yet. Try again a little later.`, 409)

  const b = await c.req.json().catch(() => ({}))
  if (!(await isPerson(c, b.turnstile))) return bad(c, NOT_A_PERSON, 403)
  const name = sanitize(b.name, 40)
  const location = sanitize(b.location, 40) || null
  const kind = b.kind === 'text' ? 'text' : 'video'
  const text = kind === 'text' ? sanitize(b.text, 280) : null
  if (!name) return bad(c, 'Add your name so they know who this is from.')
  if (kind === 'text' && !text) return bad(c, 'Write a few words first.')

  const { count } = await c.env.DB.prepare(`SELECT COUNT(*) AS count FROM clips WHERE card_id = ? AND status IN ('ready','uploading','hidden')`).bind(card.id).first()
  if (count >= Number(c.env.MAX_CLIPS_PER_CARD || 50)) return bad(c, `This card is full. You can still start a card of your own for ${card.recipient_name} from this page.`, 409)

  const clipId = newId(10)
  const editToken = newToken()
  const contentType = kind === 'video' ? (String(b.contentType || 'video/mp4').startsWith('video/') ? b.contentType : 'video/mp4') : null
  const ext = contentType?.includes('webm') ? 'webm' : contentType?.includes('quicktime') ? 'mov' : 'mp4'
  const storageKey = kind === 'video' ? `clips/${card.id}/${clipId}.${ext}` : null

  await c.env.DB.prepare(
    `INSERT INTO clips (id, card_id, edit_token, contributor_name, location, kind, text, storage_key, content_type, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(clipId, card.id, editToken, name, location, kind, text, storageKey, contentType, kind === 'text' ? 'ready' : 'uploading')
    .run()

  if (kind === 'text') await logEvent(c.env.DB, card.id, 'clip')
  // someone is still adding: a quiet card's delete date goes away
  if (card.expires_at) await c.env.DB.prepare(`UPDATE cards SET expires_at = NULL WHERE id = ? AND status = 'open'`).bind(card.id).run()

  return c.json({
    clipId,
    editToken,
    uploadUrl: kind === 'video' ? `/api/clips/${clipId}/upload?edit=${editToken}` : null,
    editUrl: `${c.env.APP_URL}/c/${card.id}?edit=${editToken}`,
  })
})

// Step 2: the phone PUTs the file straight through to R2. No S3 keys anywhere.
app.put('/api/clips/:clipId/upload', async (c) => {
  const clip = await c.env.DB.prepare(`SELECT * FROM clips WHERE id = ?`).bind(c.req.param('clipId')).first()
  if (!clip) return c.notFound()
  if (clip.edit_token !== c.req.query('edit')) return bad(c, "That link doesn't match this message. Use the private link you saved.", 403)
  if (clip.kind !== 'video') return bad(c, 'Written messages have nothing to upload.')

  const maxBytes = Number(c.env.MAX_UPLOAD_MB || 200) * 1024 * 1024
  const len = Number(c.req.header('content-length') || 0)
  if (len > maxBytes) return bad(c, `That video is too big. Trim it on your phone to under ${c.env.MAX_UPLOAD_MB || 200} MB, or record here instead.`, 413)

  const contentType = c.req.header('content-type') || clip.content_type || 'video/mp4'
  const obj = await c.env.CLIPS.put(clip.storage_key, c.req.raw.body, {
    httpMetadata: { contentType },
  })
  await c.env.DB.prepare(`UPDATE clips SET status = 'ready', bytes = ?, content_type = ?, flags = NULL WHERE id = ?`)
    .bind(obj.size, contentType, clip.id)
    .run()
  await logEvent(c.env.DB, clip.card_id, 'clip')
  return c.json({ ok: true, bytes: obj.size })
})

// Big videos (a phone's own camera can make 100+ MB) go up in pieces. Cloudflare turns away any single
// request over 100 MB before the Worker sees it, so one file is sent as several smaller requests and
// R2 joins them back together. Same clip, same key, same "ready" at the end as the one-request path above.
async function videoClip(c) {
  const clip = await c.env.DB.prepare(`SELECT * FROM clips WHERE id = ?`).bind(c.req.param('clipId')).first()
  if (!clip) return { error: c.notFound() }
  if (clip.edit_token !== c.req.query('edit')) return { error: bad(c, "That link doesn't match this message. Use the private link you saved.", 403) }
  if (clip.kind !== 'video') return { error: bad(c, 'Written messages have nothing to upload.') }
  return { clip }
}

app.post('/api/clips/:clipId/parts', async (c) => {
  const { clip, error } = await videoClip(c); if (error) return error
  const b = await c.req.json().catch(() => ({}))
  const maxBytes = Number(c.env.MAX_UPLOAD_MB || 300) * 1024 * 1024
  if (Number(b.size) > maxBytes) return bad(c, `That video is over ${c.env.MAX_UPLOAD_MB || 300} MB. Record it here instead, or trim it on your phone first.`, 413)
  const contentType = String(b.contentType || clip.content_type || 'video/mp4')
  const mpu = await c.env.CLIPS.createMultipartUpload(clip.storage_key, { httpMetadata: { contentType: contentType.startsWith('video/') ? contentType : 'video/mp4' } })
  return c.json({ uploadId: mpu.uploadId })
})

app.put('/api/clips/:clipId/parts/:n', async (c) => {
  const { clip, error } = await videoClip(c); if (error) return error
  const n = Number(c.req.param('n'))
  if (!Number.isInteger(n) || n < 1 || n > 100) return bad(c, 'That piece of the video is out of order. Try once more.')
  const mpu = c.env.CLIPS.resumeMultipartUpload(clip.storage_key, c.req.query('uploadId'))
  const part = await mpu.uploadPart(n, c.req.raw.body)
  return c.json(part) // { partNumber, etag }
})

app.post('/api/clips/:clipId/parts/done', async (c) => {
  const { clip, error } = await videoClip(c); if (error) return error
  const b = await c.req.json().catch(() => ({}))
  const parts = Array.isArray(b.parts) ? b.parts.map((p) => ({ partNumber: Number(p.partNumber), etag: String(p.etag) })) : []
  if (!parts.length) return bad(c, "The video didn't arrive. Try once more.")
  const mpu = c.env.CLIPS.resumeMultipartUpload(clip.storage_key, String(b.uploadId || ''))
  const obj = await mpu.complete(parts)
  await c.env.DB.prepare(`UPDATE clips SET status = 'ready', bytes = ?, content_type = ?, flags = NULL WHERE id = ?`)
    .bind(obj.size, obj.httpMetadata?.contentType || clip.content_type || 'video/mp4', clip.id)
    .run()
  await logEvent(c.env.DB, clip.card_id, 'clip')
  return c.json({ ok: true, bytes: obj.size })
})

app.get('/api/clips/by-edit/:token', async (c) => {
  const clip = await c.env.DB.prepare(`SELECT id FROM clips WHERE edit_token = ? AND status != 'removed'`).bind(c.req.param('token')).first()
  return c.json({ clipId: clip?.id || null })
})

// The contributor's own clip: see it, replace it (re-upload to the same key), or remove it.
app.get('/api/clips/:clipId', async (c) => {
  const clip = await c.env.DB.prepare(`SELECT * FROM clips WHERE id = ?`).bind(c.req.param('clipId')).first()
  if (!clip || clip.edit_token !== c.req.query('edit')) return c.notFound()
  const card = await getCard(c.env.DB, 'id', clip.card_id)
  return c.json({ clip: { id: clip.id, name: clip.contributor_name, kind: clip.kind, text: clip.text, status: clip.status, locked: card.status !== 'open' } })
})

app.delete('/api/clips/:clipId', async (c) => {
  const clip = await c.env.DB.prepare(`SELECT * FROM clips WHERE id = ?`).bind(c.req.param('clipId')).first()
  if (!clip || clip.edit_token !== c.req.query('edit')) return c.notFound()
  const card = await getCard(c.env.DB, 'id', clip.card_id)
  if (card.status !== 'open') return bad(c, 'The reel is already made, so your message is in it now.', 409)
  if (clip.storage_key) await c.env.CLIPS.delete(clip.storage_key)
  await c.env.DB.prepare(`UPDATE clips SET status = 'removed' WHERE id = ?`).bind(clip.id).run()
  return c.json({ ok: true })
})

app.get('/api/clips/:clipId/stream', async (c) => {
  const clip = await c.env.DB.prepare(`SELECT * FROM clips WHERE id = ?`).bind(c.req.param('clipId')).first()
  if (!clip || !clip.storage_key) return c.notFound()
  const edit = c.req.query('edit')
  const host = c.req.query('host')
  let allowed = clip.edit_token === edit
  if (!allowed && host) {
    const card = await getCard(c.env.DB, 'host_token', host)
    allowed = card && card.id === clip.card_id
  }
  if (!allowed) return c.notFound()
  return streamObject(c, clip.storage_key, clip.content_type)
})

// ─────────────────────────────────────────────────────────────────────────────
// Host board
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/host/:token', async (c) => {
  const card = await getCard(c.env.DB, 'host_token', c.req.param('token'))
  if (!card) return bad(c, "We can't find a card at this link. Check that you copied all of it.", 404)
  if (await needsVerify(c.env.DB, card.id)) await logEvent(c.env.DB, card.id, 'verified')
  const clips = await listClips(c.env.DB, card.id, { includeHidden: true })
  const base = c.env.APP_URL
  const times = card.status === 'queued' || card.status === 'stitching' ? await queueTimes(c.env.DB, card.id) : {}
  const opened = card.status === 'sent' ? await c.env.DB.prepare(`SELECT MIN(at) AS at FROM events WHERE card_id = ? AND type = 'opened'`).bind(card.id).first() : null
  let reelSeconds = null
  try { const m = card.manifest ? JSON.parse(card.manifest) : null; if (m?.length) reelSeconds = Math.round(m[m.length - 1].end) } catch {}
  return c.json({
    card: {
      ...publicCard(card, clips.filter((x) => x.status === 'ready').length),
      hostEmail: card.host_email,
      maxClips: Number(c.env.MAX_CLIPS_PER_CARD || 50),
      hasReel: !!card.final_key,
      keepDays: LIFETIME(c.env),
      accountType: card.account_type,
      sentAt: card.sent_at,
      expiresAt: card.expires_at,
      extended: !!card.extended,
      stitchError: card.stitch_error,
      queuedAt: times.queuedAt || null,
      claimedAt: times.claimedAt || null,
      now: nowIso(),
      openedAt: opened?.at || null,
      reelSeconds,
      // "Edit" after watching it first: only while every original video is still here to remake it from
      canEdit: canRemake(card, clips),
      links: { invite: `${base}/c/${card.id}`, watch: `${base}/w/${card.watch_token}`, host: `${base}/h/${card.host_token}` },
    },
    clips: clips.map((x) => ({
      id: x.id, name: x.contributor_name, location: x.location, kind: x.kind, text: x.text,
      status: x.status, flags: x.flags, duration: x.duration, position: x.position, createdAt: x.created_at,
      streamUrl: x.storage_key ? `/api/clips/${x.id}/stream?host=${card.host_token}` : null,
    })),
  })
})

// hide / unhide / reorder
app.post('/api/host/:token/clips/:clipId', async (c) => {
  const card = await getCard(c.env.DB, 'host_token', c.req.param('token'))
  if (!card) return c.notFound()
  // hiding is allowed while collecting, and after a failed reel so the host can drop a message and try again
  if (card.status !== 'open' && card.status !== 'failed') return bad(c, 'The reel is already made, so this card is closed.', 409)
  const b = await c.req.json().catch(() => ({}))
  const sets = []
  const vals = []
  if (b.status === 'hidden' || b.status === 'ready') { sets.push('status = ?'); vals.push(b.status) }
  if (Number.isInteger(b.position)) { sets.push('position = ?'); vals.push(b.position) }
  if (!sets.length) return bad(c, 'Nothing to change.')
  vals.push(c.req.param('clipId'), card.id)
  await c.env.DB.prepare(`UPDATE clips SET ${sets.join(', ')} WHERE id = ? AND card_id = ?`).bind(...vals).run()
  return c.json({ ok: true })
})

app.post('/api/host/:token/order', async (c) => {
  const card = await getCard(c.env.DB, 'host_token', c.req.param('token'))
  if (!card) return c.notFound()
  const { order } = await c.req.json().catch(() => ({}))
  if (!Array.isArray(order)) return bad(c, 'Something went wrong saving the order. Try dragging again.')
  const stmts = order.map((id, i) => c.env.DB.prepare(`UPDATE clips SET position = ? WHERE id = ? AND card_id = ?`).bind(i, id, card.id))
  await c.env.DB.batch(stmts)
  return c.json({ ok: true })
})

// optional "hear Maria" clip
app.put('/api/host/:token/intro', async (c) => {
  const card = await getCard(c.env.DB, 'host_token', c.req.param('token'))
  if (!card) return c.notFound()
  const contentType = c.req.header('content-type') || 'video/mp4'
  const ext = contentType.includes('webm') ? 'webm' : 'mp4'
  const key = `clips/${card.id}/intro.${ext}`
  await c.env.CLIPS.put(key, c.req.raw.body, { httpMetadata: { contentType } })
  await c.env.DB.prepare(`UPDATE cards SET host_intro_key = ? WHERE id = ?`).bind(key, card.id).run()
  return c.json({ ok: true })
})

// the moment: queue the stitch
app.post('/api/host/:token/send', async (c) => {
  const card = await getCard(c.env.DB, 'host_token', c.req.param('token'))
  if (!card) return c.notFound()
  if (card.status !== 'open' && card.status !== 'failed') return bad(c, "It's already being put together.", 409)
  const clips = await listClips(c.env.DB, card.id)
  if (!clips.length) return bad(c, 'No messages yet. Invite a few people first.')
  const expiresAt = plusDays(Number(c.env.CLIP_LIFETIME_DAYS || 30))
  await c.env.DB.prepare(`UPDATE cards SET status = 'queued', stitch_error = NULL, expires_at = ? WHERE id = ?`).bind(expiresAt, card.id).run()
  await logEvent(c.env.DB, card.id, 'sent')
  return c.json({ ok: true, status: 'queued', expiresAt })
})

// Still in line and no reel maker has picked it up: the host can reopen the card and keep collecting.
app.post('/api/host/:token/reopen', async (c) => {
  const card = await getCard(c.env.DB, 'host_token', c.req.param('token'))
  if (!card) return c.notFound()
  if (card.status === 'ready') {
    // "Edit": the host watched it first and wants to change something. The old reel goes; the messages stay.
    if (!canRemake(card, await listClips(c.env.DB, card.id, { includeHidden: true }))) return bad(c, 'The original messages are already cleared, so this reel can only be saved as it is.', 409)
    const listed = await c.env.CLIPS.list({ prefix: `finals/${card.id}/` })
    if (listed.objects.length) await c.env.CLIPS.delete(listed.objects.map((o) => o.key))
    await c.env.DB.prepare(`UPDATE cards SET status = 'open', expires_at = NULL, stitch_error = NULL, final_key = NULL, final_wide_key = NULL, manifest = NULL, sent_at = NULL, extended = 0 WHERE id = ? AND status = 'ready'`).bind(card.id).run()
    await logEvent(c.env.DB, card.id, 'reopened')
    return c.json({ ok: true, status: 'open' })
  }
  if (card.status === 'sent') return bad(c, 'The reel has already been opened, so it stays as it is.', 409)
  if (card.status !== 'queued' && card.status !== 'failed') return bad(c, "It's already being put together, so it can't be reopened now.", 409)
  await c.env.DB.prepare(`UPDATE cards SET status = 'open', expires_at = NULL, stitch_error = NULL WHERE id = ? AND status IN ('queued','failed')`).bind(card.id).run()
  await logEvent(c.env.DB, card.id, 'reopened')
  return c.json({ ok: true, status: 'open' })
})

// "Give them 3 more days": moves the last day to add a message (from now, if it already passed)
app.post('/api/host/:token/deadline', async (c) => {
  const card = await getCard(c.env.DB, 'host_token', c.req.param('token'))
  if (!card) return c.notFound()
  if (card.status !== 'open') return bad(c, 'Messages are already closed for this card.', 409)
  const b = await c.req.json().catch(() => ({}))
  const days = Math.min(14, Math.max(1, Number(b.days) || 3))
  const from = Math.max(Date.now(), card.deadline_at ? new Date(card.deadline_at).getTime() : 0)
  const next = new Date(from + days * 86400000).toISOString()
  await c.env.DB.prepare(`UPDATE cards SET deadline_at = ? WHERE id = ?`).bind(next, card.id).run()
  await logEvent(c.env.DB, card.id, 'deadline')
  return c.json({ ok: true, deadlineAt: next })
})

// A quiet card the host still wants: clears the delete date and restarts the clock
app.post('/api/host/:token/keep', async (c) => {
  const card = await getCard(c.env.DB, 'host_token', c.req.param('token'))
  if (!card) return c.notFound()
  if (card.status !== 'open' && card.status !== 'failed') return bad(c, 'This card is already finished.', 409)
  await c.env.DB.prepare(`UPDATE cards SET expires_at = NULL WHERE id = ?`).bind(card.id).run()
  await logEvent(c.env.DB, card.id, 'kept')
  return c.json({ ok: true })
})

// "Lost your board?": email every card this address has, with its board link
app.post('/api/lost', async (c) => {
  const b = await c.req.json().catch(() => ({}))
  if (!(await isPerson(c, b.turnstile))) return bad(c, NOT_A_PERSON, 403)
  const email = sanitize(b.email, 120)?.toLowerCase()
  if (!looksLikeEmail(email)) return bad(c, 'Check the email address.')
  const { results } = await c.env.DB.prepare(`SELECT recipient_name, host_token, status FROM cards WHERE host_email = ? ORDER BY created_at DESC LIMIT 20`).bind(email).all()
  if (results.length) {
    c.executionCtx.waitUntil(sendEmail(c.env, {
      to: email,
      subject: results.length === 1 ? `Your churpie card for ${results[0].recipient_name.split(' ')[0]}` : 'Your churpie cards',
      lines: ['Here are the cards made with this email:', ...results.map((r) => `${r.recipient_name}: ${c.env.APP_URL}/h/${r.host_token}`)],
      after: ['Keep this email. Each link is private to you.'],
    }))
  }
  return c.json({ ok: true })
})

// "Delete this card": everything goes now, not when the window ends
app.post('/api/host/:token/delete', async (c) => {
  const card = await getCard(c.env.DB, 'host_token', c.req.param('token'))
  if (!card) return c.notFound()
  if (card.status === 'stitching') return bad(c, "The reel is being made right this minute. Try again in a minute or two.", 409)
  await expireCard(c.env, card.id, 'deleted')
  return c.json({ ok: true })
})

// "Watch it first": the host's own preview of the finished reel. Doesn't mark it opened.
app.get('/api/host/:token/reel.mp4', async (c) => {
  const card = await getCard(c.env.DB, 'host_token', c.req.param('token'))
  if (!card?.final_key) return c.notFound()
  // "Save video": the same file, as a download with a name people recognize in their Files app
  const name = `${card.recipient_name.split(' ')[0].replace(/[^\w-]+/g, '') || 'churpie'}-churpie.mp4`
  return streamObject(c, card.final_key, 'video/mp4', c.req.query('download') ? { 'content-disposition': `attachment; filename="${name}"` } : {})
})

app.post('/api/host/:token/extend', async (c) => {
  const card = await getCard(c.env.DB, 'host_token', c.req.param('token'))
  if (!card) return c.notFound()
  if (card.extended) return bad(c, `This card already got its ${LIFETIME(c.env)} extra days.`, 409)
  if (!card.expires_at) return bad(c, 'Make the reel first, then you can add days.')
  const next = new Date(new Date(card.expires_at).getTime() + LIFETIME(c.env) * 86400000).toISOString()
  await c.env.DB.prepare(`UPDATE cards SET expires_at = ?, extended = 1 WHERE id = ?`).bind(next, card.id).run()
  await logEvent(c.env.DB, card.id, 'extended')
  return c.json({ ok: true, expiresAt: next })
})

// ─────────────────────────────────────────────────────────────────────────────
// Recipient
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/watch/:token', async (c) => {
  const card = await getCard(c.env.DB, 'watch_token', c.req.param('token'))
  if (!card) return bad(c, "This reel isn't here anymore.", 404)
  const clips = await listClips(c.env.DB, card.id)
  const ready = card.status === 'ready' || card.status === 'sent'
  if (ready && card.status === 'ready') {
    await c.env.DB.prepare(`UPDATE cards SET status = 'sent' WHERE id = ?`).bind(card.id).run()
    c.executionCtx.waitUntil(deleteOriginals(c.env, card.id))
  }
  await logEvent(c.env.DB, card.id, 'opened')
  const manifest = card.manifest ? JSON.parse(card.manifest) : null
  return c.json({
    card: { ...publicCard(card, clips.length), expiresAt: card.expires_at, hasIntro: !!card.host_intro_key },
    ready,
    expired: card.status === 'expired',
    manifest,
    reelUrl: ready ? `/api/watch/${card.watch_token}/reel.mp4` : null,
    reelWideUrl: ready && card.final_wide_key ? `/api/watch/${card.watch_token}/reel-wide.mp4` : null,
    people: clips.map((x) => ({ id: x.id, name: x.contributor_name, location: x.location, kind: x.kind })),
  })
})

app.get('/api/watch/:token/reel.mp4', async (c) => {
  const card = await getCard(c.env.DB, 'watch_token', c.req.param('token'))
  if (!card?.final_key) return c.notFound()
  return streamObject(c, card.final_key)
})

app.get('/api/watch/:token/reel-wide.mp4', async (c) => {
  const card = await getCard(c.env.DB, 'watch_token', c.req.param('token'))
  if (!card?.final_wide_key) return c.notFound()
  return streamObject(c, card.final_wide_key)
})

app.post('/api/watch/:token/event', async (c) => {
  const card = await getCard(c.env.DB, 'watch_token', c.req.param('token'))
  if (!card) return c.notFound()
  const { type, clipId } = await c.req.json().catch(() => ({}))
  if (type === 'saved') await logEvent(c.env.DB, card.id, 'saved')
  if (type === 'loved' && clipId) await c.env.DB.prepare(`UPDATE clips SET loved = loved + 1 WHERE id = ? AND card_id = ?`).bind(clipId, card.id).run()
  return c.json({ ok: true })
})

app.post('/api/watch/:token/reply', async (c) => {
  const card = await getCard(c.env.DB, 'watch_token', c.req.param('token'))
  if (!card) return c.notFound()
  const { text } = await c.req.json().catch(() => ({}))
  const clean = sanitize(text, 500)
  if (!clean) return bad(c, 'Write a few words first.')
  await c.env.DB.prepare(`INSERT INTO replies (id, card_id, text) VALUES (?, ?, ?)`).bind(newId(10), card.id, clean).run()
  await logEvent(c.env.DB, card.id, 'replied')
  return c.json({ ok: true })
})

app.get('/api/host/:token/replies', async (c) => {
  const card = await getCard(c.env.DB, 'host_token', c.req.param('token'))
  if (!card) return c.notFound()
  const { results } = await c.env.DB.prepare(`SELECT text, created_at FROM replies WHERE card_id = ? ORDER BY created_at DESC`).bind(card.id).all()
  return c.json({ replies: results })
})

// ─────────────────────────────────────────────────────────────────────────────
// Stitcher API (shared-secret). The container polls; it never holds R2 keys.
// ─────────────────────────────────────────────────────────────────────────────

app.use('/api/stitch/*', async (c, next) => {
  if (!stitchAuth(c)) return bad(c, 'Unauthorized', 401)
  await next()
})

// Claim the next queued card. Returns null when nothing is waiting.
const STALE_MINUTES = 20 // a reel takes a few minutes; past this, the reel maker that claimed it is gone
const MAX_CLAIMS = 2      // after two tries, stop and tell the host instead of looping

async function recoverStale(db) {
  const cutoff = new Date(Date.now() - STALE_MINUTES * 60000).toISOString()
  const { results } = await db.prepare(`SELECT id FROM cards WHERE status = 'stitching'`).all()
  for (const { id } of results) {
    const t = await queueTimes(db, id)
    if (t.claimedAt && t.claimedAt > cutoff) continue
    if (t.claims >= MAX_CLAIMS) {
      await db.prepare(`UPDATE cards SET status = 'failed', stitch_error = ? WHERE id = ? AND status = 'stitching'`)
        .bind(`timed out after ${t.claims} tries`, id).run()
    } else {
      await db.prepare(`UPDATE cards SET status = 'queued' WHERE id = ? AND status = 'stitching'`).bind(id).run()
    }
  }
}

app.post('/api/stitch/next', async (c) => {
  await recoverStale(c.env.DB)
  const card = await c.env.DB.prepare(`SELECT * FROM cards WHERE status = 'queued' ORDER BY created_at LIMIT 1`).first()
  if (!card) return c.json({ job: null })
  const res = await c.env.DB.prepare(`UPDATE cards SET status = 'stitching' WHERE id = ? AND status = 'queued'`).bind(card.id).run()
  if (!res.meta.changes) return c.json({ job: null })
  await logEvent(c.env.DB, card.id, 'claimed')
  const clips = await listClips(c.env.DB, card.id)
  return c.json({
    job: {
      cardId: card.id,
      recipientName: card.recipient_name,
      hostName: card.host_name,
      prompt: card.prompt,
      moment: card.moment,
      vibe: card.vibe,
      theme: card.vibe,
      clipSeconds: card.clip_seconds,
      introKey: card.host_intro_key,
      clips: clips.map((x) => ({ id: x.id, name: x.contributor_name, location: x.location, kind: x.kind, text: x.text, key: x.storage_key, contentType: x.content_type })),
    },
  })
})

app.get('/api/stitch/object', async (c) => {
  const key = c.req.query('key')
  if (!key || !/^clips\//.test(key)) return bad(c, 'Bad key')
  return streamObject(c, key)
})

app.post('/api/stitch/flags/:clipId', async (c) => {
  const { flags, duration } = await c.req.json().catch(() => ({}))
  await c.env.DB.prepare(`UPDATE clips SET flags = ?, duration = ? WHERE id = ?`).bind(JSON.stringify(flags || []), duration ?? null, c.req.param('clipId')).run()
  return c.json({ ok: true })
})

app.put('/api/stitch/final/:cardId', async (c) => {
  const cardId = c.req.param('cardId')
  const card = await getCard(c.env.DB, 'id', cardId)
  if (!card) return c.notFound()
  const wide = c.req.query('variant') === 'wide'
  const key = wide ? `finals/${cardId}/reel-wide.mp4` : `finals/${cardId}/reel.mp4`
  await c.env.CLIPS.put(key, c.req.raw.body, { httpMetadata: { contentType: 'video/mp4' } })
  if (wide) {
    await c.env.DB.prepare(`UPDATE cards SET final_wide_key = ? WHERE id = ?`).bind(key, cardId).run()
    return c.json({ ok: true })
  }
  const manifest = c.req.header('x-churpie-manifest')
  await c.env.DB.prepare(`UPDATE cards SET status = 'ready', final_key = ?, manifest = ?, sent_at = ? WHERE id = ?`)
    .bind(key, manifest ? decodeURIComponent(manifest) : null, nowIso(), cardId)
    .run()
  // originals stay until the reel is sent (or 3 days), so the host can still fix something after watching it first
  const first = card.recipient_name.split(' ')[0]
  c.executionCtx.waitUntil(sendEmail(c.env, {
    to: card.host_email,
    subject: `${first}'s reel is ready`,
    lines: [`${first}'s reel is ready. Watch it first, then send ${first} the link, or download it to keep.`],
    button: { label: 'Watch and send it', url: `${c.env.APP_URL}/h/${card.host_token}` },
    after: [`You have ${LIFETIME(c.env)} days to save it. After that, churpie deletes the reel and every message, as promised.`],
  }))
  return c.json({ ok: true, watch: `${c.env.APP_URL}/w/${card.watch_token}` })
})

app.post('/api/stitch/failed/:cardId', async (c) => {
  const { error } = await c.req.json().catch(() => ({}))
  await c.env.DB.prepare(`UPDATE cards SET status = 'failed', stitch_error = ? WHERE id = ?`).bind(String(error || 'unknown').slice(0, 500), c.req.param('cardId')).run()
  return c.json({ ok: true })
})

// ─────────────────────────────────────────────────────────────────────────────
// Pages: static HTML from /public with link-preview metadata filled in
// ─────────────────────────────────────────────────────────────────────────────

// private pages (invites, boards, reels) and "not here" pages stay out of search results
const PRIVATE = /^\/(c|h|w)\//
async function page(c, file, meta, status = 200) {
  const res = await c.env.ASSETS.fetch(new URL(`/${file}`, c.req.url))
  let body = await res.text()
  const base = c.env.APP_URL
  const m = {
    title: 'churpie.',
    description: 'A video card from everyone who loves them. One link, a few seconds each, one reel to keep. Free.',
    image: `${base}/og/site.png`,
    url: c.req.url,
    ...meta,
  }
  body = body
    .replaceAll('{{og:title}}', escapeHtml(m.title))
    .replaceAll('{{og:description}}', escapeHtml(m.description))
    .replaceAll('{{og:image}}', escapeHtml(m.image))
    .replaceAll('{{og:url}}', escapeHtml(m.url))
  if (status !== 200 || PRIVATE.test(new URL(c.req.url).pathname)) c.header('X-Robots-Tag', 'noindex')
  return c.html(body, status)
}

app.get('/', (c) => page(c, 'index.html', {}))
app.get('/new', (c) => page(c, 'new.html', { title: 'Start a card · churpie.' }))
app.get('/lost', (c) => page(c, 'lost.html', { title: 'Find your card · churpie.' }))
app.get('/cards', (c) => page(c, 'cards.html', { title: 'Your cards · churpie.' }))

app.get('/c/:id', async (c) => {
  const card = await getCard(c.env.DB, 'id', c.req.param('id'))
  if (!card) return page(c, 'gone.html', { title: "This card isn't here anymore" }, 404)
  const first = card.recipient_name.split(' ')[0]
  return page(c, 'contribute.html', {
    title: `${card.host_name} is making a surprise video for ${first}`,
    description: `Add your ${card.clip_seconds} seconds. No app, no account. ${card.prompt}`,
    image: `${c.env.APP_URL}/og/${card.vibe}.png`,
  })
})

app.get('/h/:token', async (c) => {
  const card = await getCard(c.env.DB, 'host_token', c.req.param('token'))
  if (!card) return page(c, 'gone.html', { title: "We can't find this card" }, 404)
  return page(c, 'host.html', { title: `Your card for ${card.recipient_name} · churpie.`, description: 'Your private card page. Keep this link to yourself.' })
})

app.get('/w/:token', async (c) => {
  const card = await getCard(c.env.DB, 'watch_token', c.req.param('token'))
  if (!card) return page(c, 'gone.html', { title: "This reel isn't here anymore" }, 404)
  const { count } = await c.env.DB.prepare(`SELECT COUNT(*) AS count FROM clips WHERE card_id = ? AND status = 'ready'`).bind(card.id).first()
  const memorial = card.moment === 'memory'
  return page(c, 'watch.html', {
    title: memorial ? `In memory of ${card.recipient_name}` : `${card.recipient_name}, ${count} ${count === 1 ? 'person' : 'people'} made you something`,
    description: memorial ? `${count} ${count === 1 ? 'person' : 'people'} shared what they remember. Gathered by ${card.host_name}. Find a quiet moment.` : `From ${card.host_name} and everyone who loves you. Find a quiet moment.`,
    image: `${c.env.APP_URL}/og/reel-${card.vibe}.png`,
  })
})

app.notFound((c) => page(c, 'gone.html', { title: "This page isn't here anymore" }, 404))

// ─────────────────────────────────────────────────────────────────────────────
// Nightly sweep: delete what has expired, and raw clips 48h after a reel exists
// ─────────────────────────────────────────────────────────────────────────────

// Deletes every file a card has (messages, intro, reels) and marks it finished. Used by the nightly sweep
// and by the host's "Delete this card".
async function expireCard(env, id, why) {
  const listed = await env.CLIPS.list({ prefix: `clips/${id}/` })
  const finals = await env.CLIPS.list({ prefix: `finals/${id}/` })
  const keys = [...listed.objects, ...finals.objects].map((o) => o.key)
  if (keys.length) await env.CLIPS.delete(keys)
  // names, notes, the question and the email go too; only the anonymous event log remains (counts, dates)
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM replies WHERE card_id = ?`).bind(id),
    env.DB.prepare(`DELETE FROM clips WHERE card_id = ?`).bind(id),
    env.DB.prepare(`DELETE FROM cards WHERE id = ?`).bind(id),
  ])
  await logEvent(env.DB, id, why)
}

// The original uploads, once the reel exists and has been sent (or after 3 days)
function canRemake(card, clips) {
  return card.status === 'ready' && clips.every((x) => x.kind === 'text' || x.storage_key)
}

async function deleteOriginals(env, id) {
  const listed = await env.CLIPS.list({ prefix: `clips/${id}/` })
  const keys = listed.objects.map((o) => o.key)
  if (keys.length) await env.CLIPS.delete(keys)
  await env.DB.prepare(`UPDATE clips SET storage_key = NULL WHERE card_id = ?`).bind(id).run()
}

async function sweep(env) {
  await recoverStale(env.DB)
  const now = nowIso()
  // unfinished cards with nothing new for IDLE_DAYS get a delete date; the existing expiry below does the rest
  const idleCutoff = new Date(Date.now() - IDLE_DAYS * 86400000).toISOString()
  const { results: quiet } = await env.DB.prepare(
    `SELECT c.id FROM cards c
      WHERE c.status IN ('open','failed') AND c.expires_at IS NULL
        AND MAX(c.created_at,
                COALESCE((SELECT MAX(k.created_at) FROM clips k WHERE k.card_id = c.id), ''),
                COALESCE((SELECT MAX(e.at) FROM events e WHERE e.card_id = c.id AND e.type IN ('clip','reopened','kept','deadline')), '')) < ?`
  ).bind(idleCutoff).all()
  const graceUntil = new Date(Date.now() + GRACE_DAYS * 86400000).toISOString()
  for (const { id } of quiet) {
    await env.DB.prepare(`UPDATE cards SET expires_at = ? WHERE id = ? AND expires_at IS NULL`).bind(graceUntil, id).run()
    await logEvent(env.DB, id, 'quiet')
  }
  const { results: expired } = await env.DB.prepare(
    `SELECT id FROM cards WHERE expires_at IS NOT NULL AND expires_at < ? AND status != 'expired'`
  ).bind(now).all()
  for (const { id } of expired) await expireCard(env, id, 'expired')
  // originals: gone once the reel has been sent, or 3 days after it was made
  const cutoff = new Date(Date.now() - 3 * 86400000).toISOString()
  const { results: done } = await env.DB.prepare(
    `SELECT c.id FROM cards c WHERE c.final_key IS NOT NULL AND (c.status = 'sent' OR c.sent_at < ?) AND EXISTS (SELECT 1 FROM clips k WHERE k.card_id = c.id AND k.storage_key IS NOT NULL)`
  ).bind(cutoff).all()
  for (const { id } of done) await deleteOriginals(env, id)

  // a reminder 2 days before the reel is deleted, once
  const soon = new Date(Date.now() + 2 * 86400000).toISOString()
  const { results: remind } = await env.DB.prepare(
    `SELECT c.* FROM cards c WHERE c.status IN ('ready','sent') AND c.host_email IS NOT NULL AND c.expires_at IS NOT NULL AND c.expires_at <= ? AND c.expires_at > ?
       AND NOT EXISTS (SELECT 1 FROM events e WHERE e.card_id = c.id AND e.type = 'reminded')`
  ).bind(soon, now).all()
  for (const card of remind) {
    const first = card.recipient_name.split(' ')[0]
    await sendEmail(env, {
      to: card.host_email,
      subject: `${first}'s reel is deleted in 2 days`,
      lines: [`A reminder: churpie deletes ${first}'s reel and every message in 2 days, as promised.`, `If you haven't yet, download it to keep it forever.`],
      button: { label: 'Open your card to download it', url: `${env.APP_URL}/h/${card.host_token}` },
    })
    await logEvent(env.DB, card.id, 'reminded')
  }
  return { quiet: quiet.length, expired: expired.length, originalsCleared: done.length, reminded: remind.length }
}

app.post('/api/stitch/sweep', async (c) => c.json(await sweep(c.env)))

// Every minute: if a reel is waiting, wake the reel maker in the cloud (Google Cloud Run) and wait while it
// makes it. Nothing waiting = no call at all, so the reel maker stays asleep and free. Waiting on the call
// isn't Worker CPU time, and a cron run may wait up to 15 minutes.
async function wakeStitcher(env, scheduledTime = Date.now()) {
  if (!env.STITCHER_URL || !env.STITCH_TOKEN) return { skipped: 'no reel maker set' }
  // kept as small as possible: on the free plan each run gets 10 ms of CPU. One tiny query most minutes;
  // the stuck-reel check only every 10 minutes.
  if (new Date(scheduledTime).getUTCMinutes() % 10 === 0) await recoverStale(env.DB)
  const waiting = await env.DB.prepare(`SELECT 1 FROM cards WHERE status = 'queued' LIMIT 1`).first()
  if (!waiting) return { waiting: 0 }
  const r = await fetch(`${env.STITCHER_URL.replace(/\/$/, '')}/run`, { method: 'POST', headers: { authorization: `Bearer ${env.STITCH_TOKEN}` } })
  return { waiting: 1, status: r.status, body: await r.text().catch(() => '') }
}

export default {
  fetch: app.fetch,
  scheduled: (event, env, ctx) => ctx.waitUntil(event.cron === '* * * * *' ? wakeStitcher(env, event.scheduledTime) : sweep(env)),
}
