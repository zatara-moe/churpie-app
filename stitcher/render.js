// Renders the card frames (wide 1920x1080 and story 720x1280) to PNGs with a transparent window.
// Uses headless Chromium via Playwright so the cards can be real HTML/CSS, not FFmpeg drawtext.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { coverHtml, endHtml, coverSeconds, COVER_SECONDS, END_SECONDS, LOOK_SWATCH, designVars, BIRD_SVG } from './cover.js'

const HERE = path.dirname(fileURLToPath(import.meta.url))

async function loadPlaywright() {
  for (const spec of ['playwright', process.env.PLAYWRIGHT_PATH, '/opt/npm-tools/node_modules/playwright/index.mjs'].filter(Boolean)) {
    try { return await import(spec) } catch {}
  }
  throw new Error('playwright not found; npm install playwright, or set PLAYWRIGHT_PATH')
}

// the window geometry must match card.html's .window rules
export const WINDOWS = {
  wide: { W: 1920, H: 1080, x: 695, y: 70, w: 530, h: 942 },
  story: { W: 720, H: 1280, x: 30, y: 46, w: 660, h: 1120 },
}

const MOMENT_LINE = {
  birthday: (c) => c.age ? `turning ${c.age}` : 'happy birthday', congrats: () => 'you did it', thankyou: () => 'with thanks', getwell: () => 'get well soon',
  missyou: () => 'we miss you', memory: () => 'in memory', team: () => 'from the team', brand: () => 'from all of us',
  welcome: () => 'welcome home', retirement: () => 'happy retirement',
  holiday: () => 'happy holidays', newyear: () => 'happy new year', baby: () => 'welcome to the world', anniversary: () => 'happy anniversary', wedding: () => 'congratulations',
}

export async function renderFrames(job, outDir) {
  const { chromium } = await loadPlaywright()
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-gpu'] })
  try {
    const html = fs.readFileSync(path.join(HERE, 'cards/card.html'), 'utf8')
    const name = job.recipientName.trim()
    const first = name.length <= 14 ? name : (/ (?:&|\+|and) /i.test(name) ? name.split(/ (?:&|\+|and) /i).map((p) => p.trim().split(' ')[0]).join(' & ') : name.split(' ')[0])
    const n = job.clips.length
    const card = {
      theme: job.theme || 'postcard', recipient: job.recipientName, first, host: job.hostName, n,
      prompt: job.prompt, moment: job.moment, momentLine: (MOMENT_LINE[job.moment] || (() => ''))(job),
      seconds: job.totalSeconds ? Math.round(job.totalSeconds) : undefined,
      totalText: job.totalSeconds ? `${Math.round(job.totalSeconds)} seconds, all for you` : `${n} messages`,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toLowerCase(),
      bignum: job.age || '', quote: job.quote, dates: job.dates, pronoun: job.pronoun,
    }
    const out = {}
    for (const size of ['wide', 'story']) {
      const { W, H } = WINDOWS[size]
      const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
      await page.setContent(html.replace('<script>', `<script>window.CARD=${JSON.stringify({ ...card, size })};`), { waitUntil: 'load' })
      await page.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 8000 }).catch(() => {})
      await page.waitForTimeout(150)
      const file = path.join(outDir, `frame-${size}.png`)
      await page.screenshot({ path: file, omitBackground: true, type: 'png' })
      await page.close()
      out[size] = file
    }
    return out
  } finally {
    await browser.close()
  }
}

// Name tags and note headings start ~15% down: when a reel is posted, Instagram and TikTok lay the poster's name
// over the top strip, and the tags must stay readable there.
// ── Painter: every piece of text in the reel (title card, written messages, end card, name stickers) is HTML painted to a PNG
// in churpie's real fonts. FFmpeg only composites video, so the stitcher never depends on FFmpeg's text features
// (the bundled ffmpeg-static builds don't include them).
const FONTS = '<link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,500;9..40,700&family=DM+Serif+Display:ital@0;1&family=Caveat:wght@500;700&family=Courier+Prime:wght@400;700&display=swap" rel="stylesheet">'
const THEME = {
  postcard: ['#F5F0E8', '#1A1410'], airmail: ['#F7F3EA', '#1A1410'], quietnote: ['#F3EFE6', '#1A1410'], kraft: ['#E4D3B4', '#2B2116'],
  confettipop: ['#FFF8EE', '#1A1410'], lockernote: ['#FBFBF9', '#1A1410'], milestonegold: ['#15120F', '#F3E3BF'], pressedflower: ['#F6F2EA', '#2E2A24'],
}
const e = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
function cardHtml(theme, inner) {
  const [bg, fg] = THEME[theme] || THEME.postcard
  return `<!doctype html><html><head>${FONTS}<style>
    * { box-sizing: border-box; margin: 0; }
    body { width: 720px; height: 1280px; background: ${bg}; color: ${fg}; font-family: 'DM Sans', sans-serif; position: relative; overflow: hidden; }
    .stripe { position: absolute; top: 0; left: 0; right: 0; height: 14px; background: repeating-linear-gradient(90deg, #D4266A 0 28px, ${bg} 28px 40px, #0B9DAA 40px 68px, ${bg} 68px 80px); }
    .in { position: absolute; inset: 0; padding: 0 72px; display: flex; flex-direction: column; justify-content: center; gap: 22px; }
    .eye { font-family: 'Courier Prime', monospace; font-size: 24px; letter-spacing: 4px; text-transform: uppercase; opacity: 0.7; }
    .big { font-family: 'DM Serif Display', serif; font-size: 128px; line-height: 0.95; overflow-wrap: anywhere; }
    .hand { font-family: 'Caveat', cursive; font-size: 58px; line-height: 1.12; font-weight: 500; }
    .msg { font-family: 'Caveat', cursive; font-size: 66px; line-height: 1.1; font-weight: 500; }
    .sig { font-size: 32px; font-weight: 700; opacity: 0.85; }
    .num { font-family: 'DM Serif Display', serif; font-size: 112px; line-height: 1; }
    .it { font-family: 'DM Serif Display', serif; font-style: italic; font-size: 64px; line-height: 1.05; }
    .mark { position: absolute; left: 0; right: 0; bottom: 90px; text-align: center; font-family: 'DM Serif Display', serif; font-style: italic; font-size: 40px; }
    .mark b { color: #D4266A; font-style: normal; } .url { display: block; font-family: 'Courier Prime', monospace; font-style: normal; font-size: 22px; letter-spacing: 3px; color: #D4266A; margin-top: 6px; }
  </style></head><body><div class="stripe"></div><div class="in">${inner}</div></body></html>`
}
export const CARDS = {
  title: (j) => `<div class="eye">a card for</div><div class="big">${e(j.first)}</div><div class="eye" style="margin-top:30px">${e(j.host)} asked ${j.n} ${j.n === 1 ? 'person' : 'people'}</div><div class="hand">“${e(j.prompt)}”</div>`,
  text: (j) => `<div class="msg">“${e(j.text)}”</div><div class="sig">— ${e(j.name)}${j.location ? `, ${e(j.location)}` : ''}</div>`,
  end: (j) => j.memory
    ? `<div class="num">${j.n} ${j.n === 1 ? 'person' : 'people'}</div><div class="it">remembered ${e(j.first)}.</div><div class="hand" style="margin-top:34px;font-size:50px;opacity:0.8">with love, always.</div></div><div class="mark">churpie<b>.</b><span class="url">churpie.me</span>`
    : `<div class="num">${j.n} ${j.n === 1 ? 'person' : 'people'}</div><div class="it">showed up for you.</div><div class="hand" style="margin-top:34px;font-size:50px;color:#D4266A">so you know you're loved.</div></div><div class="mark">churpie<b>.</b><span class="url">churpie.me</span>`,
}
function stickerHtml(name, location) {
  return `<!doctype html><html><head>${FONTS}<style>
    * { margin: 0; } body { width: 720px; height: 1280px; background: transparent; font-family: 'DM Sans', sans-serif; }
    .s { position: absolute; left: 40px; top: 196px; display: flex; flex-direction: column; align-items: flex-start; gap: 10px; }
    .n { background: #fff; color: #1A1410; font-weight: 700; font-size: 40px; padding: 8px 20px; border-radius: 14px; box-shadow: 0 3px 10px rgba(0,0,0,0.18); }
    .l { background: #7ECDD5; color: #1A1410; font-weight: 700; font-size: 24px; padding: 5px 16px; border-radius: 999px; }
  </style></head><body><div class="s"><span class="n">${e(name)}</span>${location ? `<span class="l">${e(location)}</span>` : ''}</div></body></html>`
}

// ── Written notes: taped onto the reel, not a break in it ───────────────────────────────────────────
// A note sits on lined paper, taped over a soft blur of the person beside it, with the same name tag every video gets.
// Back-to-back notes become one moment: "A few words for Rosa", taped on one at a time.
const PAPERS = ['#FFFCF4', '#FDF1E2', '#EEF7F8']
const TAPES = ['rgba(247,217,108,0.9)', 'rgba(126,205,213,0.88)', 'rgba(244,192,209,0.9)']
function bgCss(bg, theme) {
  if (bg) return `background: url(data:image/jpeg;base64,${fs.readFileSync(bg).toString('base64')}) center/cover; filter: blur(30px) saturate(1.1) brightness(0.82); transform: scale(1.1);`
  const [paper] = THEME[theme] || THEME.postcard
  return `background: ${paper};`
}
function noteHtml(inner, { bg, theme }) {
  return `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
    * { box-sizing: border-box; margin: 0; }
    body { width: 720px; height: 1280px; position: relative; overflow: hidden; font-family: 'DM Sans', sans-serif; background: #1A1410; }
    .bg { position: absolute; inset: -60px; ${bgCss(bg, theme)} }
    .wash { position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 55%, rgba(245,240,232,0.18), rgba(26,20,16,${bg ? 0.32 : 0.06})); }
    .stripe { position: absolute; top: 0; left: 0; right: 0; height: 10px; background: #D4266A; z-index: 5; }
    .s { position: absolute; left: 40px; top: 196px; display: flex; flex-direction: column; align-items: flex-start; gap: 10px; z-index: 4; }
    .n { background: #fff; color: #1A1410; font-weight: 700; font-size: 40px; padding: 8px 20px; border-radius: 14px; box-shadow: 0 3px 10px rgba(0,0,0,0.18); }
    .l { background: #7ECDD5; color: #1A1410; font-weight: 700; font-size: 24px; padding: 5px 16px; border-radius: 999px; }
    .note { position: absolute; left: 70px; right: 70px; border-radius: 6px; box-shadow: 0 26px 56px rgba(0,0,0,0.32); background-image: repeating-linear-gradient(0deg, transparent 0 63px, rgba(201,186,150,0.45) 63px 65px); }
    .note .tape { position: absolute; top: -22px; left: 50%; width: 170px; height: 44px; margin-left: -85px; }
    .one { top: 50%; padding: 70px 54px 54px; }
    .one .m { font-family: 'Caveat', cursive; font-weight: 500; line-height: 65px; color: #1A1410; overflow-wrap: anywhere; }
    .sig { font-family: 'Caveat', cursive; font-weight: 700; color: #D4266A; text-align: right; }
    .one .sig { font-size: 48px; margin-top: 22px; }
    .heart { position: absolute; left: -26px; bottom: -40px; width: 82px; height: 94px; background: #D4266A; border: 6px solid #fff; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 40px; transform: rotate(-8deg); box-shadow: 0 6px 14px rgba(0,0,0,0.2); }
    .hint { position: absolute; left: 0; right: 0; bottom: 120px; text-align: center; color: #fff; font-weight: 700; font-size: 26px; text-shadow: 0 2px 8px rgba(0,0,0,0.45); }
    .top { position: absolute; top: 190px; left: 40px; right: 40px; text-align: center; font-family: 'DM Serif Display', serif; font-size: 54px; line-height: 1.05; color: #fff; text-shadow: 0 2px 10px rgba(0,0,0,0.35); }
    .wall { padding: 44px 40px 28px; }
    .wall .m { font-family: 'Caveat', cursive; font-weight: 500; font-size: 48px; line-height: 1.05; color: #1A1410; overflow-wrap: anywhere; }
    .wall .sig { font-size: 38px; margin-top: 6px; }
  </style></head><body><div class="bg"></div><div class="wash"></div>${inner}</body></html>`
}
// longer notes get a smaller hand, so every note fits the paper
const noteSize = (t) => { const n = String(t).length; return n < 60 ? 72 : n < 110 ? 64 : n < 170 ? 54 : 46 }
const wallSize = (t) => { const n = String(t).length; return n < 70 ? 48 : n < 130 ? 40 : 34 }
export const NOTES = {
  one: (j) => `<div class="s"><span class="n">${e(j.name)}</span>${j.location ? `<span class="l">${e(j.location)}</span>` : ''}</div>
    <div class="note one" style="background-color: ${PAPERS[0]}; transform: translateY(-46%) rotate(-2deg)"><span class="tape" style="background: ${TAPES[0]}; transform: rotate(3deg)"></span>
      <div class="m" style="font-size: ${noteSize(j.text)}px; line-height: ${Math.round(noteSize(j.text) * 0.98)}px">${e(j.text)}</div><div class="sig">— ${e(j.name)}</div><div class="heart">&#9829;</div></div>
    <div class="hint">${j.memory ? 'wrote this' : 'wrote this for you'}</div>`,
  // notes: the ones taped on so far (1 to 3); each new one lands below the last
  wall: (j) => {
    const tops = j.notes.length === 1 ? [500] : j.notes.length === 2 ? [380, 730] : [320, 610, 900]
    const turns = [-3, 2.5, -1.5]
    return `<div class="top">${j.memory ? 'A few words about' : 'A few words for'} ${e(j.first)}</div>` + j.notes.map((x, i) =>
      `<div class="note wall" style="top: ${tops[i]}px; background-color: ${PAPERS[i % 3]}; transform: rotate(${turns[i % 3]}deg)"><span class="tape" style="background: ${TAPES[(i + 1) % 3]}; width: 120px; height: 34px; margin-left: -60px; top: -16px"></span>
        <div class="m" style="font-size: ${wallSize(x.text)}px">${e(x.text)}</div><div class="sig">— ${e(x.name)}${x.location ? `, ${e(x.location)}` : ''}</div></div>`).join('')
  },
}

export async function openPainter() {
  const { chromium } = await loadPlaywright()
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-gpu'] })
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 }, deviceScaleFactor: 1 })
  // offline/dev machines: FONT_ROUTE points at a module that serves the Google Fonts from local files
  if (process.env.FONT_ROUTE) { const { routeFonts } = await import(process.env.FONT_ROUTE); await routeFonts(page.context()) }
  const paint = async (html, file, transparent) => {
    await page.setContent(html, { waitUntil: 'load' })
    await page.evaluate(() => document.fonts.ready).catch(() => {})
    await page.screenshot({ path: file, omitBackground: transparent, type: 'png' })
    return file
  }
  // The cover moves, so it is filmed: every animation on the page is paused, then stepped to each frame's moment and
  // photographed. Same result on a fast or a slow machine, and the confetti lands the same way every time.
  const film = async (html, dir, fps, seconds = COVER_SECONDS) => {
    await page.setContent(html, { waitUntil: 'load' })
    await page.evaluate(() => document.fonts.ready).catch(() => {})
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    const n = Math.round(seconds * fps)
    for (let i = 0; i < n; i++) {
      await page.evaluate((ms) => document.getAnimations().forEach((a) => { a.pause(); a.currentTime = ms }), (i * 1000) / fps)
      await page.screenshot({ path: path.join(dir, `f${String(i).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 88 })
    }
    return path.join(dir, 'f%04d.jpg')
  }
  return {
    cover: (data, dir, fps = 30) => film(coverHtml(data), dir, fps, coverSeconds(data.prompt)),
    end: (data, dir, fps = 30) => film(endHtml(data), dir, fps, END_SECONDS),
    card: (kind, data, theme, file) => paint(cardHtml(theme, CARDS[kind](data)), file, false),
    sticker: (name, location, file) => paint(stickerHtml(name, location), file, true),
    note: (kind, data, opts, file) => paint(noteHtml(NOTES[kind](data), opts), file, false),
    close: () => browser.close(),
  }
}

// CLI preview:  node render.js postcard /tmp/out
if (import.meta.url === `file://${process.argv[1]}`) {
  const [theme = 'postcard', outDir = '.'] = process.argv.slice(2)
  fs.mkdirSync(outDir, { recursive: true })
  const files = await renderFrames({ theme, recipientName: 'Rosa Martinez', hostName: 'Maria', clips: new Array(31), prompt: 'Tell Rosa your favorite memory with her, then wish her happy 60th.', moment: 'birthday', age: 60, totalSeconds: 480 }, outDir)
  console.log(files)
}


// ── Link previews: what a text message or WhatsApp shows before anyone taps ─────────────────────────────────────
// The card's own cover (its look, the name, the photo) beside one line: the friends' version invites them in, the
// recipient's version says how many people made it. 1200x630. The Worker asks for one (serve.js POST /og) whenever
// the card or its look changes, and again when the reel is made, and keeps it with the card.
// o: { mode: 'invite' | 'watch', card: { theme, design, moment, first, headline, host, n, prompt, photo, clipSeconds } }
function ogHtml(o, coverB64) {
  const c = o.card || {}
  const dv = c.design ? designVars(c.design) : null
  const sw = LOOK_SWATCH[c.theme] || LOOK_SWATCH.postcard
  const table = dv ? dv.surface : sw.bg, accent = dv ? dv.accent : sw.accent
  const memory = c.moment === 'memory'
  const n = Number(c.n) || 0
  const first = e(c.first || 'them'), host = e(c.host || 'Someone')
  const t = o.mode === 'watch'
    ? memory ? { eye: 'In memory', big: first, line: `${n} ${n === 1 ? 'person' : 'people'} shared what they remember.`, cta: 'Watch it' }
      : { eye: 'A video card for you', big: `${first},`, line: `${n} ${n === 1 ? 'person' : 'people'} made you something.`, cta: 'Open it' }
    : memory ? { eye: 'Remembering', big: first, line: `${host} is gathering memories of ${first}.`, cta: `Add yours · ${Number(c.clipSeconds) || 15} seconds` }
      : { eye: 'A surprise video card', big: `For ${first}`, line: `${host} is gathering everyone who loves ${first}. Shh, it's a surprise.`, cta: `Add your ${Number(c.clipSeconds) || 15} seconds` }
  const size = t.big.length <= 10 ? 92 : t.big.length <= 16 ? 74 : 58
  return `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
    *{box-sizing:border-box;margin:0} body{width:1200px;height:630px;overflow:hidden;background:${table};font-family:'DM Sans',sans-serif;position:relative}
    body::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 30% 40%,rgba(255,255,255,.18),transparent 60%)}
    .card{position:absolute;left:84px;top:34px;width:316px;height:562px;border-radius:22px;overflow:hidden;transform:rotate(-3deg);box-shadow:0 26px 50px rgba(0,0,0,.35);background:#fff url(data:image/jpeg;base64,${coverB64}) center/cover}
    .note{position:absolute;left:470px;top:70px;width:660px;height:490px;background:#FFFDF8;border-radius:28px;padding:48px 52px;box-shadow:0 20px 44px rgba(0,0,0,.22);display:flex;flex-direction:column}
    .eye{font:700 18px 'Courier Prime',monospace;letter-spacing:4px;text-transform:uppercase;color:#6B6158}
    .big{font-family:'DM Serif Display',serif;font-size:${size}px;line-height:1;color:#1A1410;margin-top:16px}
    .line{font-size:28px;line-height:1.35;color:#3A322B;margin-top:18px;max-width:540px}
    .cta{margin-top:auto;align-self:flex-start;background:${accent};color:${lumOk(accent) ? '#1A1410' : '#fff'};font:700 26px 'DM Sans',sans-serif;padding:16px 30px;border-radius:999px}
    .brand{position:absolute;right:52px;bottom:44px;display:flex;align-items:center;gap:4px;font-family:'DM Serif Display',serif;font-style:italic;font-size:34px;color:#1A1410}
    .brand svg{width:64px;height:48px}
  </style></head><body><div class="card"></div><div class="note"><div class="eye">${t.eye}</div><div class="big">${t.big}</div><div class="line">${t.line}</div><div class="cta">${t.cta}</div><div class="brand">churpie${BIRD_SVG}</div></div></body></html>`
}
const lumOk = (hex) => { const v = parseInt(hex.slice(1), 16); const r = (v >> 16) & 255, g = (v >> 8) & 255, b = v & 255; return (0.299 * r + 0.587 * g + 0.114 * b) > 160 }
export async function renderOg(o) {
  const { chromium } = await loadPlaywright()
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-gpu'] })
  try {
    const page = await browser.newPage({ viewport: { width: 720, height: 1280 }, deviceScaleFactor: 1 })
    if (process.env.FONT_ROUTE) { const { routeFonts } = await import(process.env.FONT_ROUTE); await routeFonts(page.context()) }
    const c = o.card || {}
    await page.setContent(coverHtml({ theme: c.theme, design: c.design || null, moment: c.moment, first: c.first, headline: c.headline, host: c.host, n: o.mode === 'watch' ? c.n : null, prompt: c.prompt, photo: c.photo || null, preview: true }), { waitUntil: 'load' })
    await page.evaluate(() => document.fonts.ready).catch(() => {})
    await page.evaluate(() => document.getAnimations().forEach((a) => { a.pause(); a.currentTime = 2600 }))
    const cover = await page.screenshot({ type: 'jpeg', quality: 86 })
    await page.setViewportSize({ width: 1200, height: 630 })
    await page.setContent(ogHtml(o, cover.toString('base64')), { waitUntil: 'load' })
    await page.evaluate(() => document.fonts.ready).catch(() => {})
    return await page.screenshot({ type: 'png' })
  } finally { await browser.close() }
}
