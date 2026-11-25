// small helpers, no dependencies

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789' // no 0/o/1/l/i: links get read aloud and typed

export function newId(len = 8) {
  const bytes = crypto.getRandomValues(new Uint8Array(len))
  let out = ''
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length]
  return out
}

export function newToken() {
  return newId(24)
}

export function nowIso() {
  return new Date().toISOString()
}

export function plusDays(days) {
  return new Date(Date.now() + days * 86400000).toISOString()
}

export function sanitize(value, max = 200) {
  if (typeof value !== 'string') return ''
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max)
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]))
}

const CONSUMER_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'ymail.com', 'hotmail.com', 'outlook.com', 'live.com', 'msn.com',
  'icloud.com', 'me.com', 'mac.com', 'aol.com', 'protonmail.com', 'proton.me', 'pm.me', 'gmx.com', 'gmx.net',
  'mail.com', 'zoho.com', 'yandex.com', 'comcast.net', 'att.net', 'verizon.net', 'sbcglobal.net', 'cox.net',
  'charter.net', 'earthlink.net', 'hey.com', 'fastmail.com', 'duck.com',
])

// A business email is any domain that isn't a consumer provider. That's the lead list for brand mode.
export function isBusinessEmail(email) {
  const at = email.lastIndexOf('@')
  if (at < 1) return false
  const domain = email.slice(at + 1).toLowerCase()
  if (!domain.includes('.')) return false
  return !CONSUMER_DOMAINS.has(domain)
}

// The short name used everywhere a card speaks about its person: "Rosa Garcia" is Rosa, "Rosa and Sam Lee" is
// Rosa & Sam, "Aunt Rosa" and "The Garcias" stay whole. A list with commas is kept as typed.
const NAME_LEAD = /^(the|aunt|auntie|uncle|grandma|grandpa|granny|nana|papa|mama|dr\.?|mr\.?|mrs\.?|ms\.?|miss|coach|pastor|father|sister|brother|professor|prof\.?|tía|tia|tío|tio|abuela|abuelo)$/i
const oneName = (t) => { const w = t.split(' '); return w.length > 1 && NAME_LEAD.test(w[0]) ? `${w[0]} ${w[1]}` : w[0] }
export function firstName(s) {
  const t = String(s || '').trim().replace(/\s+/g, ' ')
  if (!t) return ''
  if (t.includes(',')) return t.slice(0, 40)
  const pair = t.split(/ (?:&|\+|and) /i)
  if (pair.length === 2 && pair[0] && pair[1]) return `${oneName(pair[0])} & ${oneName(pair[1])}`
  return oneName(t)
}
