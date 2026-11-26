// churpie stitcher · one Node file + FFmpeg. No database, no R2 keys: it talks to the app with one shared secret.
// Runs anywhere: Cloudflare Containers, Fly, a $5 VPS, or a laptop during the MVP.
//
//   APP_URL=https://app.churpie.me STITCH_TOKEN=... node stitch.js          # poll forever
//   node stitch.js --once                                                   # one job, then exit (containers / cron)
//   node stitch.js --local job.json out.mp4                                 # offline test with local files

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'
import { COVER_SECONDS, END_SECONDS, coverSeconds } from './cover.js'
import { renderFrames, openPainter, WINDOWS } from './render.js'

const run = promisify(execFile)
// FFmpeg: use the system one if installed, otherwise the copy npm brought (ffmpeg-static / ffprobe-static). No Homebrew needed.
import { createRequire } from 'node:module'
const require_ = createRequire(import.meta.url)

// The short name used everywhere a card speaks about its person: "Rosa Garcia" is Rosa, "Rosa and Sam Lee" is
// Rosa & Sam, "Aunt Rosa" and "The Garcias" stay whole. A list with commas is kept as typed.
const NAME_LEAD = /^(the|aunt|auntie|uncle|grandma|grandpa|granny|nana|papa|mama|dr\.?|mr\.?|mrs\.?|ms\.?|miss|coach|pastor|father|sister|brother|professor|prof\.?|tía|tia|tío|tio|abuela|abuelo)$/i
const oneName = (t) => { const w = t.split(' '); return w.length > 1 && NAME_LEAD.test(w[0]) ? `${w[0]} ${w[1]}` : w[0] }
function shortName(s) {
  const t = String(s || '').trim().replace(/\s+/g, ' ')
  if (!t) return ''
  if (t.includes(',')) return t.slice(0, 40)
  const pair = t.split(/ (?:&|\+|and) /i)
  if (pair.length === 2 && pair[0] && pair[1]) return `${oneName(pair[0])} & ${oneName(pair[1])}`
  return oneName(t)
}
function bin(name, pkg, pick) {
  if (process.env[name.toUpperCase() + '_PATH']) return process.env[name.toUpperCase() + '_PATH']
  try { const p = pick(require_(pkg)); if (p && fs.existsSync(p)) return p } catch {}
  return name
}
const FFMPEG = bin('ffmpeg', 'ffmpeg-static', (m) => m)
const FFPROBE = bin('ffprobe', 'ffprobe-static', (m) => m.path)
const HERE = path.dirname(fileURLToPath(import.meta.url))
const APP_URL = process.env.APP_URL?.replace(/\/$/, '')
const TOKEN = process.env.STITCH_TOKEN
const POLL_MS = Number(process.env.POLL_SECONDS || 20) * 1000
const W = 720, H = 1280, FPS = 30
const PAPER = '0xF5F0E8', INK = '0x1A1410', PINK = '0xD4266A'

const THEME_BG = { postcard: '0xF5F0E8', airmail: '0xF7F3EA', quietnote: '0xF3EFE6', kraft: '0xC9A678', confettipop: '0xFFF8EE', lockernote: '0xFBFBF9', milestonegold: '0x15120F', pressedflower: '0xF6F2EA' }
// Music is picked by mood, and each mood has a few tracks (stitcher/music/<mood>-<n>.mp3). The occasion decides
// first (a wedding gets a slow dance, a new baby a lullaby), then the card theme, then the vibe. Within a mood the
// card's id picks the track, so different cards get different tracks but one card always sounds the same if remade.
// Drop a new <mood>-<n>.mp3 in the folder (made with prepare.sh) and it joins the rotation; no code change needed.
const MOMENT_MOOD = { holiday: 'holiday', newyear: 'celebration', baby: 'lullaby', wedding: 'slowdance', anniversary: 'slowdance', memory: 'reflective', getwell: 'everyday', missyou: 'everyday' }
const THEME_MOOD = { postcard: 'celebration', confettipop: 'celebration', lockernote: 'beat', airmail: 'everyday', kraft: 'everyday', milestonegold: 'everyday', quietnote: 'reflective', pressedflower: 'reflective' }
const VIBE_MOOD = { confetti: 'celebration', golden: 'everyday', hype: 'beat', softlight: 'reflective', candle: 'reflective' }
function pickMusic(job, theme) {
  if (job.song && /^[a-z]+-[a-z0-9]+$/.test(job.song) && fs.existsSync(path.join(HERE, 'music', `${job.song}.mp3`))) return job.song
  const mood = (job.moment === 'memory' || theme === 'pressedflower') ? 'reflective'
    : MOMENT_MOOD[job.moment] || THEME_MOOD[theme] || VIBE_MOOD[job.vibe] || 'everyday'
  const dir = path.join(HERE, 'music')
  const all = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^[a-z]+-[a-z0-9]+\.mp3$/.test(f)).sort() : []
  const pool = all.filter((f) => f.startsWith(`${mood}-`))
  const list = pool.length ? pool : all.filter((f) => f.startsWith('everyday-'))
  if (!list.length) return null
  let h = 0
  for (const ch of String(job.cardId || job.token || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return list[h % list.length].replace(/\.mp3$/, '')
}
const VIBE_PAPER = { confetti: '0xF5F0E8', golden: '0xFAEEDA', hype: '0x1A1410', softlight: '0xE8F4F6', candle: '0x1A1410' }
const VIBE_INK = { confetti: INK, golden: INK, hype: '0xF5F0E8', softlight: INK, candle: '0xF5F0E8' }

function firstExisting(paths) { return paths.find((p) => fs.existsSync(p)) || null }
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a)

// ─────────────────────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────────────────────
const headers = { authorization: `Bearer ${TOKEN}` }

async function claimJob() {
  const r = await fetch(`${APP_URL}/api/stitch/next`, { method: 'POST', headers })
  if (!r.ok) throw new Error(`claim failed: ${r.status}`)
  return (await r.json()).job
}
async function download(key, dest) {
  const r = await fetch(`${APP_URL}/api/stitch/object?key=${encodeURIComponent(key)}`, { headers })
  if (!r.ok) throw new Error(`download ${key}: ${r.status}`)
  await pipeline(Readable.fromWeb(r.body), fs.createWriteStream(dest))
}
async function postFlags(clipId, flags, duration) {
  await fetch(`${APP_URL}/api/stitch/flags/${clipId}`, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ flags, duration }) }).catch(() => {})
}
async function uploadFinal(cardId, file, manifest, variant = null) {
  const r = await fetch(`${APP_URL}/api/stitch/final/${cardId}${variant ? `?variant=${variant}` : ''}`, {
    method: 'PUT',
    headers: { ...headers, 'content-type': 'video/mp4', 'x-churpie-manifest': encodeURIComponent(JSON.stringify(manifest)), 'content-length': String(fs.statSync(file).size) },
    body: fs.createReadStream(file),
    duplex: 'half',
  })
  if (!r.ok) throw new Error(`upload final: ${r.status} ${await r.text()}`)
  return r.json()
}
async function markFailed(cardId, error) {
  await fetch(`${APP_URL}/api/stitch/failed/${cardId}`, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ error }) }).catch(() => {})
}

// ─────────────────────────────────────────────────────────────────────────────
// FFmpeg helpers
// ─────────────────────────────────────────────────────────────────────────────
async function ffmpeg(args, timeoutMs = 5 * 60 * 1000) {
  try { await run(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', ...args], { timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 }) }
  catch (e) { throw new Error(`ffmpeg: ${(e.stderr || e.message).toString().slice(-600)}`) }
}
async function probe(file) {
  const { stdout } = await run(FFPROBE, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file])
  const j = JSON.parse(stdout)
  const v = j.streams.find((s) => s.codec_type === 'video')
  const a = j.streams.find((s) => s.codec_type === 'audio')
  const rot = Number(v?.side_data_list?.find((d) => d.rotation !== undefined)?.rotation || v?.tags?.rotate || 0)
  return { duration: Number(j.format?.duration || v?.duration || 0), hasAudio: !!a, width: v?.width, height: v?.height, rotation: rot }
}

// Cheap quality signals, all from one analysis pass. These become the host's "to check" flags.
async function analyze(file, info) {
  const flags = []
  if (info.duration < 3) flags.push('short')
  let meanVol = null, blackSec = 0
  try {
    const { stderr } = await run(FFMPEG, ['-hide_banner', '-i', file, '-t', '40', '-vf', 'blackdetect=d=1:pix_th=0.10', '-af', 'volumedetect', '-f', 'null', '-'], { maxBuffer: 16 * 1024 * 1024 })
    const m = /mean_volume:\s*(-?[\d.]+) dB/.exec(stderr); if (m) meanVol = Number(m[1])
    for (const b of stderr.matchAll(/black_duration:([\d.]+)/g)) blackSec += Number(b[1])
  } catch {}
  if (!info.hasAudio || (meanVol !== null && meanVol < -38)) flags.push('quiet')
  if (info.duration > 0 && blackSec / info.duration > 0.6) flags.push('dark')
  const speech = info.hasAudio ? await speechSpan(file, info.duration, meanVol).catch(() => null) : null
  return { flags, meanVol, speech }
}

// Dead air: most phone videos start with a second or three of the person getting ready, and end with them reaching
// for the stop button. Find where talking starts and stops and keep just that, with a little room either side.
// The silence threshold follows each clip's own loudness, so a quiet speaker isn't mistaken for silence.
// Nothing is cut when the result would look wrong: no clear speech, or under a third of the clip left.
const LEAD_ROOM = 0.25, TAIL_ROOM = 0.5
async function speechSpan(file, duration, meanVol) {
  if (!duration || duration < 2.5 || meanVol === null || meanVol < -50) return null
  const floor = Math.max(-55, Math.min(-28, meanVol - 14))
  const { stderr } = await run(FFMPEG, ['-hide_banner', '-i', file, '-vn', '-af', `silencedetect=n=${floor}dB:d=0.5`, '-f', 'null', '-'], { maxBuffer: 16 * 1024 * 1024 })
  const quiet = []
  for (const line of String(stderr).split('\n')) {
    const a = /silence_start:\s*(-?[\d.]+)/.exec(line); if (a) quiet.push({ from: Math.max(0, Number(a[1])), to: duration })
    const b = /silence_end:\s*([\d.]+)/.exec(line); if (b && quiet.length) quiet[quiet.length - 1].to = Number(b[1])
  }
  const lead = quiet.find((q) => q.from <= 0.05)
  const tail = [...quiet].reverse().find((q) => q.to >= duration - 0.05 && q !== lead)
  const start = lead ? Math.max(0, lead.to - LEAD_ROOM) : 0
  const end = tail ? Math.min(duration, tail.from + TAIL_ROOM) : duration
  if (end - start < Math.max(1.2, duration * 0.3)) return null
  if (start < 0.3 && duration - end < 0.3) return null
  return { start: Math.round(start * 100) / 100, end: Math.round(end * 100) / 100 }
}

const esc = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\u2019").replace(/:/g, '\\:').replace(/%/g, '%%').replace(/\[/g, '\\[').replace(/\]/g, '\\]')
function wrap(text, max = 26) {
  const words = String(text).split(/\s+/); const lines = []; let cur = ''
  for (const w of words) { if ((cur + ' ' + w).trim().length > max) { lines.push(cur.trim()); cur = w } else cur += ' ' + w }
  if (cur.trim()) lines.push(cur.trim()); return lines
}
const stripe = `drawbox=x=0:y=0:w=iw:h=10:color=${PINK}:t=fill`

// Normalize one clip: 720x1280 filled edge to edge (sideways videos trimmed at the sides), 30fps, trimmed, EBU R128 loudness, name sticker, silent track if the phone gave none.
// Audio glue: every room sounds different, so each clip gets the same gentle treatment before it meets the others:
//   rumble and hiss filtered out, light noise reduction (hum, fridge, traffic), one loudness, and soft 0.12 s / 0.18 s edges
//   so room sound never snaps on or off between people. The music bed underneath covers what's left.
async function normalizeClip(src, dst, { seconds, hasAudio, duration, sticker, speech = null }) {
  const span = speech ? speech.end - speech.start : duration
  const out = Math.max(0.5, Math.min(span || seconds + 1, seconds + 1))
  const glue = `highpass=f=80,lowpass=f=12000,afftdn=nr=10:nf=-40:tn=1,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000,afade=t=in:st=0:d=0.12,afade=t=out:st=${(out - 0.18).toFixed(2)}:d=0.18`
  // every message fills the vertical card edge to edge, like a story: a sideways video is trimmed at the sides
  // (centred) rather than shown small between bands, so a reel never mixes wide and tall people
  const vf = [
    `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}[base]`,
    `[base][1:v]overlay=0:0,fps=${FPS},format=yuv420p[v]`,
  ].join(';')
  const audioIn = hasAudio ? '[0:a]' : '[2:a]'
  const extra = hasAudio ? [] : ['-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo']
  await ffmpeg([
    ...(speech?.start ? ['-ss', String(speech.start)] : []), '-i', src, '-i', sticker, ...extra,
    '-filter_complex', `${vf};${audioIn}${glue}[a]`,
    '-map', '[v]', '-map', '[a]', '-t', out.toFixed(2),
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2', '-movflags', '+faststart', dst,
  ])
}

// A still card (title, written message, end card): painted as a PNG in churpie's fonts, held for a few seconds, silent.
async function makeCard(dst, png, seconds) {
  await ffmpeg([
    '-loop', '1', '-framerate', String(FPS), '-i', png,
    '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo',
    '-vf', `scale=${W}:${H},fps=${FPS},format=yuv420p`, '-t', String(seconds),
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-tune', 'stillimage', '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2', '-movflags', '+faststart', dst,
  ])
}

// The cover: filmed frames (render.js) into a clip, silent; the music starts under it.
async function makeCover(dst, pattern, seconds = COVER_SECONDS) {
  await ffmpeg([
    '-framerate', String(FPS), '-i', pattern, '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo',
    '-vf', `scale=${W}:${H},format=yuv420p`, '-t', String(seconds),
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2', '-movflags', '+faststart', dst,
  ])
}
const dataUrl = (file) => {
  const b = fs.readFileSync(file)
  const type = b[0] === 0x89 ? 'image/png' : b[0] === 0x52 && b[8] === 0x57 ? 'image/webp' : 'image/jpeg'
  return `data:${type};base64,${b.toString('base64')}`
}

// A note is never a frozen frame: it drifts in very slowly (about 4% over its time on screen).
async function makeDrift(dst, png, seconds) {
  const frames = Math.round(seconds * FPS)
  await ffmpeg([
    '-i', png, '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo',
    '-filter_complex', `[0:v]scale=${W * 2}:${H * 2},zoompan=z='1+0.04*on/${frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=${FPS},format=yuv420p[v]`,
    '-map', '[v]', '-map', '1:a', '-t', String(seconds),
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2', '-movflags', '+faststart', dst,
  ])
}
// one still frame from a finished clip: its last moment (the note after them) or its first (the note before them)
async function grabFrame(src, dst, atEnd) {
  await ffmpeg([...(atEnd ? ['-sseof', '-0.4'] : ['-ss', '0.3']), '-i', src, '-frames:v', '1', '-q:v', '4', dst]).catch(() => {})
  return fs.existsSync(dst) ? dst : null
}
// time on screen follows the note: about 3 seconds plus reading time, never under 4 or over 9
const readSeconds = (text) => Math.min(9, Math.max(4, 3 + String(text || '').trim().split(/\s+/).length * 0.3))

// Concat, loop the music under it with ducking so voices always win, stamp the watermark. One encode.
async function finalize(parts, dst, { music, withMusic, markFrom = null, markTo = null }) {
  const list = path.join(path.dirname(dst), 'concat.txt')
  fs.writeFileSync(list, parts.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'))
  const wm = firstExisting([path.join(HERE, 'assets/watermark.png')])
  const musicFile = withMusic ? firstExisting([path.join(HERE, `music/${music}.mp3`)]) : null
  const inputs = ['-f', 'concat', '-safe', '0', '-i', list]
  let fc = '', mapA = '0:a', mapV = '0:v'
  if (musicFile) {
    inputs.push('-stream_loop', '-1', '-i', musicFile)
    // Voices are the point; the music only holds things together. Every voice clip is first evened out to -16 LUFS
    // (see glue above), so quiet and loud people come out alike. Every music file is prepared to -18 LUFS
    // (stitcher/music/prepare.sh), held steady start to finish so a build-up never climbs over anyone. Against that:
    //   nobody talking (title, end card, between people): music ~11 dB under the voices, a soft bed, not a track
    //   someone talking: it ducks to ~28 dB under (accessibility guidance asks for at least 20), felt rather than
    //   heard, and stays down between sentences (0.9 s release) so it doesn't pump up in every pause.
    // (Nov 2026 history: ~4 dB under, then ~8 dB under; lowered again so it never reads as a music video.)
    fc += `[1:a]volume=0.35,afade=t=in:st=0:d=1,aresample=48000[m];[0:a]asplit=2[voice][key];[m][key]sidechaincompress=threshold=0.015:ratio=5:attack=20:release=900:makeup=1[duck];[voice][duck]amix=inputs=2:duration=first:dropout_transition=2:normalize=0[a]`
    mapA = '[a]'
  }
  if (wm) {
    inputs.push('-i', wm)
    const wmIdx = musicFile ? 2 : 1
    // the faint corner mark only shows between the cover and the end, which carry the name themselves
    const when = markFrom !== null && markTo > markFrom ? `:enable='between(t,${markFrom},${markTo})'` : ''
    fc += (fc ? ';' : '') + `[${wmIdx}:v]colorchannelmixer=aa=0.18[wm];[0:v][wm]overlay=W-w-16:H-h-16${when}[v]`
    mapV = '[v]'
  }
  await ffmpeg([...inputs, ...(fc ? ['-filter_complex', fc] : []), '-map', mapV, '-map', mapA, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', '-shortest', dst], 15 * 60 * 1000)
}


// Put the inner reel inside a rendered card frame. The frame PNG sits on top, so its rounded window hides the video's corners.
async function frameReel(inner, framePng, dst, size, theme) {
  const g = WINDOWS[size]
  const bg = THEME_BG[theme] || PAPER
  await ffmpeg([
    '-i', inner, '-i', framePng,
    '-filter_complex', `color=c=${bg}:s=${g.W}x${g.H}:r=${FPS}[bg];[0:v]scale=${g.w}:${g.h}:flags=lanczos[reel];[bg][reel]overlay=${g.x}:${g.y}:shortest=1[a];[a][1:v]overlay=0:0:format=auto,format=yuv420p[v]`,
    // quality-first (crf 21), but never above ~2.5 Mbps, so a reel stays about 19 MB a minute at most
    '-map', '[v]', '-map', '0:a', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-maxrate', '2500k', '-bufsize', '5000k', '-c:a', 'copy', '-movflags', '+faststart', dst,
  ], 15 * 60 * 1000)
}

// ─────────────────────────────────────────────────────────────────────────────
// One job
// ─────────────────────────────────────────────────────────────────────────────
export async function stitch(job, { fetchClip, outFile, wideFile = null, shortFile = null, onFlags = async () => {} }) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `churpie-${job.cardId}-`))
  const painter = await openPainter()
  const theme = job.theme || 'postcard'
  const png = (n) => path.join(tmp, `${n}.png`)
  try {
    const first = shortName(job.recipientName)
    const parts = [], manifest = []
    let t = 0
    const push = async (file, meta) => { const { duration } = await probe(file); parts.push(file); manifest.push({ ...meta, start: round(t), end: round(t + duration) }); t += duration }

    // 1. the cover is made last (step 5), once the first face is known: it lifts away to reveal them

    // 2. the host's own voice, if they recorded one
    if (job.introKey) {
      const raw = path.join(tmp, 'intro-raw'), norm = path.join(tmp, 'intro.mp4')
      await fetchClip(job.introKey, raw)
      const info = await probe(raw)
      const { speech } = await analyze(raw, info)
      await normalizeClip(raw, norm, { speech, seconds: 20, hasAudio: info.hasAudio, duration: info.duration, sticker: await painter.sticker(job.hostName, null, png('intro-sticker')) })
      await push(norm, { kind: 'intro', name: job.hostName, clipId: null })
    }

    // 3a. every video first, so a written note can borrow the colors of the person next to it
    const items = []
    let i = 0
    for (const clip of job.clips) {
      i++
      if (clip.kind === 'text') { items.push({ clip }); continue }
      const norm = path.join(tmp, `clip-${i}.mp4`), raw = path.join(tmp, `clip-${i}-raw`)
      log(`[${job.cardId}] clip ${i}/${job.clips.length} ${clip.name}`)
      await fetchClip(clip.key, raw)
      const info = await probe(raw)
      const { flags, speech } = await analyze(raw, info)
      await onFlags(clip.id, flags, info.duration)
      if (speech) log(`[${job.cardId}]   trimmed to ${speech.start}s-${speech.end}s of ${info.duration.toFixed(1)}s`)
      await normalizeClip(raw, norm, { speech, seconds: job.clipSeconds, hasAudio: info.hasAudio, duration: info.duration, sticker: await painter.sticker(clip.name, clip.location, png(`sticker-${i}`)) })
      items.push({ clip, norm, flags })
      fs.rmSync(raw, { force: true })
    }

    // 3b. the host's order. A note is taped over a blur of the person before it (or after it, if it opens the reel);
    //     notes in a row become one "A few words for Rosa" moment, taped on one at a time, three to a screen.
    const memory = job.moment === 'memory'
    let k = 0, n = 0
    while (k < items.length) {
      const it = items[k]
      if (it.norm) { await push(it.norm, { kind: 'video', name: it.clip.name, location: it.clip.location, clipId: it.clip.id, flags: it.flags }); k++; continue }
      const run = []
      while (k < items.length && !items[k].norm) run.push(items[k++].clip)
      const before = [...items.slice(0, k - run.length)].reverse().find((x) => x.norm), after = items.slice(k).find((x) => x.norm)
      const bg = before ? await grabFrame(before.norm, png(`bg-${k}`).replace('.png', '.jpg'), true) : after ? await grabFrame(after.norm, png(`bg-${k}`).replace('.png', '.jpg'), false) : null
      const look = { bg, theme }
      if (run.length === 1) {
        const c = run[0], dst = path.join(tmp, `note-${++n}.mp4`)
        await makeDrift(dst, await painter.note('one', { text: c.text, name: c.name, location: c.location, memory }, look, png(`note-${n}`)), readSeconds(c.text))
        await push(dst, { kind: 'text', name: c.name, location: c.location, clipId: c.id })
        continue
      }
      for (let g = 0; g < run.length; g += 3) {
        const group = run.slice(g, g + 3)
        for (let j = 0; j < group.length; j++) {
          const c = group[j], dst = path.join(tmp, `note-${++n}.mp4`)
          const shown = group.slice(0, j + 1).map((x) => ({ text: x.text, name: x.name, location: x.location }))
          await makeCard(dst, await painter.note('wall', { notes: shown, first, memory }, look, png(`note-${n}`)), readSeconds(c.text))
          await push(dst, { kind: 'text', name: c.name, location: c.location, clipId: c.id })
        }
      }
    }

    // 4. the end: everyone's faces fill in, in the card's look. A face is a still from the middle of their video;
    //    someone who wrote a note gets their initial. If it goes wrong, the plain end card from before stands in.
    const end = path.join(tmp, 'end.mp4')
    try {
      const faces = []
      for (const [k, it] of items.entries()) {
        let img = null
        if (it.norm) {
          const f = path.join(tmp, `face-${k}.jpg`)
          await ffmpeg(['-ss', '1.2', '-i', it.norm, '-frames:v', '1', '-vf', 'crop=iw:iw:0:(ih-iw)/2,scale=240:240', '-q:v', '5', f]).catch(() => {})
          if (fs.existsSync(f)) img = dataUrl(f)
        }
        faces.push({ name: it.clip.name, img })
      }
      const dir = path.join(tmp, 'end-frames'); fs.mkdirSync(dir)
      await makeCover(end, await painter.end({ theme, design: job.design || null, moment: job.moment, first, n: job.clips.length, faces }, dir), END_SECONDS)
    } catch (err) {
      log(`[${job.cardId}] end failed, using the plain end card: ${err.message}`)
      await makeCard(end, await painter.card('end', { n: job.clips.length, first, memory: job.moment === 'memory' }, theme, png('end')), 5)
    }
    await push(end, { kind: 'end', name: 'churpie', clipId: null })

    // 5. the cover, put in front: the card's front, full screen, with their name, then the question, then it lifts
    //    away onto the first face. If anything about it goes wrong, the plain title card from before stands in.
    {
      const cover = path.join(tmp, 'cover.mp4')
      try {
        const frames = path.join(tmp, 'cover-frames'); fs.mkdirSync(frames)
        let photo = null
        if (job.photoKey) { const f = path.join(tmp, 'cover-photo'); await fetchClip(job.photoKey, f); photo = dataUrl(f) }
        const still = parts[0] ? await grabFrame(parts[0], path.join(tmp, 'cover-next.jpg'), false) : null
        log(`[${job.cardId}] cover (${theme})`)
        await makeCover(cover, await painter.cover({ theme, design: job.design || null, moment: job.moment, first, headline: job.headline, host: job.hostName, n: job.clips.length, prompt: job.prompt, photo, next: still ? dataUrl(still) : null }, frames), coverSeconds(job.prompt))
      } catch (err) {
        log(`[${job.cardId}] cover failed, using the title card: ${err.message}`)
        await makeCard(cover, await painter.card('title', { first, host: job.hostName, n: job.clips.length, prompt: job.prompt }, theme, png('title')), 4)
      }
      const { duration: cd } = await probe(cover)
      for (const m of manifest) { m.start = round(m.start + cd); m.end = round(m.end + cd) }
      parts.unshift(cover); manifest.unshift({ kind: 'title', name: 'churpie', clipId: null, start: 0, end: round(cd) }); t += cd
    }

    // 6. weave
    log(`[${job.cardId}] weaving ${parts.length} parts, ${Math.round(t)}s`)
    const inner = path.join(tmp, 'inner.mp4')
    const music = pickMusic(job, theme)
    log(`[${job.cardId}] music: ${music || 'none'}`)
    const last = manifest[manifest.length - 1]
    await finalize(parts, inner, { music, withMusic: !!music, markFrom: manifest[0]?.end ?? null, markTo: last?.kind === 'end' ? last.start : null })
    // 6b. the share cut: a reel past a minute is too long for a Story or most Reels, so a ~45 s version goes with it:
    //     the cover, a few seconds of up to 14 people (spread across the reel, starting as they start talking), the end.
    //     It's the one people post, so it's the one that brings the next card in.
    if (shortFile && t > 60 && last?.kind === 'end') {
      try {
        const vids = items.filter((it) => it.norm)
        const coverDur = manifest[0].end, endDur = last.end - last.start
        const k = Math.min(vids.length, 14)
        const each = Math.max(1.6, Math.min(3.4, (45 - coverDur - endDur) / Math.max(1, k)))
        const picks = Array.from({ length: k }, (_, i) => vids[Math.floor((i * vids.length) / k)])
        const cuts = []
        for (const [i, it] of picks.entries()) {
          const dst = path.join(tmp, `cut-${i}.mp4`)
          await ffmpeg(['-ss', '0.2', '-i', it.norm, '-t', each.toFixed(2),
            '-af', `afade=t=in:d=0.08,afade=t=out:st=${(each - 0.25).toFixed(2)}:d=0.25`,
            '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2', '-movflags', '+faststart', dst])
          cuts.push(dst)
        }
        const shortTotal = coverDur + cuts.length * each + endDur
        log(`[${job.cardId}] share cut: ${cuts.length} people, ${Math.round(shortTotal)}s`)
        await finalize([parts[0], ...cuts, parts.at(-1)], shortFile, { music, withMusic: !!music, markFrom: coverDur, markTo: shortTotal - endDur })
      } catch (err) { log(`[${job.cardId}] share cut skipped: ${err.message}`); fs.rmSync(shortFile, { force: true }) }
    }
    // 7. the phone reel is the reel itself, edge to edge, the way Stories and Reels play: the cover and the end carry
    //    the card's look. (STORY_FRAME=1 brings back the old card border around it.) The wide export still gets its frame.
    const framed = process.env.STORY_FRAME === '1'
    const frames = framed || wideFile ? (log(`[${job.cardId}] card frames (${theme})`), await renderFrames({ ...job, theme, totalSeconds: t }, tmp)) : null
    if (framed) await frameReel(inner, frames.story, outFile, 'story', theme)
    else fs.copyFileSync(inner, outFile)
    if (wideFile) { log(`[${job.cardId}] wide card`); await frameReel(inner, frames.wide, wideFile, 'wide', theme) }
    return manifest
  } finally {
    await painter.close().catch(() => {})
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}
const round = (x) => Math.round(x * 100) / 100

// ─────────────────────────────────────────────────────────────────────────────
// Modes
// ─────────────────────────────────────────────────────────────────────────────
export async function processOne() {
  const job = await claimJob()
  if (!job) return false
  log(`[${job.cardId}] claimed · ${job.clips.length} clips for ${job.recipientName}`)
  const out = path.join(os.tmpdir(), `churpie-${job.cardId}-reel.mp4`)
  // one reel per card: computers show it inside the card frame on the watch page. The wide (16:9) export
  // doubled render time and storage, so it only happens when WIDE_REEL=1 is set on the reel maker.
  const wide = process.env.WIDE_REEL === '1' ? path.join(os.tmpdir(), `churpie-${job.cardId}-reel-wide.mp4`) : null
  const short = path.join(os.tmpdir(), `churpie-${job.cardId}-reel-short.mp4`)
  try {
    const manifest = await stitch(job, { fetchClip: download, outFile: out, wideFile: wide, shortFile: short, onFlags: postFlags })
    // the extras first, so the card only turns "ready" once every file exists
    if (wide && fs.existsSync(wide)) await uploadFinal(job.cardId, wide, manifest, 'wide')
    if (fs.existsSync(short)) await uploadFinal(job.cardId, short, manifest, 'short')
    const r = await uploadFinal(job.cardId, out, manifest)
    log(`[${job.cardId}] done → ${r.watch}`)
  } catch (e) {
    log(`[${job.cardId}] FAILED ${e.message}`)
    await markFailed(job.cardId, e.message)
  } finally { fs.rmSync(out, { force: true }); fs.rmSync(short, { force: true }); if (wide) fs.rmSync(wide, { force: true }) }
  return true
}

const argv = process.argv.slice(2)
if (argv[0] === '--local') {
  // offline: node stitch.js --local job.json out.mp4   (job.clips[].key are local file paths)
  const job = JSON.parse(fs.readFileSync(argv[1], 'utf8'))
  const manifest = await stitch(job, { fetchClip: async (key, dest) => fs.copyFileSync(key, dest), outFile: argv[2], wideFile: argv[2].replace(/\.mp4$/, '-wide.mp4'), shortFile: argv[2].replace(/\.mp4$/, '-short.mp4'), onFlags: async (id, flags, d) => log(`  flags ${id}: ${flags.join(',') || 'none'} (${d.toFixed(1)}s)`) })
  fs.writeFileSync(argv[2] + '.manifest.json', JSON.stringify(manifest, null, 2))
  log('wrote', argv[2])
} else if (import.meta.url === `file://${process.argv[1]}`) {
  if (!APP_URL || !TOKEN) { console.error('Set APP_URL and STITCH_TOKEN'); process.exit(1) }
  if (argv[0] === '--once') { await processOne(); process.exit(0) }
  log(`churpie stitcher · polling ${APP_URL} every ${POLL_MS / 1000}s`)
  for (;;) {
    try { const did = await processOne(); if (!did) await new Promise((r) => setTimeout(r, POLL_MS)) }
    catch (e) { log('poll error', e.message); await new Promise((r) => setTimeout(r, POLL_MS)) }
  }
}
