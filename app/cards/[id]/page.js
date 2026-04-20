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
  let delivery = null
  try {
    const sb = createServiceClient()
    const { data: d } = await sb
      .from('deliveries')
      .select('*')
      .eq('card_id', params.id)
      .maybeSingle()

    if (d) {
      delivery = d
      if (d.compiled_video_key) {
        previewUrl = await getPresignedReadUrl(d.compiled_video_key, 3600)
      }
    }
  } catch (err) {
    console.error('[card-detail] preview URL generation failed:', err.message)
  }

  return <CardDetailClient card={card} previewUrl={previewUrl} delivery={delivery} />
}
