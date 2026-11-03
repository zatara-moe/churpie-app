// churpie · one Worker: pages + API + nightly sweep
// No accounts. The host link is the account. Everything in R2 self-deletes.

import { Hono } from 'hono'
import { isBusinessEmail, newId, newToken, plusDays, nowIso, sanitize, escapeHtml } from './lib.js'
import { MOMENTS, VIBES } from './catalog.js'

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
async function streamObject(c, key, contentTypeFallback = 'video/mp4') {
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
    },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Catalog (moments, vibes, ready-made prompts)
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/catalog', (c) => c.json({ moments: MOMENTS, vibes: VIBES }))

// ─────────────────────────────────────────────────────────────────────────────
// Host: create a card
// ─────────────────────────────────────────────────────────────────────────────

app.post('/api/cards', async (c) => {
  const b = await c.req.json().catch(() => ({}))
  const recipientName = sanitize(b.recipientName, 60)
  const hostName = sanitize(b.hostName, 60)
  const prompt = sanitize(b.prompt, 240)
  const moment = MOMENTS.find((m) => m.id === b.moment) ? b.moment : 'birthday'
  const vibe = VIBES.find((v) => v.id === b.vibe) ? b.vibe : 'postcard'
  const tone = ['funny', 'heartfelt', 'hype', 'quiet'].includes(b.tone) ? b.tone : null
  const rules = Array.isArray(b.rules) ? b.rules.map((r) => sanitize(r, 80)).filter(Boolean).slice(0, 5) : []
  const clipSeconds = Number(b.clipSeconds) === 30 ? 30 : 15
  const hostEmail = sanitize(b.hostEmail, 120) || null
  const deadlineAt = b.deadlineAt ? new Date(b.deadlineAt).toISOString() : null

  if (!recipientName) return bad(c, "Who's it for? Even just a first name.")
  if (!hostName) return bad(c, "Add your name so people know who's asking.")
  if (!prompt) return bad(c, 'Write the one question everyone will answer.')

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
  // full is checked up front, so nobody records a message that can't go in
  return c.json({ ...publicCard(card, count), full: count >= Number(c.env.MAX_CLIPS_PER_CARD || 50) })
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
  if (card.status !== 'open') return bad(c, `${card.host_name} already made the reel, so this card is closed.`, 409)

  const b = await c.req.json().catch(() => ({}))
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
  if (!card) return bad(c, "We can't find a board at this link. Check that you copied all of it.", 404)
  const clips = await listClips(c.env.DB, card.id, { includeHidden: true })
  const base = c.env.APP_URL
  return c.json({
    card: {
      ...publicCard(card, clips.filter((x) => x.status === 'ready').length),
      hostEmail: card.host_email,
      accountType: card.account_type,
      sentAt: card.sent_at,
      expiresAt: card.expires_at,
      extended: !!card.extended,
      stitchError: card.stitch_error,
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
  if (card.status !== 'open') return bad(c, 'The reel is already made, so this card is closed.', 409)
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

app.post('/api/host/:token/extend', async (c) => {
  const card = await getCard(c.env.DB, 'host_token', c.req.param('token'))
  if (!card) return c.notFound()
  if (card.extended) return bad(c, 'This card already got its 30 extra days.', 409)
  if (!card.expires_at) return bad(c, 'Make the reel first, then you can add days.')
  const next = new Date(new Date(card.expires_at).getTime() + 30 * 86400000).toISOString()
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
app.post('/api/stitch/next', async (c) => {
  const card = await c.env.DB.prepare(`SELECT * FROM cards WHERE status = 'queued' ORDER BY created_at LIMIT 1`).first()
  if (!card) return c.json({ job: null })
  const res = await c.env.DB.prepare(`UPDATE cards SET status = 'stitching' WHERE id = ? AND status = 'queued'`).bind(card.id).run()
  if (!res.meta.changes) return c.json({ job: null })
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
  // raw clips are no longer needed once the reel exists; the sweep removes them after 48h
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

async function page(c, file, meta) {
  const res = await c.env.ASSETS.fetch(new URL(`/${file}`, c.req.url))
  let body = await res.text()
  const base = c.env.APP_URL
  const m = {
    title: 'churpie.',
    description: 'A video card from everyone who loves them. One link, a few seconds each, one reel to keep. Free.',
    image: `${base}/og/postcard.png`,
    url: c.req.url,
    ...meta,
  }
  body = body
    .replaceAll('{{og:title}}', escapeHtml(m.title))
    .replaceAll('{{og:description}}', escapeHtml(m.description))
    .replaceAll('{{og:image}}', escapeHtml(m.image))
    .replaceAll('{{og:url}}', escapeHtml(m.url))
  return c.html(body)
}

app.get('/', (c) => page(c, 'index.html', {}))
app.get('/new', (c) => page(c, 'new.html', { title: 'Start a card · churpie.' }))

app.get('/c/:id', async (c) => {
  const card = await getCard(c.env.DB, 'id', c.req.param('id'))
  if (!card) return page(c, 'gone.html', { title: "This card isn't here anymore" })
  const first = card.recipient_name.split(' ')[0]
  return page(c, 'contribute.html', {
    title: `${card.host_name} is making a surprise video for ${first}`,
    description: `Add your ${card.clip_seconds} seconds. No app, no account. ${card.prompt}`,
    image: `${c.env.APP_URL}/og/${card.vibe}.png`,
  })
})

app.get('/h/:token', async (c) => {
  const card = await getCard(c.env.DB, 'host_token', c.req.param('token'))
  if (!card) return page(c, 'gone.html', { title: "We can't find this board" })
  return page(c, 'host.html', { title: `Your card for ${card.recipient_name} · churpie.`, description: 'Your private board. Keep this link to yourself.' })
})

app.get('/w/:token', async (c) => {
  const card = await getCard(c.env.DB, 'watch_token', c.req.param('token'))
  if (!card) return page(c, 'gone.html', { title: "This reel isn't here anymore" })
  const { count } = await c.env.DB.prepare(`SELECT COUNT(*) AS count FROM clips WHERE card_id = ? AND status = 'ready'`).bind(card.id).first()
  return page(c, 'watch.html', {
    title: `${card.recipient_name}, ${count} ${count === 1 ? 'person' : 'people'} made you something`,
    description: `From ${card.host_name} and everyone who loves you. Find a quiet moment.`,
    image: `${c.env.APP_URL}/og/${card.vibe}.png`,
  })
})

app.notFound((c) => page(c, 'gone.html', { title: "This page isn't here anymore" }))

// ─────────────────────────────────────────────────────────────────────────────
// Nightly sweep: delete what has expired, and raw clips 48h after a reel exists
// ─────────────────────────────────────────────────────────────────────────────

async function sweep(env) {
  const now = nowIso()
  const { results: expired } = await env.DB.prepare(
    `SELECT id FROM cards WHERE expires_at IS NOT NULL AND expires_at < ? AND status != 'expired'`
  ).bind(now).all()
  for (const { id } of expired) {
    const listed = await env.CLIPS.list({ prefix: `clips/${id}/` })
    const finals = await env.CLIPS.list({ prefix: `finals/${id}/` })
    const keys = [...listed.objects, ...finals.objects].map((o) => o.key)
    if (keys.length) await env.CLIPS.delete(keys)
    await env.DB.prepare(`UPDATE cards SET status = 'expired', final_key = NULL, final_wide_key = NULL, host_intro_key = NULL WHERE id = ?`).bind(id).run()
    await env.DB.prepare(`UPDATE clips SET storage_key = NULL WHERE card_id = ?`).bind(id).run()
    await logEvent(env.DB, id, 'expired')
  }
  // raw clips for reels older than 48 hours
  const cutoff = new Date(Date.now() - 48 * 3600000).toISOString()
  const { results: done } = await env.DB.prepare(
    `SELECT c.id FROM cards c WHERE c.final_key IS NOT NULL AND c.sent_at < ? AND EXISTS (SELECT 1 FROM clips k WHERE k.card_id = c.id AND k.storage_key IS NOT NULL)`
  ).bind(cutoff).all()
  for (const { id } of done) {
    const listed = await env.CLIPS.list({ prefix: `clips/${id}/` })
    const keys = listed.objects.map((o) => o.key)
    if (keys.length) await env.CLIPS.delete(keys)
    await env.DB.prepare(`UPDATE clips SET storage_key = NULL WHERE card_id = ?`).bind(id).run()
  }
  return { expired: expired.length, rawsCleared: done.length }
}

app.post('/api/stitch/sweep', async (c) => c.json(await sweep(c.env)))

export default {
  fetch: app.fetch,
  scheduled: (event, env, ctx) => ctx.waitUntil(sweep(env)),
}
