// churpie · the opening cover of a reel: the front of the card, full screen, for the first six seconds.
// One file, no imports, so the same code paints the reel (stitcher/render.js plays it frame by frame) and the
// preview on the host's board (public/cover.js is a copy; tools/local-smoke.mjs checks the two stay identical).
//
// Every look is drawn here in code for now. When illustrated art arrives, a look's `art` can become an image
// (a full 720x1280 picture behind the words) without touching the layout, the motion or the reel maker.

export const COVER_SECONDS = 6.2 // beat 1 (who it's for) 0-3s, beat 2 (the question) 3-5.6s, then it lifts away
const REVEAL_AT = 5.6

export const HEADLINES = {
  birthday: 'Happy birthday,', holiday: 'Happy holidays,', newyear: 'Happy New Year,', baby: 'Welcome to the world,',
  congrats: 'Congratulations,', anniversary: 'Happy anniversary,', wedding: 'Congratulations,', welcome: 'Welcome home,',
  getwell: 'Get well soon,', retirement: 'Happy retirement,', thankyou: 'Thank you,', team: "We'll miss you,",
  missyou: 'We miss you,', memory: 'Remembering', brand: 'From all of us',
}
// what drifts across the cover, by occasion. Quiet looks and memorials get nothing.
const DRIFT = { holiday: 'snow', baby: 'stars', wedding: 'hearts', anniversary: 'hearts', missyou: 'hearts', getwell: 'hearts', memory: null }
const WORK = new Set(['team', 'retirement', 'brand'])

const FONTS = '<link href="https://fonts.googleapis.com/css2?family=Anton&family=Caveat:wght@500;700&family=Courier+Prime:wght@400;700&family=DM+Sans:opsz,wght@9..40,500;9..40,700&family=DM+Serif+Display:ital@0;1&family=Fredoka:wght@600;700&family=Parisienne&family=Permanent+Marker&family=Playfair+Display:ital,wght@0,700;1,700;1,800&display=swap" rel="stylesheet">'
const e = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
// the same picks every time for the same card, so remaking a reel never reshuffles its confetti
function rng(seed) { let h = 2166136261; for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }

// ── looks ───────────────────────────────────────────────────────────────────
// bg/ink/accent: the palette. name/head: lettering. drift: confetti colors. art: what sits behind the words.
const SPARK = (x, y, s, d) => `<svg class="spark" style="left:${x}px;top:${y}px;width:${s}px;height:${s}px;animation-delay:${d}s" viewBox="0 0 24 24"><path d="M12 0c1 7 4 10 12 12-8 2-11 5-12 12-1-7-4-10-12-12 8-2 11-5 12-12z" fill="currentColor"/></svg>`
const SPRIG = (cls) => `<svg class="sprig ${cls}" viewBox="0 0 200 260" fill="none" stroke-linecap="round"><path class="draw" d="M100 258C98 190 104 120 96 20" stroke="#2D5A3A" stroke-width="6"/>${[[96, 60, -1], [99, 95, 1], [100, 130, -1], [101, 165, 1], [100, 200, -1], [100, 228, 1]].map(([x, y, s], i) => `<path class="leaf" style="animation-delay:${0.25 + i * 0.09}s" d="M${x} ${y}c${s * 22}-${26} ${s * 62}-${30} ${s * 78}-${52}c${s * -8} ${34} ${s * -42} ${52} ${s * -78} ${52}z" fill="#3E7A4E"/>`).join('')}<circle class="berry" cx="72" cy="216" r="11" fill="#C8102E"/><circle class="berry" cx="92" cy="232" r="9" fill="#E0314B" style="animation-delay:.9s"/><circle class="berry" cx="118" cy="214" r="10" fill="#C8102E" style="animation-delay:1s"/></svg>`
const STEM = (cls, c1, c2) => `<svg class="stem ${cls}" viewBox="0 0 240 520" fill="none" stroke-linecap="round"><path class="draw" d="M120 520C112 400 130 280 118 150" stroke="${c1}" stroke-width="4"/><path class="draw" d="M119 380c-34-10-62-36-70-74M121 330c30-12 54-40 60-76M119 270c-26-14-44-40-46-72" stroke="${c1}" stroke-width="3"/>${[[49, 306, -30], [181, 254, 28], [73, 198, -24]].map(([x, y, r], i) => `<ellipse class="leaf" style="animation-delay:${0.9 + i * 0.15}s;transform-origin:${x}px ${y}px" cx="${x}" cy="${y - 22}" rx="16" ry="30" transform="rotate(${r} ${x} ${y})" fill="${c1}" opacity=".55"/>`).join('')}<g class="bloom" style="transform-origin:118px 150px">${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="118" cy="112" rx="20" ry="38" transform="rotate(${a} 118 150)" fill="${c2}" opacity=".82"/>`).join('')}<circle cx="118" cy="150" r="14" fill="#E9C46A"/></g></svg>`

const LOOKS = {
  postcard: {
    bg: '#FBF3E4', ink: '#1A1410', accent: '#D4266A', name: "'DM Serif Display','Lora',serif", head: "'Caveat','TeX Gyre Chorus',cursive", headSize: 66,
    drift: ['#D4266A', '#0B9DAA', '#F7C948', '#F58F7C', '#7ECDD5'],
    css: `.rays{position:absolute;left:50%;top:44%;width:1900px;height:1900px;margin:-950px;border-radius:50%;background:repeating-conic-gradient(from 0deg,#FDE7C2 0 9deg,transparent 9deg 18deg);opacity:.75;animation:spin 60s linear infinite}
      .edge{position:absolute;inset:0;border:20px solid transparent;border-image:repeating-linear-gradient(45deg,#D4266A 0 26px,#FBF3E4 26px 52px,#0B9DAA 52px 78px,#FBF3E4 78px 104px) 20}
      .nm{color:#D4266A;text-shadow:5px 5px 0 #fff}`,
    art: '<div class="rays"></div><div class="edge"></div>',
  },
  confettipop: {
    bg: '#E8246F', ink: '#fff', accent: '#FFE14D', name: "'Fredoka','Poppins','Archivo Black',sans-serif", head: "'Fredoka','Poppins',sans-serif", headSize: 50, nameWeight: 700, upper: false,
    drift: ['#FFE14D', '#fff', '#3DD6E0', '#FF9F6B', '#B9F2A1'],
    css: `.blob{position:absolute;left:50%;top:46%;width:820px;height:820px;margin:-410px;border-radius:46% 54% 52% 48%/50% 44% 56% 50%;background:#FFE14D;animation:wob 9s ease-in-out infinite alternate}
      .dots{position:absolute;inset:0;background-image:radial-gradient(circle,rgba(255,255,255,.22) 5px,transparent 6px);background-size:54px 54px}
      .nm{color:#1A1410;text-shadow:6px 6px 0 #fff} .hl{color:#1A1410;font-weight:700;background:#fff;padding:6px 24px;border-radius:999px;transform:rotate(-3deg)}
      .chip{background:#1A1410;color:#fff} .b2{color:#1A1410} .mark{color:#fff} .ph{border-radius:28px;border-color:#fff}`,
    art: '<div class="dots"></div><div class="blob"></div>',
  },
  lockernote: {
    bg: '#FBFBF9', ink: '#1A1410', accent: '#D4266A', name: "'Permanent Marker','Anton','Comic Relief',cursive", head: "'Caveat','TeX Gyre Chorus',cursive", headSize: 64, upper: true,
    drift: ['#D4266A', '#1A1410', '#F7D96C', '#7ECDD5'],
    css: `.lines{position:absolute;inset:0;background:repeating-linear-gradient(180deg,transparent 0 62px,#CFE0F2 62px 65px)} .margin{position:absolute;left:96px;top:0;bottom:0;width:3px;background:#F2B8C6}
      .holes{position:absolute;left:30px;top:0;bottom:0;width:40px;background:radial-gradient(circle,#DCDCDC 15px,transparent 16px);background-size:40px 380px;background-position:0 150px}
      .nm{position:relative;z-index:0;padding:0 18px} .nm::before{content:'';position:absolute;z-index:-1;left:-6px;right:-6px;top:22%;bottom:10%;background:#F7D96C;transform-origin:left;transform:rotate(-1.5deg);animation:swipe .5s cubic-bezier(.2,.8,.2,1) 1.05s both}
      .doodle{position:absolute;stroke:#1A1410;stroke-width:5;fill:none;stroke-linecap:round;stroke-linejoin:round} .doodle path{stroke-dasharray:400;animation:draw .8s ease-out both}
      .ph{border-width:16px 16px 16px;border-color:#fff;box-shadow:0 0 0 4px #1A1410,10px 12px 0 4px #D4266A}`,
    art: `<div class="lines"></div><div class="margin"></div><div class="holes"></div>
      <svg class="doodle" style="right:44px;top:120px;width:150px" viewBox="0 0 100 100"><path style="animation-delay:1.3s" d="M50 8l11 27 29 2-22 19 7 29-25-16-25 16 7-29L10 37l29-2z"/></svg>
      <svg class="doodle" style="left:118px;bottom:96px;width:110px" viewBox="0 0 100 100"><path style="animation-delay:1.6s" d="M50 84C20 62 8 44 14 28c6-14 26-14 36 2 10-16 30-16 36-2 6 16-6 34-36 56z"/></svg>
      <svg class="doodle" style="right:50px;bottom:120px;width:120px" viewBox="0 0 100 100"><path style="animation-delay:1.8s" d="M8 60c20-30 30 20 46-8s22 10 38-14"/></svg>`,
  },
  milestonegold: {
    bg: '#12100D', ink: '#F3E3BF', accent: '#E3B85A', name: "'Playfair Display','Lora',serif", head: "'Parisienne','TeX Gyre Chorus',cursive", headSize: 70, nameItalic: true, nameWeight: 800,
    drift: ['#E3B85A', '#F7E3A6', '#B98A2E'],
    css: `.fan{position:absolute;left:50%;bottom:-760px;width:1800px;height:1800px;margin-left:-900px;border-radius:50%;background:repeating-conic-gradient(from -4deg,rgba(227,184,90,.2) 0 1.2deg,transparent 1.2deg 8deg)}
      .glow{position:absolute;left:50%;top:42%;width:900px;height:900px;margin:-450px;border-radius:50%;background:radial-gradient(circle,rgba(227,184,90,.26),transparent 62%)}
      .rule{position:absolute;inset:26px;border:2px solid rgba(227,184,90,.75);border-radius:6px} .rule::after{content:'';position:absolute;inset:10px;border:1px solid rgba(227,184,90,.4)}
      .nm{background:linear-gradient(100deg,#B98A2E 0%,#F9E7A9 28%,#E3B85A 50%,#FFF3C4 72%,#B98A2E 100%);background-size:220% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation-name:pop,shine;animation-duration:.7s,5s;animation-delay:.7s,1.4s;animation-timing-function:cubic-bezier(.2,1.5,.4,1),linear;animation-fill-mode:both,both;padding:0 20px 12px}
      .spark{position:absolute;color:#F7E3A6;animation:twinkle 2.6s ease-in-out infinite} .hl{color:#F3E3BF}
      .chip{background:transparent;border:2px solid #E3B85A;color:#F3E3BF} .ph::before,.ph::after{display:none} .ph{border-color:#F3E3BF;border-width:10px;box-shadow:0 0 0 2px #E3B85A,0 30px 60px rgba(0,0,0,.6)}`,
    art: `<div class="glow"></div><div class="fan"></div><div class="rule"></div>${SPARK(90, 170, 46, 0)}${SPARK(590, 250, 30, .7)}${SPARK(560, 930, 52, 1.2)}${SPARK(110, 1010, 28, .4)}${SPARK(340, 100, 22, 1.6)}${SPARK(620, 620, 20, 2)}`,
  },
  airmail: {
    bg: '#F7F1E3', ink: '#1F2D5C', accent: '#B22222', name: "'DM Serif Display','Lora',serif", head: "'Caveat','TeX Gyre Chorus',cursive", headSize: 66,
    drift: ['#B22222', '#1F3A93', '#F7C948', '#7ECDD5'],
    css: `.edge{position:absolute;inset:0;border:26px solid transparent;border-image:repeating-linear-gradient(45deg,#B22222 0 30px,#F7F1E3 30px 60px,#1F3A93 60px 90px,#F7F1E3 90px 120px) 26}
      .route{position:absolute;left:0;top:0;width:720px;height:1280px} .route path{stroke:#1F3A93;stroke-width:4;stroke-dasharray:4 16;stroke-linecap:round;fill:none;opacity:.55}
      .plane{position:absolute;left:0;top:0;width:86px;height:86px;margin:-43px;offset-path:path('M-60 420C160 150 520 90 790 300');offset-rotate:auto 45deg;animation:fly 3.2s cubic-bezier(.3,.1,.3,1) .2s both}
      .pm{position:absolute;right:60px;bottom:170px;width:210px;height:210px;border:5px solid #1F3A93;border-radius:50%;opacity:.5;display:flex;flex-direction:column;align-items:center;justify-content:center;font:700 19px 'Courier Prime',monospace;letter-spacing:3px;text-transform:uppercase;color:#1F3A93;line-height:1.5;animation:stamp .35s cubic-bezier(.2,1.6,.4,1) 1.5s both} .pm b{font-size:30px}
      .nm{color:#1F2D5C} .hl{color:#B22222}`,
    art: `<div class="edge"></div><svg class="route" viewBox="0 0 720 1280"><path d="M-60 420C160 150 520 90 790 300"/></svg>
      <svg class="plane" viewBox="0 0 24 24"><path d="M2 12l20-9-7 19-3-8z" fill="#B22222"/><path d="M12 14l10-11-13 9z" fill="#8A1A1A"/></svg>
      <div class="pm"><span>par avion</span><b>with love</b><span>churpie post</span></div>`,
  },
  kraft: {
    bg: '#C9A678', ink: '#FBF7EE', accent: '#2D5A3A', name: "'DM Serif Display','Lora',serif", head: "'Courier Prime','DejaVu Sans Mono',monospace", headSize: 30,
    drift: ['#FBF7EE', '#C8102E', '#2D5A3A', '#F7C948'],
    css: `.fiber{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 40%,rgba(255,240,210,.35),transparent 60%),repeating-linear-gradient(92deg,rgba(90,60,20,.06) 0 2px,transparent 2px 7px),repeating-linear-gradient(3deg,rgba(255,255,255,.07) 0 1px,transparent 1px 9px)}
      .twine{position:absolute;background:repeating-linear-gradient(45deg,#C8102E 0 8px,#FBF7EE 8px 16px);box-shadow:0 3px 6px rgba(0,0,0,.25)} .twine.v{left:96px;top:0;bottom:0;width:12px} .twine.h{left:0;right:0;top:1090px;height:12px}
      .sprig{position:absolute;width:250px} .sprig.a{left:-30px;top:-20px;transform:rotate(155deg)} .sprig.b{right:-34px;bottom:120px;transform:rotate(-24deg)}
      .hl{background:#FBF7EE;color:#2B2116;padding:12px 28px 10px;letter-spacing:5px;text-transform:uppercase;font-weight:700;transform:rotate(-2deg);box-shadow:0 8px 18px rgba(0,0,0,.2);clip-path:polygon(22px 0,100% 0,100% 100%,22px 100%,0 50%)}
      .nm{color:#FBF7EE;text-shadow:0 5px 0 rgba(60,40,15,.35)} .chip{background:#2D5A3A;color:#FBF7EE} .b2{color:#2B2116} .mark{color:#2B2116}`,
    art: `<div class="fiber"></div><div class="twine v"></div><div class="twine h"></div>${SPRIG('a')}${SPRIG('b')}`,
  },
  quietnote: {
    bg: '#EEF4F1', ink: '#22343A', accent: '#0B9DAA', name: "'DM Serif Display','Lora',serif", head: "'DM Serif Display','Lora',serif", headSize: 46, headItalic: true, calm: true,
    drift: ['#F4B9CF', '#fff'],
    css: `.wash{position:absolute;border-radius:50%;filter:blur(70px);animation:float 14s ease-in-out infinite alternate} .w1{left:-180px;top:-120px;width:640px;height:640px;background:#BFE3E0} .w2{right:-220px;top:360px;width:620px;height:620px;background:#F6D9C9;animation-delay:-5s} .w3{left:-100px;bottom:-200px;width:700px;height:600px;background:#D9E6F5;animation-delay:-9s}
      .grain{position:absolute;inset:0;background-image:radial-gradient(rgba(34,52,58,.05) 1px,transparent 1.4px);background-size:7px 7px}
      .nm{color:#22343A} .hl{color:#0B7F8A} .chip{background:rgba(255,255,255,.7);color:#22343A} .ph{border-radius:8px}`,
    art: '<div class="wash w1"></div><div class="wash w2"></div><div class="wash w3"></div><div class="grain"></div>',
  },
  pressedflower: {
    bg: '#F6F1E7', ink: '#2E2A24', accent: '#A8627A', name: "'DM Serif Display','Lora',serif", head: "'DM Serif Display','Lora',serif", headSize: 46, headItalic: true, calm: true,
    drift: null,
    css: `.paper{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 45%,#FFFDF7,transparent 70%),radial-gradient(rgba(46,42,36,.045) 1px,transparent 1.4px);background-size:auto,6px 6px}
      .frame{position:absolute;inset:34px;border:1.5px solid rgba(46,42,36,.3)}
      .stem{position:absolute;width:300px} .stem.a{left:-40px;bottom:-30px;transform:rotate(8deg)} .stem.b{right:-50px;bottom:-60px;transform:scaleX(-1) rotate(4deg);width:260px} 
      .nm{color:#2E2A24} .hl{color:#8A5A6A} .chip{background:transparent;color:#5E564A;border-top:1.5px solid rgba(46,42,36,.3);border-radius:0;font-style:italic;font-family:'DM Serif Display','Lora',serif;font-weight:400} .ph{border-radius:4px;filter:saturate(.85)}`,
    art: `<div class="paper"></div><div class="frame"></div>${STEM('a', '#7C8F6A', '#C98BA0')}${STEM('b', '#8A9A78', '#D9A9B8')}`,
  },
}
export const COVER_LOOKS = Object.keys(LOOKS)
// for pickers: each look's paper, ink and accent
export const LOOK_SWATCH = Object.fromEntries(Object.entries(LOOKS).map(([k, v]) => [k, { bg: v.bg, ink: v.ink, accent: v.accent }]))

function driftHtml(kind, colors, rand, calm) {
  if (!kind || !colors) return ''
  const n = kind === 'confetti' ? 46 : kind === 'snow' ? 40 : 16
  let out = ''
  for (let i = 0; i < n; i++) {
    const x = Math.round(rand() * 720), dur = (kind === 'confetti' ? 3.2 : kind === 'snow' ? 7 : 8) + rand() * 4, delay = -(rand() * dur).toFixed(2)
    const c = colors[Math.floor(rand() * colors.length)], sway = Math.round((rand() - 0.5) * 160), spin = Math.round((rand() - 0.5) * 1400)
    const base = `left:${x}px;animation-duration:${dur.toFixed(2)}s;animation-delay:${delay}s;--sway:${sway}px;--spin:${spin}deg;`
    if (kind === 'confetti') {
      const w = 12 + Math.round(rand() * 14), shape = i % 3
      out += `<i class="d fall" style="${base}width:${w}px;height:${shape === 1 ? w : Math.round(w * 1.9)}px;background:${c};border-radius:${shape === 1 ? '50%' : shape === 2 ? '40% 10%' : '3px'}"></i>`
    } else if (kind === 'snow') {
      const w = 8 + Math.round(rand() * 14)
      out += `<i class="d fall" style="${base}width:${w}px;height:${w}px;background:#fff;border-radius:50%;opacity:${(0.55 + rand() * 0.45).toFixed(2)};box-shadow:0 0 8px rgba(255,255,255,.8)"></i>`
    } else if (kind === 'stars') {
      const w = 22 + Math.round(rand() * 30)
      out += `<svg class="d tw" style="left:${x}px;top:${Math.round(rand() * 1180)}px;width:${w}px;height:${w}px;animation-delay:${delay}s;color:${c}" viewBox="0 0 24 24"><path d="M12 0c1 7 4 10 12 12-8 2-11 5-12 12-1-7-4-10-12-12 8-2 11-5 12-12z" fill="currentColor"/></svg>`
    } else {
      const w = 26 + Math.round(rand() * 34)
      out += `<svg class="d rise" style="${base}width:${w}px;height:${w}px;color:${c};opacity:${calm ? 0.5 : 0.85}" viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 5 6.4 5c2 0 3.3 1.1 4 2.2.3.5 1 .5 1.3 0C12.4 6.1 13.7 5 15.6 5 19 5 21.1 8.4 19.6 11.8 17.5 16.4 12 21 12 21z" fill="currentColor"/></svg>`
    }
  }
  return `<div class="drift">${out}</div>`
}

// d: { theme, first, headline?, moment, host, n, prompt, photo? (image URL or data: URL), next? (the reel's first frame),
//      preview? (true on the host's board: holds on beat 1 and never lifts away) }
export function coverHtml(d) {
  const L = LOOKS[d.theme] || LOOKS.postcard
  const memory = d.moment === 'memory'
  const calm = !!L.calm || memory
  const rand = rng(`${d.first}|${d.theme}`)
  const kind = memory || d.theme === 'pressedflower' ? null : (d.moment in DRIFT ? DRIFT[d.moment] : 'confetti')
  const headline = String(d.headline || '').trim() || HEADLINES[d.moment] || 'A card for'
  const name = String(d.first || '').trim() || 'you'
  const len = name.length
  const big = d.photo ? (len <= 4 ? 190 : len <= 7 ? 150 : len <= 10 ? 116 : len <= 14 ? 92 : 74) : (len <= 4 ? 250 : len <= 7 ? 190 : len <= 10 ? 140 : len <= 14 ? 108 : 84)
  // no count yet (a preview before anyone has joined): say "everyone" instead of a number
  const n = d.n == null || d.n === '' || !(Number(d.n) > 0) ? null : Number(d.n)
  const chip = memory ? (n === null ? 'remembered by everyone' : n === 1 ? 'one person remembers' : `${n} people remember`)
    : WORK.has(d.moment) ? (n === null ? 'from all of us' : n === 1 ? 'a message for you' : `from ${n} people`)
    : (n === null ? 'from everyone who loves you' : n === 1 ? 'from someone who loves you' : `from ${n} people who love you`)
  const q = String(d.prompt || '').trim()
  const qSize = q.length < 50 ? 60 : q.length < 90 ? 52 : q.length < 140 ? 44 : 38
  const pop = calm ? 'rise' : 'pop'
  const reveal = d.next && !d.preview
  return `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
  *{box-sizing:border-box;margin:0} html,body{width:720px;height:1280px;overflow:hidden;background:${L.bg}}
  body{position:relative;font-family:'DM Sans','Inter',sans-serif;color:${L.ink};-webkit-font-smoothing:antialiased}
  .next{position:absolute;inset:0;background:#000 center/cover no-repeat}
  .cover{position:absolute;inset:0;overflow:hidden;background:${L.bg};${reveal ? `animation:lift ${(COVER_SECONDS - REVEAL_AT).toFixed(2)}s cubic-bezier(.7,0,.84,0) ${REVEAL_AT}s both;box-shadow:0 30px 60px rgba(0,0,0,.45)` : ''}}
  .art{position:absolute;inset:0;overflow:hidden}
  .drift{position:absolute;inset:0;overflow:hidden;pointer-events:none} .d{position:absolute;top:-60px}
  .fall{animation:fall linear infinite} .rise{top:auto;bottom:-80px;animation:floatup linear infinite} .tw{animation:twinkle 3s ease-in-out infinite}
  .content{position:absolute;inset:0;padding:${d.photo ? '96px 54px 170px' : '120px 54px 190px'};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${d.photo ? 22 : 30}px;text-align:center}
  .hl{font-family:${L.head};font-size:${L.headSize}px;line-height:1.05;${L.headItalic ? 'font-style:italic;' : ''}color:${L.accent};max-width:600px;overflow-wrap:anywhere;animation:rise .55s cubic-bezier(.2,.8,.2,1) .45s both}
  .ph{width:${len > 10 ? 360 : 400}px;height:${len > 10 ? 430 : 480}px;flex:none;border:16px solid #fff;border-bottom-width:54px;background:#ddd center/cover no-repeat;box-shadow:0 24px 50px rgba(0,0,0,.28);transform:rotate(-3deg);animation:${calm ? 'rise .8s ease-out' : 'drop .7s cubic-bezier(.2,1.4,.4,1)'} .12s both;position:relative}
  .ph::before,.ph::after{content:'';position:absolute;top:-34px;width:130px;height:40px;opacity:.9} .ph::before{left:-30px;background:#F7D96C;transform:rotate(-24deg)} .ph::after{right:-30px;background:#7ECDD5;transform:rotate(22deg)}
  ${calm ? '.ph::before,.ph::after{display:none} .ph{transform:rotate(-1.5deg)}' : ''}
  .nm{font-family:${L.name};font-size:${big}px;line-height:.95;font-weight:${L.nameWeight || 400};${L.nameItalic ? 'font-style:italic;' : ''}${L.upper ? 'text-transform:uppercase;' : ''}letter-spacing:-1px;max-width:640px;animation:${pop} ${calm ? '.9s ease-out' : '.7s cubic-bezier(.2,1.5,.4,1)'} .7s both}
  .low{position:relative;width:100%;min-height:${d.preview ? 70 : 250}px;display:flex;justify-content:center}
  .chip{position:absolute;top:8px;font-weight:700;font-size:32px;padding:14px 30px;border-radius:999px;background:${L.accent};color:${L.bg};white-space:nowrap;animation:${pop} .5s cubic-bezier(.2,1.5,.4,1) 1.25s both${d.preview || !q ? '' : ',out .35s ease-in 2.85s forwards'}}
  .b2{position:absolute;top:0;left:0;right:0;display:flex;flex-direction:column;align-items:center;gap:10px;animation:rise .5s cubic-bezier(.2,.8,.2,1) 3.15s both}
  .ask{font:700 22px 'Courier Prime','DejaVu Sans Mono',monospace;letter-spacing:3px;text-transform:uppercase;opacity:.75}
  .q{font-family:'Caveat','TeX Gyre Chorus',cursive;font-weight:700;font-size:${qSize}px;line-height:1.05;max-width:600px}
  .mark{position:absolute;left:0;right:0;bottom:64px;text-align:center;font-family:'DM Serif Display','Lora',serif;font-style:italic;font-size:38px;opacity:.9;animation:rise .5s ease-out 1.6s both} .mark b{color:${L.accent};font-style:normal}
  @keyframes rise{from{opacity:0;transform:translateY(34px)}to{opacity:1;transform:none}}
  @keyframes pop{0%{opacity:0;transform:scale(.4)}60%{opacity:1}100%{opacity:1;transform:scale(1)}}
  @keyframes drop{0%{opacity:0;transform:translateY(-240px) rotate(-14deg)}100%{opacity:1;transform:rotate(-3deg)}}
  @keyframes out{to{opacity:0;transform:translateY(-20px)}}
  @keyframes lift{to{transform:translateY(-104%) rotate(-3deg)}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes wob{to{border-radius:54% 46% 44% 56%/46% 56% 44% 54%;transform:rotate(14deg) scale(1.05)}}
  @keyframes float{to{transform:translate(60px,-50px) scale(1.12)}}
  @keyframes twinkle{0%,100%{opacity:.25;transform:scale(.6) rotate(0)}50%{opacity:1;transform:scale(1.1) rotate(20deg)}}
  @keyframes fall{from{transform:translate(0,0) rotate(0)}to{transform:translate(var(--sway),1400px) rotate(var(--spin))}}
  @keyframes floatup{from{transform:translate(0,0)}to{transform:translate(var(--sway),-1500px)}}
  @keyframes swipe{from{transform:rotate(-1.5deg) scaleX(0)}to{transform:rotate(-1.5deg) scaleX(1)}}
  @keyframes draw{from{stroke-dashoffset:400}to{stroke-dashoffset:0}}
  @keyframes fly{from{offset-distance:0%}to{offset-distance:100%}}
  @keyframes stamp{from{opacity:0;transform:scale(2.2) rotate(-30deg)}to{opacity:.5;transform:rotate(-12deg)}}
  @keyframes shine{from{background-position:120% 0}to{background-position:-100% 0}}
  @keyframes grow{from{opacity:0;transform:scale(0)}to{opacity:1;transform:scale(1)}}
  .sprig .draw,.stem .draw{stroke-dasharray:600;animation:draw2 1.3s ease-out .1s both} @keyframes draw2{from{stroke-dashoffset:600}to{stroke-dashoffset:0}}
  .sprig .leaf,.sprig .berry,.stem .leaf{transform-box:fill-box;transform-origin:center;animation:grow .5s cubic-bezier(.2,1.4,.4,1) .8s both} .stem .bloom{animation:grow .9s cubic-bezier(.2,1.2,.4,1) 1.3s both}
  ${L.css}
  </style></head><body class="t-${e(d.theme)}">
  ${reveal ? `<div class="next" style="background-image:url(${d.next})"></div>` : ''}
  <div class="cover"><div class="art">${L.art}</div>${driftHtml(kind, L.drift, rand, calm)}
    <div class="content">
      <div class="hl">${e(headline)}</div>
      ${d.photo ? `<div class="ph" style="background-image:url(${d.photo})"></div>` : ''}
      <div class="nm">${e(name)}</div>
      <div class="low"><div class="chip">${e(chip)}</div>${d.preview || !q ? '' : `<div class="b2"><span class="ask">${e(d.host || 'We')} asked everyone</span><span class="q">“${e(q)}”</span></div>`}</div>
    </div>
    <div class="mark">churpie<b>.</b></div>
  </div><script>(function(){var n=document.querySelector('.nm');if(!n)return;var s=parseFloat(getComputedStyle(n).fontSize);function fit(){while(n.scrollWidth>612&&s>48){s-=4;n.style.fontSize=s+'px'}}fit();if(document.fonts&&document.fonts.ready)document.fonts.ready.then(fit)})()</script></body></html>`
}
