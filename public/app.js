// churpie · shared browser helpers. No framework, no build step.

export async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'content-type': 'application/json', ...(opts.headers || {}) },
    ...opts,
    body: opts.body && typeof opts.body !== 'string' && !(opts.body instanceof Blob) ? JSON.stringify(opts.body) : opts.body,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Something hiccuped on our end. Try once more.')
  return data
}

export function $(sel, root = document) { return root.querySelector(sel) }
export function $$(sel, root = document) { return [...root.querySelectorAll(sel)] }

export function toast(msg, ms = 2600) {
  let el = $('.toast')
  if (!el) { el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el) }
  el.textContent = msg
  el.classList.remove('hidden')
  clearTimeout(el._t)
  el._t = setTimeout(() => el.classList.add('hidden'), ms)
}

// The phone's own share sheet first; copy as the fallback. Churpie never sends texts itself.
export async function share({ title, text, url }) {
  if (navigator.share) {
    try { await navigator.share({ title, text, url }); return 'shared' } catch (e) { if (e.name === 'AbortError') return 'cancelled' }
  }
  await navigator.clipboard?.writeText(`${text} ${url}`.trim())
  toast('Link copied. Paste it anywhere.')
  return 'copied'
}

export function firstName(s) { return String(s || '').trim().split(/\s+/)[0] }

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]))
}

export function fmtDays(iso) {
  if (!iso) return ''
  const d = Math.ceil((new Date(iso) - Date.now()) / 86400000)
  return d <= 0 ? 'today' : d === 1 ? '1 day' : `${d} days`
}

export function reducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

// MediaRecorder: pick what this phone can actually produce. iPhones give mp4, Android gives webm. The stitcher handles both.
export function recorderMime() {
  if (typeof MediaRecorder === 'undefined') return ''
  const types = ['video/mp4;codecs=avc1,mp4a', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
  return types.find((t) => MediaRecorder.isTypeSupported(t)) || ''
}

// Upload with progress. PUT straight to the Worker, which streams it into R2.
export function upload(url, blob, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('content-type', blob.type || 'video/mp4')
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total) }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText || '{}'))
      else if (xhr.status === 413) reject(new Error("That video is too big to send. Record it here instead, or trim it on your phone first."))
      else { let msg = "That didn't go through. Try once more."; try { msg = JSON.parse(xhr.responseText).error || msg } catch {} reject(new Error(msg)) }
    }
    xhr.onerror = () => reject(new Error('Your connection blinked. Your video is still on your phone, so try once more.'))
    xhr.send(blob)
  })
}

export function installPrompt() {
  // "add churpie to your home screen" — only after they've done something, never on arrival
  let deferred = null
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e })
  return async () => { if (!deferred) return false; deferred.prompt(); const r = await deferred.userChoice; deferred = null; return r.outcome === 'accepted' }
}

// ── "your cards" on this device ─────────────────────────────────────────────
// No account: the board link is the key. We keep every board this browser has opened, so hosts can
// find their way back from the home page. It never leaves this device.
const BOARDS = 'churpie:boards'
export function myBoards() {
  try {
    const list = JSON.parse(localStorage.getItem(BOARDS) || '[]')
    // carry over the single link older versions saved
    const last = localStorage.getItem('churpie:last-host')
    if (last && !list.some((b) => b.url === last)) list.push({ url: last, name: '', at: '' })
    return list
  } catch { return [] }
}
export function rememberBoard(entry) {
  try {
    const list = myBoards().filter((b) => b.url !== entry.url)
    list.unshift({ ...entry, at: new Date().toISOString() })
    localStorage.setItem(BOARDS, JSON.stringify(list.slice(0, 20)))
    localStorage.setItem('churpie:last-host', entry.url)
  } catch {}
}
export function forgetBoard(url) {
  try {
    localStorage.setItem(BOARDS, JSON.stringify(myBoards().filter((b) => b.url !== url)))
    if (localStorage.getItem('churpie:last-host') === url) localStorage.removeItem('churpie:last-host')
  } catch {}
}

// "Fri, Nov 6, 3 PM" in the viewer's own time
export function fmtWhen(iso) {
  return new Date(iso).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// Every contributor's video goes through here, whatever the phone. Small files go up in one request;
// big ones (a phone's own camera can make 100+ MB) go up in 50 MB pieces, because Cloudflare refuses
// any single request over 100 MB. Each piece gets two retries, so a blip on a phone connection
// doesn't lose the whole video. The person just sees one progress bar.
const ONE_SHOT = 90 * 1024 * 1024
const PIECE = 50 * 1024 * 1024
export async function uploadVideo(reg, blob, onProgress) {
  if (blob.size <= ONE_SHOT) return upload(reg.uploadUrl, blob, onProgress)
  const edit = new URL(reg.uploadUrl, location.href).searchParams.get('edit')
  const clipPath = `/api/clips/${reg.clipId}/parts`
  const { uploadId } = await api(`${clipPath}?edit=${encodeURIComponent(edit)}`, { method: 'POST', body: { size: blob.size, contentType: blob.type || 'video/mp4' } })
  const parts = []
  const count = Math.ceil(blob.size / PIECE)
  for (let i = 0; i < count; i++) {
    const piece = blob.slice(i * PIECE, Math.min(blob.size, (i + 1) * PIECE), blob.type)
    const url = `${clipPath}/${i + 1}?edit=${encodeURIComponent(edit)}&uploadId=${encodeURIComponent(uploadId)}`
    let tries = 0
    for (;;) {
      try {
        parts.push(await upload(url, piece, (p) => onProgress?.((i + p) / count)))
        break
      } catch (e) { if (++tries > 2) throw e; await new Promise((r) => setTimeout(r, 1500 * tries)) }
    }
  }
  return api(`${clipPath}/done?edit=${encodeURIComponent(edit)}`, { method: 'POST', body: { uploadId, parts } })
}

// ── bot check (Cloudflare Turnstile) ────────────────────────────────────────
// Invisible for nearly everyone; only shows a quick checkbox if Cloudflare is unsure. Returns null when the
// check is switched off, so pages work the same either way.
let ts = null
export async function botCheck() {
  if (!ts) ts = (async () => {
    const { turnstile: key } = await api('/api/catalog').catch(() => ({}))
    if (!key) return null
    await new Promise((resolve, reject) => {
      if (window.turnstile) return resolve()
      const s = document.createElement('script')
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      s.onload = resolve; s.onerror = () => reject(new Error('The person check didn’t load. Check your connection and try again.'))
      document.head.appendChild(s)
    })
    const box = document.createElement('div'); box.style.cssText = 'display:flex;justify-content:center;margin:8px 0'
    document.body.appendChild(box)
    return { key, box, id: null }
  })()
  const t = await ts
  if (!t) return null
  return new Promise((resolve, reject) => {
    const opts = { sitekey: t.key, appearance: 'interaction-only', callback: resolve, 'error-callback': () => reject(new Error('We couldn’t confirm you’re a person. Try once more.')) }
    if (t.id === null) t.id = window.turnstile.render(t.box, opts)
    else { window.turnstile.reset(t.id) }
  })
}
