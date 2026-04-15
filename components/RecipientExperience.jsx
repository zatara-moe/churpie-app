'use client'
import { useState, useRef } from 'react'

const ROSE = '#C23B6B'
const ROSE_DEEP = '#8C1F45'
const INK = '#0d0d0d'
const INK_SOFT = 'rgba(255,255,255,0.45)'

const avatarColors = [
  { bg:'#534AB7', fg:'#CECBF6' }, { bg:'#0F6E56', fg:'#9FE1CB' },
  { bg:'#854F0B', fg:'#FAC775' }, { bg:'#185FA5', fg:'#B5D4F4' },
  { bg:'#993C1D', fg:'#F5C4B3' }, { bg:'#3B6D11', fg:'#C0DD97' },
  { bg:'#72243E', fg:'#F4C0D1' },
]

function Heart({ size=24 }) {
  return <svg width={size} height={size*0.92} viewBox="0 0 100 92" fill="none">
    <path d="M50 86 C50 86 6 59 6 28 C6 14 16 6 27 6 C35 6 43 10 50 18 C57 10 65 6 73 6 C84 6 94 14 94 28 C94 59 50 86 50 86Z" fill={ROSE} opacity=".15"/>
    <path d="M50 78 C50 78 14 55 14 30 C14 19 22 12 32 12 C39 12 46 16 50 24 C54 16 61 12 68 12 C78 12 86 19 86 30 C86 55 50 78 50 78Z" fill={ROSE} opacity=".35"/>
    <path d="M50 67 C50 67 24 50 24 33 C24 25 30 20 38 20 C44 20 48 23 50 29 C52 23 56 20 62 20 C70 20 76 25 76 33 C76 50 50 67 50 67Z" fill={ROSE}/>
    <path d="M33 21C29 22 25 27 25 33" stroke="rgba(255,255,255,0.28)" strokeWidth="2" strokeLinecap="round"/>
  </svg>
}

export default function RecipientExperience({ card, videoUrl }) {
  const [screen, setScreen] = useState('reveal')
  const [replyText, setReplyText] = useState('')
  const [replySent, setReplySent] = useState(false)
  const [sendingReply, setSendingReply] = useState(false)
  const videoRef = useRef(null)

  const phoneStyle = {
    width:390, maxWidth:'100%', margin:'0 auto', background:'#0d0d0d',
    borderRadius:36, overflow:'hidden', fontFamily:"'DM Sans',system-ui,sans-serif",
    boxShadow:'0 24px 80px rgba(0,0,0,0.5)',
  }
  const wrap = { background:'#1a0d12', minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-start', padding:'24px 16px 40px' }

  const sendReply = async () => {
    if (!replyText.trim()) return
    setSendingReply(true)
    try {
      await fetch('/api/replies', { method:'POST', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ cardId:card.id, message:replyText }) })
      setReplySent(true)
    } catch(e) { /* silent */ }
    finally { setSendingReply(false) }
  }

  // ── REVEAL ───────────────────────────────────────────────────────
  if (screen === 'reveal') return (
    <div style={wrap}>
    <div style={phoneStyle}>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'44px 24px 36px', minHeight:660 }}>
        {/* Wordmark */}
        <span style={{ fontSize:14, fontWeight:400, letterSpacing:'-0.5px', color:'rgba(255,255,255,0.25)', marginBottom:36, fontFamily:"'DM Sans',system-ui,sans-serif" }}>
          churp<span style={{ display:'inline-block', position:'relative' }}>
            <span style={{ fontSize:7, position:'absolute', left:'50%', bottom:'82%', transform:'translateX(-50%)', lineHeight:1 }}>🩷</span>
            ı
          </span>e<span style={{ color:ROSE }}>.</span>
        </span>

        {/* Heart with pulse rings */}
        <div style={{ position:'relative', width:120, height:120, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:22 }}>
          <div style={{ position:'absolute', inset:-14, borderRadius:'50%', border:'1.5px solid rgba(194,59,107,0.2)' }}/>
          <div style={{ position:'absolute', inset:-5, borderRadius:'50%', border:'1px solid rgba(194,59,107,0.12)' }}/>
          <Heart size={100}/>
        </div>

        <div style={{ fontSize:13, color:'rgba(255,255,255,0.38)', marginBottom:8 }}>A gift for</div>
        <div style={{ fontSize:30, fontWeight:500, color:'#fff', marginBottom:6, letterSpacing:'-0.5px' }}>{card.recipientName}</div>
        <div style={{ fontSize:14, color:'rgba(255,255,255,0.4)', marginBottom:18, lineHeight:1.5, textAlign:'center', maxWidth:240 }}>
          from everyone who loves you — something you can replay whenever you need it
        </div>

        {/* Contributor avatars */}
        <div style={{ display:'flex', justifyContent:'center', margin:'0 0 6px' }}>
          {card.contributors.slice(0,5).map((c, i) => {
            const col = avatarColors[i % avatarColors.length]
            return <div key={i} style={{ width:32, height:32, borderRadius:'50%', border:'2px solid #0d0d0d', background:col.bg, color:col.fg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:500, marginLeft:i===0?0:-8 }}>
              {(c.name||'?').charAt(0).toUpperCase()}
            </div>
          })}
          {card.contributors.length > 5 && (
            <div style={{ width:32, height:32, borderRadius:'50%', border:'2px solid #0d0d0d', background:'#333', color:'#ccc', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:500, marginLeft:-8 }}>
              +{card.contributors.length - 5}
            </div>
          )}
        </div>
        <div style={{ fontSize:13, color:'rgba(255,255,255,0.35)', marginBottom:22 }}>
          {card.clipCount} {card.clipCount === 1 ? 'person' : 'people'} took a moment to record something just for you
        </div>

        {/* Creator note */}
        {card.creatorNote && (
          <div style={{ background:'rgba(255,255,255,0.06)', borderRadius:14, padding:'14px 16px', marginBottom:24, width:'100%', border:'0.5px solid rgba(255,255,255,0.09)' }}>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.28)', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.5px' }}>A note for you</div>
            <div style={{ fontSize:13, color:'rgba(255,255,255,0.72)', lineHeight:1.65, fontStyle:'italic' }}>"{card.creatorNote}"</div>
          </div>
        )}

        {/* Play button */}
        {videoUrl
          ? <div onClick={() => setScreen('player')} style={{ width:68, height:68, borderRadius:'50%', background:ROSE, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', marginBottom:10, boxShadow:`0 8px 32px rgba(194,59,107,0.45)` }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M6 4l14 8-14 8V4z" fill="#fff"/></svg>
            </div>
          : <div style={{ fontSize:13, color:'rgba(255,255,255,0.3)', marginTop:8 }}>Your video is being prepared…</div>
        }
        {videoUrl && <div style={{ fontSize:12, color:'rgba(255,255,255,0.3)' }}>Tap to watch · {card.clipCount} voices</div>}
      </div>
    </div>
    </div>
  )

  // ── PLAYER ───────────────────────────────────────────────────────
  if (screen === 'player') return (
    <div style={wrap}>
    <div style={phoneStyle}>
      <div style={{ display:'flex', flexDirection:'column', minHeight:660 }}>
        <video ref={videoRef} src={videoUrl} controls playsInline autoPlay
          style={{ width:'100%', background:'#000', borderRadius:'36px 36px 0 0' }}/>
        <div style={{ padding:'16px 20px' }}>
          <div style={{ fontSize:17, fontWeight:500, color:'#fff', marginBottom:3, letterSpacing:'-0.3px' }}>
            For {card.recipientName}
          </div>
          <div style={{ fontSize:12, color:'rgba(255,255,255,0.38)', marginBottom:18 }}>
            {card.clipCount} voices, all here for you
          </div>
          <div style={{ fontSize:11, color:'rgba(255,255,255,0.25)', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.5px' }}>
            Everyone in this video
          </div>
          {/* Contributor scroll */}
          <div style={{ display:'flex', gap:10, overflowX:'auto', paddingBottom:6, marginBottom:14 }}>
            {card.contributors.map((c, i) => {
              const col = avatarColors[i % avatarColors.length]
              return <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, flexShrink:0 }}>
                <div style={{ width:36, height:36, borderRadius:'50%', background:col.bg, color:col.fg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:500 }}>
                  {(c.name||'?').charAt(0).toUpperCase()}
                </div>
                <div style={{ fontSize:10, color:'rgba(255,255,255,0.5)', whiteSpace:'nowrap', maxWidth:52, overflow:'hidden', textOverflow:'ellipsis' }}>
                  {c.name?.split(' ')[0] || 'Friend'}
                </div>
              </div>
            })}
          </div>
        </div>
        <div style={{ padding:'0 20px 28px', display:'flex', gap:10 }}>
          <button style={{ flex:1, padding:13, borderRadius:12, background:ROSE, color:'#fff', fontSize:13, fontWeight:500, border:'none', cursor:'pointer', fontFamily:'inherit' }}
            onClick={() => setScreen('reply')}>
            Send a thank you
          </button>
          <button style={{ flex:1, padding:13, borderRadius:12, background:'rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.7)', fontSize:13, fontWeight:500, border:'none', cursor:'pointer', fontFamily:'inherit' }}
            onClick={() => { if (videoRef.current) { const a=document.createElement('a'); a.href=videoUrl; a.download=`churpie-${card.recipientName}.mp4`; a.click() } }}>
            Save video
          </button>
        </div>
      </div>
    </div>
    </div>
  )

  // ── REPLY ────────────────────────────────────────────────────────
  if (screen === 'reply') return (
    <div style={wrap}>
    <div style={phoneStyle}>
      <div style={{ display:'flex', flexDirection:'column', padding:'32px 24px', minHeight:660 }}>
        <div style={{ fontSize:13, color:'rgba(255,255,255,0.28)', cursor:'pointer', marginBottom:22 }} onClick={() => setScreen('player')}>
          ← back
        </div>
        {!replySent ? (
          <>
            <div style={{ fontSize:20, fontWeight:500, color:'#fff', marginBottom:6, letterSpacing:'-0.3px' }}>
              Say thank you
            </div>
            <div style={{ fontSize:13, color:'rgba(255,255,255,0.42)', marginBottom:22, lineHeight:1.6 }}>
              Your message will reach all {card.clipCount} people who showed up for you. Say whatever is in your heart.
            </div>
            <textarea
              value={replyText} onChange={e => setReplyText(e.target.value)}
              style={{ width:'100%', background:'rgba(255,255,255,0.07)', border:'0.5px solid rgba(255,255,255,0.12)', borderRadius:14, padding:14, color:'#fff', fontSize:14, fontFamily:'inherit', resize:'none', lineHeight:1.65, marginBottom:10, boxSizing:'border-box', outline:'none' }}
              rows={5} placeholder="Write whatever is in your heart…"/>
            <div style={{ fontSize:12, color:'rgba(255,255,255,0.25)', marginBottom:22, lineHeight:1.5 }}>
              Each person receives your message privately.
            </div>
            <button
              style={{ width:'100%', padding:14, borderRadius:14, background:replyText.trim()?ROSE:'rgba(255,255,255,0.08)', color:replyText.trim()?'#fff':'rgba(255,255,255,0.28)', fontSize:14, fontWeight:500, border:'none', cursor:replyText.trim()?'pointer':'default', fontFamily:'inherit', opacity:sendingReply?0.7:1 }}
              onClick={sendReply} disabled={!replyText.trim()||sendingReply}>
              {sendingReply ? 'Sending…' : 'Send to everyone'}
            </button>
          </>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', paddingTop:60 }}>
            <div style={{ width:64, height:64, borderRadius:20, background:'rgba(194,59,107,0.15)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path d="M5 14l6 6L23 8" stroke={ROSE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div style={{ fontSize:18, fontWeight:500, color:'#fff', marginBottom:8 }}>Your thank you was sent.</div>
            <div style={{ fontSize:13, color:'rgba(255,255,255,0.4)', lineHeight:1.65, marginBottom:28 }}>
              Everyone who contributed received your words. They'll know it meant something.
            </div>
            <button style={{ width:'100%', padding:14, borderRadius:14, background:'rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.72)', fontSize:14, fontWeight:500, border:'none', cursor:'pointer', fontFamily:'inherit' }}
              onClick={() => setScreen('player')}>
              Watch again
            </button>
          </div>
        )}
      </div>
    </div>
    </div>
  )

  return null
}
