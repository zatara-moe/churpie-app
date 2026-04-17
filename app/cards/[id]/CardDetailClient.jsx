// app/cards/[id]/CardDetailClient.jsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

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
const GREEN_PALE = '#D9E8C4'
const GREEN = '#2D7A3A'

const THEME_LABELS = {
  birthday: 'Birthday', milestone: 'Milestone', recovery: 'Recovery',
  welcome_home: 'Welcome home', honoring_service: 'Honoring service',
  injured_athlete: 'Injured athlete', hard_stretch: 'Hard stretch',
  something_else: 'Something else',
  getwell: 'Recovery', homecoming: 'Welcome home',
  veteran: 'Honoring service', athlete: 'Injured athlete',
  grief: 'Hard stretch', other: 'Something else',
  support: 'Hard stretch', graduation: 'Milestone', justbecause: 'Something else',
}

export default function CardDetailClient({ card: initialCard }) {
  const router = useRouter()
  const [card, setCard] = useState(initialCard)
  const [copied, setCopied] = useState(false)
  const [origin, setOrigin] = useState('')
  const [actionLoading, setActionLoading] = useState(null)
  const [showSendConfirm, setShowSendConfirm] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') setOrigin(window.location.origin)
  }, [])

  // Poll for status if compiling (every 5s)
  useEffect(() => {
    if (card.status !== 'compiling') return
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/cards/${card.id}`)
        if (!res.ok) return
        const { card: updated } = await res.json()
        if (updated && updated.status !== 'compiling') {
          setCard(updated)
          clearInterval(poll)
          router.refresh()
        }
      } catch {}
    }, 5000)
    return () => clearInterval(poll)
  }, [card.id, card.status, router])

  const contributorUrl = origin ? `${origin}/c/${card.slug}` : ''
  const clips = card.clips || []
  const submittedClips = clips.filter(c => c.status === 'submitted' || c.status === 'processed')
  const canPreview = submittedClips.length >= 2
  const themeLabel = THEME_LABELS[card.theme] || card.theme

  const copyLink = async () => {
    if (!contributorUrl) return
    try {
      await navigator.clipboard.writeText(contributorUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      alert(`Copy this link: ${contributorUrl}`)
    }
  }

  const triggerCompile = async () => {
    setActionLoading('compile')
    try {
      const res = await fetch(`/api/cards/${card.id}/compile`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Compile failed')
      }
      setCard({ ...card, status: 'compiling' })
    } catch (err) {
      alert(`Something hiccuped: ${err.message}. Try again in a moment.`)
    } finally {
      setActionLoading(null)
    }
  }

  const triggerSend = async () => {
    setActionLoading('send')
    try {
      const res = await fetch(`/api/cards/${card.id}/send`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Send failed')
      }
      setCard({ ...card, status: 'sent' })
      setShowSendConfirm(false)
    } catch (err) {
      alert(`Something hiccuped: ${err.message}. Try again in a moment.`)
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div style={wrap}>
      <div style={stripe} />

      <nav style={navBar}>
        <a href="/dashboard" style={logo}>
          churpie<span style={{ color: PINK }}>.</span>
        </a>
        <a href="/dashboard" style={backLink}>&larr; Back to your cards</a>
      </nav>

      <main style={main}>
        <h1 style={title}>for {card.recipient_name}</h1>
        <div style={subtitle}>
          {themeLabel}
          {card.deadline_at && ` · sending ${new Date(card.deadline_at).toLocaleDateString()}`}
        </div>

        <div style={statusBar}>
          <span style={{ fontSize: 13 }}>Clips recorded so far</span>
          <span style={{ fontSize: 22, fontWeight: 700, color: PINK }}>
            {submittedClips.length}
          </span>
        </div>

        {card.status === 'live' && contributorUrl && (
          <section style={shareBox}>
            <div style={shareLabel}>The link to share</div>
            <div style={shareRow}>
              <div style={shareUrl}>{contributorUrl}</div>
              <button style={copyBtn} onClick={copyLink}>
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div style={shareHint}>
              Drop this in a group chat. Anyone with the link can record — no account needed.
            </div>
          </section>
        )}

        {card.status === 'live' && canPreview && (
          <section style={sendBanner}>
            <div style={{ ...sendLabel, color: GREEN }}>Ready when you are</div>
            <div style={sendTitle}>you&rsquo;ve got enough to preview it.</div>
            <div style={sendBody}>
              {submittedClips.length} {submittedClips.length === 1 ? 'clip is' : 'clips are'} in.
              You can keep gathering, or put it together and send it now.
            </div>
            <button
              style={sendBtn}
              onClick={triggerCompile}
              disabled={actionLoading === 'compile'}
            >
              {actionLoading === 'compile' ? 'Putting it together…' : 'Put it together →'}
            </button>
          </section>
        )}

        {card.status === 'compiling' && (
          <section style={{ ...sendBanner, background: PAPER_AGED, borderColor: PAPER_DARK }}>
            <div style={{ ...sendLabel, color: INK_FADED }}>Working on it</div>
            <div style={sendTitle}>putting it together…</div>
            <div style={sendBody}>
              The clips are being stitched. This usually takes 2–3 minutes.
              We&rsquo;ll update automatically when it&rsquo;s ready.
            </div>
          </section>
        )}

        {card.status === 'compiled' && (
          <section style={sendBanner}>
            <div style={{ ...sendLabel, color: GREEN }}>Ready to deliver</div>
            <div style={sendTitle}>
              this is what {card.recipient_name} will see.
            </div>
            <div style={sendBody}>
              Watch it all the way through first. When it feels right, send it.
              Once it&rsquo;s gone, it&rsquo;s gone — you can&rsquo;t unsend it.
            </div>
            <button style={sendBtn} onClick={() => setShowSendConfirm(true)}>
              Send it to {card.recipient_name} →
            </button>
          </section>
        )}

        {card.status === 'sent' && (
          <section style={{ ...sendBanner, background: PINK_PALE, borderColor: PINK }}>
            <div style={{ ...sendLabel, color: PINK }}>Already sent</div>
            <div style={sendTitle}>
              this one&rsquo;s with {card.recipient_name}.
            </div>
            <div style={sendBody}>
              {card.watch_count > 0
                ? `They've watched it ${card.watch_count} time${card.watch_count === 1 ? '' : 's'} so far.`
                : 'Waiting for them to press play.'}
            </div>
          </section>
        )}

        {card.status === 'failed' && (
          <section style={{ ...sendBanner, background: '#FBE3E3', borderColor: '#B22222' }}>
            <div style={{ ...sendLabel, color: '#B22222' }}>Something went wrong</div>
            <div style={sendTitle}>we couldn&rsquo;t put it together.</div>
            <div style={sendBody}>
              Try compiling again. If it keeps failing, send us a note and we&rsquo;ll look.
            </div>
            <button style={sendBtn} onClick={triggerCompile} disabled={actionLoading === 'compile'}>
              {actionLoading === 'compile' ? 'Trying again…' : 'Try again'}
            </button>
          </section>
        )}

        <div style={sectionLabel}>Who&rsquo;s recorded</div>
        {submittedClips.length === 0 ? (
          <div style={emptyClips}>Nobody yet. Send the link around.</div>
        ) : (
          <div style={clipList}>
            {submittedClips.map((clip, i) => (
              <div key={clip.id} style={clipItem}>
                <span>{clip.contributor_name || `Clip ${i + 1}`}</span>
                <span style={{ color: INK_GHOST, fontSize: 11, letterSpacing: 0.5 }}>
                  {clip.duration_seconds}s
                </span>
              </div>
            ))}
          </div>
        )}
      </main>

      {showSendConfirm && (
        <div style={modalBg} onClick={() => setShowSendConfirm(false)}>
          <div style={modalCard} onClick={e => e.stopPropagation()}>
            <div style={modalTitle}>One last check.</div>
            <div style={modalBody}>
              This sends the video to <strong>{card.recipient_name}</strong> right now.
              Once it&rsquo;s gone, it&rsquo;s gone — you can&rsquo;t unsend it.
            </div>
            <button
              style={{ ...sendBtn, width: '100%', marginBottom: 10 }}
              onClick={triggerSend}
              disabled={actionLoading === 'send'}
            >
              {actionLoading === 'send' ? 'Sending…' : 'Yes, send it'}
            </button>
            <button
              style={modalCancel}
              onClick={() => setShowSendConfirm(false)}
              disabled={actionLoading === 'send'}
            >
              Not yet
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Styles ─────────────────────────────────────────────────────
const wrap = { minHeight: '100vh', background: PAPER, fontFamily: "'Courier Prime', 'Courier New', monospace", color: INK, paddingBottom: 80 }
const stripe = { height: 4, background: `repeating-linear-gradient(90deg, ${PINK} 0 12px, ${CYAN} 12px 24px)` }
const navBar = { maxWidth: 720, margin: '0 auto', padding: '24px 24px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }
const logo = { fontFamily: "'Permanent Marker', cursive", fontSize: 22, color: INK, textDecoration: 'none' }
const backLink = { fontSize: 11, color: INK_FADED, textDecoration: 'none', letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 700 }
const main = { maxWidth: 720, margin: '0 auto', padding: 24 }
const title = { fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 'clamp(30px, 5vw, 42px)', lineHeight: 1.1, letterSpacing: '-0.5px', marginBottom: 8, fontWeight: 400 }
const subtitle = { fontSize: 13, color: INK_FADED, marginBottom: 28, letterSpacing: 0.3 }
const statusBar = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', border: `1px solid ${PAPER_DARK}`, padding: '16px 20px', marginBottom: 24, borderRadius: 2 }

const shareBox = { background: PINK_PALE, border: `1px solid ${PINK}`, padding: '22px 22px 18px', marginBottom: 28, borderRadius: 2 }
const shareLabel = { fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: PINK, fontWeight: 700, marginBottom: 10 }
const shareRow = { display: 'flex', gap: 10, alignItems: 'stretch', flexWrap: 'wrap' }
const shareUrl = { flex: 1, minWidth: 200, background: '#fff', padding: '12px 14px', fontSize: 12, border: `1px solid ${PAPER_DARK}`, fontFamily: 'inherit', color: INK_FADED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderRadius: 2 }
const copyBtn = { padding: '12px 20px', background: PINK, color: '#fff', border: 'none', fontFamily: 'inherit', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 700, cursor: 'pointer', borderRadius: 2, minWidth: 90 }
const shareHint = { fontSize: 11, color: INK_FADED, marginTop: 12, fontStyle: 'italic', lineHeight: 1.5 }

const sendBanner = { background: GREEN_PALE, border: `1px solid ${GREEN}`, padding: '22px 22px 20px', marginTop: 8, borderRadius: 2 }
const sendLabel = { fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700, marginBottom: 10 }
const sendTitle = { fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 22, marginBottom: 10, lineHeight: 1.2, textTransform: 'lowercase', fontWeight: 400 }
const sendBody = { fontSize: 13, color: INK_FADED, marginBottom: 16, lineHeight: 1.6 }
const sendBtn = { padding: '14px 26px', background: PINK, color: '#fff', border: 'none', fontFamily: 'inherit', fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 700, cursor: 'pointer', boxShadow: `3px 3px 0 ${INK}`, borderRadius: 2 }

const sectionLabel = { fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: INK_FADED, fontWeight: 700, marginTop: 32, marginBottom: 12, paddingBottom: 8, borderBottom: `1px dashed ${PAPER_DARK}` }
const clipList = { display: 'grid', gap: 8 }
const clipItem = { background: '#fff', border: `1px solid ${PAPER_DARK}`, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, borderRadius: 2 }
const emptyClips = { background: '#fff', border: `1px dashed ${PAPER_DARK}`, padding: '20px 16px', textAlign: 'center', fontSize: 13, color: INK_FADED, fontStyle: 'italic', borderRadius: 2 }

const modalBg = { position: 'fixed', inset: 0, background: 'rgba(26, 20, 16, 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }
const modalCard = { background: '#fff', border: `1px solid ${PAPER_DARK}`, padding: 28, maxWidth: 440, width: '100%', boxShadow: `4px 4px 0 ${INK}` }
const modalTitle = { fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 26, marginBottom: 12, lineHeight: 1.2, textTransform: 'lowercase', fontWeight: 400 }
const modalBody = { fontSize: 13, color: INK_FADED, lineHeight: 1.7, marginBottom: 22 }
const modalCancel = { width: '100%', padding: '12px', background: 'transparent', border: `1px solid ${PAPER_DARK}`, color: INK_FADED, fontFamily: 'inherit', fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 700, cursor: 'pointer' }
