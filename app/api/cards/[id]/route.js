// app/api/cards/[id]/route.js

export const dynamic = 'force-dynamic'

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createServiceClient } from '../../../../lib/supabase'
import { NextResponse } from 'next/server'

export async function GET(request, { params }) {
  const { id } = params
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sb = createServiceClient()
  const { data: card } = await sb
    .from('cards')
    .select('*, clips(*)')
    .eq('id', id)
    .eq('creator_id', session.user.id)
    .single()

  if (!card) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ card })
}
