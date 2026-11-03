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
import { renderFrames, WINDOWS } from './render.js'

const run = promisify(execFile)
// FFmpeg: use the system one if installed, otherwise the copy npm brought (ffmpeg-static / ffprobe-static). No Homebrew needed.
import { createRequire } from 'node:module'
const require_ = createRequire(import.meta.url)
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
const FONT = process.env.FONT_FILE || firstExisting(['/usr/share/fonts/truetype/nunito/Nunito-ExtraBold.ttf', path.join(HERE, 'fonts/Nunito-ExtraBold.ttf'), '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf'])
const W = 720, H = 1280, FPS = 30
const PAPER = '0xF5F0E8', INK = '0x1A1410', PINK = '0xD4266A'

const THEME_BG = { postcard: '0xF5F0E8', airmail: '0xF7F3EA', quietnote: '0xF3EFE6', kraft: '0xC9A678', confettipop: '0xFFF8EE', lockernote: '0xFBFBF9', milestonegold: '0x15120F', pressedflower: '0xF6F2EA' }
const THEME_MUSIC = { postcard: 'uplifting', airmail: 'warm-acoustic', quietnote: 'gentle-piano', kraft: 'warm-acoustic', confettipop: 'uplifting', lockernote: 'uplifting', milestonegold: 'warm-acoustic', pressedflower: 'gentle-piano' }
const VIBE_MUSIC = { confetti: 'uplifting', golden: 'warm-acoustic', hype: 'uplifting', softlight: 'gentle-piano', candle: 'gentle-piano' }
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
  return { flags, meanVol }
}

const esc = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\u2019").replace(/:/g, '\\:').replace(/%/g, '%%').replace(/\[/g, '\\[').replace(/\]/g, '\\]')
function wrap(text, max = 26) {
  const words = String(text).split(/\s+/); const lines = []; let cur = ''
  for (const w of words) { if ((cur + ' ' + w).trim().length > max) { lines.push(cur.trim()); cur = w } else cur += ' ' + w }
  if (cur.trim()) lines.push(cur.trim()); return lines
}
function drawLines(lines, { size = 44, color = INK, y = 'h*0.42', lineGap = 1.25, box = false, boxColor = '0xFFFFFF' } = {}) {
  const lh = Math.round(size * lineGap)
  return lines.map((l, i) => `drawtext=fontfile='${FONT}':text='${esc(l)}':fontsize=${size}:fontcolor=${color}:x=(w-text_w)/2:y=${y}+${i * lh}${box ? `:box=1:boxcolor=${boxColor}:boxborderw=18` : ''}`).join(',')
}
// name sticker, top-left, white box with ink text (the postcard sticker)
function nameSticker(name, location) {
  const parts = [`drawtext=fontfile='${FONT}':text='${esc(name)}':fontsize=40:fontcolor=${INK}:x=40:y=120:box=1:boxcolor=0xFFFFFF:boxborderw=16`]
  if (location) parts.push(`drawtext=fontfile='${FONT}':text='${esc(location)}':fontsize=24:fontcolor=${INK}:x=44:y=200:box=1:boxcolor=0x7ECDD5:boxborderw=10`)
  return parts.join(',')
}
const stripe = `drawbox=x=0:y=0:w=iw:h=10:color=${PINK}:t=fill`

// Normalize one clip: 720x1280, blurred fill (no black bars), 30fps, trimmed, EBU R128 loudness, name sticker, silent track if the phone gave none.
async function normalizeClip(src, dst, { seconds, name, location, hasAudio }) {
  const vf = [
    'split=2[fg][bg]',
    `[bg]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},gblur=sigma=24[bgd]`,
    `[fg]scale=${W}:${H}:force_original_aspect_ratio=decrease[fgd]`,
    `[bgd][fgd]overlay=(W-w)/2:(H-h)/2,${nameSticker(name, location)},${stripe},fps=${FPS},format=yuv420p[v]`,
  ].join(';')
  const audioIn = hasAudio ? '[0:a]' : '[1:a]'
  const extra = hasAudio ? [] : ['-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo']
  await ffmpeg([
    '-i', src, ...extra,
    '-filter_complex', `${vf};${audioIn}loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[a]`,
    '-map', '[v]', '-map', '[a]', '-t', String(seconds + 1),
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2', '-movflags', '+faststart', dst,
  ])
}

// A still card (title, text message, end card): paper background, wrapped text, silence.
async function makeCard(dst, { seconds, lines, sub, vibe, big = false }) {
  const paper = VIBE_PAPER[vibe] || PAPER, ink = VIBE_INK[vibe] || INK
  const main = drawLines(lines, { size: big ? 84 : 42, color: ink, y: 'h*0.34' })
  const subf = sub?.length ? ',' + drawLines(sub, { size: 34, color: ink, y: `h*0.34+${lines.length * (big ? 105 : 60) + 70}` }) : ''
  await ffmpeg([
    '-f', 'lavfi', '-i', `color=c=${paper}:s=${W}x${H}:r=${FPS}:d=${seconds}`,
    '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo',
    '-vf', `${main}${subf},${stripe},format=yuv420p`, '-t', String(seconds),
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2', '-movflags', '+faststart', dst,
  ])
}

// Concat, loop the music under it with ducking so voices always win, stamp the watermark. One encode.
async function finalize(parts, dst, { music, withMusic }) {
  const list = path.join(path.dirname(dst), 'concat.txt')
  fs.writeFileSync(list, parts.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'))
  const wm = firstExisting([path.join(HERE, 'assets/watermark.png')])
  const musicFile = withMusic ? firstExisting([path.join(HERE, `music/${music}.mp3`)]) : null
  const inputs = ['-f', 'concat', '-safe', '0', '-i', list]
  let fc = '', mapA = '0:a', mapV = '0:v'
  if (musicFile) {
    inputs.push('-stream_loop', '-1', '-i', musicFile)
    // music at -22 dB, ducked a further ~12 dB whenever someone is speaking, 0.6 s release so it swells back between people
    fc += `[1:a]volume=0.14,aresample=48000[m];[0:a]asplit=2[voice][key];[m][key]sidechaincompress=threshold=0.02:ratio=6:attack=30:release=600:makeup=1[duck];[voice][duck]amix=inputs=2:duration=first:dropout_transition=2:normalize=0[a]`
    mapA = '[a]'
  }
  if (wm) {
    inputs.push('-i', wm)
    const wmIdx = musicFile ? 2 : 1
    fc += (fc ? ';' : '') + `[${wmIdx}:v]colorchannelmixer=aa=0.18[wm];[0:v][wm]overlay=W-w-16:H-h-16[v]`
    mapV = '[v]'
  }
  await ffmpeg([...inputs, ...(fc ? ['-filter_complex', fc] : []), '-map', mapV, '-map', mapA, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', '-shortest', dst], 15 * 60 * 1000)
}


// Wide export (1920x1080): the vertical reel in the middle, postcard panels either side. For laptops, TVs, YouTube, Facebook.
// The brand covers what would otherwise be black. Same audio, no re-mix.
async function makeWide(verticalFile, dst, job) {
  const first = job.recipientName.split(' ')[0]
  const paper = VIBE_PAPER[job.vibe] || PAPER, ink = VIBE_INK[job.vibe] || INK
  const n = job.clips.length
  const prompt = wrap(job.prompt, 24)
  const left = [
    `drawtext=fontfile='${FONT}':text='for':fontsize=40:fontcolor=${ink}:x=96:y=300`,
    `drawtext=fontfile='${FONT}':text='${esc(first)}':fontsize=110:fontcolor=${ink}:x=92:y=340`,
    `drawtext=fontfile='${FONT}':text='${esc(job.hostName + ' asked ' + n + ' people:')}':fontsize=30:fontcolor=${ink}:x=96:y=500`,
    ...prompt.map((l, i) => `drawtext=fontfile='${FONT}':text='${esc(l)}':fontsize=34:fontcolor=${ink}:x=96:y=${560 + i * 46}`),
  ]
  const right = [
    // stamp
    `drawbox=x=1500:y=160:w=300:h=360:color=0xC68B00:t=4`,
    `drawbox=x=1512:y=172:w=276:h=336:color=0xFAEEDA:t=fill`,
    `drawtext=fontfile='${FONT}':text='${n}':fontsize=140:fontcolor=${INK}:x=1650-text_w/2:y=230`,
    `drawtext=fontfile='${FONT}':text='people':fontsize=34:fontcolor=${INK}:x=1650-text_w/2:y=390`,
    `drawtext=fontfile='${FONT}':text='showed up':fontsize=34:fontcolor=${INK}:x=1650-text_w/2:y=430`,
    `drawtext=fontfile='${FONT}':text='made on churpie.':fontsize=40:fontcolor=${ink}:x=1340:y=900`,
    `drawtext=fontfile='${FONT}':text='churpie.me':fontsize=30:fontcolor=${PINK}:x=1340:y=955`,
  ]
  const panel = `color=c=${paper}:s=1920x1080:r=${FPS},drawbox=x=0:y=0:w=iw:h=14:color=${PINK}:t=fill,drawbox=x=0:y=14:w=iw:h=6:color=0x0B9DAA:t=fill,${left.join(',')},${right.join(',')}`
  await ffmpeg([
    '-f', 'lavfi', '-i', panel, '-i', verticalFile,
    '-filter_complex', `[1:v]scale=608:1080[reel];[0:v][reel]overlay=656:0:shortest=1,format=yuv420p[v]`,
    '-map', '[v]', '-map', '1:a', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-c:a', 'copy', '-movflags', '+faststart', dst,
  ], 15 * 60 * 1000)
}

// Put the inner reel inside a rendered card frame. The frame PNG sits on top, so its rounded window hides the video's corners.
async function frameReel(inner, framePng, dst, size, theme) {
  const g = WINDOWS[size]
  const bg = THEME_BG[theme] || PAPER
  await ffmpeg([
    '-i', inner, '-i', framePng,
    '-filter_complex', `color=c=${bg}:s=${g.W}x${g.H}:r=${FPS}[bg];[0:v]scale=${g.w}:${g.h}:flags=lanczos[reel];[bg][reel]overlay=${g.x}:${g.y}:shortest=1[a];[a][1:v]overlay=0:0:format=auto,format=yuv420p[v]`,
    '-map', '[v]', '-map', '0:a', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-c:a', 'copy', '-movflags', '+faststart', dst,
  ], 15 * 60 * 1000)
}

// ─────────────────────────────────────────────────────────────────────────────
// One job
// ─────────────────────────────────────────────────────────────────────────────
export async function stitch(job, { fetchClip, outFile, wideFile = null, onFlags = async () => {} }) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `churpie-${job.cardId}-`))
  try {
    const first = job.recipientName.split(' ')[0]
    const parts = [], manifest = []
    let t = 0
    const push = async (file, meta) => { const { duration } = await probe(file); parts.push(file); manifest.push({ ...meta, start: round(t), end: round(t + duration) }); t += duration }

    // 1. title card: the prompt everyone answered
    const title = path.join(tmp, 'title.mp4')
    await makeCard(title, { seconds: 4, vibe: job.vibe, big: true, lines: [`for ${first}`], sub: [`${job.hostName} asked ${job.clips.length} people:`, ...wrap(job.prompt, 34)] })
    await push(title, { kind: 'title', name: 'churpie', clipId: null })

    // 2. the host's own voice, if they recorded one
    if (job.introKey) {
      const raw = path.join(tmp, 'intro-raw'), norm = path.join(tmp, 'intro.mp4')
      await fetchClip(job.introKey, raw)
      const info = await probe(raw)
      await normalizeClip(raw, norm, { seconds: 20, name: job.hostName, location: null, hasAudio: info.hasAudio })
      await push(norm, { kind: 'intro', name: job.hostName, clipId: null })
    }

    // 3. every message, in the host's order
    let i = 0
    for (const clip of job.clips) {
      i++
      const norm = path.join(tmp, `clip-${i}.mp4`)
      if (clip.kind === 'text') {
        await makeCard(norm, { seconds: 8, vibe: job.vibe, lines: wrap(clip.text, 24), sub: [`— ${clip.name}${clip.location ? `, ${clip.location}` : ''}`] })
        await push(norm, { kind: 'text', name: clip.name, location: clip.location, clipId: clip.id })
        continue
      }
      const raw = path.join(tmp, `clip-${i}-raw`)
      log(`[${job.cardId}] clip ${i}/${job.clips.length} ${clip.name}`)
      await fetchClip(clip.key, raw)
      const info = await probe(raw)
      const { flags } = await analyze(raw, info)
      await onFlags(clip.id, flags, info.duration)
      await normalizeClip(raw, norm, { seconds: job.clipSeconds, name: clip.name, location: clip.location, hasAudio: info.hasAudio })
      await push(norm, { kind: 'video', name: clip.name, location: clip.location, clipId: clip.id, flags })
      fs.rmSync(raw, { force: true })
    }

    // 4. end card: the growth loop
    const end = path.join(tmp, 'end.mp4')
    await makeCard(end, { seconds: 5, vibe: job.vibe, lines: [`${job.clips.length} ${job.clips.length === 1 ? 'person' : 'people'}`, 'showed up for you.'], sub: ['churpie.me'] })
    await push(end, { kind: 'end', name: 'churpie', clipId: null })

    // 5. weave
    log(`[${job.cardId}] weaving ${parts.length} parts, ${Math.round(t)}s`)
    const inner = path.join(tmp, 'inner.mp4')
    const theme = job.theme || 'postcard'
    await finalize(parts, inner, { music: THEME_MUSIC[theme] || VIBE_MUSIC[job.vibe] || 'gentle-piano', withMusic: true })
    // 6. the card: render the frames, then tape the reel inside each
    log(`[${job.cardId}] card frames (${theme})`)
    const frames = await renderFrames({ ...job, theme, totalSeconds: t }, tmp)
    await frameReel(inner, frames.story, outFile, 'story', theme)
    if (wideFile) { log(`[${job.cardId}] wide card`); await frameReel(inner, frames.wide, wideFile, 'wide', theme) }
    return manifest
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}
const round = (x) => Math.round(x * 100) / 100

// ─────────────────────────────────────────────────────────────────────────────
// Modes
// ─────────────────────────────────────────────────────────────────────────────
async function processOne() {
  const job = await claimJob()
  if (!job) return false
  log(`[${job.cardId}] claimed · ${job.clips.length} clips for ${job.recipientName}`)
  const out = path.join(os.tmpdir(), `churpie-${job.cardId}-reel.mp4`)
  const wide = path.join(os.tmpdir(), `churpie-${job.cardId}-reel-wide.mp4`)
  try {
    const manifest = await stitch(job, { fetchClip: download, outFile: out, wideFile: wide, onFlags: postFlags })
    // wide first, so the card only turns "ready" once both files exist
    if (fs.existsSync(wide)) await uploadFinal(job.cardId, wide, manifest, 'wide')
    const r = await uploadFinal(job.cardId, out, manifest)
    log(`[${job.cardId}] done → ${r.watch}`)
  } catch (e) {
    log(`[${job.cardId}] FAILED ${e.message}`)
    await markFailed(job.cardId, e.message)
  } finally { fs.rmSync(out, { force: true }); fs.rmSync(wide, { force: true }) }
  return true
}

const argv = process.argv.slice(2)
if (argv[0] === '--local') {
  // offline: node stitch.js --local job.json out.mp4   (job.clips[].key are local file paths)
  const job = JSON.parse(fs.readFileSync(argv[1], 'utf8'))
  const manifest = await stitch(job, { fetchClip: async (key, dest) => fs.copyFileSync(key, dest), outFile: argv[2], wideFile: argv[2].replace(/\.mp4$/, '-wide.mp4'), onFlags: async (id, flags, d) => log(`  flags ${id}: ${flags.join(',') || 'none'} (${d.toFixed(1)}s)`) })
  fs.writeFileSync(argv[2] + '.manifest.json', JSON.stringify(manifest, null, 2))
  log('wrote', argv[2])
} else if (import.meta.url === `file://${process.argv[1]}`) {
  if (!APP_URL || !TOKEN) { console.error('Set APP_URL and STITCH_TOKEN'); process.exit(1) }
  if (!FONT) console.warn('No font file found; text cards will fail. Install fonts-dejavu-core or set FONT_FILE.')
  if (argv[0] === '--once') { await processOne(); process.exit(0) }
  log(`churpie stitcher · polling ${APP_URL} every ${POLL_MS / 1000}s`)
  for (;;) {
    try { const did = await processOne(); if (!did) await new Promise((r) => setTimeout(r, POLL_MS)) }
    catch (e) { log('poll error', e.message); await new Promise((r) => setTimeout(r, POLL_MS)) }
  }
}
