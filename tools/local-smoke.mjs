// churpie · a walk through one whole card against a local copy of the app (never the live site).
// Run by TEST-LOCAL-MAC.command. Usage: node tools/local-smoke.mjs http://localhost:8799 dev-token 8798
// It also stands in for the two outside services: the email sender (so emails are caught here, never sent)
// and the reel maker's wake-up address.
import { createHmac } from 'node:crypto'
import { createServer } from 'node:http'

const BASE = process.argv[2] || 'http://localhost:8799'
const STITCH = process.argv[3] || 'dev-token'
const FAKE_PORT = Number(process.argv[4] || 8798)
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) { console.error('This test only runs against a local copy.'); process.exit(2) }

const outbox = []
const fake = createServer((req, res) => {
  let body = ''
  req.on('data', (d) => { body += d })
  req.on('end', () => {
    if (req.url === '/emails') { try { outbox.push(JSON.parse(body)) } catch {} }
    res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"id":"test"}')
  })
})
await new Promise((r) => fake.listen(FAKE_PORT, r))

let failed = 0
const ok = (cond, label, extra = '') => { console.log(`${cond ? '  ok  ' : '  FAIL'}  ${label}${cond || !extra ? '' : `  (${extra})`}`); if (!cond) failed++ }
const call = async (path, { method = 'GET', body, headers = {}, raw } = {}) => {
  const r = await fetch(BASE + path, { method, headers: { ...(raw ? {} : { 'content-type': 'application/json' }), ...headers }, body: raw ?? (body ? JSON.stringify(body) : undefined) })
  const text = await r.text(); let json = null; try { json = JSON.parse(text) } catch {}
  return { status: r.status, json, text }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const mailTo = (to) => outbox.filter((m) => m.to?.[0] === to)
const waitMail = async (to, n = 1) => { for (let i = 0; i < 40 && mailTo(to).length < n; i++) await sleep(250); return mailTo(to) }
// the same signature the app makes for admin peek links
const sig = (token, back = 0) => createHmac('sha256', STITCH).update(`peek:${token}:${Math.floor(Date.now() / 3600e3) - back}`).digest('hex').slice(0, 32)
const host = async (t, q = '') => (await call(`/api/host/${t}${q}`))
const everyMinute = async () => {
  let r = await call('/__scheduled?cron=*+*+*+*+*')
  if (r.status === 404) r = await call('/cdn-cgi/handler/scheduled?cron=*+*+*+*+*')
  return r
}
const done = () => { console.log(failed ? `\n${failed} CHECK${failed === 1 ? '' : 'S'} FAILED\n` : '\nALL CHECKS PASSED\n'); fake.close(); process.exit(failed ? 1 : 0) }

console.log('\n1 · pages')
for (const [p, must] of [['/', 'churpie'], ['/new', 'churpie'], ['/privacy', 'hello@sherwooddigital.org'], ['/terms', 'the terms, in plain words'], ['/admin', 'admin']]) {
  const r = await call(p); ok(r.status === 200 && r.text.includes(must), `${p} loads`, `status ${r.status}`)
}
ok((await call('/')).text.includes('href="/terms"'), 'home page footer links to the terms')
ok((await call('/api/admin/stats')).status === 403, 'admin data is refused without an admin sign-in')
const cat = (await call('/api/catalog')).json
const hol = cat?.moments?.find((m) => m.id === 'holiday')
ok(!!hol && !!cat.moments.find((m) => m.id === 'newyear') && !!cat.moments.find((m) => m.id === 'baby'), 'the holiday, New Year and new baby moments are on offer')
ok(!!hol?.byTone?.funny && cat.moments.filter((m) => m.byTone).length >= 12, 'every moment has a question for each feeling')
ok(cat?.vibes?.some((v) => v.id === hol?.vibe && v.moments.includes('holiday')), "the holiday moment's card suits it")
const hc = await call('/api/cards', { method: 'POST', body: { recipientName: 'Nana and Pop Garcia', hostName: 'Sam', hostEmail: 'sam@example.com', prompt: 'A holiday question', moment: 'holiday', vibe: 'kraft', deadlineAt: new Date(Date.now() + 3 * 86400000).toISOString() } })
const hpub = hc.json?.id ? (await call(`/api/cards/${hc.json.id}/public`)).json : null
ok(hpub?.moment === 'holiday' && hpub?.vibe === 'kraft' && !!hpub?.deadlineAt && hpub?.deadlinePassed === false, 'a holiday card is made with its card and its last day')
ok(!!cat.moments.find((m) => m.id === 'wedding') && !!cat.moments.find((m) => m.id === 'anniversary'), 'weddings and anniversaries are on offer')
ok(((await waitMail('sam@example.com'))[0]?.text || '').includes('Your card for Nana & Pop is ready'), 'a card for two people is named for both of them')

console.log('\n2 · make a card: the link goes to the host by email, and opening it opens the card')
const made = await call('/api/cards', { method: 'POST', body: { recipientName: 'Rosa Test', hostName: 'Maria Test', hostEmail: 'maria@example.com', prompt: 'What is your favorite memory with Rosa?', moment: 'birthday' } })
ok(made.status === 200 && made.json?.checkEmail && !made.json?.hostToken, 'card is made, and the private link is not shown on screen', `status ${made.status} ${made.text.slice(0, 160)}`)
const id = made.json?.id
const boardMail = (await waitMail('maria@example.com'))[0]
const H = /\/h\/([a-z0-9]+)/.exec(boardMail?.text || '')?.[1]
ok(!!H, 'the host gets the card link by email')
if (!id || !H) { console.log('\nThe card could not be made, so the rest cannot run.'); done() }
const early = await call(`/api/cards/${id}/clips`, { method: 'POST', body: { name: 'Too Early', kind: 'text', text: 'hi' } })
ok(early.status === 409, 'messages are refused until the host has opened that link')
ok((await host(H, `?peek=${sig(H)}`)).status === 200 && (await call(`/api/cards/${id}/public`)).json?.notYet === true, 'an admin look does not count as the host opening it')
let b = await host(H)
ok(b.status === 200 && (await call(`/api/cards/${id}/public`)).json?.notYet === false, 'the host opens the link: the card is open')
const Wt = b.json.card.links.watch.split('/w/')[1]

console.log('\n3 · two messages, and one person asks to hear back')
const c1 = await call(`/api/cards/${id}/clips`, { method: 'POST', body: { name: 'Grandma J', location: 'Phoenix, AZ', kind: 'text', text: 'Happy birthday, Rosa.' } })
const c2 = await call(`/api/cards/${id}/clips`, { method: 'POST', body: { name: 'Dev', kind: 'text', text: 'You taught me to drive.' } })
ok(c1.status === 200 && c2.status === 200, 'two written messages go in')
ok((await call(`/api/cards/${id}/public`)).json?.canNotify === true, 'the invite page offers "email me when it\'s opened"')
const tell = (clip, edit, email) => call(`/api/clips/${clip}/notify?edit=${edit}`, { method: 'POST', body: { email } })
ok((await tell(c1.json.clipId, c1.json.editToken, 'not-an-email')).status === 400, 'a mistyped email is refused')
ok((await tell(c1.json.clipId, 'wrong-link', 'x@example.com')).status === 404, "someone else's link can't sign a person up")
ok((await tell(c1.json.clipId, c1.json.editToken, 'Grandma@Example.com')).json?.on === true, 'Grandma J asks to hear back')
ok((await tell(c2.json.clipId, c2.json.editToken, 'dev@example.com')).json?.on === true && (await tell(c2.json.clipId, c2.json.editToken, '')).json?.on === false, 'Dev signs up, then changes his mind')
b = await host(H)
ok(b.json?.clips?.length === 2 && b.json.card.status === 'open' && b.json.card.notifyCount === 1, 'the card page shows both messages and that one person asked')
ok(b.json?.clips?.every((c) => c.loved === 0) && b.json.card.peek === false, 'card page reports loves (0 so far) and is not an admin view')

console.log('\n4 · admin look at the card page')
const peekBoard = await host(H, `?peek=${sig(H)}`)
ok(peekBoard.status === 200 && peekBoard.json?.card?.peek === true, 'a signed admin link opens the card page as an admin view')
ok((await host(H, `?peek=${sig(H, 1)}`)).status === 200, 'a link signed in the last hour still works')
ok((await host(H, '?peek=1')).status === 403, 'the old ?peek=1 link is refused')
ok((await host(H, `?peek=${sig(H, 3)}`)).status === 403, 'a link from three hours ago is refused')
const hp = await call(`/h/${H}?peek=${sig(H)}`); ok(hp.status === 200 && hp.text.includes('READ_ONLY'), 'card page carries the read-only guard')

console.log('\n5 · make the reel (standing in for the reel maker)')
ok((await call(`/api/host/${H}/send`, { method: 'POST' })).json?.status === 'queued', 'host presses make the reel: queued')
const auth = { authorization: `Bearer ${STITCH}` }
const job = await call('/api/stitch/next', { method: 'POST', headers: auth })
ok(job.json?.job?.cardId === id, 'reel maker picks the job up', `status ${job.status} ${job.text.slice(0, 120)}`)
const clipA = c1.json.clipId, clipB = c2.json.clipId
const manifest = [{ clipId: null, name: 'title', start: 0, end: 3, kind: 'title' }, { clipId: clipA, name: 'Grandma J', start: 3, end: 8, kind: 'text' }, { clipId: clipB, name: 'Dev', start: 8, end: 13, kind: 'text' }]
const fin = await call(`/api/stitch/final/${id}`, { method: 'PUT', raw: new Uint8Array(2048), headers: { ...auth, 'content-type': 'video/mp4', 'x-churpie-manifest': encodeURIComponent(JSON.stringify(manifest)) } })
ok(fin.status === 200, 'reel is delivered', `status ${fin.status} ${fin.text.slice(0, 120)}`)
b = await host(H); ok(b.json.card.status === 'ready' && b.json.card.hasReel, 'card is ready, not yet opened')
ok((await waitMail('maria@example.com', 2)).some((m) => /reel is ready/.test(m.subject)), 'the host is emailed that the reel is ready')

console.log('\n6 · admin previews, and a guest view: neither counts as the recipient')
const pv = await call(`/api/watch/${Wt}?peek=${sig(Wt)}`)
ok(pv.status === 200 && pv.json?.ready && pv.json?.peek === true, 'admin preview loads the reel')
const gv = await call(`/api/watch/${Wt}?guest=1`)
ok(gv.status === 200 && gv.json?.guest === true, 'a guest view loads the reel')
b = await host(H); ok(b.json.card.status === 'ready' && !b.json.card.openedAt, 'after both, the card is still ready and unopened')
ok((await call(`/api/watch/${Wt}?peek=1`)).status === 403, 'a bad preview link is refused')
ok((await call(`/api/watch/${Wt}?peek=${sig(H)}`)).status === 403, "another link's signature is refused")
const wp = await call(`/w/${Wt}`)
ok(wp.status === 200 && !wp.text.includes('Open without music') && !wp.text.includes('Captions on') && wp.text.includes('Names on screen'), 'reel page: no music-free button, no captions claim')
await everyMinute(); await sleep(1500)
ok(mailTo('grandma@example.com').length === 0, 'nobody is told before the reel has been opened')

console.log('\n7 · the recipient opens it, loves a message and says thanks')
const real = await call(`/api/watch/${Wt}`)
ok(real.status === 200 && real.json?.ready && real.json?.peek === false && real.json?.guest === false, 'recipient opens the reel')
b = await host(H); ok(b.json.card.status === 'sent' && !!b.json.card.openedAt, 'now the card is sent and shows when it was opened')
ok((await call(`/api/watch/${Wt}/reel.mp4`)).status === 200, 'the reel file plays')
await call(`/api/watch/${Wt}/event`, { method: 'POST', body: { type: 'loved', clipId: clipA } })
b = await host(H)
ok(b.json.clips.find((c) => c.id === clipA)?.loved === 1 && b.json.clips.find((c) => c.id === clipB)?.loved === 0, 'the host sees which message was loved')
await call(`/api/watch/${Wt}/reply`, { method: 'POST', body: { text: 'You all made my day.' } })
ok((await call(`/api/host/${H}/replies`)).json?.replies?.length === 1, 'the thank-you note reaches the host')

console.log('\n8 · the recipient sends a video back')
const vhead = { 'content-type': 'video/mp4' }
ok((await call(`/api/watch/${Wt}/reaction`, { method: 'PUT', raw: new Uint8Array(4096), headers: { 'content-type': 'text/plain' } })).status === 400, 'a file that is not a video is refused')
ok((await call(`/api/watch/${Wt}/reaction`)).status === 404, 'there is no video back yet')
ok((await call(`/api/watch/${Wt}/reaction`, { method: 'PUT', raw: new Uint8Array(4096), headers: vhead })).status === 200, 'the video back is sent')
const withR = await call(`/api/watch/${Wt}?guest=1`)
ok(!!withR.json?.reactionUrl && (await call(withR.json.reactionUrl)).status === 200, 'a guest can watch it next to the reel')
b = await host(H)
ok(!!b.json.card.reactionUrl && (await call(b.json.card.reactionUrl)).status === 200, 'the host sees it on the card page')
ok((await call(`/api/watch/${Wt}/reaction`, { method: 'PUT', raw: new Uint8Array(8192), headers: vhead })).status === 200 && (await call(`/api/watch/${Wt}/reaction`)).text.length === 8192, 'recording a new one replaces the old one')
const wpg = await call(`/w/${Wt}`); ok(wpg.text.includes('Want to show them your face?') && wpg.text.includes('reactDlg'), 'the reel page carries the "show them your face" step')

console.log('\n9 · the person who asked hears back, once')
const tick = await everyMinute()
ok(tick.status === 200, 'the every-minute job runs', `status ${tick.status} ${tick.text.slice(0, 120)}`)
const told = (await waitMail('grandma@example.com'))[0]
ok(!!told, 'Grandma J gets her email')
ok(/Rosa opened the reel/.test(told?.subject || ''), 'its subject says Rosa opened the reel', told?.subject)
ok((told?.text || '').includes('Love it') && (told?.text || '').includes('You all made my day.'), 'it carries the love and the thank-you note')
ok((told?.text || '').includes('recorded a video back'), 'it says a video came back')
ok((told?.text || '').includes(`/w/${Wt}?guest=1`), 'its button opens the reel as a guest')
ok((told?.html || '').includes('you asked to hear when the reel was opened') && !(told?.html || '').includes('because you made a card'), 'its footer says why she got it')
await everyMinute(); await sleep(1500)
ok(mailTo('grandma@example.com').length === 1 && mailTo('dev@example.com').length === 0, 'no second email, and nothing to Dev, who opted out')

console.log('\n10 · taking the video back, then the host deletes the card: everything goes')
ok((await call(`/api/watch/${Wt}/reaction`, { method: 'DELETE' })).status === 200 && (await call(`/api/watch/${Wt}/reaction`)).status === 404 && (await call(`/api/watch/${Wt}?guest=1`)).json?.reactionUrl === null, 'the recipient takes the video back and it is gone')
await call(`/api/watch/${Wt}/reaction`, { method: 'PUT', raw: new Uint8Array(4096), headers: vhead })
ok((await call(`/api/host/${H}/delete`, { method: 'POST' })).status === 200, 'the card is deleted')
ok((await host(H)).status === 404 && (await call(`/api/watch/${Wt}?guest=1`)).status === 404 && (await call(`/api/watch/${Wt}/reaction`)).status === 404, 'the card page, the reel and the video back are gone')
done()
