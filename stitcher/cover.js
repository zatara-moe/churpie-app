// churpie · the opening cover of a reel: the front of the card, full screen, for the first six seconds.
// One file, no imports, so the same code paints the reel (stitcher/render.js plays it frame by frame) and the
// preview on the host's board (public/cover.js is a copy; tools/local-smoke.mjs checks the two stay identical).
//
// Every look is drawn here in code for now. When illustrated art arrives, a look's `art` can become an image
// (a full 720x1280 picture behind the words) without touching the layout, the motion or the reel maker.

// The cover's timing follows the question: beat 1 (who it's for) runs 0-3 s, then the question stays up long enough to
// read (a second and a half plus ~0.3 s a word, 3.5 to 7 s), then the card lifts away in 0.6 s.
export function coverSeconds(prompt) {
  const words = String(prompt || '').trim().split(/\s+/).filter(Boolean).length
  if (!words) return 4.2
  return Math.round((3.15 + Math.min(7, Math.max(3.5, 1.5 + words * 0.3)) + 0.6) * 100) / 100
}
export const COVER_SECONDS = 6.2 // the shortest a cover with a question runs; kept for older callers
export const END_SECONDS = 7.2 // faces fill in over ~3 s, then it holds ~4 s on the last line

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

// the motion every look shares (the looks' own CSS calls these by name)
const MOTION = `
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
`

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
// ── build your own: the same covers, split into layers people mix themselves ────────────────────────────
// A design = { paper, edge, decor: [up to 3], fall, type, accent }. The 8 looks above stay as they are for cards that
// never touch a layer; PRESETS says which layers each look starts from when someone does.
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
const lum = (h) => { const [r, g, b] = hexRgb(h).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
const mixHex = (a, b, t) => '#' + hexRgb(a).map((c, i) => Math.round((c * (1 - t) + hexRgb(b)[i] * t) * 255).toString(16).padStart(2, '0')).join('')

const PAPERS = {
  cream: { label: 'Cream', bg: '#FBF3E4', ink: '#1A1410', art: '<div class="p-rays"></div>', css: '.p-rays{position:absolute;left:50%;top:44%;width:1900px;height:1900px;margin:-950px;border-radius:50%;background:repeating-conic-gradient(from 0deg,#FDE7C2 0 9deg,transparent 9deg 18deg);opacity:.75;animation:spin 60s linear infinite}' },
  kraft: { label: 'Kraft', bg: '#C9A678', ink: '#FBF7EE', shadow: '0 5px 0 rgba(60,40,15,.35)', art: '<div class="p-fiber"></div>', css: '.p-fiber{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 40%,rgba(255,240,210,.35),transparent 60%),repeating-linear-gradient(92deg,rgba(90,60,20,.06) 0 2px,transparent 2px 7px),repeating-linear-gradient(3deg,rgba(255,255,255,.07) 0 1px,transparent 1px 9px)}' },
  black: { label: 'Black', bg: '#12100D', ink: '#F3E3BF', art: '<div class="p-glow"></div><div class="p-fan"></div>', css: '.p-glow{position:absolute;left:50%;top:42%;width:900px;height:900px;margin:-450px;border-radius:50%;background:radial-gradient(circle,rgba(227,184,90,.24),transparent 62%)} .p-fan{position:absolute;left:50%;bottom:-760px;width:1800px;height:1800px;margin-left:-900px;border-radius:50%;background:repeating-conic-gradient(from -4deg,rgba(227,184,90,.18) 0 1.2deg,transparent 1.2deg 8deg)}' },
  winter: { label: 'Winter night', bg: '#0E3A2D', ink: '#FFF6E5', art: '<div class="p-hearth"></div>', css: '.p-hearth{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 46%,rgba(255,214,140,.22),transparent 58%),radial-gradient(ellipse at 50% 120%,rgba(0,0,0,.35),transparent 60%),repeating-linear-gradient(45deg,rgba(255,255,255,.025) 0 2px,transparent 2px 22px)}' },
  snowy: { label: 'Snowy white', bg: '#F2F6FA', ink: '#1D3557', art: '<div class="p-frost"></div>', css: '.p-frost{position:absolute;inset:0;background:radial-gradient(ellipse at 20% 10%,rgba(190,214,236,.7),transparent 45%),radial-gradient(ellipse at 85% 95%,rgba(190,214,236,.6),transparent 45%)}' },
  notebook: { label: 'Notebook', bg: '#FBFBF9', ink: '#1A1410', art: '<div class="p-lines"></div><div class="p-margin"></div><div class="p-holes"></div>', css: '.p-lines{position:absolute;inset:0;background:repeating-linear-gradient(180deg,transparent 0 62px,#CFE0F2 62px 65px)} .p-margin{position:absolute;left:96px;top:0;bottom:0;width:3px;background:#F2B8C6} .p-holes{position:absolute;left:30px;top:0;bottom:0;width:40px;background:radial-gradient(circle,#DCDCDC 15px,transparent 16px);background-size:40px 380px;background-position:0 150px}' },
  party: { label: 'Party pink', bg: '#E8246F', ink: '#1A1410', loud: true, art: '<div class="p-dots"></div><div class="p-blob"></div>', css: '.p-dots{position:absolute;inset:0;background-image:radial-gradient(circle,rgba(255,255,255,.22) 5px,transparent 6px);background-size:54px 54px} .p-blob{position:absolute;left:50%;top:46%;width:820px;height:820px;margin:-410px;border-radius:46% 54% 52% 48%/50% 44% 56% 50%;background:#FFE14D;animation:wob 9s ease-in-out infinite alternate} .mark{color:#fff}' },
  sage: { label: 'Sage', bg: '#EEF4F1', ink: '#22343A', art: '<div class="p-wash w1"></div><div class="p-wash w2"></div><div class="p-wash w3"></div>', css: '.p-wash{position:absolute;border-radius:50%;filter:blur(70px);animation:float 14s ease-in-out infinite alternate} .p-wash.w1{left:-180px;top:-120px;width:640px;height:640px;background:#BFE3E0} .p-wash.w2{right:-220px;top:360px;width:620px;height:620px;background:#F6D9C9;animation-delay:-5s} .p-wash.w3{left:-100px;bottom:-200px;width:700px;height:600px;background:#D9E6F5;animation-delay:-9s}' },
  ivory: { label: 'Ivory', bg: '#F6F1E7', ink: '#2E2A24', art: '<div class="p-paper"></div>', css: '.p-paper{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 45%,#FFFDF7,transparent 70%),radial-gradient(rgba(46,42,36,.045) 1px,transparent 1.4px);background-size:auto,6px 6px}' },
  letter: { label: 'Letter', bg: '#F7F1E3', ink: '#1F2D5C', art: '', css: '' },
}
const stripes = (a, b, gap, w) => `position:absolute;inset:0;border:${w}px solid transparent;border-image:repeating-linear-gradient(45deg,${a} 0 26px,${gap} 26px 52px,${b} 52px 78px,${gap} 78px 104px) ${w}`
const EDGES = {
  none: { label: 'None', html: () => '' },
  postcard: { label: 'Postcard', html: (P) => `<div class="e-edge" style="${stripes('#D4266A', '#0B9DAA', P.bg, 20)}"></div>` },
  airmail: { label: 'Airmail', html: (P) => `<div class="e-edge" style="${stripes('#B22222', '#1F3A93', P.bg, 24)}"></div>` },
  candy: { label: 'Candy cane', html: () => `<div class="e-edge" style="${stripes('#C8102E', '#C8102E', '#FFFFFF', 22)}"></div>` },
  gold: { label: 'Gold lines', html: () => '<div class="e-rule"></div>', css: '.e-rule{position:absolute;inset:26px;border:2px solid rgba(227,184,90,.8);border-radius:6px} .e-rule::after{content:"";position:absolute;inset:10px;border:1px solid rgba(227,184,90,.45)}' },
  twine: { label: 'Twine', html: () => '<div class="e-twine v"></div><div class="e-twine h"></div>', css: '.e-twine{position:absolute;background:repeating-linear-gradient(45deg,#C8102E 0 8px,#FBF7EE 8px 16px);box-shadow:0 3px 6px rgba(0,0,0,.25)} .e-twine.v{left:96px;top:0;bottom:0;width:12px} .e-twine.h{left:0;right:0;top:1090px;height:12px}' },
  frame: { label: 'Thin frame', html: (P) => `<div style="position:absolute;inset:34px;border:1.5px solid ${P.ink};opacity:.3"></div>` },
}
const BULBS = ['#FF5A5F', '#FFD166', '#06D6A0', '#4CC9F0', '#FF9F1C']
const DECOR = {
  holly: { label: 'Holly', html: () => SPRIG('k-holly a') + SPRIG('k-holly b'), css: '.k-holly{position:absolute;width:240px} .k-holly.a{left:-30px;top:-20px;transform:rotate(155deg)} .k-holly.b{right:-34px;bottom:120px;transform:rotate(-24deg)}' },
  lights: { label: 'String lights', html: () => { let b = ''; for (let i = 0; i < 11; i++) { const x = 30 + i * 66, y = 46 + Math.round(Math.sin((i / 10) * Math.PI) * 54); b += `<g transform="translate(${x} ${y}) rotate(${(i % 2 ? 8 : -8)})"><rect x="-6" y="-4" width="12" height="10" rx="2" fill="#2B3A33"/><ellipse class="k-bulb" style="animation-delay:${(i * 0.37) % 2}s" cx="0" cy="18" rx="11" ry="16" fill="${BULBS[i % BULBS.length]}"/></g>` } return `<svg class="k-lights" viewBox="0 0 720 150"><path d="M0 40 Q 360 150 720 40" fill="none" stroke="#2B3A33" stroke-width="4"/>${b}</svg>` }, css: '.k-lights{position:absolute;left:0;top:0;width:720px;height:150px;overflow:visible} .k-bulb{animation:glow 1.6s ease-in-out infinite alternate;filter:drop-shadow(0 0 10px currentColor)} @keyframes glow{from{opacity:.55}to{opacity:1}}' },
  ornaments: { label: 'Ornaments', html: (P, A) => [[96, 150, '#C8102E'], [610, 210, '#E3B85A'], [520, 120, A]].map(([x, len, c], i) => `<div class="k-orn" style="left:${x}px;animation-delay:${-i * 0.7}s"><i style="height:${len}px"></i><b style="background:radial-gradient(circle at 35% 35%,#fff8,transparent 45%),${c}"></b></div>`).join(''), css: '.k-orn{position:absolute;top:0;transform-origin:top center;animation:sway 3.2s ease-in-out infinite alternate} .k-orn i{display:block;width:2px;margin:0 auto;background:rgba(0,0,0,.35)} .k-orn b{display:block;width:58px;height:58px;border-radius:50%;margin:-2px 0 0 -28px;box-shadow:0 8px 16px rgba(0,0,0,.25)} .k-orn b::before{content:"";position:absolute;width:18px;height:12px;margin:-8px 0 0 20px;background:#C9A24C;border-radius:3px} @keyframes sway{from{transform:rotate(-5deg)}to{transform:rotate(5deg)}}' },
  stars: { label: 'Sparkles', html: () => SPARK(90, 170, 46, 0) + SPARK(590, 250, 30, 0.7) + SPARK(560, 930, 52, 1.2) + SPARK(110, 1010, 28, 0.4) + SPARK(620, 620, 20, 2), css: '.spark{position:absolute;color:var(--sparkle);animation:twinkle 2.6s ease-in-out infinite}' },
  hearts: { label: 'Hearts', html: (P, A) => [[70, 860, 70, -14], [600, 300, 54, 12], [610, 980, 40, 8]].map(([x, y, s, r], i) => `<svg class="k-heart" style="left:${x}px;top:${y}px;width:${s}px;transform:rotate(${r}deg);animation-delay:${0.9 + i * 0.25}s" viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 5 6.4 5c2 0 3.3 1.1 4 2.2.3.5 1 .5 1.3 0C12.4 6.1 13.7 5 15.6 5 19 5 21.1 8.4 19.6 11.8 17.5 16.4 12 21 12 21z" fill="${A}"/></svg>`).join(''), css: '.k-heart{position:absolute;animation:pop .6s cubic-bezier(.2,1.6,.4,1) both}' },
  flowers: { label: 'Flowers', html: () => STEM('k-stem a', '#7C8F6A', '#C98BA0') + STEM('k-stem b', '#8A9A78', '#D9A9B8'), css: '.k-stem{position:absolute;width:290px} .k-stem.a{left:-40px;bottom:-30px;transform:rotate(8deg)} .k-stem.b{right:-50px;bottom:-60px;transform:scaleX(-1) rotate(4deg);width:250px}' },
  doodles: { label: 'Doodles', loud: true, html: (P) => `<svg class="k-dood" style="right:44px;top:120px;width:150px" viewBox="0 0 100 100"><path style="animation-delay:1.3s" d="M50 8l11 27 29 2-22 19 7 29-25-16-25 16 7-29L10 37l29-2z"/></svg><svg class="k-dood" style="left:118px;bottom:96px;width:110px" viewBox="0 0 100 100"><path style="animation-delay:1.6s" d="M50 84C20 62 8 44 14 28c6-14 26-14 36 2 10-16 30-16 36-2 6 16-6 34-36 56z"/></svg><svg class="k-dood" style="right:50px;bottom:120px;width:120px" viewBox="0 0 100 100"><path style="animation-delay:1.8s" d="M8 60c20-30 30 20 46-8s22 10 38-14"/></svg>`.replace(/class="k-dood"/g, `class="k-dood" stroke="${P.ink}"`), css: '.k-dood{position:absolute;stroke-width:5;fill:none;stroke-linecap:round;stroke-linejoin:round} .k-dood path{stroke-dasharray:400;animation:draw .8s ease-out both}' },
  stamp: { label: 'Stamp', html: (P, A) => `<div class="k-stamp" style="background:${A}"><span>churpie</span><b>&#9829;</b></div><div class="k-pm" style="border-color:${P.ink};color:${P.ink}"><span>with love</span><b>${new Date().getFullYear()}</b></div>`, css: '.k-stamp{position:absolute;right:56px;top:66px;width:120px;height:146px;border:7px dashed rgba(255,255,255,.85);border-radius:6px;transform:rotate(5deg);display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font:700 15px "Courier Prime",monospace;letter-spacing:2px;box-shadow:0 6px 14px rgba(0,0,0,.18);animation:stamp .35s cubic-bezier(.2,1.6,.4,1) 1.4s both} .k-stamp b{font-size:56px;line-height:1} .k-pm{position:absolute;right:150px;top:150px;width:150px;height:150px;border:4px solid;border-radius:50%;opacity:.45;display:flex;flex-direction:column;align-items:center;justify-content:center;font:700 15px "Courier Prime",monospace;letter-spacing:3px;text-transform:uppercase;transform:rotate(-14deg)} .k-pm b{font-size:24px}' },
  plane: { label: 'Paper plane', html: (P, A) => `<svg class="k-route" viewBox="0 0 720 1280"><path d="M-60 420C160 150 520 90 790 300" stroke="${P.ink}"/></svg><svg class="k-plane" viewBox="0 0 24 24"><path d="M2 12l20-9-7 19-3-8z" fill="${A}"/><path d="M12 14l10-11-13 9z" fill="${mixHex(A, '#000000', 0.3)}"/></svg>`, css: '.k-route{position:absolute;left:0;top:0;width:720px;height:1280px} .k-route path{stroke-width:4;stroke-dasharray:4 16;stroke-linecap:round;fill:none;opacity:.45} .k-plane{position:absolute;left:0;top:0;width:86px;height:86px;margin:-43px;offset-path:path("M-60 420C160 150 520 90 790 300");offset-rotate:auto 45deg;animation:fly 3.2s cubic-bezier(.3,.1,.3,1) .2s both}' },
  bird: { label: 'Churpie bird', html: () => `<span class="k-bird">${BIRD}</span>`, css: '.k-bird{position:absolute;right:34px;bottom:150px;transform:rotate(-6deg);animation:rise .6s ease-out 1.3s both;filter:drop-shadow(0 6px 8px rgba(26,20,16,.2))}' },
}
const FALLS = { auto: 'Suits the occasion', none: 'None', confetti: 'Confetti', snow: 'Snow', mix: 'Snow + confetti', hearts: 'Hearts', stars: 'Stars' }
const TYPES = {
  classic: { label: 'Classic', name: "'DM Serif Display','Lora',serif", head: "'Caveat','TeX Gyre Chorus',cursive", headSize: 66 },
  script: { label: 'Script', name: "'Parisienne','TeX Gyre Chorus',cursive", head: "'DM Serif Display','Lora',serif", headSize: 46, headItalic: true },
  elegant: { label: 'Elegant', name: "'Playfair Display','Lora',serif", nameItalic: true, nameWeight: 800, head: "'Parisienne','TeX Gyre Chorus',cursive", headSize: 70 },
  gentle: { label: 'Gentle', name: "'DM Serif Display','Lora',serif", head: "'DM Serif Display','Lora',serif", headSize: 46, headItalic: true },
  marker: { label: 'Marker', loud: true, name: "'Permanent Marker','Anton',cursive", upper: true, head: "'Caveat','TeX Gyre Chorus',cursive", headSize: 64 },
  round: { label: 'Bold & round', loud: true, name: "'Fredoka','Poppins',sans-serif", nameWeight: 700, head: "'Fredoka','Poppins',sans-serif", headSize: 50 },
  typewriter: { label: 'Typewriter', name: "'DM Serif Display','Lora',serif", head: "'Courier Prime','DejaVu Sans Mono',monospace", headSize: 30 },
}
// each colour has a lighter partner for dark papers, so it never sinks into the background
const ACCENTS = {
  pink: ['Pink', '#D4266A', '#FF7FB0'], red: ['Christmas red', '#C8102E', '#FF6B6B'], evergreen: ['Evergreen', '#2D6A4F', '#7BD39A'], gold: ['Gold', '#B98A2E', '#E3B85A'],
  teal: ['Teal', '#0B8A96', '#5FD3DD'], navy: ['Navy', '#1F3A93', '#9DB4FF'], rose: ['Rose', '#A8627A', '#E8A5B9'], plum: ['Plum', '#7A3FC0', '#C9A2F5'],
}
export const PRESETS = {
  postcard: { paper: 'cream', edge: 'postcard', decor: ['stamp'], fall: 'auto', type: 'classic', accent: 'pink' },
  confettipop: { paper: 'party', edge: 'none', decor: [], fall: 'auto', type: 'round', accent: 'pink' },
  lockernote: { paper: 'notebook', edge: 'none', decor: ['doodles'], fall: 'auto', type: 'marker', accent: 'pink' },
  milestonegold: { paper: 'black', edge: 'gold', decor: ['stars'], fall: 'auto', type: 'elegant', accent: 'gold' },
  airmail: { paper: 'letter', edge: 'airmail', decor: ['plane'], fall: 'auto', type: 'classic', accent: 'red' },
  kraft: { paper: 'kraft', edge: 'twine', decor: ['holly'], fall: 'auto', type: 'typewriter', accent: 'evergreen' },
  quietnote: { paper: 'sage', edge: 'none', decor: [], fall: 'none', type: 'gentle', accent: 'teal' },
  pressedflower: { paper: 'ivory', edge: 'frame', decor: ['flowers'], fall: 'none', type: 'gentle', accent: 'rose' },
}
export const HOLIDAY_BIRTHDAY = { paper: 'winter', edge: 'candy', decor: ['lights', 'holly'], fall: 'mix', type: 'classic', accent: 'red' }
// for the pickers (and the server's checks): every option's id and label, plus what a swatch needs
export const DESIGN_OPTIONS = {
  papers: Object.entries(PAPERS).map(([id, p]) => ({ id, label: p.label, bg: p.bg, ink: p.ink, loud: !!p.loud })),
  edges: Object.entries(EDGES).map(([id, x]) => ({ id, label: x.label })),
  decor: Object.entries(DECOR).map(([id, x]) => ({ id, label: x.label, loud: !!x.loud })),
  falls: Object.entries(FALLS).map(([id, label]) => ({ id, label, loud: id === 'confetti' || id === 'mix' })),
  types: Object.entries(TYPES).map(([id, t]) => ({ id, label: t.label, font: t.name, loud: !!t.loud })),
  accents: Object.entries(ACCENTS).map(([id, [label, hex, light]]) => ({ id, label, hex, light })),
  maxDecor: 3,
}
// a design checked against the options: anything unknown falls back, so a stored design always draws
export function cleanDesign(x) {
  if (!x || typeof x !== 'object') return null
  const pick = (v, set, d) => (typeof v === 'string' && v in set ? v : d)
  return {
    paper: pick(x.paper, PAPERS, 'cream'), edge: pick(x.edge, EDGES, 'none'),
    decor: [...new Set((Array.isArray(x.decor) ? x.decor : []).filter((k) => typeof k === 'string' && k in DECOR))].slice(0, 3),
    fall: pick(x.fall, FALLS, 'auto'), type: pick(x.type, TYPES, 'classic'), accent: pick(x.accent, ACCENTS, 'pink'),
  }
}
// a design turned into the same shape as one of the LOOKS, so the cover and the end draw it the same way
function composeLook(design, memory) {
  const D = cleanDesign(design)
  const P = PAPERS[D.paper], T = TYPES[D.type], [, deep, light] = ACCENTS[D.accent]
  const dark = lum(P.bg) < 0.25
  const A = dark ? light : deep
  const chipInk = lum(A) > 0.45 ? '#1A1410' : '#FFFFFF'
  const decor = D.decor.map((k) => DECOR[k])
  const css = [P.css, EDGES[D.edge].css || '', ...decor.map((k) => k.css || ''),
    `:root{--sparkle:${dark ? '#F7E3A6' : A}}`,
    `.nm{color:${P.ink};${P.shadow ? `text-shadow:${P.shadow}` : dark ? '' : 'text-shadow:4px 4px 0 rgba(255,255,255,.7)'}}`,
    `.chip{background:${A};color:${chipInk}}`,
    D.type === 'typewriter' ? `.hl{background:${dark ? 'rgba(255,255,255,.92)' : '#FBF7EE'};color:#2B2116;padding:12px 28px 10px;letter-spacing:5px;text-transform:uppercase;font-weight:700;transform:rotate(-2deg);box-shadow:0 8px 18px rgba(0,0,0,.2)}` : '',
    D.type === 'marker' ? `.nm{position:relative;z-index:0;padding:0 18px} .nm::before{content:'';position:absolute;z-index:-1;left:-6px;right:-6px;top:22%;bottom:10%;background:${mixHex(A, '#FFFFFF', 0.45)};transform-origin:left;transform:rotate(-1.5deg);animation:swipe .5s cubic-bezier(.2,.8,.2,1) 1.05s both}` : '',
    D.paper === 'party' ? `.hl{color:#1A1410} .b2{color:#1A1410} .low .q{color:#1A1410;text-shadow:${halo('#1A1410')}} .b2{text-shadow:${halo('#1A1410')}} .mark{text-shadow:${halo('#FFFFFF')}} body .low{background:#FFE14D;border-radius:999px;padding:4px 26px 8px 14px;box-shadow:0 6px 14px rgba(0,0,0,.15)} body .low::before{display:none} body .b2::before{background:radial-gradient(closest-side,#FFE14De6 55%,#FFE14D00)}` : '',
    dark && D.accent === 'gold' ? '.nm{background:linear-gradient(100deg,#B98A2E 0%,#F9E7A9 28%,#E3B85A 50%,#FFF3C4 72%,#B98A2E 100%);background-size:220% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:none;padding:0 20px 12px}' : '',
  ].join('\n')
  const art = P.art + EDGES[D.edge].html(P, A) + decor.map((k) => k.html(P, A)).join('')
  const drift = D.paper === 'party' ? ['#FFE14D', '#fff', '#3DD6E0', '#FF9F6B'] : dark ? ['#F7E3A6', '#fff', A, '#FFD166'] : [A, '#0B9DAA', '#F7C948', '#F58F7C', mixHex(A, '#FFFFFF', 0.5)]
  const topPad = D.decor.some((k) => k === 'lights' || k === 'ornaments') ? 80 : 0 // things hanging from the top push the words down
  return { topPad, bg: P.bg, ink: P.ink, accent: A, name: T.name, head: T.head, headSize: T.headSize, headItalic: !!T.headItalic, nameItalic: !!T.nameItalic, nameWeight: T.nameWeight, upper: !!T.upper, drift, css, art, calm: memory, fall: D.fall }
}
// what the watch page needs to dress its table and the signed page in a custom design
export function designVars(design) {
  const D = cleanDesign(design); if (!D) return null
  const P = PAPERS[D.paper], [, deep, light] = ACCENTS[D.accent], dark = lum(P.bg) < 0.25
  return { surface: mixHex(P.bg, dark ? '#000000' : '#5A4630', dark ? 0.35 : 0.18), page: P.bg, ink: P.ink, faded: mixHex(P.ink, P.bg, 0.35), accent: dark ? light : deep, dark }
}
// the falling pieces always sit behind the words, and the words at the bottom get a soft halo in the opposite tone, so
// snow and confetti passing behind them never make them hard to read
const halo = (ink) => (lum(ink) > 0.4 ? '0 2px 10px rgba(0,0,0,.65),0 0 3px rgba(0,0,0,.55)' : '0 1px 10px rgba(255,255,255,.95),0 0 3px rgba(255,255,255,.9)')
const layers = (L) => `.drift{z-index:1} .content,.mark{z-index:2} .low,.b2{position:relative} .low::before,.mark::before,.b2::before{content:'';position:absolute;inset:-26px -40px;z-index:-1;background:radial-gradient(closest-side,${L.bg}e6 55%,${L.bg}00)} .mark,.b2,.low .q{text-shadow:${halo(L.ink)}} .t-confettipop .low .q,.t-confettipop .b2{text-shadow:${halo('#1A1410')}} .t-confettipop .mark{text-shadow:${halo('#FFFFFF')}} body.t-confettipop .low{background:#FFE14D;border-radius:999px;padding:4px 26px 8px 14px;box-shadow:0 6px 14px rgba(0,0,0,.15)} body.t-confettipop .low::before{display:none} body.t-confettipop .b2::before{background:radial-gradient(closest-side,#FFE14De6 55%,#FFE14D00)}`
const lookFor = (d) => (d.design ? composeLook(d.design, d.moment === 'memory') : LOOKS[d.theme] || LOOKS.postcard)
const fallFor = (d, L, memory) => {
  if (memory || (!d.design && d.theme === 'pressedflower')) return null
  const auto = d.moment in DRIFT ? DRIFT[d.moment] : 'confetti'
  if (!L.fall || L.fall === 'auto') return d.design ? auto : auto
  return L.fall === 'none' ? null : L.fall
}

export const COVER_LOOKS = Object.keys(LOOKS)
// for pickers: each look's paper, ink and accent
export const LOOK_SWATCH = Object.fromEntries(Object.entries(LOOKS).map(([k, v]) => [k, { bg: v.bg, ink: v.ink, accent: v.accent }]))

function driftHtml(kind, colors, rand, calm) {
  if (!kind || !colors) return ''
  if (kind === 'mix') return driftHtml('snow', colors, rand, calm) + driftHtml('confetti', colors, rand, calm)
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
  const L = lookFor(d)
  const memory = d.moment === 'memory'
  const calm = !!L.calm || memory
  const rand = rng(`${d.first}|${d.theme}`)
  const kind = fallFor(d, L, memory)
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
  const total = coverSeconds(q), REVEAL_AT = total - 0.6
  return `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
  *{box-sizing:border-box;margin:0} html,body{width:720px;height:1280px;overflow:hidden;background:${L.bg}}
  body{position:relative;font-family:'DM Sans','Inter',sans-serif;color:${L.ink};-webkit-font-smoothing:antialiased}
  .next{position:absolute;inset:0;background:#000 center/cover no-repeat}
  .cover{position:absolute;inset:0;overflow:hidden;background:${L.bg};${reveal ? `animation:lift 0.6s cubic-bezier(.7,0,.84,0) ${REVEAL_AT.toFixed(2)}s both;box-shadow:0 30px 60px rgba(0,0,0,.45)` : ''}}
  .art{position:absolute;inset:0;overflow:hidden}
  .drift{position:absolute;inset:0;overflow:hidden;pointer-events:none} .d{position:absolute;top:-60px}
  .fall{animation:fall linear infinite} .rise{top:auto;bottom:-80px;animation:floatup linear infinite} .tw{animation:twinkle 3s ease-in-out infinite}
  .content{position:absolute;inset:0;padding:${(d.photo ? 150 : 150) + (L.topPad || 0)}px 54px ${d.photo ? 170 : 190}px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${d.photo ? 22 : 30}px;text-align:center}
  .hl{font-family:${L.head};font-size:${L.headSize}px;line-height:1.05;${L.headItalic ? 'font-style:italic;' : ''}color:${L.accent};max-width:600px;overflow-wrap:anywhere;animation:rise .55s cubic-bezier(.2,.8,.2,1) .45s both}
  .ph{width:${len > 10 ? 340 : 370}px;height:${len > 10 ? 400 : 440}px;flex:none;border:16px solid #fff;border-bottom-width:54px;background:#ddd center/cover no-repeat;box-shadow:0 24px 50px rgba(0,0,0,.28);transform:rotate(-3deg);animation:${calm ? 'rise .8s ease-out' : 'drop .7s cubic-bezier(.2,1.4,.4,1)'} .12s both;position:relative}
  .ph::before,.ph::after{content:'';position:absolute;top:-34px;width:130px;height:40px;opacity:.9} .ph::before{left:-30px;background:#F7D96C;transform:rotate(-24deg)} .ph::after{right:-30px;background:#7ECDD5;transform:rotate(22deg)}
  ${calm ? '.ph::before,.ph::after{display:none} .ph{transform:rotate(-1.5deg)}' : ''}
  .nm{font-family:${L.name};font-size:${big}px;line-height:.95;font-weight:${L.nameWeight || 400};${L.nameItalic ? 'font-style:italic;' : ''}${L.upper ? 'text-transform:uppercase;' : ''}letter-spacing:-1px;max-width:640px;animation:${pop} ${calm ? '.9s ease-out' : '.7s cubic-bezier(.2,1.5,.4,1)'} .7s both}
  .low{position:relative;width:100%;min-height:${d.preview ? 70 : 250}px;display:flex;justify-content:center}
  .chip{position:absolute;top:8px;font-weight:700;font-size:32px;padding:14px 30px;border-radius:999px;background:${L.accent};color:${L.bg};white-space:nowrap;animation:${pop} .5s cubic-bezier(.2,1.5,.4,1) 1.25s both${d.preview || !q ? '' : ',out .35s ease-in 2.85s forwards'}}
  .b2{position:absolute;top:0;left:0;right:0;display:flex;flex-direction:column;align-items:center;gap:10px;animation:rise .5s cubic-bezier(.2,.8,.2,1) 3.15s both}
  .ask{font:700 22px 'Courier Prime','DejaVu Sans Mono',monospace;letter-spacing:3px;text-transform:uppercase;opacity:.75}
  .q{font-family:'Caveat','TeX Gyre Chorus',cursive;font-weight:700;font-size:${qSize}px;line-height:1.05;max-width:600px}
  .mark{position:absolute;left:0;right:0;bottom:64px;text-align:center;font-family:'DM Serif Display','Lora',serif;font-style:italic;font-size:38px;opacity:.9;animation:rise .5s ease-out 1.6s both} .mark b{color:${L.accent};font-style:normal}
  ${MOTION}
  ${L.css}
  ${layers(L)}
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


// ── the end: everyone who showed up, faces filling in one by one, in the card's own look ────────────────────────
// d: { theme, moment, first, n, faces: [{ img? (data: URL), name }], memory? }
const BIRD = `<svg width="150" height="114" viewBox="0 0 132 100" aria-hidden="true" style="overflow:visible"><path d="M30 56 L7 45 L13 72 L32 66 Z" fill="#D4266A"/><path d="M22 58 C22 38 38 24 56 24 C72 24 82 36 82 50 C82 70 66 82 48 82 C32 82 22 72 22 58 Z" fill="#D4266A"/><g transform="rotate(-10 108 49)"><rect x="89" y="37" width="38" height="25" rx="2" fill="#fff" stroke="#1A1410" stroke-width="2.5"/><rect x="93" y="41" width="30" height="17" fill="none" stroke="#D4266A" stroke-width="2.5" stroke-dasharray="5 4"/><rect x="113" y="42.5" width="7" height="8" fill="#0B9DAA"/></g><path d="M79 42.5 L97 48.5 L79 50 Z" fill="#F2B33D"/><path d="M79 50 L95 51 L79 55.5 Z" fill="#F2B33D"/><path d="M64 57 C58 47 42 47 30 57 C36 59 38 63 34 68 C46 70 58 66 64 57 Z" fill="#0B9DAA"/><circle cx="66" cy="42" r="4.6" fill="#1A1410"/><circle cx="67.6" cy="40.4" r="1.4" fill="#fff"/><path d="M44 82 L41 92 M56 81 L56 92" stroke="#1A1410" stroke-width="3.2" stroke-linecap="round"/></svg>`
const DOTS = ['#F4B9CF', '#B8E3E8', '#F7E27A', '#D9E8C4', '#E4D6F0', '#FAD7B5']
export function endHtml(d) {
  const L = lookFor(d)
  const memory = d.moment === 'memory' || (!d.design && d.theme === 'pressedflower')
  const calm = !!L.calm || memory
  const n = Math.max(1, Number(d.n) || (d.faces || []).length || 1)
  const all = d.faces || []
  const shown = all.slice(0, all.length > 24 ? 23 : 24)
  const extra = all.length - shown.length
  const cells = shown.length + (extra > 0 ? 1 : 0)
  const size = cells <= 4 ? 190 : cells <= 9 ? 150 : cells <= 16 ? 118 : 96
  const step = Math.min(0.16, 2.4 / Math.max(1, cells)) // they all land within ~3 seconds, however many there are
  const face = (f, i) => `<span class="face" style="animation-delay:${(0.7 + i * step).toFixed(2)}s;${f.img ? `background-image:url(${f.img})` : `background:${DOTS[i % DOTS.length]}`}">${f.img ? '' : `<b>${e(String(f.name || '?').trim().slice(0, 1).toUpperCase())}</b>`}</span>`
  const people = n === 1 ? '1 person' : `${n} people`
  const line1 = memory ? `remembered ${e(d.first || '')}.` : 'showed up for you.'
  const line2 = memory ? 'with love, always.' : "so you know you're loved."
  return `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
  *{box-sizing:border-box;margin:0} html,body{width:720px;height:1280px;overflow:hidden;background:${L.bg}}
  body{position:relative;font-family:'DM Sans','Inter',sans-serif;color:${L.ink};-webkit-font-smoothing:antialiased}
  .cover{position:absolute;inset:0;overflow:hidden;background:${L.bg}} .art{position:absolute;inset:0;overflow:hidden}
  .drift{position:absolute;inset:0;overflow:hidden;pointer-events:none} .d{position:absolute;top:-60px}
  .fall{animation:fall linear infinite} .rise{top:auto;bottom:-80px;animation:floatup linear infinite} .tw{animation:twinkle 3s ease-in-out infinite}
  .content{position:absolute;inset:0;padding:${120 + (L.topPad || 0)}px 50px 150px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;text-align:center}
  .nm{font-family:${L.name};font-size:${n >= 100 ? 120 : 150}px;line-height:.95;font-weight:${L.nameWeight || 400};${L.nameItalic ? 'font-style:italic;' : ''}${L.upper ? 'text-transform:uppercase;' : ''}animation:${calm ? 'rise .9s ease-out' : 'pop .7s cubic-bezier(.2,1.5,.4,1)'} .15s both}
  .hl{font-family:${L.head};font-size:${Math.round(L.headSize * 0.95)}px;line-height:1.05;${L.headItalic ? 'font-style:italic;' : ''}color:${L.accent};animation:rise .55s cubic-bezier(.2,.8,.2,1) .4s both}
  .faces{display:flex;flex-wrap:wrap;justify-content:center;gap:14px;max-width:640px}
  .face{width:${size}px;height:${size}px;border-radius:50%;background:#ccc center/cover no-repeat;border:${size > 120 ? 7 : 5}px solid #fff;box-shadow:0 10px 24px rgba(0,0,0,.22);display:flex;align-items:center;justify-content:center;animation:${calm ? 'rise .7s ease-out' : 'pop .5s cubic-bezier(.2,1.6,.4,1)'} both}
  .face b{font:700 ${Math.round(size * 0.42)}px 'DM Sans',sans-serif;color:#1A1410}
  .more{font:700 ${Math.round(size * 0.3)}px 'DM Sans',sans-serif;color:#1A1410;background:#fff}
  .low{display:flex;align-items:center;gap:6px;animation:rise .6s ease-out ${(0.9 + cells * step).toFixed(2)}s both}
  .low .q{font-family:'Caveat','TeX Gyre Chorus',cursive;font-weight:700;font-size:50px;line-height:1;white-space:nowrap}
  .t-confettipop .low .q,.t-confettipop .hl{color:#1A1410}
  .nm{white-space:nowrap}
  .bird{animation:hop 1.2s ease-in-out ${(1.2 + cells * step).toFixed(2)}s infinite} @keyframes hop{0%,100%{transform:translateY(0) rotate(-4deg)}40%{transform:translateY(-14px) rotate(2deg)}}
  .mark{position:absolute;left:0;right:0;bottom:56px;text-align:center;font-family:'DM Serif Display','Lora',serif;font-style:italic;font-size:38px;animation:rise .5s ease-out 1.2s both} .mark b{color:${L.accent};font-style:normal}
  .mark small{display:block;font:700 18px 'Courier Prime','DejaVu Sans Mono',monospace;font-style:normal;letter-spacing:3px;opacity:.75;margin-top:4px}
  ${MOTION}
  ${L.css}
  ${layers(L)}
  .content .hl{background:none;padding:0;border-radius:0;transform:none;box-shadow:none;clip-path:none}
  </style></head><body class="t-${e(d.theme)}">
  <div class="cover"><div class="art">${L.art}</div>${calm ? '' : driftHtml(fallFor(d, L, memory), L.drift, rng(`end|${d.first}|${d.theme}`), calm)}
    <div class="content">
      <div><div class="nm">${e(people)}</div><div class="hl" style="margin-top:12px">${line1}</div></div>
      <div class="faces">${shown.map(face).join('')}${extra > 0 ? `<span class="face more" style="animation-delay:${(0.7 + shown.length * step).toFixed(2)}s">+${extra}</span>` : ''}</div>
      <div class="low">${memory ? '' : `<span class="bird">${BIRD}</span>`}<span class="q">${line2}</span></div>
    </div>
    <div class="mark">churpie<b>.</b><small>churpie.me</small></div>
  </div><script>(function(){var n=document.querySelector('.nm');if(!n)return;var s=parseFloat(getComputedStyle(n).fontSize);function fit(){while(n.scrollWidth>620&&s>60){s-=6;n.style.fontSize=s+'px'}}fit();if(document.fonts&&document.fonts.ready)document.fonts.ready.then(fit)})()</script></body></html>`
}

// the Churpie bird holding its card, for the link previews (stitcher/render.js)
export { BIRD as BIRD_SVG }
