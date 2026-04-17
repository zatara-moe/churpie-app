// app/cards/[id]/page.js
// Card detail / tracking page for a single card.
// Server component — fetches card + clips + preview URL (when compiled).

export const dynamic = 'force-dynamic'

import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { createServiceClient } from '../../../lib/supabase'
import { getPresignedReadUrl } from '../../../lib/r2'
import CardDetailClient from './CardDetailClient'

export default async function CardDetailPage({ params }) {
  const supabase = createServerComponentClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect(`/login?next=/cards/${params.id}`)
  }

  const sb = createServiceClient()
  const { data: card } = await sb
    .from('cards')
    .select('*, clips(*), deliveries(*)')
    .eq('id', params.id)
    .single()

  if (!card) notFound()

  if (card.creator_id !== session.user.id) {
    redirect('/dashboard')
  }

  // Fetch a signed preview URL if the video is compiled
  let previewUrl = null
  const delivery = card.deliveries?.[0]
  if (delivery?.compiled_video_key) {
    try {
      previewUrl = await getPresignedReadUrl(delivery.compiled_video_key, 3600)
    } catch (err) {
      console.error('Failed to generate preview URL:', err.message)
    }
  }

  return <CardDetailClient card={card} previewUrl={previewUrl} />
}
