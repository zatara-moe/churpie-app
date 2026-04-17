// app/c/[slug]/page.js
// What contributors see when they open the invite link.
// Server component: looks up the card, handles closed states, renders the contributor flow.

import { getCardBySlug } from '../../../lib/supabase'
import ContributorFlowV2 from '../../../components/ContributorFlowV2'
import { notFound } from 'next/navigation'

export async function generateMetadata({ params }) {
  const card = await getCardBySlug(params.slug)
  if (!card) return { title: 'churpie.' }
  return {
    title: `You're one of ${card.recipient_name}'s people. — churpie.`,
    description: card.contributor_message,
  }
}

export default async function ContributorPage({ params }) {
  const card = await getCardBySlug(params.slug)
  if (!card) notFound()

  if (card.status !== 'live') {
    return <ClosedCardScreen recipientName={card.recipient_name} status={card.status} />
  }

  return <ContributorFlowV2 card={card} />
}

function ClosedCardScreen({ recipientName, status }) {
  const INK = '#1A1410'
  const INK_FADED = '#4A3F30'
  const PAPER = '#F5F0E8'
  const PAPER_DARK = '#D4C9A8'
  const PINK = '#D4266A'
  const CYAN = '#0B9DAA'

  const firstName = recipientName.split(' ')[0]
  const heading = status === 'sent'
    ? `${firstName}'s card has already been delivered.`
    : `${firstName}'s card is being put together.`
  const body = status === 'sent'
    ? `Ask whoever organized it if you'd like a copy of the video.`
    : `The link is no longer accepting new clips. Check back later.`

  return (
    <div style={{ minHeight: '100vh', background: PAPER, fontFamily: "'Courier Prime', 'Courier New', monospace", color: INK, display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 4, background: `repeating-linear-gradient(90deg, ${PINK} 0 12px, ${CYAN} 12px 24px)` }} />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 440, textAlign: 'center', background: '#fff', border: `1px solid ${PAPER_DARK}`, padding: '36px 32px' }}>
          <div style={{ fontFamily: "'Permanent Marker', cursive", fontSize: 24, marginBottom: 20 }}>
            churpie<span style={{ color: PINK }}>.</span>
          </div>
          <h1 style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 24, lineHeight: 1.2, letterSpacing: '-0.4px', textTransform: 'lowercase', marginBottom: 12, fontWeight: 400 }}>
            {heading.toLowerCase()}
          </h1>
          <p style={{ fontSize: 14, color: INK_FADED, lineHeight: 1.7 }}>
            {body}
          </p>
        </div>
      </div>
    </div>
  )
}
