// app/watch/[token]/page.js
import { verifyWatchToken } from '../../../lib/watch-token'
import { createServiceClient } from '../../../lib/supabase'
import { getPresignedReadUrl } from '../../../lib/r2'
import RecipientExperienceV2 from '../../../components/RecipientExperienceV2'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function WatchPage({ params }) {
  const payload = await verifyWatchToken(params.token)
  if (!payload) notFound()

  const sb = createServiceClient()

  const { data: card } = await sb
    .from('cards')
    .select('*, clips(*), deliveries(*)')
    .eq('id', payload.cardId)
    .single()

  if (!card) notFound()

  const delivery = card.deliveries?.[0]
  let videoUrl = null
  if (delivery?.compiled_video_key) {
    videoUrl = await getPresignedReadUrl(delivery.compiled_video_key, 3600)
  }

  const submittedClips = (card.clips || []).filter(c =>
    c.status === 'submitted' || c.status === 'processed'
  )

  const totalDuration = submittedClips.reduce(
    (sum, c) => sum + (c.duration_seconds || 0),
    0
  )

  return (
    <RecipientExperienceV2
      recipientName={card.recipient_name}
      clipCount={submittedClips.length}
      contributors={submittedClips.map(c => ({
        name: c.contributor_name || 'Anonymous',
      }))}
      videoUrl={videoUrl}
      cardId={card.id}
      theme={card.theme}
      durationSeconds={totalDuration}
      deliveredAt={delivery?.sent_at || card.created_at}
    />
  )
}
