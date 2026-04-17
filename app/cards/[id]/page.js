// app/cards/[id]/page.js
// Card detail / tracking page for a single card.
// Server component — fetches card + clips, enforces creator ownership.

export const dynamic = 'force-dynamic'

import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { getCardWithClips } from '../../../lib/supabase'
import CardDetailClient from './CardDetailClient'

export default async function CardDetailPage({ params }) {
  const supabase = createServerComponentClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect(`/login?next=/cards/${params.id}`)
  }

  const card = await getCardWithClips(params.id)
  if (!card) notFound()

  // Creator-only access
  if (card.creator_id !== session.user.id) {
    redirect('/dashboard')
  }

  return <CardDetailClient card={card} />
}
