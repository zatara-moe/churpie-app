'use client'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '../lib/supabase'
import { useRouter } from 'next/navigation'

const ROSE = '#C23B6B'
const ROSE_DEEP = '#8C1F45'
const ROSE_PALE = '#FBEAF0'
const INK = '#1a0d0f'
const INK_SOFT = '#7a5a62'
const PARCHMENT = '#FAF8F5'
const PARCHMENT_W = '#F2EDE6'

const themes = [
  { id:'getwell',    icon:'🏥', name:'Get well',       sub:'Hospital & recovery' },
  { id:'birthday',   icon:'🎂', name:'Birthday',        sub:'Celebrate someone' },
  { id:'veteran',    icon:'🎖️', name:'Veteran',         sub:'Honor & gratitude' },
  { id:'support',    icon:'💛', name:'Support',         sub:'You are not alone' },
  { id:'graduation', icon:'🎓', name:'Graduation',      sub:'So proud of you' },
  { id:'justbecause',icon:'✨', name:'Just because',    sub:'Any reason at all' },
]

const musicOptions = [
  { id:'gentle-piano',  label:'Gentle piano',   sub:'Soft & warm' },
  { id:'warm-acoustic', label:'Warm acoustic',  sub:'Guitar & strings' },
  { id:'uplifting',     label:'Uplifting',       sub:'Hopeful & bright' },
  { id:'no-music',      label:'Just their voices', sub:'No music underneath' },
]

// ─── Shared styles ────────────────────────────────────────────────
const s = {
  wrap:  { background:'#f0ebe6', minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-start', padding:'24px 16px 100px' },
  phone: { width:390, maxWidth:'100%', margin:'0 auto', background:PARCHMENT, borderRadius:36, overflow:'hidden', fontFamily:"'DM Sans',system-ui,sans-serif", boxShadow:'0 24px 64px rgba(0,0,0,0.14)', minHeight:660, display:'flex', flexDirection:'column' },
  scroll:{ flex:1, overflowY:'auto', padding:'18px 20px' },
  topbar:{ padding:'14px 20px', display:'flex', alignItems:'center', gap:10, borderBottom:'0.5px solid rgba(26,13,15,0.08)', flexShrink:0 },
  back:  { width:32, height:32, borderRadius:'50%', background:'rgba(26,13,15,0.06)', border:'0.5px solid rgba(26,13,15,0.1)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 },
  btnP:  { width:'100%', padding:'14px 0', borderRadius:14, background:ROSE, color:'#fff', fontSize:15, fontWeight:500, border:'none', cursor:'pointer', marginBottom:10, fontFamily:'inherit', letterSpacing:'-0.1px' },
  btnS:  { width:'100%', padding:'13px 0', borderRadius:14, background:'rgba(26,13,15,0.05)', color:INK, fontSize:15, fontWeight:500, border:'0.5px solid rgba(26,13,15,0.12)', cursor:'pointer', marginBottom:10, fontFamily:'inherit' },
  inp:   { width:'100%', padding:'12px 14px', borderRadius:12, border:'0.5px solid rgba(26,13,15,0.14)', background:'rgba(255,255,255,0.7)', color:INK, fontSize:14, fontFamily:'inherit', boxSizing:'border-box', outline:'none' },
  lbl:   { fontSize:12, color:INK_SOFT, marginBottom:6, display:'block', fontWeight:500 },
  tag:   { fontSize:11, fontWeight:500, color:INK_SOFT, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:8 },
}

// ─── Primitives ───────────────────────────────────────────────────
function Wm({ size=22 }) {
  return (
    <span style={{ fontSize:size, fontWeight:400, letterSpacing:'-0.7px', color:INK, fontFamily:"'DM Sans',system-ui,sans-serif" }}>
      churp<span style={{ display:'inline-block', position:'relative' }}>
        <span style={{ fontSize:size*0.5, position:'absolute', left:'50%', bottom:'82%', transform:'translateX(-50%)', lineHeight:1 }}>🩷</span>
        ı
      </span>e<span style={{ color:ROSE }}>.</span>
    </span>
  )
}

function ChevL() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
}

function Heart({ size=24 }) {
  return <svg width={size} height={size*0.92} viewBox="0 0 100 92" fill="none">
    <path d="M50 86 C50 86 6 59 6 28 C6 14 16 6 27 6 C35 6 43 10 50 18 C57 10 65 6 73 6 C84 6 94 14 94 28 C94 59 50 86 50 86Z" fill={ROSE} opacity=".1"/>
    <path d="M50 78 C50 78 14 55 14 30 C14 19 22 12 32 12 C39 12 46 16 50 24 C54 16 61 12 68 12 C78 12 86 19 86 30 C86 55 50 78 50 78Z" fill={ROSE} opacity=".25"/>
    <path d="M50 67 C50 67 24 50 24 33 C24 25 30 20 38 20 C44 20 48 23 50 29 C52 23 56 20 62 20 C70 20 76 25 76 33 C76 50 50 67 50 67Z" fill={ROSE}/>
    <path d="M33 21C29 22 25 27 25 33" stroke="rgba(255,255,255,0.28)" strokeWidth="2" strokeLinecap="round"/>
  </svg>
}

function Stepper({ steps, current }) {
  return <div style={{ display:'flex', alignItems:'center', padding:'0 20px 14px', flexShrink:0 }}>
    {steps.map((label, i) => (
      <div key={i} style={{ display:'flex', alignItems:'center', flex: i < steps.length-1 ? 1 : 'none' }}>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
          <div style={{ width:24, height:24, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:500,
            background: i < current ? ROSE : i===current ? 'rgba(194,59,107,0.15)' : 'rgba(26,13,15,0.07)',
            border: i===current ? `1.5px solid ${ROSE}` : 'none',
            color: i < current ? '#fff' : i===current ? ROSE : '#aaa' }}>
            {i < current ? '✓' : i+1}
          </div>
          <span style={{ fontSize:9, color: i===current ? ROSE : i<current ? '#888' : '#ccc', whiteSpace:'nowrap' }}>{label}</span>
        </div>
        {i < steps.length-1 && <div style={{ flex:1, height:1, background: i<current ? ROSE : 'rgba(26,13,15,0.1)', margin:'0 4px', marginBottom:16 }}/>}
      </div>
    ))}
  </div>
}

// ─── HOME ─────────────────────────────────────────────────────────
function HomeScreen({ go, session, onSignOut }) {
  return <div style={s.phone}>
    <div style={{ ...s.topbar, borderBottom:'none', paddingBottom:6 }}>
      <div style={{ flex:1 }}><Wm/></div>
      {session
        ? <span onClick={onSignOut} style={{ fontSize:12, color:'#bbb', cursor:'pointer', padding:'6px 10px' }}>Sign out</span>
        : <a href="/login" style={{ fontSize:12, color:ROSE, fontWeight:500, padding:'6px 10px', textDecoration:'none' }}>Sign in</a>
      }
    </div>
    <div style={s.scroll}>
      {/* Hero card */}
      <div style={{ background:'linear-gradient(160deg, #FBEAF0 0%, #F2D4DE 100%)', borderRadius:20, padding:'26px 22px 22px', marginBottom:18, position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', right:-16, top:-16, opacity:0.07, pointerEvents:'none' }}>
          <Heart size={110}/>
        </div>
        <div style={{ width:44, height:44, borderRadius:13, background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:14, boxShadow:'0 2px 12px rgba(194,59,107,0.12)' }}>
          <Heart size={22}/>
        </div>
        <div style={{ fontSize:19, fontWeight:500, color:INK, marginBottom:10, letterSpacing:'-0.4px', lineHeight:1.25 }}>
          Someone you love needs to hear<br/>from everyone who loves them.
        </div>
        <div style={{ fontSize:13, color:INK_SOFT, lineHeight:1.7, marginBottom:18 }}>
          Everyone records fifteen seconds. We weave it into one video — something they can press play on whenever they need it.
        </div>
        <button style={s.btnP} onClick={() => session ? go('create1') : window.location.href='/login'}>
          Make their video
        </button>
        <div style={{ fontSize:11, color:INK_SOFT, opacity:0.55, fontStyle:'italic', textAlign:'center', marginTop:2 }}>
          Free for anyone who needs it.
        </div>
      </div>

      {session && <button style={s.btnS} onClick={() => go('dashboard')}>My cards</button>}

      {/* How it works — 3 quiet steps */}
      <div style={{ marginTop:4 }}>
        <div style={s.tag}>How it works</div>
        {[
          ['Choose your intention','Who it\'s for and what you\'d love people to say.'],
          ['Share a link — everyone records','One link. Opens on any phone. Fifteen seconds to record.'],
          ['We deliver it','One video, soft music, captions — sent directly to them.'],
        ].map(([title, sub], i) => (
          <div key={i} style={{ display:'flex', gap:12, marginBottom:14, alignItems:'flex-start' }}>
            <div style={{ width:26, height:26, borderRadius:'50%', background:ROSE_PALE, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:11, fontWeight:500, color:ROSE_DEEP, marginTop:2 }}>{i+1}</div>
            <div>
              <div style={{ fontSize:13, fontWeight:500, color:INK, marginBottom:2 }}>{title}</div>
              <div style={{ fontSize:12, color:INK_SOFT, lineHeight:1.5 }}>{sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
}

// ─── CREATE STEP 1: Theme ─────────────────────────────────────────
function Create1({ go, card, setCard }) {
  const [sel, setSel] = useState(card.theme || 'getwell')
  return <div style={s.phone}>
    <div style={s.topbar}>
      <div style={s.back} onClick={() => go('home')}><ChevL/></div>
      <span style={{ fontSize:15, fontWeight:500, flex:1, color:INK }}>New card</span>
    </div>
    <Stepper steps={['Intention','Blessing','Delivery','Share']} current={0}/>
    <div style={s.scroll}>
      <div style={{ fontSize:16, fontWeight:500, color:INK, marginBottom:3 }}>What is this for?</div>
      <div style={{ fontSize:13, color:INK_SOFT, marginBottom:16, lineHeight:1.5 }}>This sets the mood for everyone who records.</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:20 }}>
        {themes.map(t => (
          <div key={t.id} onClick={() => setSel(t.id)} style={{ borderRadius:14, padding:'16px 12px', textAlign:'center',
            border:`${sel===t.id ? 2 : 1}px solid ${sel===t.id ? ROSE : 'rgba(26,13,15,0.1)'}`,
            background: sel===t.id ? ROSE_PALE : 'rgba(26,13,15,0.02)', cursor:'pointer', transition:'all 0.15s' }}>
            <div style={{ fontSize:24, marginBottom:6 }}>{t.icon}</div>
            <div style={{ fontSize:12, fontWeight:500, color: sel===t.id ? ROSE_DEEP : INK, marginBottom:2 }}>{t.name}</div>
            <div style={{ fontSize:11, color:INK_SOFT }}>{t.sub}</div>
          </div>
        ))}
      </div>
      <button style={s.btnP} onClick={() => { setCard({ ...card, theme:sel }); go('create2') }}>Continue</button>
    </div>
  </div>
}

// ─── CREATE STEP 2: Blessing / message ───────────────────────────
function Create2({ go, card, setCard }) {
  const [recipient, setRecipient] = useState(card.recipient || '')
  const [message, setMessage] = useState(card.message || '')
  const [deadline, setDeadline] = useState(card.deadline || '')
  const ready = recipient.trim() && message.trim()
  return <div style={s.phone}>
    <div style={s.topbar}>
      <div style={s.back} onClick={() => go('create1')}><ChevL/></div>
      <span style={{ fontSize:15, fontWeight:500, flex:1, color:INK }}>Write your blessing</span>
    </div>
    <Stepper steps={['Intention','Blessing','Delivery','Share']} current={1}/>
    <div style={s.scroll}>
      <div style={{ fontSize:16, fontWeight:500, color:INK, marginBottom:3 }}>Who is this for?</div>
      <div style={{ fontSize:13, color:INK_SOFT, marginBottom:18, lineHeight:1.5 }}>Your note is what everyone reads before they record. Make it specific — the more real it feels, the more powerful the clips will be.</div>
      <div style={{ marginBottom:14 }}>
        <label style={s.lbl}>Their name</label>
        <input style={s.inp} value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="e.g. Aunt Rosa"/>
      </div>
      <div style={{ marginBottom:14 }}>
        <label style={s.lbl}>Your message to contributors</label>
        <textarea style={{ ...s.inp, lineHeight:1.6, resize:'none' }} rows={5}
          value={message} onChange={e => setMessage(e.target.value)}
          placeholder={`e.g. "Aunt Rosa is in the hospital, far from home. She's the one who always showed up for everyone else. Tell her what she means to you."`}/>
        <div style={{ fontSize:11, color:'#bbb', marginTop:4 }}>This appears at the top of every contributor's recording page.</div>
      </div>
      <div style={{ marginBottom:20 }}>
        <label style={s.lbl}>Deadline (optional)</label>
        <input style={s.inp} value={deadline} onChange={e => setDeadline(e.target.value)} placeholder="e.g. Friday April 18"/>
      </div>
      <button style={{ ...s.btnP, opacity: ready ? 1 : 0.45 }} disabled={!ready}
        onClick={() => { setCard({ ...card, recipient, message, deadline }); go('create3') }}>
        Continue
      </button>
    </div>
  </div>
}

// ─── CREATE STEP 3: Delivery ──────────────────────────────────────
function Create3({ go, card, setCard }) {
  const [email, setEmail] = useState(card.email || '')
  const [phone, setPhone] = useState(card.phone || '')
  const [music, setMusic] = useState(card.music || 'gentle-piano')
  return <div style={s.phone}>
    <div style={s.topbar}>
      <div style={s.back} onClick={() => go('create2')}><ChevL/></div>
      <span style={{ fontSize:15, fontWeight:500, flex:1, color:INK }}>How to deliver it</span>
    </div>
    <Stepper steps={['Intention','Blessing','Delivery','Share']} current={2}/>
    <div style={s.scroll}>
      <div style={{ fontSize:16, fontWeight:500, color:INK, marginBottom:3 }}>Where does it go?</div>
      <div style={{ fontSize:13, color:INK_SOFT, marginBottom:18, lineHeight:1.5 }}>When the video is ready we'll send it directly to {card.recipient || 'them'}.</div>
      <div style={{ marginBottom:14 }}>
        <label style={s.lbl}>Their email</label>
        <input style={s.inp} value={email} onChange={e => setEmail(e.target.value)}
          placeholder={`${(card.recipient||'').split(' ')[0]?.toLowerCase() || 'name'}@example.com`} type="email"/>
      </div>
      <div style={{ marginBottom:20 }}>
        <label style={s.lbl}>Their phone (optional)</label>
        <input style={s.inp} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" type="tel"/>
      </div>
      <div style={s.tag}>Background music</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:22 }}>
        {musicOptions.map(m => (
          <div key={m.id} onClick={() => setMusic(m.id)} style={{ borderRadius:12, padding:'11px 13px', cursor:'pointer',
            border:`${music===m.id ? 2 : 1}px solid ${music===m.id ? ROSE : 'rgba(26,13,15,0.1)'}`,
            background: music===m.id ? ROSE_PALE : 'rgba(26,13,15,0.02)', transition:'all 0.15s' }}>
            <div style={{ fontSize:12, fontWeight:500, color: music===m.id ? ROSE_DEEP : INK }}>{m.label}</div>
            <div style={{ fontSize:11, color:INK_SOFT, marginTop:2 }}>{m.sub}</div>
          </div>
        ))}
      </div>
      <button style={s.btnP} onClick={() => { setCard({ ...card, email, phone, music }); go('create4') }}>
        Generate their link →
      </button>
    </div>
  </div>
}

// ─── CREATE STEP 4: Share ─────────────────────────────────────────
function Create4({ go, card, setCard, setCreatedCard }) {
  const [loading, setLoading] = useState(false)
  const [slug, setSlug] = useState(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState(null)

  const createCard = async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/cards/create', {
        method:'POST', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ recipientName:card.recipient, recipientEmail:card.email, recipientPhone:card.phone,
          theme:card.theme, message:card.message, music:card.music, deadline:card.deadline })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSlug(data.card.slug); setCreatedCard(data.card)
    } catch(e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const link = slug ? `${window.location.origin}/c/${slug}` : null
  const copy = () => { navigator.clipboard.writeText(link).then(() => { setCopied(true); setTimeout(()=>setCopied(false),2000) }) }

  return <div style={s.phone}>
    <div style={s.topbar}>
      <div style={s.back} onClick={() => go('create3')}><ChevL/></div>
      <span style={{ fontSize:15, fontWeight:500, flex:1, color:INK }}>Share your link</span>
    </div>
    <Stepper steps={['Intention','Blessing','Delivery','Share']} current={3}/>
    <div style={s.scroll}>
      {!slug ? (
        <div style={{ textAlign:'center', padding:'32px 0' }}>
          <div style={{ width:64, height:64, borderRadius:18, background:ROSE_PALE, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
            <Heart size={28}/>
          </div>
          <div style={{ fontSize:16, fontWeight:500, color:INK, marginBottom:6 }}>Ready to make {card.recipient}'s video?</div>
          <div style={{ fontSize:13, color:INK_SOFT, marginBottom:28, lineHeight:1.55 }}>
            A link will be created that anyone can open to record their fifteen seconds. Share it as widely as you can.
          </div>
          {error && <div style={{ background:'#FCEBEB', border:'0.5px solid #F7C1C1', borderRadius:10, padding:'10px 14px', marginBottom:14, fontSize:13, color:'#A32D2D', textAlign:'left' }}>{error}</div>}
          <button style={{ ...s.btnP, opacity:loading?0.7:1 }} onClick={createCard} disabled={loading}>
            {loading ? 'Creating…' : 'Create and get the link'}
          </button>
        </div>
      ) : (
        <>
          <div style={{ textAlign:'center', padding:'12px 0 18px' }}>
            <div style={{ width:56, height:56, borderRadius:16, background:ROSE_PALE, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 10px' }}>
              <Heart size={24}/>
            </div>
            <div style={{ fontSize:17, fontWeight:500, color:INK, marginBottom:4 }}>Card created for {card.recipient}</div>
            <div style={{ fontSize:13, color:INK_SOFT }}>Send this link to everyone who loves them.</div>
          </div>
          <div style={{ background:'rgba(26,13,15,0.04)', borderRadius:12, padding:'12px 14px', display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
            <div style={{ flex:1, fontSize:12, color:'#555', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{link}</div>
            <div style={{ fontSize:12, fontWeight:500, color:ROSE, cursor:'pointer', flexShrink:0 }} onClick={copy}>{copied?'Copied!':'Copy'}</div>
          </div>
          <button style={{ ...s.btnP, background:'#25D366', marginBottom:8 }}
            onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`${card.recipient} needs to hear from you. Record 15 seconds here: ${link}`)}`)}>
            Share via WhatsApp
          </button>
          <button style={s.btnS} onClick={() => window.open(`sms:?body=${encodeURIComponent(`${card.recipient} needs to hear from you. Record 15 seconds: ${link}`)}`)}>
            Share via text
          </button>
          <div style={{ marginTop:14, borderTop:'0.5px solid rgba(26,13,15,0.08)', paddingTop:14 }}>
            <div style={{ fontSize:13, color:INK_SOFT, lineHeight:1.65 }}>
              Contributors open the link, read your blessing, and record their fifteen seconds. You'll see clips arriving in your dashboard. When you're ready, tap <strong>"Send their video"</strong> to compile and deliver.
            </div>
          </div>
          <button style={{ ...s.btnS, marginTop:14 }} onClick={() => go('dashboard')}>Go to my dashboard</button>
        </>
      )}
    </div>
  </div>
}

// ─── DASHBOARD ───────────────────────────────────────────────────
function Dashboard({ go, session }) {
  const [cards, setCards] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) return
    fetch('/api/cards/list').then(r=>r.json()).then(d=>{ setCards(d.cards||[]); setLoading(false) }).catch(()=>setLoading(false))
  }, [session])

  const statusStyle = st => st==='live'
    ? { bg:'#EAF3DE', color:'#27500A', label:'Collecting' }
    : st==='compiling' ? { bg:'#FAEEDA', color:'#633806', label:'Weaving…' }
    : st==='compiled'  ? { bg:'#E6F1FB', color:'#185FA5', label:'Ready' }
    : { bg:'rgba(26,13,15,0.06)', color:'#888', label:'Done' }

  return <div style={s.phone}>
    <div style={s.topbar}>
      <div style={s.back} onClick={() => go('home')}><ChevL/></div>
      <span style={{ fontSize:15, fontWeight:500, flex:1, color:INK }}>My cards</span>
    </div>
    <div style={s.scroll}>
      {loading && <div style={{ textAlign:'center', padding:40, color:'#aaa', fontSize:14 }}>Loading…</div>}
      {!loading && cards?.length === 0 && (
        <div style={{ textAlign:'center', padding:'48px 0' }}>
          <div style={{ fontSize:15, fontWeight:500, color:INK, marginBottom:6 }}>No cards yet</div>
          <div style={{ fontSize:13, color:INK_SOFT, marginBottom:24, lineHeight:1.6 }}>Is there someone in your life who needs to feel less alone right now?</div>
          <button style={s.btnP} onClick={() => go('create1')}>Make their video</button>
        </div>
      )}
      {cards?.map(card => {
        const ss = statusStyle(card.status)
        const clipCount = card.clips?.[0]?.count ?? card.clips?.length ?? 0
        return (
          <div key={card.id} onClick={() => go(`card:${card.id}`)}
            style={{ background:'#fff', border:'0.5px solid rgba(26,13,15,0.09)', borderRadius:16, padding:'14px 16px', marginBottom:10, cursor:'pointer' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
              <div style={{ fontSize:22 }}>{themes.find(t=>t.id===card.theme)?.icon || '💛'}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:500, color:INK }}>{card.recipient_name}</div>
                <div style={{ fontSize:11, color:INK_SOFT }}>{new Date(card.created_at).toLocaleDateString()}</div>
              </div>
              <div style={{ background:ss.bg, color:ss.color, fontSize:10, fontWeight:500, padding:'3px 9px', borderRadius:20 }}>{ss.label}</div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              <div style={{ background:'rgba(26,13,15,0.03)', borderRadius:10, padding:'9px 11px' }}>
                <div style={{ fontSize:18, fontWeight:500, color:INK }}>{clipCount}</div>
                <div style={{ fontSize:11, color:INK_SOFT }}>voices recorded</div>
              </div>
              <div style={{ background:'rgba(26,13,15,0.03)', borderRadius:10, padding:'9px 11px' }}>
                <div style={{ fontSize:12, fontWeight:500, color:'#555', marginTop:3 }}>
                  {card.status==='live' ? 'Collecting voices' : card.status==='compiling' ? 'Weaving together…' : 'Complete'}
                </div>
                <div style={{ fontSize:11, color:INK_SOFT }}>status</div>
              </div>
            </div>
          </div>
        )
      })}
      {!loading && cards?.length > 0 && (
        <button style={{ ...s.btnP, marginTop:8 }} onClick={() => go('create1')}>+ Make another card</button>
      )}
    </div>
  </div>
}

// ─── CARD DETAIL ──────────────────────────────────────────────────
function CardDetail({ go, cardId }) {
  const [card, setCard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [compiling, setCompiling] = useState(false)
  const [compiled, setCompiled] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch(`/api/cards/${cardId}`).then(r=>r.json()).then(d=>{ setCard(d.card); setLoading(false) })
  }, [cardId])

  const compile = async () => {
    setCompiling(true)
    const res = await fetch(`/api/cards/${cardId}/compile`, { method:'POST' })
    const data = await res.json()
    if (res.ok) setCompiled(true)
    else { setCompiling(false); alert(data.error) }
  }

  const link = card ? `${window.location.origin}/c/${card.slug}` : ''
  const copy = () => { navigator.clipboard.writeText(link); setCopied(true); setTimeout(()=>setCopied(false),2000) }
  const clips = card?.clips?.filter(c=>c.status==='submitted') || []

  if (loading) return <div style={s.phone}><div style={{ textAlign:'center', padding:60, color:'#aaa' }}>Loading…</div></div>
  if (compiled) return <CompiledScreen recipientName={card?.recipient_name} clipCount={clips.length} go={go}/>

  return <div style={s.phone}>
    <div style={s.topbar}>
      <div style={s.back} onClick={() => go('dashboard')}><ChevL/></div>
      <span style={{ fontSize:14, fontWeight:500, flex:1, color:INK, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
        {card?.recipient_name} · {themes.find(t=>t.id===card?.theme)?.name}
      </span>
    </div>
    <div style={s.scroll}>
      {/* Share link bar */}
      <div style={{ background:'rgba(26,13,15,0.04)', borderRadius:12, padding:'11px 14px', display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
        <div style={{ flex:1, fontSize:12, color:'#666', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{link}</div>
        <div style={{ fontSize:12, fontWeight:500, color:ROSE, cursor:'pointer', flexShrink:0 }} onClick={copy}>{copied?'Copied!':'Copy link'}</div>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
        <div style={{ background:'rgba(26,13,15,0.04)', borderRadius:12, padding:'12px 14px' }}>
          <div style={{ fontSize:24, fontWeight:500, color:INK }}>{clips.length}</div>
          <div style={{ fontSize:11, color:INK_SOFT, marginTop:2 }}>voices recorded</div>
        </div>
        <div style={{ background:'rgba(26,13,15,0.04)', borderRadius:12, padding:'12px 14px' }}>
          <div style={{ fontSize:12, fontWeight:500, color:'#555', marginTop:3 }}>
            {card?.status==='live' ? 'Collecting voices' : card?.status==='compiling' ? 'Weaving together…' : 'Complete'}
          </div>
          <div style={{ fontSize:11, color:INK_SOFT }}>status</div>
        </div>
      </div>

      {/* Ready to send nudge */}
      {clips.length > 0 && !compiling && (
        <div style={{ background:ROSE_PALE, borderRadius:14, padding:'14px 16px', marginBottom:14, display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:'rgba(194,59,107,0.15)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <Heart size={16}/>
          </div>
          <div>
            <div style={{ fontSize:14, fontWeight:500, color:ROSE_DEEP }}>Ready to send?</div>
            <div style={{ fontSize:12, color:ROSE_DEEP, opacity:0.75, marginTop:2 }}>{clips.length} voices waiting for {card?.recipient_name}</div>
          </div>
        </div>
      )}
      {compiling && (
        <div style={{ background:'#FAEEDA', borderRadius:14, padding:'14px 16px', marginBottom:14, textAlign:'center' }}>
          <div style={{ fontSize:14, fontWeight:500, color:'#633806', marginBottom:3 }}>Weaving all the voices together…</div>
          <div style={{ fontSize:12, color:'#854F0B' }}>This takes 1–3 minutes. You can close this page.</div>
        </div>
      )}

      {/* Contributors list */}
      <div style={s.tag}>Who's contributed ({clips.length})</div>
      {clips.length === 0 && (
        <div style={{ textAlign:'center', padding:'18px 0', color:'#aaa', fontSize:13 }}>
          No voices yet — share the link to get started
        </div>
      )}
      {clips.map((c, i) => (
        <div key={i} style={{ display:'flex', alignItems:'center', gap:11, padding:'10px 0', borderBottom:'0.5px solid rgba(26,13,15,0.06)' }}>
          <div style={{ width:36, height:36, borderRadius:'50%', background:ROSE_PALE, color:ROSE_DEEP, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:500, flexShrink:0 }}>
            {(c.contributor_name||'?').charAt(0).toUpperCase()}
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, fontWeight:500, color:INK }}>{c.contributor_name || 'Someone who loves them'}</div>
            <div style={{ fontSize:11, color:'#3B7D4A' }}>✓ Voice recorded · {c.duration_seconds||15}s</div>
          </div>
        </div>
      ))}

      {/* Compile button */}
      {clips.length > 0 && (
        <button style={{ ...s.btnP, marginTop:20, opacity:compiling?0.6:1 }} onClick={compile} disabled={compiling}>
          {compiling ? 'Weaving together…' : `Send their video to ${card?.recipient_name}`}
        </button>
      )}
      <button style={{ ...s.btnS, marginTop: clips.length > 0 ? 0 : 14 }}
        onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`${card?.recipient_name} needs to hear from you. Record your 15 seconds here: ${link}`)}`)}>
        Share link again
      </button>
    </div>
  </div>
}

// ─── COMPILED CONFIRMATION ────────────────────────────────────────
function CompiledScreen({ recipientName, clipCount, go }) {
  return <div style={s.phone}>
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', padding:'48px 28px', minHeight:660 }}>
      <div style={{ width:72, height:72, borderRadius:22, background:'#EAF3DE', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><path d="M6 16l7 7L26 9" stroke="#27500A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </div>
      <div style={{ fontSize:22, fontWeight:500, color:INK, marginBottom:8, letterSpacing:'-0.4px' }}>
        On its way to {recipientName}.
      </div>
      <div style={{ fontSize:14, color:INK_SOFT, lineHeight:1.7, marginBottom:28 }}>
        {clipCount} voices, woven together into one gift. {recipientName} will receive it by email and can press play whenever they need it.
      </div>
      <div style={{ background:'rgba(26,13,15,0.04)', borderRadius:16, padding:'16px 20px', width:'100%', marginBottom:20, textAlign:'left' }}>
        <div style={{ fontSize:13, color:INK_SOFT, lineHeight:1.6 }}>They'll have a link to watch anytime for the next 90 days. Consider letting them know something special is in their inbox.</div>
      </div>
      <button style={{ ...s.btnP, width:'100%', marginBottom:8 }} onClick={() => go('home')}>Done</button>
      <button style={{ ...s.btnS, width:'100%' }} onClick={() => go('create1')}>Make another card</button>
    </div>
  </div>
}

// ─── BOTTOM NAV ───────────────────────────────────────────────────
function BottomNav({ screen, go, session }) {
  const tabs = [
    { id:'home', label:'Home', icon:<svg width="20" height="20" viewBox="0 0 22 22" fill="none"><path d="M3 9.5L11 3l8 6.5V19a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg> },
    { id:'create1', label:'Create', icon:<svg width="20" height="20" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.3"/><path d="M11 7v8M7 11h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg> },
    ...(session ? [{ id:'dashboard', label:'Cards', icon:<svg width="20" height="20" viewBox="0 0 22 22" fill="none"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><rect x="12" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><rect x="3" y="12" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><rect x="12" y="12" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3"/></svg> }] : []),
  ]
  const active = screen.startsWith('card:') ? 'dashboard' : screen
  return (
    <div style={{ maxWidth:390, margin:'8px auto 0', background:'rgba(250,248,245,0.97)', display:'flex', borderTop:'0.5px solid rgba(26,13,15,0.08)', borderRadius:'0 0 36px 36px', boxShadow:'0 8px 24px rgba(26,13,15,0.06)' }}>
      {tabs.map(({ id, label, icon }) => {
        const isActive = active === id
        return (
          <div key={id} onClick={() => go(id)} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4, cursor:'pointer', padding:'12px 8px 10px', position:'relative', transition:'color 0.15s', color: isActive ? ROSE : '#aaa' }}>
            {/* Active indicator pill */}
            {isActive && <div style={{ position:'absolute', top:0, left:'50%', transform:'translateX(-50%)', width:24, height:2.5, borderRadius:2, background:ROSE }}/>}
            {icon}
            <span style={{ fontSize:10, fontWeight: isActive ? 600 : 400, letterSpacing:'0.1px' }}>{label}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── ROOT ─────────────────────────────────────────────────────────
export default function AppShell({ session }) {
  const [screen, setScreen] = useState('home')
  const [card, setCard] = useState({ theme:'getwell', music:'gentle-piano' })
  const [createdCard, setCreatedCard] = useState(null)
  const supabase = createBrowserClient()
  const router = useRouter()
  const go = s => setScreen(s)
  const signOut = async () => { await supabase.auth.signOut(); router.refresh() }

  const renderScreen = () => {
    if (screen==='home')      return <HomeScreen go={go} session={session} onSignOut={signOut}/>
    if (screen==='create1')   return <Create1 go={go} card={card} setCard={setCard}/>
    if (screen==='create2')   return <Create2 go={go} card={card} setCard={setCard}/>
    if (screen==='create3')   return <Create3 go={go} card={card} setCard={setCard}/>
    if (screen==='create4')   return <Create4 go={go} card={card} setCard={setCard} setCreatedCard={setCreatedCard}/>
    if (screen==='dashboard') return <Dashboard go={go} session={session}/>
    if (screen.startsWith('card:')) return <CardDetail go={go} cardId={screen.replace('card:','')}/>
    return <HomeScreen go={go} session={session} onSignOut={signOut}/>
  }

  return (
    <div style={s.wrap}>
      {renderScreen()}
      <BottomNav screen={screen} go={go} session={session}/>
    </div>
  )
}
