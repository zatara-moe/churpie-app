// components/RecipientExperienceV2.jsx
// The recipient's watch experience — sacred-moment voice, quiet aesthetic.
// Phases: arrival → playing → after-watch (contributors + save + reply)

'use client'

import { useState, useRef } from 'react'

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

export default function RecipientExperienceV2({ recipientName, clipCount, contributors, videoUrl, cardId }) {
  const [phase, setPhase] = useState('arrival') // arrival | playing | after
  const [reply, setReply] = useState('')
  const [replyStatus, setReplyStatus] = useState(null) // null | 'sending' | 'sent' | 'error'
  const videoRef = useRef(null)
  const firstName = recipientName.split(' ')[0]

  const startWatching = async () => {
    setPhase('playing')
    // Play is triggered after video element mounts
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.play().catch(() => {})
      }
    }, 100)
  }

  const handleVideoEnd = () => setPhase('after')

  const watchAgain = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0
      videoRef.current.play().catch(() => {})
      setPhase('playing')
    }
  }

  const sendReply = async () => {
    if (!reply.trim()) return
    setReplyStatus('sending')
    try {
      const res = await fetch('/api/replies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId, message: reply.trim() }),
      })
      if (!res.ok) throw new Error('Failed')
      setReplyStatus('sent')
    } catch {
      setReplyStatus('error')
    }
  }

  return (
    <div style={pageWrap}>
      <div style={stripe} />

      <div style={content}>
        {phase === 'arrival' && (
          <ArrivalScreen
            firstName={firstName}
            clipCount={clipCount}
            contributors={contributors}
            onStart={startWatching}
            hasVideo={!!videoUrl}
          />
        )}

        {phase === 'playing' && videoUrl && (
          <PlayingScreen
            videoRef={videoRef}
            videoUrl={videoUrl}
            onEnd={handleVideoEnd}
          />
        )}

        {phase === 'after' && (
          <AfterScreen
            firstName={firstName}
            clipCount={clipCount}
            contributors={contributors}
            onWatchAgain={watchAgain}
            onSaveVideo={() => videoRef.current && window.open(videoUrl, '_blank')}
            reply={reply}
            setReply={setReply}
            replyStatus={replyStatus}
            onSendReply={sendReply}
          />
        )}
      </div>
    </div>
  )
}

function ArrivalScreen({ firstName, clipCount, contributors, onStart, hasVideo }) {
  if (!hasVideo) {
    return (
      <div style={centeredCol}>
        <div style={arrivalLogo}>churpie<span style={{ color: PINK }}>.</span></div>
        <h1 style={arrivalTitle}>one moment.</h1>
        <p style={arrivalSub}>
          The video is still being put together. It&rsquo;ll be ready in a few minutes.
          Try this link again soon.
        </p>
      </div>
    )
  }

  return (
    <div style={centeredCol}>
      <div style={arrivalLogo}>churpie<span style={{ color: PINK }}>.</span></div>

      <div style={{ fontFamily: "'Caveat', cursive", fontSize: 24, fontWeight: 600, color: CYAN, transform: 'rotate(-0.5deg)', display: 'inline-block', marginBottom: 14 }}>
        for {firstName}
      </div>

      <h1 style={arrivalTitle}>
        find a quiet moment.
      </h1>

      <p style={arrivalSub}>
        {clipCount} {clipCount === 1 ? 'person' : 'people'} who love you made something for you.
      </p>

      <div style={breathCard}>
        <p style={breathLine}>Take a breath.</p>
        <p style={breathLine}>Put it on your phone.</p>
        <p style={{ ...breathLine, marginBottom: 0 }}>Then press play.</p>
      </div>

      <button onClick={onStart} style={primaryCta}>
        I&rsquo;m ready &rarr;
      </button>

      <div style={{ fontSize: 12, color: INK_GHOST, marginTop: 18, fontStyle: 'italic' }}>
        It&rsquo;s about {Math.max(1, Math.ceil(clipCount * 15 / 60))} minute{Math.max(1, Math.ceil(clipCount * 15 / 60)) === 1 ? '' : 's'} long.
      </div>
    </div>
  )
}

function PlayingScreen({ videoRef, videoUrl, onEnd }) {
  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px' }}>
      <video
        ref={videoRef}
        src={videoUrl}
        controls
        playsInline
        onEnded={onEnd}
        style={{
          width: '100%',
          borderRadius: 4,
          background: '#000',
          boxShadow: `4px 4px 0 ${PAPER_DARK}, 8px 8px 0 ${PAPER_AGED}`,
        }}
      />
    </div>
  )
}

function AfterScreen({ firstName, clipCount, contributors, onWatchAgain, onSaveVideo, reply, setReply, replyStatus, onSendReply }) {
  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '40px 20px 60px' }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <h1 style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 'clamp(36px, 8vw, 52px)', lineHeight: 1.05, letterSpacing: '-0.7px', color: INK, textTransform: 'lowercase', marginBottom: 8, fontWeight: 400 }}>
          you are loved.
        </h1>
        <div style={{ fontFamily: "'Caveat', cursive", fontSize: 22, fontWeight: 600, color: CYAN, transform: 'rotate(-0.5deg)', display: 'inline-block' }}>
          {clipCount} people showed up for you.
        </div>
      </div>

      {contributors.length > 0 && (
        <div style={contributorsCard}>
          <div style={contributorsLabel}>Who was there</div>
          <div style={contributorsList}>
            {contributors.map((c, i) => (
              <span key={i} style={contributorName}>{c.name}</span>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gap: 10, marginBottom: 32 }}>
        <button onClick={onWatchAgain} style={primaryCta}>
          Watch again
        </button>
        <button onClick={onSaveVideo} style={ghostCta}>
          Keep it forever &middot; open in new tab
        </button>
      </div>

      <div style={replyCard}>
        <h3 style={replyHead}>write them back?</h3>
        <p style={replySub}>
          A short note. They&rsquo;ll see it.
        </p>

        {replyStatus === 'sent' ? (
          <div style={{ padding: '16px 0', fontSize: 14, color: CYAN, fontFamily: "'Caveat', cursive", fontSize: 22, fontWeight: 600, textAlign: 'center' }}>
            they&rsquo;ll see it soon.
          </div>
        ) : (
          <>
            <textarea
              value={reply}
              onChange={e => setReply(e.target.value)}
              placeholder="Thank you. Even writing that feels small. But thank you."
              disabled={replyStatus === 'sending'}
              style={{
                width: '100%',
                minHeight: 100,
                padding: '12px 14px',
                fontSize: 14,
                lineHeight: 1.6,
                border: `1px solid ${PAPER_DARK}`,
                background: '#fff',
                fontFamily: 'inherit',
                color: INK,
                outline: 'none',
                borderRadius: 2,
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
            {replyStatus === 'error' && (
              <div style={{ fontSize: 12, color: '#B22222', marginTop: 6 }}>
                Couldn&rsquo;t send. Try once more?
              </div>
            )}
            <button
              onClick={onSendReply}
              disabled={!reply.trim() || replyStatus === 'sending'}
              style={{
                ...primaryCta,
                marginTop: 12,
                opacity: !reply.trim() || replyStatus === 'sending' ? 0.5 : 1,
              }}
            >
              {replyStatus === 'sending' ? 'Sending…' : 'Send the note →'}
            </button>
          </>
        )}
      </div>

      <div style={{ textAlign: 'center', marginTop: 40, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: INK_GHOST }}>
        <a href="https://churpie.me" style={{ color: INK_GHOST, textDecoration: 'none', borderBottom: `1px dashed ${INK_GHOST}` }}>
          made with churpie
        </a>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════

const pageWrap = { minHeight: '100vh', background: PAPER, fontFamily: "'Courier Prime', 'Courier New', monospace", color: INK }
const stripe = { height: 4, background: `repeating-linear-gradient(90deg, ${PINK} 0 12px, ${CYAN} 12px 24px)` }
const content = { minHeight: 'calc(100vh - 4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }
const centeredCol = { maxWidth: 520, margin: '0 auto', padding: '48px 24px', textAlign: 'center' }

const arrivalLogo = { fontFamily: "'Permanent Marker', cursive", fontSize: 22, color: INK, marginBottom: 32 }
const arrivalTitle = { fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 'clamp(40px, 9vw, 56px)', lineHeight: 1.05, letterSpacing: '-0.7px', color: INK, textTransform: 'lowercase', marginBottom: 14, fontWeight: 400 }
const arrivalSub = { fontSize: 14, color: INK_FADED, lineHeight: 1.7, marginBottom: 32, maxWidth: 400, margin: '0 auto 32px' }

const breathCard = { background: '#fff', border: `1px solid ${PAPER_DARK}`, padding: '28px 24px', marginBottom: 32, boxShadow: `3px 3px 0 ${PAPER_AGED}` }
const breathLine = { fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 20, color: INK, marginBottom: 8, fontStyle: 'italic', lineHeight: 1.4, textTransform: 'lowercase', fontWeight: 400 }

const primaryCta = { padding: '16px 32px', background: PINK, color: '#fff', fontFamily: "'Courier Prime', monospace", fontSize: 13, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', border: 'none', cursor: 'pointer', boxShadow: `3px 3px 0 ${INK}`, borderRadius: 2 }
const ghostCta = { padding: '14px 24px', background: 'transparent', color: INK_FADED, fontFamily: "'Courier Prime', monospace", fontSize: 12, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', border: `1px solid ${PAPER_DARK}`, cursor: 'pointer', borderRadius: 2 }

const contributorsCard = { background: '#fff', border: `1px solid ${PAPER_DARK}`, padding: '22px 24px', marginBottom: 32, borderRadius: 2 }
const contributorsLabel = { fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: INK_FADED, fontWeight: 700, marginBottom: 12 }
const contributorsList = { display: 'flex', flexWrap: 'wrap', gap: 8 }
const contributorName = { fontSize: 13, padding: '4px 12px', background: PINK_PALE, color: INK, borderRadius: 16, fontFamily: "'Caveat', cursive", fontWeight: 600, fontSize: 18, lineHeight: 1.2 }

const replyCard = { background: PINK_PALE, border: `1px solid rgba(212, 38, 106, 0.3)`, padding: '24px 22px', borderRadius: 2 }
const replyHead = { fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 22, color: INK, lineHeight: 1.2, textTransform: 'lowercase', marginBottom: 6, fontWeight: 400 }
const replySub = { fontSize: 13, color: INK_FADED, marginBottom: 16, lineHeight: 1.6 }
