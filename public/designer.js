// churpie · the cover designer: a live, moving preview of the reel's first seconds, and everything a host can make
// their own. Start from a look, then change any layer (paper, edge, decorations, what falls, lettering, color), add a
// first line, a photo and a song. Used on /new (step 3) and on the card page (The cover).
// The preview is the real cover: public/cover.js is the same code the reel maker films.
import { coverHtml, LOOK_SWATCH, HEADLINES, PRESETS, DESIGN_OPTIONS as O, cleanDesign } from '/cover.js'
import { escapeHtml as esc } from '/app.js'

// keep in step with src/catalog.js looksFor / songsFor and stitcher/stitch.js pickMusic
export function looksFor(vibes, moment) {
  if (moment === 'memory') return vibes.filter((v) => v.moments.includes('memory'))
  const suited = vibes.filter((v) => v.moments.includes(moment))
  return [...suited, ...vibes.filter((v) => v.id !== 'pressedflower' && !suited.includes(v))]
}
export function songsFor(songs, moment) { return moment === 'memory' ? songs.filter((s) => ['reflective', 'everyday', 'slowdance'].includes(s.mood)) : songs }
const MOMENT_MOOD = { holiday: 'holiday', newyear: 'celebration', baby: 'lullaby', wedding: 'slowdance', anniversary: 'slowdance', memory: 'reflective', getwell: 'everyday', missyou: 'everyday' }
const THEME_MOOD = { postcard: 'celebration', confettipop: 'celebration', lockernote: 'beat', airmail: 'everyday', kraft: 'everyday', milestonegold: 'everyday', quietnote: 'reflective', pressedflower: 'reflective' }
export const autoMood = (moment, vibe) => (moment === 'memory' || vibe === 'pressedflower') ? 'reflective' : MOMENT_MOOD[moment] || THEME_MOOD[vibe] || 'everyday'

// first lines people reach for, by occasion and season (one tap fills the box)
export function quickLines(moment, now = new Date()) {
  const m = now.getMonth(), d = now.getDate()
  const season = m === 10 && d >= 10 || m === 11 || (m === 0 && d <= 6)
  const out = [HEADLINES[moment]].filter(Boolean)
  if (season && moment !== 'memory') {
    if (moment === 'birthday') out.push('Merry Christmas & happy birthday,')
    out.push('Merry Christmas,', 'Happy holidays,', 'Happy Hanukkah,')
    if (m === 11 && d >= 20 || m === 0) out.push('Happy New Year,')
  }
  if (moment === 'birthday') out.push('Happy birthday to you,')
  return [...new Set(out)].slice(0, 6)
}

const CSS = `
.dz { display: grid; gap: 18px; align-items: start; }
@media (min-width: 720px) { .dz { grid-template-columns: 260px minmax(0, 1fr); } .dz-stage { position: sticky; top: 76px; } }
.dz-stage { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.dz-phone { width: 216px; height: 384px; border-radius: 26px; overflow: hidden; position: relative; background: #1A1410; box-shadow: 0 0 0 6px #1A1410, 0 18px 40px rgba(0,0,0,0.25); flex: none; }
.dz-phone iframe { position: absolute; left: 0; top: 0; width: 720px; height: 1280px; border: 0; transform: scale(0.3); transform-origin: 0 0; pointer-events: none; }
@media (max-width: 719px) {
  /* phones: the preview stays in view, smaller, while the choices scroll under it */
  .dz-stage { position: sticky; top: 56px; z-index: 4; background: var(--paper, #F5F0E8); margin: 0 -16px; padding: 8px 16px 6px; box-shadow: 0 8px 12px -10px rgba(26,20,16,0.25); }
  .dz-phone { width: 153px; height: 272px; border-radius: 20px; box-shadow: 0 0 0 4px #1A1410, 0 10px 20px rgba(0,0,0,0.2); }
  .dz-phone iframe { transform: scale(0.2125); }
}
.dz-replay { border: 0; background: transparent; color: var(--pink-deep, #B01E58); font: 700 14px 'DM Sans', sans-serif; cursor: pointer; min-height: 36px; padding: 0 10px; }
.dz-side { display: flex; flex-direction: column; gap: 18px; min-width: 0; }
.dz-h { font-size: 12px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; color: var(--ink-ghost, #8A8076); margin: 0 0 8px; display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.dz-h small { text-transform: none; letter-spacing: 0; font-weight: 600; }
.dz-h button { border: 0; background: none; color: var(--pink-deep, #B01E58); font: 700 13px 'DM Sans', sans-serif; letter-spacing: 0; text-transform: none; cursor: pointer; padding: 0; }
.dz-row { display: flex; gap: 12px; overflow-x: auto; padding: 4px 2px 8px; scroll-snap-type: x proximity; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
.dz-row::-webkit-scrollbar { display: none; }
.dz-look { flex: none; width: 70px; border: 0; background: transparent; padding: 0; cursor: pointer; font: 600 12px 'DM Sans', sans-serif; color: var(--ink, #1A1410); display: flex; flex-direction: column; align-items: center; gap: 6px; scroll-snap-align: start; }
.dz-look .sw { width: 60px; height: 60px; border-radius: 50%; position: relative; overflow: hidden; box-shadow: 0 0 0 1px rgba(0,0,0,0.12); transition: transform .15s; display: block; }
.dz-look .sw i { position: absolute; left: 0; right: 0; bottom: 0; height: 38%; }
.dz-look .sw b { position: absolute; left: 0; right: 0; top: 14px; text-align: center; font: 400 22px 'DM Serif Display', serif; }
.dz-look[aria-checked=true] .sw { box-shadow: 0 0 0 3px var(--paper, #F5F0E8), 0 0 0 6px var(--ink, #1A1410); transform: scale(1.04); }
.dz-look span:last-child { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 70px; }
.dz-tools { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; border-bottom: 1.5px solid var(--line, #E3DACB); margin-bottom: 10px; }
.dz-tools::-webkit-scrollbar { display: none; }
.dz-tool { flex: none; border: 0; background: none; padding: 10px 10px 9px; font: 700 14px 'DM Sans', sans-serif; color: var(--ink-faded, #6B6158); cursor: pointer; border-bottom: 3px solid transparent; margin-bottom: -1.5px; }
.dz-tool[aria-selected=true] { color: var(--ink, #1A1410); border-color: var(--pink, #D4266A); }
.dz-chip { flex: none; border: 2px solid var(--line, #E3DACB); background: #fff; border-radius: 999px; min-height: 42px; padding: 0 15px; font: 700 14px 'DM Sans', sans-serif; color: var(--ink, #1A1410); cursor: pointer; white-space: nowrap; }
.dz-chip[aria-pressed=true] { background: var(--ink, #1A1410); border-color: var(--ink, #1A1410); color: #fff; }
.dz-chip.font { font-size: 20px; font-weight: 400; min-height: 46px; }
.dz-dot { flex: none; width: 46px; height: 46px; border-radius: 50%; border: 0; cursor: pointer; box-shadow: 0 0 0 1px rgba(0,0,0,0.12); }
.dz-dot[aria-pressed=true] { box-shadow: 0 0 0 3px var(--paper, #F5F0E8), 0 0 0 6px var(--ink, #1A1410); }
.dz-note { font-size: 13px; color: var(--ink-faded, #6B6158); margin: 2px 2px 0; }
.dz-in { width: 100%; font: 600 17px 'DM Sans', sans-serif; padding: 12px 14px; border-radius: 12px; border: 2px solid var(--line, #E3DACB); background: #fff; color: var(--ink, #1A1410); }
.dz-in:focus { outline: none; border-color: var(--ink, #1A1410); }
.dz-quick { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; padding: 0 0 8px; }
.dz-quick::-webkit-scrollbar { display: none; }
.dz-quick button { flex: none; border: 1.5px dashed var(--line-dark, #CFC3AE); background: transparent; border-radius: 999px; min-height: 36px; padding: 0 12px; font: 600 13px 'DM Sans', sans-serif; color: var(--ink, #1A1410); cursor: pointer; white-space: nowrap; }
.dz-photo { display: flex; align-items: center; gap: 12px; }
.dz-photo .th { width: 54px; height: 54px; border-radius: 10px; background: #E9E1D3 center/cover no-repeat; flex: none; border: 3px solid #fff; box-shadow: 0 2px 6px rgba(0,0,0,0.15); }
.dz-btn { border: 2px solid var(--ink, #1A1410); background: #fff; color: var(--ink, #1A1410); border-radius: 999px; font: 700 14px 'DM Sans', sans-serif; min-height: 44px; padding: 0 16px; cursor: pointer; }
.dz-btn.quiet { border-color: transparent; background: transparent; color: var(--ink-faded, #6B6158); }
.dz-songs { display: flex; flex-direction: column; gap: 6px; margin-top: 4px; }
.dz-song { display: flex; align-items: center; gap: 12px; border: 2px solid transparent; background: #fff; border-radius: 14px; padding: 6px 12px 6px 6px; cursor: pointer; text-align: left; font: 600 15px 'DM Sans', sans-serif; color: var(--ink, #1A1410); min-height: 52px; }
.dz-song[aria-checked=true] { border-color: var(--ink, #1A1410); }
.dz-song .pl { width: 40px; height: 40px; border-radius: 50%; background: var(--paper-aged, #EFE7D9); display: flex; align-items: center; justify-content: center; flex: none; }
.dz-song .pl.on { background: var(--pink, #D4266A); color: #fff; }
.dz-song .nm { flex: 1; min-width: 0; }
.dz-song .ck { font-weight: 800; color: var(--pink-deep, #B01E58); visibility: hidden; }
.dz-song[aria-checked=true] .ck { visibility: visible; }
`
const PLAY = '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4l13 8-13 8z" fill="currentColor"/></svg>'
const STOP = '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor"/></svg>'
const TOOLS = [['look', 'Start from'], ['paper', 'Paper'], ['edge', 'Edge'], ['decor', 'Decorations'], ['fall', 'Falling'], ['type', 'Lettering'], ['accent', 'Color']]

// root: an element to fill. value: { vibe, design, song, headline } (changed in place). data(): { first, host, n, prompt, moment }.
// photo (card page only): { url() -> string|null, add(file) -> Promise, remove() -> Promise }. onChange(value): after any change.
export function mountDesigner(root, { catalog, value, data, photo = null, onChange = () => {} }) {
  if (!document.getElementById('dz-css')) document.head.insertAdjacentHTML('beforeend', `<style id="dz-css">${CSS}</style>`)
  const audio = new Audio(); audio.preload = 'none'
  let playing = null, shownMood = null, tool = 'look'
  root.innerHTML = `<div class="dz">
    <div class="dz-stage"><div class="dz-phone"><iframe title="Preview of the cover" tabindex="-1" sandbox="allow-scripts allow-same-origin"></iframe></div>
      <button type="button" class="dz-replay">&#8635; Play it again</button></div>
    <div class="dz-side">
      <div><p class="dz-h"><span>Design</span><button type="button" class="dz-reset hidden">Back to the look as made</button></p>
        <div class="dz-tools" role="tablist" aria-label="What to change">${TOOLS.map(([id, label]) => `<button type="button" class="dz-tool" role="tab" data-tool="${id}">${label}</button>`).join('')}</div>
        <div class="dz-row dz-opts"></div><p class="dz-note dz-optnote"></p></div>
      <div><p class="dz-h">First line <small>optional</small></p><div class="dz-quick"></div><input class="dz-in dz-head" maxlength="${catalog.headlineMax || 40}" autocomplete="off" aria-label="First line of the cover"></div>
      ${photo ? '<div><p class="dz-h">Photo <small>optional</small></p><div class="dz-photo"><span class="th"></span><button type="button" class="dz-btn dz-addph"></button><button type="button" class="dz-btn quiet dz-rmph hidden">Remove</button><input type="file" accept="image/*" class="hidden dz-file"></div></div>' : ''}
      <div><p class="dz-h">Song</p><div class="dz-row dz-moods" role="group" aria-label="Kind of song"></div><div class="dz-songs" role="radiogroup" aria-label="Song"></div><p class="dz-note dz-songnote"></p></div>
    </div></div>`
  const $ = (s) => root.querySelector(s)
  const frame = $('iframe')
  const memorial = () => data().moment === 'memory'
  const current = () => value.design ? cleanDesign(value.design) : { ...(PRESETS[value.vibe] || PRESETS.postcard) }
  const quiet = (list) => (memorial() ? list.filter((o) => !o.loud) : list)

  let timer = null
  function preview(now) {
    clearTimeout(timer)
    timer = setTimeout(() => {
      frame.srcdoc = coverHtml({ ...data(), theme: value.vibe, design: value.design || null, headline: value.headline, photo: photo?.url() || null })
    }, now ? 0 : 300)
  }
  function fit() {
    const m = data().moment
    const looks = looksFor(catalog.vibes, m)
    if (!looks.some((v) => v.id === value.vibe)) value.vibe = looks[0]?.id || 'postcard'
    if (value.song && !songsFor(catalog.songs, m).some((s) => s.id === value.song)) value.song = null
    return looks
  }
  const swatch = (bg, ink, accent) => `<span class="sw" style="background:${bg}"><b style="color:${ink}">Aa</b><i style="background:${accent}"></i></span>`
  function drawTools() {
    const looks = fit(), d = current()
    root.querySelectorAll('.dz-tool').forEach((b) => b.setAttribute('aria-selected', b.dataset.tool === tool))
    $('.dz-reset').classList.toggle('hidden', !value.design)
    let html = '', note = ''
    if (tool === 'look') {
      html = looks.map((v) => { const s = LOOK_SWATCH[v.id] || { bg: '#eee', accent: '#999', ink: '#111' }; return `<button type="button" class="dz-look" data-look="${v.id}" aria-checked="${!value.design && v.id === value.vibe}">${swatch(s.bg, s.ink, s.accent)}<span>${esc(v.label)}</span></button>` }).join('')
      note = value.design ? 'You changed this one. Tap a look to start over from it.' : `Pick a starting point, then change any part with the tabs above.`
    } else if (tool === 'paper') {
      html = quiet(O.papers).map((p) => `<button type="button" class="dz-look" data-set="paper" data-v="${p.id}" aria-checked="${d.paper === p.id}">${swatch(p.bg, p.ink, p.bg)}<span>${esc(p.label)}</span></button>`).join('')
    } else if (tool === 'edge') {
      html = O.edges.map((x) => `<button type="button" class="dz-chip" data-set="edge" data-v="${x.id}" aria-pressed="${d.edge === x.id}">${esc(x.label)}</button>`).join('')
    } else if (tool === 'decor') {
      html = quiet(O.decor).map((x) => `<button type="button" class="dz-chip" data-decor="${x.id}" aria-pressed="${d.decor.includes(x.id)}">${esc(x.label)}</button>`).join('')
      note = `Up to ${O.maxDecor}. They sit around the edges, never over the name.`
    } else if (tool === 'fall') {
      html = (memorial() ? O.falls.filter((f) => f.id === 'none') : O.falls).map((x) => `<button type="button" class="dz-chip" data-set="fall" data-v="${x.id}" aria-pressed="${d.fall === x.id}">${esc(x.label)}</button>`).join('')
      if (memorial()) note = 'A memorial card stays still.'
    } else if (tool === 'type') {
      html = quiet(O.types).map((x) => `<button type="button" class="dz-chip font" data-set="type" data-v="${x.id}" aria-pressed="${d.type === x.id}" style="font-family:${x.font}" title="${esc(x.label)}">${esc(x.label)}</button>`).join('')
    } else if (tool === 'accent') {
      html = O.accents.map((x) => `<button type="button" class="dz-dot" data-set="accent" data-v="${x.id}" aria-pressed="${d.accent === x.id}" aria-label="${esc(x.label)}" title="${esc(x.label)}" style="background:${x.hex}"></button>`).join('')
      note = 'Used for the first line, the pill under the name and the little details.'
    }
    $('.dz-opts').innerHTML = html
    $('.dz-optnote').textContent = note
  }
  function setLayer(k, v) {
    const d = current()
    if (k === 'decor') { d.decor = d.decor.includes(v) ? d.decor.filter((x) => x !== v) : [...d.decor, v].slice(-O.maxDecor) }
    else d[k] = v
    value.design = d
    drawTools(); preview(true); onChange(value)
  }
  function drawQuick() {
    $('.dz-quick').innerHTML = quickLines(data().moment).map((t) => `<button type="button" data-line="${esc(t)}">${esc(t)}</button>`).join('')
  }
  function drawSongs() {
    const m = data().moment
    const list = songsFor(catalog.songs, m)
    const moods = catalog.moods.filter((x) => list.some((s) => s.mood === x.id))
    const auto = autoMood(m, value.vibe)
    if (!shownMood) shownMood = value.song ? list.find((s) => s.id === value.song)?.mood : 'auto'
    $('.dz-moods').innerHTML = `<button type="button" class="dz-chip" data-mood="auto" aria-pressed="${shownMood === 'auto'}">We'll pick</button>` +
      moods.map((x) => `<button type="button" class="dz-chip" data-mood="${x.id}" aria-pressed="${shownMood === x.id}">${esc(x.label)}</button>`).join('')
    const autoLabel = catalog.moods.find((x) => x.id === auto)?.label || 'gentle'
    if (shownMood === 'auto') {
      $('.dz-songs').innerHTML = `<button type="button" class="dz-song" role="radio" data-song="" aria-checked="${!value.song}"><span class="pl" data-play="${list.find((s) => s.mood === auto)?.id || ''}">${PLAY}</span><span class="nm">A ${esc(autoLabel.toLowerCase())} song that suits it</span><span class="ck">&#10003;</span></button>`
      $('.dz-songnote').textContent = 'Tap a kind of song above to choose one yourself.'
    } else {
      $('.dz-songs').innerHTML = list.filter((s) => s.mood === shownMood).map((s) => `<button type="button" class="dz-song" role="radio" data-song="${s.id}" aria-checked="${value.song === s.id}"><span class="pl ${playing === s.id ? 'on' : ''}" data-play="${s.id}">${playing === s.id ? STOP : PLAY}</span><span class="nm">${esc(s.label)}</span><span class="ck">&#10003;</span></button>`).join('')
      $('.dz-songnote').textContent = 'It plays softly under everyone, never over a voice.'
    }
  }
  function drawPhoto() {
    if (!photo) return
    const u = photo.url()
    $('.dz-photo .th').style.backgroundImage = u ? `url("${u}")` : ''
    $('.dz-addph').textContent = u ? 'Change photo' : `Add a photo of ${data().first || 'them'}`
    $('.dz-rmph').classList.toggle('hidden', !u)
  }
  function stop() { audio.pause(); playing = null }
  function play(id) {
    if (!id) return
    if (playing === id) { stop(); drawSongs(); return }
    audio.src = `/music/${id}.mp3`; audio.currentTime = 0
    audio.play().catch(() => {}); playing = id; drawSongs()
  }
  audio.addEventListener('ended', () => { playing = null; drawSongs() })

  root.addEventListener('click', async (e) => {
    const t = e.target.closest('.dz-tool'); if (t) { tool = t.dataset.tool; drawTools(); return }
    const look = e.target.closest('[data-look]')
    if (look) { value.vibe = look.dataset.look; value.design = null; drawTools(); if (shownMood === 'auto') drawSongs(); preview(true); onChange(value); return }
    const set = e.target.closest('[data-set]'); if (set) { setLayer(set.dataset.set, set.dataset.v); return }
    const dec = e.target.closest('[data-decor]'); if (dec) { setLayer('decor', dec.dataset.decor); return }
    if (e.target.closest('.dz-reset')) { value.design = null; drawTools(); preview(true); onChange(value); return }
    const line = e.target.closest('[data-line]'); if (line) { value.headline = line.dataset.line; $('.dz-head').value = value.headline; preview(true); onChange(value); return }
    const mood = e.target.closest('[data-mood]')
    if (mood) { shownMood = mood.dataset.mood; if (shownMood === 'auto') { value.song = null; onChange(value) } drawSongs(); return }
    const pl = e.target.closest('[data-play]')
    const song = e.target.closest('.dz-song')
    if (song) {
      const id = song.dataset.song || null
      if (pl && !id) { play(pl.dataset.play); return }
      if (value.song !== id) { value.song = id; onChange(value) }
      if (id && (pl || playing !== id)) play(id); else drawSongs()
      return
    }
    if (e.target.closest('.dz-replay')) { preview(true); return }
    if (e.target.closest('.dz-addph')) { $('.dz-file').click(); return }
    if (e.target.closest('.dz-rmph')) { await photo.remove(); drawPhoto(); preview(true); return }
  })
  $('.dz-head').addEventListener('input', (e) => { value.headline = e.target.value; preview(); onChange(value) })
  if (photo) $('.dz-file').addEventListener('change', async (e) => {
    const f = e.target.files?.[0]; e.target.value = ''
    if (!f) return
    $('.dz-addph').textContent = 'Adding...'
    try { await photo.add(f) } finally { drawPhoto(); preview(true) }
  })

  function refresh() {
    $('.dz-head').value = value.headline || ''
    $('.dz-head').placeholder = HEADLINES[data().moment] || 'A card for'
    drawTools(); drawQuick(); drawSongs(); drawPhoto(); preview(true)
  }
  refresh()
  return { refresh, stop }
}

// shrink a phone photo to about 1000 px before it goes anywhere (fast uploads, nothing huge stored)
export async function shrinkPhoto(file, max = 1000) {
  const img = await createImageBitmap(file)
  const s = Math.min(1, max / Math.max(img.width, img.height))
  const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s)
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
  return new Promise((r) => c.toBlob(r, 'image/jpeg', 0.86))
}
