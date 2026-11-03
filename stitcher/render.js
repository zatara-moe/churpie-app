// Renders the card frames (wide 1920x1080 and story 720x1280) to PNGs with a transparent window.
// Uses headless Chromium via Playwright so the cards can be real HTML/CSS, not FFmpeg drawtext.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

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
}

export async function renderFrames(job, outDir) {
  const { chromium } = await loadPlaywright()
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-gpu'] })
  try {
    const html = fs.readFileSync(path.join(HERE, 'cards/card.html'), 'utf8')
    const name = job.recipientName.trim()
    const first = name.length <= 14 ? name : name.split(' ')[0]
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

// CLI preview:  node render.js postcard /tmp/out
if (import.meta.url === `file://${process.argv[1]}`) {
  const [theme = 'postcard', outDir = '.'] = process.argv.slice(2)
  fs.mkdirSync(outDir, { recursive: true })
  const files = await renderFrames({ theme, recipientName: 'Rosa Martinez', hostName: 'Maria', clips: new Array(31), prompt: 'Tell Rosa your favorite memory with her, then wish her happy 60th.', moment: 'birthday', age: 60, totalSeconds: 480 }, outDir)
  console.log(files)
}
