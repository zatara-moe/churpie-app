// Renders every churpie link-preview image into public/og/. Run: node tools/og/render.mjs
// Needs Playwright with Chromium (npx playwright install chromium if you don't have it).
// Set FONTS_DIR to a folder of @fontsource packages to render offline; otherwise Google Fonts loads.
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

const { chromium } = createRequire(import.meta.url)('playwright')
const here = path.dirname(fileURLToPath(import.meta.url))
const out = path.resolve(here, '../../public/og')
const THEMES = ['postcard', 'confettipop', 'milestonegold', 'airmail', 'quietnote', 'kraft', 'pressedflower', 'lockernote']

// Invite: what a friend sees when the host shares the invite link. Words follow the voice guide.
const INVITE = {
  kind: 'invite', eyebrow: "You're invited", title: 'Add to a <em>surprise</em> video card',
  sub: "Everyone records a few seconds. They'll get one reel.", facts: ['No sign-in', 'About 15 seconds', 'Free'],
}
const INVITE_MEMORY = {
  kind: 'invite', eyebrow: "You're invited", title: 'Share a memory, in <em>your</em> words',
  sub: 'A few seconds each, gathered into one video for the family.', facts: ['No sign-in', 'Take your time', 'Free'],
}
// Reel: what the person it's for sees when the finished card is shared with them.
const REEL = {
  kind: 'reel', eyebrow: 'Special delivery', title: 'A video card made <em>for you</em>',
  sub: 'Press play when you have a quiet moment.', postmark: '<span>churpie</span><b>for you</b><span>★ ★ ★</span>',
}
const REEL_MEMORY = {
  kind: 'reel', eyebrow: 'Gathered with care', title: 'What everyone <em>remembers</em>',
  sub: 'Watch when you have a quiet moment.', postmark: '<span>churpie</span><b>with love</b><span>★ ★ ★</span>',
}
// Site: the home page and the occasion pages.
const SITE = {
  site: { theme: 'postcard', eyebrow: 'Free group video cards', title: 'A video card from <em>everyone</em> who loves them', facts: ['One link', '15 seconds each', 'No sign-in'] },
  birthday: { theme: 'confettipop', eyebrow: 'Birthday video cards', title: 'A birthday video from <em>everyone</em>', facts: ['One link', 'No sign-in', 'Free'] },
  retirement: { theme: 'milestonegold', eyebrow: 'Retirement video cards', title: 'A send-off from <em>everyone</em> they worked with', facts: ['One link', 'No sign-in', 'Free'] },
  'get-well': { theme: 'quietnote', eyebrow: 'Get well video cards', title: 'A little company while they <em>rest up</em>', facts: ['One link', 'No sign-in', 'Free'] },
  memorial: { theme: 'pressedflower', eyebrow: 'Memorial video tributes', title: 'Gather what everyone <em>remembers</em>', facts: ['One link', 'No sign-in', 'Free'] },
}

const jobs = [
  ...THEMES.map((t) => [t, { ...(t === 'pressedflower' ? INVITE_MEMORY : INVITE), theme: t }]),
  ...THEMES.map((t) => [`reel-${t}`, { ...(t === 'pressedflower' ? REEL_MEMORY : REEL), theme: t }]),
  ...Object.entries(SITE).map(([k, v]) => [k, { kind: 'site', postmark: '<span>churpie</span><b>free</b><span>★ ★ ★</span>', ...v }]),
]

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
await page.goto('file://' + path.join(here, 'og.html'))
if (process.env.FONTS_DIR) {
  const f = (pkg, file, fam, w = 400, s = 'normal') => {
    const p = path.join(process.env.FONTS_DIR, '@fontsource', pkg, 'files', file)
    return fs.existsSync(p) ? `@font-face{font-family:'${fam}';font-weight:${w};font-style:${s};src:url(data:font/woff2;base64,${fs.readFileSync(p).toString('base64')}) format('woff2')}` : ''
  }
  await page.addStyleTag({ content: [
    f('dm-serif-display', 'dm-serif-display-latin-400-normal.woff2', 'DM Serif Display'),
    f('dm-serif-display', 'dm-serif-display-latin-400-italic.woff2', 'DM Serif Display', 400, 'italic'),
    f('dm-sans', 'dm-sans-latin-500-normal.woff2', 'DM Sans', 500), f('dm-sans', 'dm-sans-latin-700-normal.woff2', 'DM Sans', 700),
    f('courier-prime', 'courier-prime-latin-700-normal.woff2', 'Courier Prime', 700),
    f('caveat', 'caveat-latin-500-normal.woff2', 'Caveat', 500),
    f('nunito', 'nunito-latin-900-normal.woff2', 'Nunito', 900),
    f('playfair-display', 'playfair-display-latin-500-normal.woff2', 'Playfair Display', 500),
    f('playfair-display', 'playfair-display-latin-500-italic.woff2', 'Playfair Display', 500, 'italic'),
    f('cormorant-garamond', 'cormorant-garamond-latin-500-normal.woff2', 'Cormorant Garamond', 500),
    f('cormorant-garamond', 'cormorant-garamond-latin-500-italic.woff2', 'Cormorant Garamond', 500, 'italic'),
    f('permanent-marker', 'permanent-marker-latin-400-normal.woff2', 'Permanent Marker'),
  ].join('') })
}
for (const [name, o] of jobs) {
  await page.evaluate((o) => window.render(o), o)
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(80)
  await page.screenshot({ path: path.join(out, `${name}.png`) })
  console.log('wrote', name)
}
await browser.close()
