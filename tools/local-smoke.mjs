// churpie · a walk through one whole card against a local copy of the app (never the live site).
// Run by TEST-LOCAL-MAC.command. Usage: node tools/local-smoke.mjs http://localhost:8799 dev-token
import { createHmac } from 'node:crypto'

const BASE = process.argv[2] || 'http://localhost:8799'
const STITCH = process.argv[3] || 'dev-token'
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) { console.error('This test only runs against a local copy.'); process.exit(2) }

let failed = 0
const ok = (cond, label, extra = '') => { console.log(`${cond ? '  ok  ' : '  FAIL'}  ${label}${cond || !extra ? '' : `  (${extra})`}`); if (!cond) failed++ }
const call = async (path, { method = 'GET', body, headers = {}, raw } = {}) => {
  const r = await fetch(BASE + path, { method, headers: { ...(raw ? {} : { 'content-type': 'application/json' }), ...headers }, body: raw ?? (body ? JSON.stringify(body) : undefined) })
  const text = await r.text(); let json = null; try { json = JSON.parse(text) } catch {}
  return { status: r.status, json, text }
}
// the same signature the app makes for admin peek links
const sig = (token, back = 0) => createHmac('sha256', STITCH).update(`peek:${token}:${Math.floor(Date.now() / 3600e3) - back}`).digest('hex').slice(0, 32)
const host = async (t, q = '') => (await call(`/api/host/${t}${q}`))

console.log('\n1 · pages')
for (const [p, must] of [['/', 'churpie'], ['/new', 'churpie'], ['/privacy', 'hello@sherwooddigital.org'], ['/terms', 'the terms, in plain words'], ['/admin', 'admin']]) {
  const r = await call(p); ok(r.status === 200 && r.text.includes(must), `${p} loads`, `status ${r.status}`)
}
ok((await call('/')).text.includes('href="/terms"'), 'home page footer links to the terms')
ok((await call('/api/admin/stats')).status === 403, 'admin data is refused without an admin sign-in')

console.log('\n2 · make a card and add two messages')
const made = await call('/api/cards', { method: 'POST', body: { recipientName: 'Rosa Test', hostName: 'Maria Test', prompt: 'What is your favorite memory with Rosa?', moment: 'birthday' } })
ok(made.status === 200 && made.json?.hostToken, 'card is made', `status ${made.status} ${made.text.slice(0, 120)}`)
if (!made.json?.hostToken) { console.log('\nThe card could not be made, so the rest cannot run.'); process.exit(1) }
const id = made.json.id, H = made.json.hostToken, Wt = made.json.links.watch.split('/w/')[1]
const c1 = await call(`/api/cards/${id}/clips`, { method: 'POST', body: { name: 'Grandma J', location: 'Phoenix, AZ', kind: 'text', text: 'Happy birthday, Rosa.' } })
const c2 = await call(`/api/cards/${id}/clips`, { method: 'POST', body: { name: 'Dev', kind: 'text', text: 'You taught me to drive.' } })
ok(c1.status === 200 && c2.status === 200, 'two written messages go in')
let b = await host(H)
ok(b.json?.clips?.length === 2 && b.json.card.status === 'open', 'the card page shows both, card is open')
ok(b.json?.clips?.every((c) => c.loved === 0) && b.json.card.peek === false, 'card page reports loves (0 so far) and is not an admin view')

console.log('\n3 · admin look at the card page')
const peekBoard = await host(H, `?peek=${sig(H)}`)
ok(peekBoard.status === 200 && peekBoard.json?.card?.peek === true, 'a signed admin link opens the card page as an admin view')
ok((await host(H, `?peek=${sig(H, 1)}`)).status === 200, 'a link signed in the last hour still works')
ok((await host(H, '?peek=1')).status === 403, 'the old ?peek=1 link is refused')
ok((await host(H, `?peek=${sig(H, 3)}`)).status === 403, 'a link from three hours ago is refused')
const hp = await call(`/h/${H}?peek=${sig(H)}`); ok(hp.status === 200 && hp.text.includes('READ_ONLY'), 'card page carries the read-only guard')

console.log('\n4 · make the reel (standing in for the reel maker)')
ok((await call(`/api/host/${H}/send`, { method: 'POST' })).json?.status === 'queued', 'host presses make the reel: queued')
const auth = { authorization: `Bearer ${STITCH}` }
const job = await call('/api/stitch/next', { method: 'POST', headers: auth })
ok(job.json?.job?.cardId === id, 'reel maker picks the job up', `status ${job.status} ${job.text.slice(0, 120)}`)
const clipA = b.json.clips[0].id, clipB = b.json.clips[1].id
const manifest = [{ clipId: null, name: 'title', start: 0, end: 3, kind: 'title' }, { clipId: clipA, name: 'Grandma J', start: 3, end: 8, kind: 'text' }, { clipId: clipB, name: 'Dev', start: 8, end: 13, kind: 'text' }]
const fin = await call(`/api/stitch/final/${id}`, { method: 'PUT', raw: new Uint8Array(2048), headers: { ...auth, 'content-type': 'video/mp4', 'x-churpie-manifest': encodeURIComponent(JSON.stringify(manifest)) } })
ok(fin.status === 200, 'reel is delivered', `status ${fin.status} ${fin.text.slice(0, 120)}`)
b = await host(H); ok(b.json.card.status === 'ready' && b.json.card.hasReel, 'card is ready, not yet opened')

console.log('\n5 · admin previews the reel: must not count as the recipient')
const pv = await call(`/api/watch/${Wt}?peek=${sig(Wt)}`)
ok(pv.status === 200 && pv.json?.ready && pv.json?.peek === true, 'admin preview loads the reel')
b = await host(H); ok(b.json.card.status === 'ready' && !b.json.card.openedAt, 'after the preview the card is still ready and unopened')
ok((await call(`/api/watch/${Wt}?peek=1`)).status === 403, 'a bad preview link is refused')
ok((await call(`/api/watch/${Wt}?peek=${sig(H)}`)).status === 403, "another link's signature is refused")
b = await host(H); ok(b.json.card.status === 'ready', 'refused previews change nothing')
const wp = await call(`/w/${Wt}`)
ok(wp.status === 200 && !wp.text.includes('Open without music') && !wp.text.includes('Captions on') && wp.text.includes('Names on screen'), 'reel page: no music-free button, no captions claim')

console.log('\n6 · the recipient opens it')
const real = await call(`/api/watch/${Wt}`)
ok(real.status === 200 && real.json?.ready && real.json?.peek === false, 'recipient opens the reel')
b = await host(H); ok(b.json.card.status === 'sent' && !!b.json.card.openedAt, 'now the card is sent and shows when it was opened')
ok((await call(`/api/watch/${Wt}/reel.mp4`)).status === 200, 'the reel file plays')

console.log('\n7 · love and thank-you reach the host')
await call(`/api/watch/${Wt}/event`, { method: 'POST', body: { type: 'loved', clipId: clipA } })
b = await host(H)
ok(b.json.clips.find((c) => c.id === clipA)?.loved === 1 && b.json.clips.find((c) => c.id === clipB)?.loved === 0, "the host sees which message was loved")
await call(`/api/watch/${Wt}/reply`, { method: 'POST', body: { text: 'You all made my day.' } })
ok((await call(`/api/host/${H}/replies`)).json?.replies?.length === 1, 'the thank-you note reaches the host')

console.log(failed ? `\n${failed} CHECK${failed === 1 ? '' : 'S'} FAILED\n` : '\nALL CHECKS PASSED\n')
process.exit(failed ? 1 : 0)
