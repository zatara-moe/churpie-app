// app/cards/[id]/page.js
// Card detail / tracking page for a single card.

export const dynamic = 'force-dynamic'

import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { createServiceClient, getCardWithClips } from '../../../lib/supabase'
import { getPresignedReadUrl } from '../../../lib/r2'
import CardDetailClient from './CardDetailClient'

export default async function CardDetailPage({ params }) {
  const supabase = createServerComponentClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect(`/login?next=/cards/${params.id}`)
  }

  const card = await getCardWithClips(params.id)
  if (!card) notFound()

  if (card.creator_id !== session.user.id) {
    redirect('/dashboard')
  }

  let previewUrl = null
  try {
    const sb = createServiceClient()
    const { data: delivery, error: dErr } = await sb
      .from('deliveries')
      .select('compiled_video_key')
      .eq('card_id', params.id)
      .maybeSingle()

    if (dErr) {
      console.error('[card-detail] delivery query error:', dErr.message)
    } else if (delivery?.compiled_video_key) {
      console.log('[card-detail] generating preview for key:', delivery.compiled_video_key)
      previewUrl = await getPresignedReadUrl(delivery.compiled_video_key, 3600)
      console.log('[card-detail] preview URL length:', previewUrl?.length || 0)
    } else {
      console.log('[card-detail] no compiled_video_key for card', params.id)
    }
  } catch (err) {
    console.error('[card-detail] preview URL generation failed:', err.message)
  }

  return <CardDetailClient card={card} previewUrl={previewUrl} />
}
