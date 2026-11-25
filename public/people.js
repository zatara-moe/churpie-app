// The people in demos and previews: stills from the same free stock clips as the home page reel (Pexels and Mixkit,
// commercial use allowed; see demo/README.md), cropped small in public/people/. Real faces, because the product is about faces.

const BACKDROPS = ['#F7D96C', '#7ECDD5', '#FAE0EC', '#D9E8C4', '#FAEEDA', '#E8DFF5', '#FFD8C2', '#CFE6F2']
const SKIN = ['#F2C9A5', '#E0A981', '#C68A62', '#A86F4C', '#7E5136', '#F5D5BE']
const HAIR = ['#2B1D14', '#5A3A22', '#8C5A2B', '#C99A4E', '#1A1410', '#B8B0A6', '#6B2E1F']
const SHIRT = ['#D4266A', '#0B9DAA', '#C68B00', '#2D7A3A', '#1F3A93', '#4A3F30', '#E87AAD']

export const DEMO_PEOPLE = [
  { name: 'Maria', where: 'Flagstaff, AZ', line: 'you showed up for everyone', img: 'maria', b: 0 },
  { name: 'Daniel', where: 'Denver, CO', line: 'happy 60th, you legend', img: 'daniel', b: 4 },
  { name: 'Jen', where: 'Tucson, AZ', line: 'the summer you taught me tamales', img: 'jen', b: 2 },
  { name: 'Sofia', where: 'Phoenix, AZ', line: 'we love you', img: 'sofia', b: 3 },
  { name: 'Nina', where: 'San Diego, CA', line: 'thank you for everything', img: 'nina', b: 1 },
  { name: 'Grace', where: 'Sedona, AZ', line: 'still the loudest fan', img: 'grace', b: 5 },
  { name: 'Sara', where: 'Austin, TX', line: 'so proud of you', img: 'sara', b: 0 },
  { name: 'June', where: 'Portland, OR', line: 'see you very soon', img: 'june', b: 2 },
]

// The person's photo, drawn over a soft out-of-focus silhouette. The silhouette only shows if the photo can't load.
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
    ${p.img ? `<image href="/people/${p.img}.jpg" width="100" height="156" preserveAspectRatio="xMidYMid slice"/>` : ''}
  </svg>`
}

// A live mini version of the card the stitcher will render. Same layout as the wide file, scaled to fit.
const SUBLINE = { birthday: 'happy birthday', congrats: 'you did it', thankyou: 'with thanks', getwell: 'get well soon', missyou: 'we miss you', memory: 'in loving memory', team: 'from the team', brand: 'from all of us', welcome: 'welcome home', retirement: 'happy retirement', holiday: 'happy holidays', newyear: 'happy new year', baby: 'welcome to the world', anniversary: 'happy anniversary', wedding: 'congratulations' }
// (a memorial card always shows the calmest still, never a big grin)
export function cardPreview({ theme = 'postcard', first = '', host = '', n = null, moment = 'birthday', prompt = '', person = 0 } = {}) {
  const e = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
  const name = first || 'their name'
  const eye = theme === 'pressedflower' ? 'in memory of' : theme === 'airmail' ? 'par avion' : 'a card for'
  return `<div class="pv t-${e(theme)}"><div class="pv-edge"></div><span class="pv-tape a"></span><span class="pv-tape b"></span>
    <div class="pv-text"><div class="pv-eye">${eye}</div><div class="pv-name">${e(name)}</div><div class="pv-sub">${e(SUBLINE[moment] || '')}</div>
      <div class="pv-ask">${host ? `${e(host)} asks:` : 'your question:'}</div><div class="pv-prompt">${e(prompt || 'the one thing you want everyone to say')}</div></div>
    <div class="pv-reel">${personSVG(DEMO_PEOPLE[theme === 'pressedflower' ? 0 : person % DEMO_PEOPLE.length], { w: 100, h: 156 })}</div>
    <div class="pv-stamp"><b>${n ?? '?'}</b><small>showed up</small></div>
    <div class="pv-meta"><span>to ${e(name)}</span><span>from ${e(host || 'you')} and friends</span></div>
    <div class="pv-mark">churpie<b>.</b></div></div>`
}
