// components/ContributorFlowV2.jsx
// The mobile-first contributor experience — bulletin-board aesthetic,
// v8 voice. Wraps the same MediaRecorder/R2 upload flow as the v1 ContributorFlow.

'use client'

import { useState, useRef, useEffect } from 'react'

// ─── Palette ────────────────────────────────────────────────────
const INK = '#1A1410'
const INK_FADED = '#4A3F30'
const INK_GHOST = '#7A6E5C'
const PAPER = '#F5F0E8'
const PAPER_AGED = '#EDE5D0'
const PAPER_DARK = '#D4C9A8'
const PINK = '#D4266A'
const PINK_PALE = '#FAE0EC'
const CYAN = '#0B9DAA'

// ─── Helpers ────────────────────────────────────────────────────
function getSupportedMimeType() {
  if (typeof MediaRecorder === 'undefined') return 'video/webm'
  const types = ['video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
  return types.find(t => MediaRecorder.isTypeSupported(t)) || 'video/webm'
}

export default function ContributorFlowV2({ card }) {
  const [screen, setScreen] = useState('landing') // landing | permission | record | preview | sent
  const [name, setName] = useState('')
  const [recSecs, setRecSecs] = useState(0)
  const [recOn, setRecOn] = useState(false)
  const [countdown, setCountdown] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)

  const timerRef = useRef(null)
  const mediaRef = useRef(null)
  const streamRef = useRef(null)
  const videoRef = useRef(null)
  const chunksRef = useRef([])
  const blobRef = useRef(null)
  const durationRef = useRef(0)

  const firstName = card.recipient_name.split(' ')[0]

  const go = (s) => { setError(null); setScreen(s) }

  // Attach stream to video element once we reach the record screen
  useEffect(() => {
    if (screen === 'record' && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current
    }
  }, [screen])

  const requestCamera = async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: true,
      })
      streamRef.current = stream
      go('record')
    } catch (err) {
      setError('We need your camera to record. Please tap allow when your browser asks, or check your browser settings.')
    }
  }

  const startRec = async () => {
    setError(null)
    if (!streamRef.current) {
      await requestCamera()
      return
    }

    // 3-2-1 countdown
    for (const n of [3, 2, 1]) {
      setCountdown(n)
      await new Promise(r => setTimeout(r, 900))
    }
    setCountdown(null)

    chunksRef.current = []
    const mr = new MediaRecorder(streamRef.current, { mimeType: getSupportedMimeType() })
    mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: getSupportedMimeType() })
      blobRef.current = blob
      durationRef.current = recSecs || 15
      // Keep stream live for retry; only release when leaving the flow
      setPreviewUrl(URL.createObjectURL(blob))
      go('preview')
    }
    mediaRef.current = mr
    mr.start(250)
    setRecOn(true)
    setRecSecs(0)

    timerRef.current = setInterval(() => {
      setRecSecs(s => {
        const next = s + 1
        if (next >= 15) {
          stopRec()
          return 15
        }
        return next
      })
    }, 1000)
  }

  const stopRec = () => {
    clearInterval(timerRef.current)
    setRecOn(false)
    if (mediaRef.current?.state === 'recording') {
      mediaRef.current.stop()
    }
  }

  const retakeClip = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    blobRef.current = null
    setRecSecs(0)
    go('record')
  }

  const releaseStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
  }

  useEffect(() => {
    // Release the stream when component unmounts
    return releaseStream
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sendClip = async () => {
    if (!blobRef.current) return
    setUploading(true)
    setError(null)
    try {
      // Step 1: get signed upload URL (also pre-creates the clip row)
      const urlRes = await fetch('/api/clips/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardSlug: card.slug,
          contributorName: name.trim() || null,
        }),
      })
      if (!urlRes.ok) throw new Error('Could not prepare upload')
      const { uploadUrl, clipId } = await urlRes.json()
      if (!uploadUrl) throw new Error('Could not get upload URL')

      // Step 2: PUT blob to R2
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: blobRef.current,
        headers: { 'Content-Type': getSupportedMimeType() },
      })
      if (!putRes.ok) throw new Error(`Upload failed (status ${putRes.status})`)

      // Step 3: confirm (triggers async transcription)
      await fetch(`/api/clips/${clipId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationSeconds: durationRef.current || 15 }),
      })

      releaseStream()
      go('sent')
    } catch (e) {
      setError(`That didn't go through: ${e.message}. Try once more?`)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={pageWrap}>
      <div style={stripe} />
      <CountdownStyles />

      <header style={brandStrip}>
        <span style={brandLogo}>
          churpie<span style={{ color: PINK }}>.</span>
        </span>
        <span style={privateTag}>private link</span>
      </header>

      <main style={mainCol}>
        {screen === 'landing' && (
          <LandingScreen
            firstName={firstName}
            recipientName={card.recipient_name}
            organizerMessage={card.contributor_message}
            onStart={() => go('permission')}
          />
        )}

        {screen === 'permission' && (
          <PermissionScreen
            firstName={firstName}
            error={error}
            onAllow={requestCamera}
            onBack={() => go('landing')}
          />
        )}

        {screen === 'record' && (
          <RecordScreen
            firstName={firstName}
            recSecs={recSecs}
            recOn={recOn}
            countdown={countdown}
            videoRef={videoRef}
            onStart={startRec}
            onStop={stopRec}
            onBack={() => { stopRec(); releaseStream(); go('landing') }}
          />
        )}

        {screen === 'preview' && (
          <PreviewScreen
            firstName={firstName}
            previewUrl={previewUrl}
            name={name}
            setName={setName}
            uploading={uploading}
            error={error}
            onSend={sendClip}
            onRetake={retakeClip}
          />
        )}

        {screen === 'sent' && (
          <SentScreen firstName={firstName} recipientName={card.recipient_name} />
        )}
      </main>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// SCREENS
// ═══════════════════════════════════════════════════════════════

function LandingScreen({ firstName, recipientName, organizerMessage, onStart }) {
  return (
    <>
      <article style={cardBox}>
        <div style={cardFrom}>&mdash; for {recipientName}</div>

        <h1 style={cardHeadline}>
          you&rsquo;re one of<br />
          <span style={{ color: PINK }}>{firstName}&rsquo;s</span> people.
        </h1>
        <p style={cardSub}>
          and someone who loves them is rallying everyone.
        </p>

        <div style={organizerNote}>
          <div style={organizerNoteLabel}>a note from the organizer</div>
          <div style={organizerNoteText}>
            &ldquo;{organizerMessage}&rdquo;
          </div>
        </div>

        <div style={askBlock}>
          <div style={askLine}>
            <span style={askDash}>&mdash;</span>
            <span><strong>15 seconds.</strong> That&rsquo;s it. Shorter than it sounds.</span>
          </div>
          <div style={askLine}>
            <span style={askDash}>&mdash;</span>
            <span><strong>No account. No download.</strong> Just your phone&rsquo;s camera.</span>
          </div>
          <div style={askLine}>
            <span style={askDash}>&mdash;</span>
            <span><strong>{firstName} will feel it.</strong> Every single one.</span>
          </div>
        </div>

        <button onClick={onStart} style={primaryCta}>
          Record 15 seconds &rarr;
        </button>
        <div style={ctaHint}>
          takes about <span style={{ color: PINK, fontWeight: 700 }}>2 minutes</span> total
        </div>
      </article>

      <section style={reassurance}>
        <div style={reassuranceTitle}>a few things to know &mdash;</div>
        <ul style={reassuranceList}>
          <li style={reassuranceItem}>
            <span style={askDash}>&mdash;</span>
            <span><strong>You can redo it as many times as you want.</strong> Hit stop, record again, keep whichever take feels right.</span>
          </li>
          <li style={reassuranceItem}>
            <span style={askDash}>&mdash;</span>
            <span><strong>The organizer won&rsquo;t see what you said.</strong> Your clip goes straight to {firstName}.</span>
          </li>
          <li style={reassuranceItem}>
            <span style={askDash}>&mdash;</span>
            <span><strong>It works on any phone.</strong> Your 70-year-old uncle could do this (we tested).</span>
          </li>
          <li style={reassuranceItem}>
            <span style={askDash}>&mdash;</span>
            <span><strong>We don&rsquo;t keep anything you don&rsquo;t send.</strong> If you never press record, we never see you.</span>
          </li>
        </ul>
      </section>

      <section style={nervousBox}>
        <div style={nervousTitle}>if you&rsquo;re not sure what to say &mdash;</div>
        <p style={nervousBody}>
          <strong>That&rsquo;s fine.</strong> Most people aren&rsquo;t, and {firstName} won&rsquo;t care.
          The point isn&rsquo;t being eloquent. The point is showing up.
        </p>
        <p style={nervousBody}>
          Try one of these: share a favorite memory &middot; say what they mean to you &middot; wish them one thing.
          Or just look at the camera and say what comes to mind. <strong>They&rsquo;ll feel the fact that you tried.</strong>
        </p>
      </section>
    </>
  )
}

function PermissionScreen({ firstName, error, onAllow, onBack }) {
  return (
    <article style={{ ...cardBox, textAlign: 'center' }}>
      <h2 style={{ ...cardHeadline, fontSize: 28, marginBottom: 10 }}>
        one quick ask.
      </h2>
      <p style={{ fontSize: 14, color: INK_FADED, lineHeight: 1.6, marginBottom: 22 }}>
        Tap allow so we can use your camera for the next 15 seconds.
        We don&rsquo;t keep anything you don&rsquo;t send.
      </p>

      {error && (
        <div style={errorBox}>{error}</div>
      )}

      <button onClick={onAllow} style={{ ...primaryCta, marginBottom: 12 }}>
        Allow camera &rarr;
      </button>
      <button onClick={onBack} style={ghostBtn}>
        &larr; Back
      </button>
    </article>
  )
}

function RecordScreen({ firstName, recSecs, recOn, countdown, videoRef, onStart, onStop, onBack }) {
  const left = 15 - recSecs
  return (
    <article style={cardBox}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <button onClick={onBack} style={ghostBtnSmall}>&larr; Back</button>
        <span style={{ fontSize: 12, color: INK_FADED }}>for {firstName}</span>
        <div style={{ width: 60 }} />
      </div>

      <div style={viewfinder}>
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }}
        />
        {countdown !== null && (
          <div style={countdownOverlay}>
            <div style={countdownNumber} key={countdown}>{countdown}</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 8 }}>Get ready…</div>
          </div>
        )}
        {recOn && (
          <div style={recPill}>
            <span style={recDot} />
            <span>REC &middot; {left}s left</span>
          </div>
        )}
      </div>

      <div style={{ marginTop: 18, textAlign: 'center' }}>
        {recOn ? (
          <button onClick={onStop} style={{ ...primaryCta, background: '#B22222' }}>
            Stop &mdash; keep this one
          </button>
        ) : (
          <button onClick={onStart} style={primaryCta}>
            Start recording
          </button>
        )}
        <div style={ctaHint}>
          {recOn ? `Tap stop when you're done.` : `Max 15 seconds. We'll auto-stop.`}
        </div>
      </div>
    </article>
  )
}

function PreviewScreen({ firstName, previewUrl, name, setName, uploading, error, onSend, onRetake }) {
  return (
    <article style={cardBox}>
      <h2 style={{ ...cardHeadline, fontSize: 28, marginBottom: 10 }}>
        watch it back.
      </h2>
      <p style={{ fontSize: 13, color: INK_FADED, marginBottom: 18 }}>
        Happy with it? Or one more take?
      </p>

      {previewUrl && (
        <video
          src={previewUrl}
          controls
          playsInline
          style={{ width: '100%', borderRadius: 6, background: '#000', marginBottom: 18 }}
        />
      )}

      <label style={inputLabel}>Your name (optional)</label>
      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="so {firstName} knows who it's from"
        style={textInput}
      />
      <div style={{ fontSize: 11, color: INK_GHOST, marginTop: 6, fontStyle: 'italic' }}>
        Skip this if you want to stay anonymous — {firstName} will still get your clip.
      </div>

      {error && <div style={{ ...errorBox, marginTop: 16 }}>{error}</div>}

      <div style={{ marginTop: 22, display: 'grid', gap: 10 }}>
        <button onClick={onSend} disabled={uploading} style={{ ...primaryCta, opacity: uploading ? 0.6 : 1 }}>
          {uploading ? 'Sending…' : `Send it to ${firstName} →`}
        </button>
        <button onClick={onRetake} disabled={uploading} style={ghostBtn}>
          One more take
        </button>
      </div>
    </article>
  )
}

function SentScreen({ firstName, recipientName }) {
  return (
    <article style={{ ...cardBox, textAlign: 'center' }}>
      <h2 style={{ ...cardHeadline, fontSize: 32, marginBottom: 12 }}>
        thank you.
      </h2>
      <p style={{ fontSize: 15, color: INK_FADED, lineHeight: 1.7, marginBottom: 24, maxWidth: 360, margin: '0 auto 24px' }}>
        Your 15 seconds is in. {firstName} is going to feel it.
      </p>

      <div style={{ fontFamily: "'Caveat', cursive", fontSize: 22, color: CYAN, fontWeight: 600, transform: 'rotate(-0.5deg)', display: 'inline-block', marginBottom: 24 }}>
        want to make one for someone?
      </div>

      <a href="https://churpie.me" style={ghostBtn}>
        What is churpie?
      </a>
    </article>
  )
}

// ═══════════════════════════════════════════════════════════════
// STYLES & countdown keyframes
// ═══════════════════════════════════════════════════════════════

function CountdownStyles() {
  return (
    <style>{`
      @keyframes countPulse {
        0%   { transform: scale(1.6); opacity: 0; }
        30%  { transform: scale(1.0); opacity: 1; }
        80%  { transform: scale(1.0); opacity: 1; }
        100% { transform: scale(0.8); opacity: 0; }
      }
    `}</style>
  )
}

const pageWrap = { minHeight: '100vh', background: PAPER, fontFamily: "'Courier Prime', 'Courier New', monospace", color: INK, paddingBottom: 48 }
const stripe = { height: 4, background: `repeating-linear-gradient(90deg, ${PINK} 0 12px, ${CYAN} 12px 24px)` }
const brandStrip = { maxWidth: 520, margin: '0 auto', padding: '24px 20px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }
const brandLogo = { fontFamily: "'Permanent Marker', cursive", fontSize: 20, color: INK }
const privateTag = { fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: INK_FADED }
const mainCol = { maxWidth: 520, margin: '0 auto', padding: '0 20px' }

const cardBox = { background: '#fff', border: `1px solid ${PAPER_DARK}`, padding: '28px 22px 24px', marginBottom: 24, boxShadow: `3px 3px 0 ${PAPER_AGED}, 6px 6px 0 ${PAPER_DARK}` }
const cardFrom = { fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: INK_FADED, marginBottom: 14 }
const cardHeadline = { fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 'clamp(28px, 7vw, 34px)', lineHeight: 1.08, letterSpacing: '-0.5px', color: INK, marginBottom: 6, fontWeight: 400, textTransform: 'lowercase' }
const cardSub = { fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 18, lineHeight: 1.3, color: INK_FADED, fontStyle: 'italic', marginBottom: 22, textTransform: 'lowercase', fontWeight: 400 }

const organizerNote = { background: PINK_PALE, border: `1px solid rgba(212, 38, 106, 0.3)`, padding: '16px 18px', marginBottom: 22, borderRadius: 2 }
const organizerNoteLabel = { fontFamily: "'Caveat', cursive", fontSize: 18, fontWeight: 700, color: PINK, transform: 'rotate(-1deg)', display: 'inline-block', marginBottom: 4, lineHeight: 1 }
const organizerNoteText = { fontSize: 14, lineHeight: 1.6, color: INK, fontStyle: 'italic' }

const askBlock = { marginBottom: 18 }
const askLine = { fontSize: 13, lineHeight: 1.7, color: INK, marginBottom: 8, display: 'flex', gap: 10, alignItems: 'flex-start' }
const askDash = { color: PINK, fontWeight: 700, flexShrink: 0 }

const primaryCta = { width: '100%', padding: '16px 22px', background: PINK, color: '#fff', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', border: 'none', cursor: 'pointer', boxShadow: `3px 3px 0 ${INK}`, borderRadius: 2 }
const ghostBtn = { display: 'inline-block', padding: '12px 20px', background: 'transparent', color: INK_FADED, border: `1px solid ${PAPER_DARK}`, fontFamily: 'inherit', fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 700, cursor: 'pointer', textDecoration: 'none', textAlign: 'center' }
const ghostBtnSmall = { fontSize: 11, color: INK_FADED, background: 'transparent', border: 'none', cursor: 'pointer', letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 700, fontFamily: 'inherit', padding: 8 }
const ctaHint = { textAlign: 'center', fontSize: 11, color: INK_FADED, textTransform: 'uppercase', letterSpacing: 1, marginTop: 12 }

const reassurance = { padding: '0 4px', marginBottom: 28 }
const reassuranceTitle = { fontFamily: "'Caveat', cursive", fontSize: 22, fontWeight: 700, color: CYAN, transform: 'rotate(-0.5deg)', display: 'inline-block', marginBottom: 14, lineHeight: 1 }
const reassuranceList = { listStyle: 'none', padding: 0, margin: 0 }
const reassuranceItem = { fontSize: 13, lineHeight: 1.6, color: INK, padding: '8px 0', display: 'flex', gap: 10, alignItems: 'flex-start' }

const nervousBox = { background: PAPER_AGED, padding: '20px 22px 18px', border: `1px dashed ${PAPER_DARK}`, marginBottom: 24 }
const nervousTitle = { fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 18, color: INK, marginBottom: 10, lineHeight: 1.2, textTransform: 'lowercase', fontWeight: 400 }
const nervousBody = { fontSize: 13, color: INK_FADED, lineHeight: 1.65, marginBottom: 10 }

const viewfinder = { position: 'relative', width: '100%', aspectRatio: '9 / 16', maxHeight: 500, background: '#000', borderRadius: 8, overflow: 'hidden' }
const countdownOverlay = { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }
const countdownNumber = { fontSize: 100, fontWeight: 700, color: '#fff', lineHeight: 1, animation: 'countPulse 0.9s ease-out', fontVariantNumeric: 'tabular-nums' }
const recPill = { position: 'absolute', top: 12, left: 12, display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(178, 34, 34, 0.9)', padding: '5px 11px', borderRadius: 20, color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: 1 }
const recDot = { width: 7, height: 7, borderRadius: '50%', background: '#fff' }

const inputLabel = { display: 'block', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: INK_FADED, fontWeight: 700, marginBottom: 6 }
const textInput = { width: '100%', padding: '12px 14px', fontSize: 14, border: `1px solid ${PAPER_DARK}`, background: '#fff', fontFamily: 'inherit', color: INK, outline: 'none', borderRadius: 2, boxSizing: 'border-box' }
const errorBox = { background: '#FBE3E3', border: '1px solid #B22222', padding: '12px 14px', fontSize: 13, color: '#7A1F1F', borderRadius: 2, lineHeight: 1.5 }
