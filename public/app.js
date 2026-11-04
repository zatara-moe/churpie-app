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
      else if (xhr.status === 413) reject(new Error('That video is too big to send. Record it here instead (it’s quicker), or trim it in your camera roll first.'))
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
