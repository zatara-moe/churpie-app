// app/create/page.js
// The 4-step create-a-card wizard (server wrapper).

export const dynamic = 'force-dynamic'

import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import CreateWizardClient from './CreateWizardClient'

export default async function CreatePage() {
  const supabase = createServerComponentClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login?next=/create')
  }

  return <CreateWizardClient userEmail={session.user.email} />
}
