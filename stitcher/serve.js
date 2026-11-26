// churpie stitcher · wake-on-request mode, for Google Cloud Run's free tier.
// Cloud Run keeps this asleep (and free) until churpie's Worker calls POST /run, which happens
// at most once a minute and only when a reel is waiting. One request makes one reel, start to finish,
// then answers; Cloud Run only counts the time a request is open, so idle time costs nothing.
//
//   PORT=8080 APP_URL=https://churpie.me STITCH_TOKEN=... node serve.js

import http from 'node:http'
import { processOne } from './stitch.js'
import { renderOg } from './render.js'

const PORT = Number(process.env.PORT || 8080)
const TOKEN = process.env.STITCH_TOKEN
if (!process.env.APP_URL || !TOKEN) { console.error('Set APP_URL and STITCH_TOKEN'); process.exit(1) }

let busy = false
http.createServer(async (req, res) => {
  const send = (code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)) }
  if (req.method === 'GET' && req.url === '/') return send(200, { ok: true, busy })
  // a link preview for a card (render.js renderOg); quick, and never blocked by a reel being made
  if (req.method === 'POST' && req.url === '/og') {
    if (req.headers.authorization !== `Bearer ${TOKEN}`) return send(401, { error: 'unauthorized' })
    let body = ''
    for await (const chunk of req) { body += chunk; if (body.length > 4e6) return send(413, { error: 'too big' }) }
    try {
      const png = await renderOg(JSON.parse(body || '{}'))
      res.writeHead(200, { 'content-type': 'image/png', 'content-length': png.length }); return res.end(png)
    } catch (e) { console.error('og error', e); return send(500, { error: String(e.message || e) }) }
  }
  if (req.method !== 'POST' || req.url !== '/run') return send(404, { error: 'not here' })
  // the same shared secret the reel maker already uses to talk to churpie
  if (req.headers.authorization !== `Bearer ${TOKEN}`) return send(401, { error: 'unauthorized' })
  if (busy) return send(200, { made: 0, note: 'already making one' })
  busy = true
  try {
    const made = await processOne() // claims the next waiting reel, makes it, uploads it (or marks it failed)
    send(200, { made: made ? 1 : 0 })
  } catch (e) {
    console.error('run error', e)
    send(500, { error: String(e.message || e) })
  } finally { busy = false }
}).listen(PORT, () => console.log(`churpie stitcher · waiting to be woken on :${PORT}`))
