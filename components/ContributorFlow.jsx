'use client'
import { useState, useRef } from 'react'

const ROSE = '#C23B6B'
const ROSE_DEEP = '#8C1F45'
const ROSE_PALE = '#FBEAF0'
const INK = '#1a0d0f'
const INK_SOFT = '#7a5a62'
const PARCHMENT = '#FAF8F5'

const s = {
  wrap:  { background:'#f0ebe6', minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-start', padding:'24px 16px 40px' },
  phone: { width:390, maxWidth:'100%', margin:'0 auto', background:PARCHMENT, borderRadius:36, overflow:'hidden', fontFamily:"'DM Sans',system-ui,sans-serif", boxShadow:'0 24px 64px rgba(0,0,0,0.14)', minHeight:660, display:'flex', flexDirection:'column' },
  scroll:{ flex:1, overflowY:'auto', padding:'18px 20px' },
  topbar:{ padding:'14px 20px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
  back:  { width:32, height:32, borderRadius:'50%', background:'rgba(26,13,15,0.06)', border:'0.5px solid rgba(26,13,15,0.1)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 },
  btnP:  { width:'100%', padding:'14px 0', borderRadius:14, background:ROSE, color:'#fff', fontSize:15, fontWeight:500, border:'none', cursor:'pointer', marginBottom:10, fontFamily:'inherit' },
  btnS:  { width:'100%', padding:'13px 0', borderRadius:14, background:'rgba(26,13,15,0.05)', color:INK, fontSize:15, fontWeight:500, border:'0.5px solid rgba(26,13,15,0.12)', cursor:'pointer', marginBottom:10, fontFamily:'inherit' },
  inp:   { width:'100%', padding:'12px 14px', borderRadius:12, border:'0.5px solid rgba(26,13,15,0.14)', background:'rgba(255,255,255,0.7)', color:INK, fontSize:14, fontFamily:'inherit', boxSizing:'border-box', outline:'none' },
}

function Wm() {
  return <span style={{ fontSize:16, fontWeight:400, letterSpacing:'-0.5px', color:INK, fontFamily:"'DM Sans',system-ui,sans-serif" }}>
    churp<span style={{ display:'inline-block', position:'relative' }}>
      <span style={{ fontSize:8, position:'absolute', left:'50%', bottom:'82%', transform:'translateX(-50%)', lineHeight:1 }}>🩷</span>
      ı
    </span>e<span style={{ color:ROSE }}>.</span>
  </span>
}

function ChevL() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
}

function Heart({ size=24 }) {
  return <svg width={size} height={size*0.92} viewBox="0 0 100 92" fill="none">
    <path d="M50 67 C50 67 24 50 24 33 C24 25 30 20 38 20 C44 20 48 23 50 29 C52 23 56 20 62 20 C70 20 76 25 76 33 C76 50 50 67 50 67Z" fill={ROSE}/>
    <path d="M33 21C29 22 25 27 25 33" stroke="rgba(255,255,255,0.28)" strokeWidth="2" strokeLinecap="round"/>
  </svg>
}

export default function ContributorFlow({ card }) {
  const [screen, setScreen] = useState('context')
  const [name, setName] = useState('')
  const [recSecs, setRecSecs] = useState(0)
  const [recOn, setRecOn] = useState(false)
  const [countdown, setCountdown] = useState(null) // 3, 2, 1, null
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const timerRef = useRef(null)
  const mediaRef = useRef(null)
  const chunksRef = useRef([])
  const blobRef = useRef(null)

  const go = s => { setError(null); setScreen(s) }

  const startRec = async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video:true, audio:true })
      // Store stream on ref so countdown can access it
      mediaRef._pendingStream = stream

      // 3-2-1 countdown before recording starts
      for (const n of [3, 2, 1]) {
        setCountdown(n)
        await new Promise(r => setTimeout(r, 1000))
      }
      setCountdown(null)

      chunksRef.current = []
      const mr = new MediaRecorder(stream, { mimeType:getSupportedMimeType() })
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        blobRef.current = new Blob(chunksRef.current, { type:getSupportedMimeType() })
        stream.getTracks().forEach(t => t.stop())
        go('preview')
      }
      mediaRef.current = mr
      mr.start(250)
      setRecOn(true); setRecSecs(0)
      timerRef.current = setInterval(() => {
        setRecSecs(s => {
          if (s >= 14) { stopRec(); return s }
          return s + 1
        })
      }, 1000)
    } catch(e) {
      setError('Camera access was denied. Please allow camera access and try again.')
    }
  }

  const stopRec = () => {
    clearInterval(timerRef.current); setRecOn(false)
    if (mediaRef.current?.state === 'recording') mediaRef.current.stop()
  }

  const uploadClip = async (blob, durationSecs) => {
    setUploading(true); setError(null)
    try {
      const urlRes = await fetch('/api/clips/upload-url', {
        method:'POST', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ cardSlug:card.slug, contributorName:name||null })
      })
      const { uploadUrl, clipId } = await urlRes.json()
      if (!uploadUrl) throw new Error('Could not get upload URL')
      await fetch(uploadUrl, { method:'PUT', body:blob, headers:{ 'Content-Type':getSupportedMimeType() } })
      await fetch(`/api/clips/${clipId}/confirm`, {
        method:'POST', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ durationSeconds:durationSecs })
      })
      go('sent')
    } catch(e) { setError(e.message) }
    finally { setUploading(false) }
  }

  const handleFileUpload = async (file) => {
    if (!file) return
    const url = URL.createObjectURL(file)
    const vid = document.createElement('video')
    vid.src = url
    await new Promise(r => { vid.onloadedmetadata = r; vid.onerror = r })
    const dur = Math.round(vid.duration) || 15
    URL.revokeObjectURL(url)
    if (dur > 20) { setError('Video must be 15 seconds or shorter.'); return }
    await uploadClip(file, dur)
  }

  const left = 15 - recSecs

  // ── CONTEXT ──────────────────────────────────────────────────────
  if (screen === 'context') return (
    <div style={s.wrap}>
    <div style={s.phone}>
      <div style={{ ...s.topbar, borderBottom:'0.5px solid rgba(26,13,15,0.07)' }}><Wm/></div>
      <div style={s.scroll}>
        {/* Card context */}
        <div style={{ background:'rgba(26,13,15,0.03)', borderRadius:16, padding:16, marginBottom:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
            <div style={{ width:38, height:38, borderRadius:10, background:ROSE_PALE, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <Heart size={18}/>
            </div>
            <div>
              <div style={{ fontSize:15, fontWeight:500, color:INK }}>For {card.recipient_name}</div>
              <div style={{ fontSize:12, color:INK_SOFT }}>Collecting voices</div>
            </div>
          </div>
          <div style={{ background:'#fff', borderRadius:12, padding:'12px 14px', border:'0.5px solid rgba(26,13,15,0.08)' }}>
            <div style={{ fontSize:13, color:'#444', lineHeight:1.6, fontStyle:'italic' }}>"{card.contributor_message}"</div>
          </div>
        </div>

        {/* Inspiration prompts */}
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:11, fontWeight:500, color:'#bbb', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:8 }}>Need a prompt?</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
            {['Introduce yourself','Share a memory','Words of encouragement','What they mean to you'].map(p => (
              <div key={p} style={{ padding:'7px 13px', borderRadius:20, fontSize:12, background:'rgba(26,13,15,0.04)', border:'0.5px solid rgba(26,13,15,0.1)', color:INK_SOFT, cursor:'pointer' }}>{p}</div>
            ))}
          </div>
        </div>

        {/* Privacy note */}
        <div style={{ background:'rgba(26,13,15,0.03)', borderRadius:12, padding:'10px 13px', marginBottom:20, display:'flex', gap:8, alignItems:'flex-start' }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink:0, marginTop:2 }}>
            <circle cx="7" cy="7" r="5.5" stroke="#bbb" strokeWidth="1"/>
            <path d="M7 6v3M7 4.5v.5" stroke="#bbb" strokeWidth="1.1" strokeLinecap="round"/>
          </svg>
          <div style={{ fontSize:12, color:INK_SOFT, lineHeight:1.55 }}>
            Your clip goes directly to {card.recipient_name}. The organiser can see you contributed but cannot watch what you said.
          </div>
        </div>

        <button style={s.btnP} onClick={() => go('permission')}>Record my fifteen seconds</button>
        <button style={s.btnS} onClick={() => go('upload')}>Upload a video instead</button>
      </div>
    </div>
    </div>
  )

  // ── PERMISSION ───────────────────────────────────────────────────
  if (screen === 'permission') return (
    <div style={s.wrap}>
    <div style={s.phone}>
      <div style={{ ...s.topbar, justifyContent:'flex-start', gap:10, borderBottom:'0.5px solid rgba(26,13,15,0.07)' }}>
        <div style={s.back} onClick={() => go('context')}><ChevL/></div>
      </div>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'32px 28px', textAlign:'center', minHeight:560, flex:1 }}>
        <div style={{ width:72, height:72, borderRadius:22, background:ROSE_PALE, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <rect x="4" y="8" width="18" height="16" rx="3" stroke={ROSE} strokeWidth="1.5"/>
            <path d="M22 13l6-3v12l-6-3V13z" stroke={ROSE} strokeWidth="1.5" strokeLinejoin="round"/>
            <circle cx="13" cy="16" r="3" stroke={ROSE} strokeWidth="1.2"/>
          </svg>
        </div>
        <div style={{ fontSize:20, fontWeight:500, color:INK, marginBottom:8 }}>We'll need your camera</div>
        <div style={{ fontSize:13, color:INK_SOFT, lineHeight:1.6, marginBottom:28 }}>Just for your fifteen seconds. Nothing more.</div>
        <div style={{ textAlign:'left', width:'100%', marginBottom:28 }}>
          {[
            `Your clip is private — only ${card.recipient_name} receives it`,
            'We never store your camera feed — only the clip you approve',
            'You can re-record as many times as you want before sending',
            'No account or sign-up needed',
          ].map((b, i) => (
            <div key={i} style={{ display:'flex', gap:10, marginBottom:12 }}>
              <div style={{ width:6, height:6, borderRadius:'50%', background:ROSE, marginTop:6, flexShrink:0 }}/>
              <div style={{ fontSize:13, color:INK_SOFT, lineHeight:1.55 }}>{b}</div>
            </div>
          ))}
        </div>
        {error && <div style={{ background:'#FCEBEB', border:'0.5px solid #F7C1C1', borderRadius:10, padding:'10px 14px', marginBottom:14, fontSize:13, color:'#A32D2D', width:'100%', textAlign:'left' }}>{error}</div>}
        <button style={{ ...s.btnP, width:'100%' }} onClick={startRec}>Allow camera and start recording</button>
        <button style={{ ...s.btnS, width:'100%', marginTop:0 }} onClick={() => go('upload')}>Upload a video instead</button>
      </div>
    </div>
    </div>
  )

  // ── RECORD ───────────────────────────────────────────────────────
  if (screen === 'record') return (
    <div style={s.wrap}>
    <div style={s.phone}>
      <div style={{ ...s.topbar, justifyContent:'space-between', gap:10, borderBottom:'0.5px solid rgba(26,13,15,0.07)' }}>
        <div style={s.back} onClick={() => { stopRec(); go('permission') }}><ChevL/></div>
        <span style={{ fontSize:13, color:INK_SOFT }}>For {card.recipient_name}</span>
        <div style={{ width:32 }}/>
      </div>
      <div style={s.scroll}>
        {/* Viewfinder */}
        <div style={{ background:'#111', borderRadius:20, width:'100%', aspectRatio:'9/16', maxHeight:290, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', position:'relative', marginBottom:14, overflow:'hidden' }}>
          {/* Countdown overlay */}
          {countdown !== null && (
            <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', zIndex:10, borderRadius:20 }}>
              <div style={{ fontSize:88, fontWeight:700, color:'#fff', lineHeight:1, animation:'countPulse 0.9s ease-out', fontVariantNumeric:'tabular-nums' }}>{countdown}</div>
              <div style={{ fontSize:14, color:'rgba(255,255,255,0.55)', marginTop:12 }}>Get ready…</div>
            </div>
          )}
          {recOn && (
            <div style={{ position:'absolute', top:12, left:12, display:'flex', alignItems:'center', gap:5, background:'rgba(226,75,74,0.9)', padding:'4px 10px', borderRadius:20 }}>
              <div style={{ width:7, height:7, borderRadius:'50%', background:'#fff' }}/>
              <span style={{ fontSize:11, color:'#fff', fontWeight:500 }}>REC</span>
            </div>
          )}
          {recOn
            ? <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:38, fontWeight:500, color:'#fff', fontVariantNumeric:'tabular-nums' }}>0:{String(left).padStart(2,'0')}</div>
                <div style={{ height:3, width:160, background:'rgba(255,255,255,0.15)', borderRadius:2, margin:'10px auto 0', overflow:'hidden' }}>
                  <div style={{ height:'100%', background:ROSE, width:`${(recSecs/15)*100}%`, transition:'width 0.2s' }}/>
                </div>
              </div>
            : <div style={{ textAlign:'center' }}>
                <div style={{ width:44, height:44, borderRadius:'50%', border:'1.5px solid rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 8px' }}>
                  <div style={{ width:18, height:18, borderRadius:'50%', background:'rgba(255,255,255,0.35)' }}/>
                </div>
                <div style={{ fontSize:12, color:'rgba(255,255,255,0.35)' }}>Camera preview</div>
              </div>
          }
        </div>

        {/* Controls */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:20, marginBottom:12 }}>
          <div style={{ width:40 }}/>
          <div onClick={() => recOn ? stopRec() : startRec()} style={{ width:72, height:72, borderRadius:'50%', border:'2.5px solid rgba(26,13,15,0.15)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
            <div style={{ width:recOn?28:50, height:recOn?28:50, borderRadius:recOn?6:'50%', background:'#E24B4A', transition:'all 0.2s' }}/>
          </div>
          <div style={{ width:40, height:40, borderRadius:'50%', background:'rgba(26,13,15,0.06)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }} onClick={() => { stopRec(); go('upload') }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 9a6 6 0 016-6h3M15 9a6 6 0 01-6 6H6" stroke="#888" strokeWidth="1.3" strokeLinecap="round"/></svg>
          </div>
        </div>
        <div style={{ fontSize:12, color:INK_SOFT, textAlign:'center', marginBottom:6 }}>
          {recOn ? `Tap to stop · ${left}s left` : 'Tap to start · max 15 seconds'}
        </div>
        <div style={{ fontSize:12, color:ROSE, textAlign:'center', cursor:'pointer', marginTop:4 }} onClick={() => { stopRec(); go('upload') }}>
          Upload a video instead
        </div>
      </div>
    </div>
    </div>
  )

  // ── PREVIEW ──────────────────────────────────────────────────────
  if (screen === 'preview') return (
    <div style={s.wrap}>
    <div style={s.phone}>
      <div style={{ ...s.topbar, justifyContent:'space-between', borderBottom:'0.5px solid rgba(26,13,15,0.07)' }}>
        <div style={s.back} onClick={() => go('record')}><ChevL/></div>
        <span style={{ fontSize:15, fontWeight:500, color:INK }}>Watch it back</span>
        <div style={{ width:32 }}/>
      </div>
      <div style={s.scroll}>
        {blobRef.current && (
          <video controls playsInline style={{ width:'100%', borderRadius:16, marginBottom:14, background:'#000' }} src={URL.createObjectURL(blobRef.current)}/>
        )}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:18 }}>
          <div style={{ background:'rgba(26,13,15,0.04)', borderRadius:12, padding:'10px 13px', textAlign:'center' }}>
            <div style={{ fontSize:18, fontWeight:500, color:INK }}>0:{String(recSecs).padStart(2,'0')}</div>
            <div style={{ fontSize:11, color:INK_SOFT, marginTop:2 }}>duration</div>
          </div>
          <div style={{ background:'rgba(26,13,15,0.04)', borderRadius:12, padding:'10px 13px', textAlign:'center' }}>
            <div style={{ fontSize:14, fontWeight:500, color:'#3B7D4A', marginTop:4 }}>Ready to send</div>
            <div style={{ fontSize:11, color:INK_SOFT, marginTop:2 }}>looks good</div>
          </div>
        </div>
        <div style={{ marginBottom:16 }}>
          <label style={{ fontSize:12, color:INK_SOFT, marginBottom:6, display:'block', fontWeight:500 }}>Your name (optional)</label>
          <input style={s.inp} value={name} onChange={e => setName(e.target.value)} placeholder={`So ${card.recipient_name} knows who it's from`}/>
        </div>
        {error && <div style={{ background:'#FCEBEB', border:'0.5px solid #F7C1C1', borderRadius:10, padding:'10px 14px', marginBottom:12, fontSize:13, color:'#A32D2D' }}>{error}</div>}
        <button style={{ ...s.btnP, opacity:uploading?0.7:1 }} onClick={() => uploadClip(blobRef.current, recSecs)} disabled={uploading}>
          {uploading ? 'Sending your voice…' : `Send to ${card.recipient_name}`}
        </button>
        <button style={s.btnS} onClick={() => { blobRef.current=null; go('record') }}>Re-record</button>
        <div style={{ fontSize:11, color:'#bbb', textAlign:'center', marginTop:4 }}>Once sent, your clip becomes part of the gift</div>
      </div>
    </div>
    </div>
  )

  // ── UPLOAD ───────────────────────────────────────────────────────
  if (screen === 'upload') return (
    <div style={s.wrap}>
    <div style={s.phone}>
      <div style={{ ...s.topbar, justifyContent:'space-between', borderBottom:'0.5px solid rgba(26,13,15,0.07)' }}>
        <div style={s.back} onClick={() => go('context')}><ChevL/></div>
        <span style={{ fontSize:15, fontWeight:500, color:INK }}>Upload a clip</span>
        <div style={{ width:32 }}/>
      </div>
      <div style={s.scroll}>
        <label style={{ display:'block', border:'1.5px dashed rgba(26,13,15,0.15)', borderRadius:16, padding:'36px 20px', textAlign:'center', marginBottom:18, cursor:'pointer' }}>
          <input type="file" accept="video/*" style={{ display:'none' }} onChange={e => handleFileUpload(e.target.files[0])}/>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" style={{ display:'block', margin:'0 auto 10px' }}>
            <path d="M14 18V8M10 12l4-4 4 4" stroke="#aaa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <rect x="4" y="20" width="20" height="4" rx="2" fill="rgba(26,13,15,0.08)"/>
          </svg>
          <div style={{ fontSize:14, fontWeight:500, color:INK, marginBottom:4 }}>Tap to choose a video</div>
          <div style={{ fontSize:12, color:INK_SOFT }}>MP4, MOV · max 15 seconds</div>
        </label>
        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:12, color:INK_SOFT, marginBottom:6, display:'block', fontWeight:500 }}>Your name (optional)</label>
          <input style={s.inp} value={name} onChange={e => setName(e.target.value)} placeholder={`So ${card.recipient_name} knows who it's from`}/>
        </div>
        {error && <div style={{ background:'#FCEBEB', border:'0.5px solid #F7C1C1', borderRadius:10, padding:'10px 14px', marginBottom:12, fontSize:13, color:'#A32D2D' }}>{error}</div>}
        {uploading && <div style={{ textAlign:'center', padding:'20px 0', color:INK_SOFT, fontSize:14 }}>Sending your voice…</div>}
      </div>
    </div>
    </div>
  )

  // ── SENT ─────────────────────────────────────────────────────────
  if (screen === 'sent') return (
    <div style={s.wrap}>
    <div style={s.phone}>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', padding:'48px 28px', minHeight:660, flex:1 }}>
        <div style={{ width:72, height:72, borderRadius:22, background:ROSE_PALE, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
          <Heart size={32}/>
        </div>
        <div style={{ fontSize:22, fontWeight:500, color:INK, marginBottom:8, letterSpacing:'-0.3px' }}>
          You just reminded someone they're not alone.
        </div>
        <div style={{ fontSize:14, color:INK_SOFT, lineHeight:1.7, marginBottom:28 }}>
          {card.recipient_name} will hear your voice when the video is ready. You showed up for someone who needed it. That matters more than you know.
        </div>
        <div style={{ background:'rgba(26,13,15,0.04)', borderRadius:14, padding:'14px 20px', width:'100%', marginBottom:20, textAlign:'center' }}>
          <div style={{ fontSize:12, color:INK_SOFT, marginBottom:6 }}>Your fifteen seconds have been added</div>
          <div style={{ fontSize:26 }}>❤️</div>
        </div>
        <div style={{ fontSize:13, color:INK_SOFT, marginBottom:12 }}>Know someone else who needs one of these?</div>
        <button style={{ ...s.btnS, width:'100%' }} onClick={() => window.location.href='/'}>
          Make a card for someone you love
        </button>
      </div>
    </div>
    </div>
  )

  return null
}

// Inject countdown animation into document on mount
if (typeof document !== 'undefined' && !document.getElementById('churpie-countdown-style')) {
  const style = document.createElement('style')
  style.id = 'churpie-countdown-style'
  style.textContent = `
    @keyframes countPulse {
      0%   { transform: scale(1.4); opacity: 0; }
      30%  { transform: scale(1.0); opacity: 1; }
      80%  { transform: scale(1.0); opacity: 1; }
      100% { transform: scale(0.8); opacity: 0; }
    }
  `
  document.head.appendChild(style)
}

function getSupportedMimeType() {
  const types = ['video/mp4','video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm']
  return types.find(t => MediaRecorder.isTypeSupported(t)) || 'video/webm'
}
