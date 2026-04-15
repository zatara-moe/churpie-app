// app/api/cards/list/route.js

export const dynamic = 'force-dynamic'

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createServiceClient } from '../../../../lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sb = createServiceClient()
  const { data: cards } = await sb
    .from('cards')
    .select('*, clips(count)')
    .eq('creator_id', session.user.id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ cards: cards || [] })
}
