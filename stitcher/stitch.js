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
import { renderFrames, openPainter, WINDOWS } from './render.js'

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
const stripe = `drawbox=x=0:y=0:w=iw:h=10:color=${PINK}:t=fill`

// Normalize one clip: 720x1280, blurred fill (no black bars), 30fps, trimmed, EBU R128 loudness, name sticker, silent track if the phone gave none.
// Audio glue: every room sounds different, so each clip gets the same gentle treatment before it meets the others:
//   rumble and hiss filtered out, light noise reduction (hum, fridge, traffic), one loudness, and soft 0.12 s / 0.18 s edges
//   so room sound never snaps on or off between people. The music bed underneath covers what's left.
async function normalizeClip(src, dst, { seconds, hasAudio, duration, sticker }) {
  const out = Math.max(0.5, Math.min(duration || seconds + 1, seconds + 1))
  const glue = `highpass=f=80,lowpass=f=12000,afftdn=nr=10:nf=-40:tn=1,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000,afade=t=in:st=0:d=0.12,afade=t=out:st=${(out - 0.18).toFixed(2)}:d=0.18`
  const vf = [
    'split=2[fg][bg]',
    `[bg]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},gblur=sigma=24[bgd]`,
    `[fg]scale=${W}:${H}:force_original_aspect_ratio=decrease[fgd]`,
    `[bgd][fgd]overlay=(W-w)/2:(H-h)/2[base]`,
    `[base][1:v]overlay=0:0,${stripe},fps=${FPS},format=yuv420p[v]`,
  ].join(';')
  const audioIn = hasAudio ? '[0:a]' : '[2:a]'
  const extra = hasAudio ? [] : ['-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo']
  await ffmpeg([
    '-i', src, '-i', sticker, ...extra,
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
    // the glue: music sits ~11 dB under voices between people (clearly there, holding it together),
    // dips to ~19 dB under while someone speaks (felt, not heard), and swells back over 0.6 s. Measured, not guessed.
    fc += `[1:a]volume=0.8,aresample=48000[m];[0:a]asplit=2[voice][key];[m][key]sidechaincompress=threshold=0.025:ratio=3.5:attack=30:release=600:makeup=1[duck];[voice][duck]amix=inputs=2:duration=first:dropout_transition=2:normalize=0[a]`
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
  const painter = await openPainter()
  const theme = job.theme || 'postcard'
  const png = (n) => path.join(tmp, `${n}.png`)
  try {
    const first = job.recipientName.split(' ')[0]
    const parts = [], manifest = []
    let t = 0
    const push = async (file, meta) => { const { duration } = await probe(file); parts.push(file); manifest.push({ ...meta, start: round(t), end: round(t + duration) }); t += duration }

    // 1. title card: the prompt everyone answered
    const title = path.join(tmp, 'title.mp4')
    await makeCard(title, await painter.card('title', { first, host: job.hostName, n: job.clips.length, prompt: job.prompt }, theme, png('title')), 4)
    await push(title, { kind: 'title', name: 'churpie', clipId: null })

    // 2. the host's own voice, if they recorded one
    if (job.introKey) {
      const raw = path.join(tmp, 'intro-raw'), norm = path.join(tmp, 'intro.mp4')
      await fetchClip(job.introKey, raw)
      const info = await probe(raw)
      await normalizeClip(raw, norm, { seconds: 20, hasAudio: info.hasAudio, duration: info.duration, sticker: await painter.sticker(job.hostName, null, png('intro-sticker')) })
      await push(norm, { kind: 'intro', name: job.hostName, clipId: null })
    }

    // 3. every message, in the host's order
    let i = 0
    for (const clip of job.clips) {
      i++
      const norm = path.join(tmp, `clip-${i}.mp4`)
      if (clip.kind === 'text') {
        await makeCard(norm, await painter.card('text', { text: clip.text, name: clip.name, location: clip.location }, theme, png(`text-${i}`)), 8)
        await push(norm, { kind: 'text', name: clip.name, location: clip.location, clipId: clip.id })
        continue
      }
      const raw = path.join(tmp, `clip-${i}-raw`)
      log(`[${job.cardId}] clip ${i}/${job.clips.length} ${clip.name}`)
      await fetchClip(clip.key, raw)
      const info = await probe(raw)
      const { flags } = await analyze(raw, info)
      await onFlags(clip.id, flags, info.duration)
      await normalizeClip(raw, norm, { seconds: job.clipSeconds, hasAudio: info.hasAudio, duration: info.duration, sticker: await painter.sticker(clip.name, clip.location, png(`sticker-${i}`)) })
      await push(norm, { kind: 'video', name: clip.name, location: clip.location, clipId: clip.id, flags })
      fs.rmSync(raw, { force: true })
    }

    // 4. end card: the growth loop
    const end = path.join(tmp, 'end.mp4')
    await makeCard(end, await painter.card('end', { n: job.clips.length }, theme, png('end')), 5)
    await push(end, { kind: 'end', name: 'churpie', clipId: null })

    // 5. weave
    log(`[${job.cardId}] weaving ${parts.length} parts, ${Math.round(t)}s`)
    const inner = path.join(tmp, 'inner.mp4')
    await finalize(parts, inner, { music: THEME_MUSIC[theme] || VIBE_MUSIC[job.vibe] || 'gentle-piano', withMusic: true })
    // 6. the card: render the frames, then tape the reel inside each
    log(`[${job.cardId}] card frames (${theme})`)
    const frames = await renderFrames({ ...job, theme, totalSeconds: t }, tmp)
    await frameReel(inner, frames.story, outFile, 'story', theme)
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
  if (argv[0] === '--once') { await processOne(); process.exit(0) }
  log(`churpie stitcher · polling ${APP_URL} every ${POLL_MS / 1000}s`)
  for (;;) {
    try { const did = await processOne(); if (!did) await new Promise((r) => setTimeout(r, POLL_MS)) }
    catch (e) { log('poll error', e.message); await new Promise((r) => setTimeout(r, POLL_MS)) }
  }
}
