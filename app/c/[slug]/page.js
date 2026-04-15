// app/c/[slug]/page.js
// This is what contributors see when they open the link
import { getCardBySlug } from '../../../lib/supabase'
import ContributorFlow from '../../../components/ContributorFlow'
import { notFound } from 'next/navigation'

export async function generateMetadata({ params }) {
  const card = await getCardBySlug(params.slug)
  if (!card) return { title: 'churpie.' }
  return {
    title: `Record a message for ${card.recipient_name} — churpie.`,
    description: card.contributor_message,
  }
}

export default async function ContributorPage({ params }) {
  const card = await getCardBySlug(params.slug)
  if (!card) notFound()
  if (card.status !== 'live') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0ebe6', padding: '0 20px' }}>
        <div style={{ textAlign: 'center', maxWidth: 320 }}>
          <div style={{ fontSize: 22, fontWeight: 500, marginBottom: 8 }}>This card is closed</div>
          <div style={{ fontSize: 14, color: '#888' }}>The video for {card.recipient_name} has already been sent.</div>
        </div>
      </div>
    )
  }

  return <ContributorFlow card={card} />
}
