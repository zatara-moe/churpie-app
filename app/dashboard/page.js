// app/dashboard/page.js
// Dashboard — where creators land after sign-in.

export const dynamic = 'force-dynamic'

import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getCreatorCards } from '../../lib/supabase'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const supabase = createServerComponentClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login?next=/dashboard')
  }

  const cards = await getCreatorCards(session.user.id)

  const firstName =
    session.user.user_metadata?.full_name?.split(' ')[0]
    || session.user.user_metadata?.name?.split(' ')[0]
    || session.user.email?.split('@')[0]
    || 'friend'

  return (
    <DashboardClient
      initialCards={cards}
      firstName={firstName}
      userEmail={session.user.email}
    />
  )
}
