// churpie · shared browser helpers. No framework, no build step.

export async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'content-type': 'application/json', ...(opts.headers || {}) },
    ...opts,
    body: opts.body && typeof opts.body !== 'string' && !(opts.body instanceof Blob) ? JSON.stringify(opts.body) : opts.body,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Something hiccuped. We did not lose your work.')
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
  toast('Link copied. Go rally.')
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
      else { let msg = 'Upload failed.'; try { msg = JSON.parse(xhr.responseText).error || msg } catch {} reject(new Error(msg)) }
    }
    xhr.onerror = () => reject(new Error('Something hiccuped during the upload. Your video is still on your phone; try again.'))
    xhr.send(blob)
  })
}

export function installPrompt() {
  // "add churpie to your home screen" — only after they've done something, never on arrival
  let deferred = null
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e })
  return async () => { if (!deferred) return false; deferred.prompt(); const r = await deferred.userChoice; deferred = null; return r.outcome === 'accepted' }
}
