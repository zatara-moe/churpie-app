// app/watch/[token]/page.js
import { verifyWatchToken } from '../../../lib/watch-token'
import { createServiceClient } from '../../../lib/supabase'
import { getPresignedReadUrl } from '../../../lib/r2'
import RecipientExperience from '../../../components/RecipientExperience'
import { notFound } from 'next/navigation'

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

  // Get a short-lived signed URL for the final compiled video
  const delivery = card.deliveries?.[0]
  let videoUrl = null
  if (delivery?.compiled_video_key) {
    videoUrl = await getPresignedReadUrl(delivery.compiled_video_key, 3600)
  }

  const submittedClips = (card.clips || []).filter(c => c.status === 'submitted')

  return (
    <RecipientExperience
      card={{
        id: card.id,
        recipientName: card.recipient_name,
        theme: card.theme,
        creatorNote: card.contributor_message,
        clipCount: submittedClips.length,
        contributors: submittedClips.map(c => ({
          name: c.contributor_name || 'Anonymous',
          durationSeconds: c.duration_seconds,
        })),
      }}
      videoUrl={videoUrl}
    />
  )
}
