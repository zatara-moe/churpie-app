// Friendly illustrated people for demos and previews. No stock photos, no real faces.
// Each person is a little portrait "video still": colored backdrop, shoulders, head, hair, a smile.

const BACKDROPS = ['#F7D96C', '#7ECDD5', '#FAE0EC', '#D9E8C4', '#FAEEDA', '#E8DFF5', '#FFD8C2', '#CFE6F2']
const SKIN = ['#F2C9A5', '#E0A981', '#C68A62', '#A86F4C', '#7E5136', '#F5D5BE']
const HAIR = ['#2B1D14', '#5A3A22', '#8C5A2B', '#C99A4E', '#1A1410', '#B8B0A6', '#6B2E1F']
const SHIRT = ['#D4266A', '#0B9DAA', '#C68B00', '#2D7A3A', '#1F3A93', '#4A3F30', '#E87AAD']

export const DEMO_PEOPLE = [
  { name: 'Grandma J', where: 'Phoenix, AZ', line: 'the summer you taught me tamales', s: 1, h: 5, c: 1, b: 0, style: 'bun', glasses: true },
  { name: 'Tom', where: 'Denver, CO', line: 'happy 60th, you legend', s: 0, h: 2, c: 4, b: 1, style: 'short' },
  { name: 'Priya', where: 'Flagstaff, AZ', line: 'you showed up for everyone', s: 3, h: 0, c: 0, b: 2, style: 'long' },
  { name: 'The kids', where: 'Tucson, AZ', line: 'we love you abuela', s: 2, h: 1, c: 3, b: 3, style: 'curly' },
  { name: 'Coach B', where: 'Sedona, AZ', line: 'still the loudest fan', s: 4, h: 4, c: 2, b: 4, style: 'bald', beard: true },
  { name: 'Nina', where: 'San Diego, CA', line: 'thank you for everything', s: 5, h: 6, c: 6, b: 5, style: 'long' },
]

// A soft, out-of-focus "video still": warm light, a blurred head-and-shoulders silhouette. Reads as a person on camera
// without drawing a face. Real footage replaces it wherever we have it.
const WARM = [['#E9C9A8', '#B98A66', '#F6E3CC'], ['#C9D6DE', '#7E96A6', '#EEF2F4'], ['#E6C3C8', '#A97A82', '#F6E4E6'], ['#D8D0B8', '#9A8D6A', '#F2EEDF'], ['#D9C4B0', '#8C6E58', '#F3E8DC'], ['#CBD8C8', '#7F9A7C', '#EDF2EB']]
export function personSVG(p, { w = 100, h = 156, round = 0 } = {}) {
  const [bg, fig, light] = WARM[(p.b ?? 0) % WARM.length]
  const id = 'b' + Math.random().toString(36).slice(2, 8)
  return `<svg viewBox="0 0 100 156" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style="display:block;border-radius:${round}px">
    <defs><filter id="${id}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5"/></filter>
    <radialGradient id="${id}g" cx="0.75" cy="0.15" r="0.9"><stop offset="0" stop-color="${light}"/><stop offset="1" stop-color="${bg}"/></radialGradient></defs>
    <rect width="100" height="156" fill="url(#${id}g)"/>
    <g filter="url(#${id})" opacity="0.85"><ellipse cx="50" cy="62" rx="19" ry="23" fill="${fig}"/><path d="M8 156 C10 110 28 94 50 94 C72 94 90 110 92 156Z" fill="${fig}"/></g>
    <circle cx="80" cy="26" r="16" fill="#fff" opacity="0.25" filter="url(#${id})"/>
  </svg>`
}

// A live mini version of the card the stitcher will render. Same layout as the wide file, scaled to fit.
const SUBLINE = { birthday: 'happy birthday', congrats: 'you did it', thankyou: 'with thanks', getwell: 'get well soon', missyou: 'we miss you', memory: 'in loving memory', team: 'from the team', brand: 'from all of us' }
export function cardPreview({ theme = 'postcard', first = '', host = '', n = null, moment = 'birthday', prompt = '', person = 0 } = {}) {
  const e = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
  const name = first || 'their name'
  const eye = theme === 'pressedflower' ? 'in memory of' : theme === 'airmail' ? 'par avion' : 'a card for'
  return `<div class="pv t-${e(theme)}"><div class="pv-edge"></div><span class="pv-tape a"></span><span class="pv-tape b"></span>
    <div class="pv-text"><div class="pv-eye">${eye}</div><div class="pv-name">${e(name)}</div><div class="pv-sub">${e(SUBLINE[moment] || '')}</div>
      <div class="pv-ask">${e(host || 'you')} asks:</div><div class="pv-prompt">${e(prompt || 'the one thing you want everyone to say')}</div></div>
    <div class="pv-reel">${personSVG(DEMO_PEOPLE[person % DEMO_PEOPLE.length], { w: 100, h: 156 })}</div>
    <div class="pv-stamp"><b>${n ?? '?'}</b><small>showed up</small></div>
    <div class="pv-meta"><span>to ${e(name)}</span><span>from ${e(host || 'you')} + your people</span></div>
    <div class="pv-mark">churpie<b>.</b></div></div>`
}
