// app/dashboard/DashboardClient.jsx
'use client'

import { useRouter } from 'next/navigation'
import { createBrowserClient } from '../../lib/supabase'

// ─── Brand palette (matches churpie.me v8) ──────────────────────
const INK = '#1A1410'
const INK_FADED = '#4A3F30'
const INK_GHOST = '#7A6E5C'
const PAPER = '#F5F0E8'
const PAPER_AGED = '#EDE5D0'
const PAPER_DARK = '#D4C9A8'
const PINK = '#D4266A'
const PINK_PALE = '#FAE0EC'
const CYAN = '#0B9DAA'
const GREEN = '#2D7A3A'

// Map v1 and v2 theme values to display labels
const THEME_LABELS = {
  birthday: 'Birthday',
  milestone: 'Milestone',
  recovery: 'Recovery',
  welcome_home: 'Welcome home',
  honoring_service: 'Honoring service',
  injured_athlete: 'Injured athlete',
  hard_stretch: 'Hard stretch',
  something_else: 'Something else',
  // Legacy v1 values (pre-schema-v2)
  getwell: 'Recovery',
  homecoming: 'Welcome home',
  veteran: 'Honoring service',
  athlete: 'Injured athlete',
  grief: 'Hard stretch',
  other: 'Something else',
  support: 'Hard stretch',
  graduation: 'Milestone',
  justbecause: 'Something else',
}

function statusText(card) {
  const count = card.clips?.[0]?.count ?? 0
  if (card.status === 'sent') return { text: 'Already sent', color: CYAN, bold: true }
  if (card.status === 'compiled') return { text: 'Ready when you are', color: PINK, bold: true }
  if (card.status === 'compiling') return { text: 'Putting it together…', color: INK_FADED, bold: false }
  if (card.status === 'failed') return { text: 'Something went wrong', color: '#B22222', bold: false }
  if (card.status === 'live') {
    return {
      text: count === 0 ? 'Waiting for the first clip' : `${count} clip${count === 1 ? '' : 's'} in`,
      color: INK_FADED,
      bold: false,
    }
  }
  return { text: card.status, color: INK_FADED, bold: false }
}

function findUrgent(cards) {
  const compiled = cards.find(c => c.status === 'compiled')
  if (compiled) return { card: compiled, reason: 'ready' }

  const now = Date.now()
  const soon = cards.find(c => {
    if (c.status !== 'live' || !c.deadline_at) return false
    const ms = new Date(c.deadline_at).getTime() - now
    const days = ms / (1000 * 60 * 60 * 24)
    return days > 0 && days < 2
  })
  if (soon) return { card: soon, reason: 'deadline' }
  return null
}

export default function DashboardClient({ initialCards, firstName, userEmail }) {
  const router = useRouter()
  const supabase = createBrowserClient()

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const urgent = findUrgent(initialCards)
  const liveCards = initialCards.filter(c => ['live', 'compiling', 'compiled', 'failed'].includes(c.status))
  const sentCards = initialCards.filter(c => c.status === 'sent')

  return (
    <>
      <FontLoader />
      <div style={wrap}>
        <div style={stripe} />

        <nav style={navBar}>
          <a href="/dashboard" style={logo}>
            churpie<span style={{ color: PINK }}>.</span>
          </a>
          <div style={navRight}>
            <span style={navEmail}>{userEmail}</span>
            <button onClick={signOut} style={navBtn}>Sign out</button>
          </div>
        </nav>

        <main style={main}>
          <h1 style={greeting}>hi, {firstName.toLowerCase()}.</h1>
          <div style={subgreeting}>here&rsquo;s where your cards are.</div>

          {urgent && (
            <section style={urgentBanner}>
              <div style={urgentLabel}>Waiting on you</div>
              <div style={urgentTitle}>
                {urgent.reason === 'ready'
                  ? `${urgent.card.recipient_name}'s card is ready. Press when you are.`
                  : `${urgent.card.recipient_name}'s card sends soon — have a look.`}
              </div>
              <a href={`/cards/${urgent.card.id}`} style={urgentBtn}>
                Review and send &rarr;
              </a>
            </section>
          )}

          <button
            onClick={() => router.push('/create')}
            style={newCardBtn}
            onMouseOver={(e) => { e.currentTarget.style.borderColor = PINK; e.currentTarget.style.color = PINK; }}
            onMouseOut={(e) => { e.currentTarget.style.borderColor = PAPER_DARK; e.currentTarget.style.color = INK; }}
          >
            + Start a card
          </button>

          {liveCards.length > 0 && (
            <>
              <div style={sectionLabel}>Gathering clips</div>
              <div style={cardGrid}>
                {liveCards.map(card => (
                  <CardRow key={card.id} card={card} status={statusText(card)} />
                ))}
              </div>
            </>
          )}

          {sentCards.length > 0 && (
            <>
              <div style={sectionLabel}>Already sent</div>
              <div style={cardGrid}>
                {sentCards.map(card => (
                  <CardRow key={card.id} card={card} status={statusText(card)} sent />
                ))}
              </div>
            </>
          )}

          {initialCards.length === 0 && (
            <section style={emptyState}>
              <div style={emptyTitle}>No cards yet. Think of one person.</div>
              <div style={emptyBody}>
                The friend turning 30. The one who just got the job.
                The coach hanging it up. You know.
              </div>
              <button onClick={() => router.push('/create')} style={emptyBtn}>
                Start their card &rarr;
              </button>
            </section>
          )}
        </main>
      </div>
    </>
  )
}

function CardRow({ card, status, sent }) {
  const themeLabel = THEME_LABELS[card.theme] || card.theme
  return (
    <a
      href={`/cards/${card.id}`}
      style={cardItem}
      onMouseOver={(e) => {
        e.currentTarget.style.transform = 'translate(-1px, -1px)'
        e.currentTarget.style.boxShadow = `3px 3px 0 ${PAPER_AGED}`
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.transform = 'translate(0, 0)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      <div>
        <div style={cardName}>
          For {card.recipient_name}
          {themeLabel && (
            <span style={{ color: INK_GHOST, fontWeight: 400 }}>
              {' · '}{themeLabel}
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: status.color, fontWeight: status.bold ? 700 : 400, marginTop: 3 }}>
          {sent && card.watch_count > 0
            ? `${card.recipient_name.split(' ')[0]}'s watched it ${card.watch_count} time${card.watch_count === 1 ? '' : 's'}`
            : status.text}
        </div>
      </div>
      <div style={{ fontSize: 14, color: INK_GHOST }}>&rarr;</div>
    </a>
  )
}

// ─── Google Fonts loader for the brand fonts ────────────────────
// (In a real-world build this would go in app/layout.js, but doing it
// inline here keeps this milestone self-contained and reversible.)
function FontLoader() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&family=Permanent+Marker&family=Caveat:wght@400;600;700&family=DM+Serif+Display&display=swap"
      />
    </>
  )
}

// ─── Styles (inline to avoid touching globals.css) ──────────────
const wrap = {
  minHeight: '100vh',
  background: PAPER,
  fontFamily: "'Courier Prime', 'Courier New', monospace",
  color: INK,
  paddingBottom: 80,
}
const stripe = {
  height: 4,
  background: `repeating-linear-gradient(90deg, ${PINK} 0 12px, ${CYAN} 12px 24px)`,
}
const navBar = {
  maxWidth: 920,
  margin: '0 auto',
  padding: '24px 24px 12px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 10,
}
const logo = {
  fontFamily: "'Permanent Marker', cursive",
  fontSize: 24,
  color: INK,
  textDecoration: 'none',
}
const navRight = { display: 'flex', gap: 16, alignItems: 'center' }
const navEmail = { fontSize: 11, color: INK_GHOST, letterSpacing: 0.5 }
const navBtn = {
  fontSize: 11,
  color: INK_FADED,
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  letterSpacing: 1.5,
  textTransform: 'uppercase',
  fontFamily: 'inherit',
  fontWeight: 700,
}
const main = { maxWidth: 920, margin: '0 auto', padding: '24px' }
const greeting = {
  fontFamily: "'DM Serif Display', Georgia, serif",
  fontSize: 'clamp(32px, 5vw, 44px)',
  lineHeight: 1.1,
  letterSpacing: '-0.5px',
  textTransform: 'lowercase',
  marginBottom: 6,
  fontWeight: 400,
}
const subgreeting = {
  fontFamily: "'Caveat', cursive",
  fontSize: 22,
  color: CYAN,
  fontWeight: 600,
  transform: 'rotate(-0.5deg)',
  display: 'inline-block',
  marginBottom: 32,
}
const urgentBanner = {
  background: PINK_PALE,
  border: `1px solid ${PINK}`,
  padding: '20px 22px',
  marginBottom: 28,
  borderRadius: 2,
}
const urgentLabel = {
  fontSize: 10,
  letterSpacing: 2,
  textTransform: 'uppercase',
  color: PINK,
  fontWeight: 700,
  marginBottom: 10,
}
const urgentTitle = {
  fontFamily: "'DM Serif Display', Georgia, serif",
  fontSize: 22,
  color: INK,
  marginBottom: 14,
  lineHeight: 1.25,
  textTransform: 'lowercase',
  fontWeight: 400,
}
const urgentBtn = {
  display: 'inline-block',
  padding: '11px 22px',
  background: PINK,
  color: '#fff',
  border: 'none',
  fontFamily: 'inherit',
  fontSize: 12,
  letterSpacing: 1.5,
  textTransform: 'uppercase',
  fontWeight: 700,
  cursor: 'pointer',
  boxShadow: `3px 3px 0 ${INK}`,
  textDecoration: 'none',
}
const newCardBtn = {
  width: '100%',
  padding: '18px 24px',
  background: '#fff',
  border: `2px dashed ${PAPER_DARK}`,
  color: INK,
  fontFamily: 'inherit',
  fontSize: 14,
  cursor: 'pointer',
  marginBottom: 32,
  letterSpacing: 1,
  textTransform: 'uppercase',
  fontWeight: 700,
  transition: 'all 0.15s',
}
const sectionLabel = {
  fontSize: 10,
  letterSpacing: 2,
  textTransform: 'uppercase',
  color: INK_FADED,
  fontWeight: 700,
  marginBottom: 14,
  marginTop: 28,
  paddingBottom: 8,
  borderBottom: `1px dashed ${PAPER_DARK}`,
}
const cardGrid = { display: 'grid', gap: 10 }
const cardItem = {
  background: '#fff',
  border: `1px solid ${PAPER_DARK}`,
  padding: '16px 20px',
  cursor: 'pointer',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  transition: 'transform 0.15s, box-shadow 0.15s',
  textDecoration: 'none',
  color: INK,
  borderRadius: 2,
}
const cardName = { fontSize: 15, fontWeight: 700, letterSpacing: 0.2 }
const emptyState = {
  background: '#fff',
  border: `1px solid ${PAPER_DARK}`,
  padding: '40px 32px',
  textAlign: 'center',
  marginTop: 12,
  borderRadius: 2,
}
const emptyTitle = {
  fontFamily: "'DM Serif Display', Georgia, serif",
  fontSize: 24,
  lineHeight: 1.3,
  marginBottom: 12,
  textTransform: 'lowercase',
  fontWeight: 400,
}
const emptyBody = {
  fontSize: 13,
  color: INK_FADED,
  lineHeight: 1.7,
  maxWidth: 440,
  margin: '0 auto 22px',
}
const emptyBtn = {
  padding: '12px 24px',
  background: PINK,
  color: '#fff',
  border: 'none',
  fontFamily: 'inherit',
  fontSize: 12,
  letterSpacing: 1.5,
  textTransform: 'uppercase',
  fontWeight: 700,
  cursor: 'pointer',
  boxShadow: `3px 3px 0 ${INK}`,
}
