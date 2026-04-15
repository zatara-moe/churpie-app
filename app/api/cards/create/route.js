// app/api/cards/create/route.js

export const dynamic = 'force-dynamic'

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createCard } from '../../../../lib/supabase'
import { nanoid } from 'nanoid'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { recipientName, recipientEmail, recipientPhone, theme, message, music, deadline } = body

  if (!recipientName || !message) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const slug = nanoid(8).toLowerCase().replace(/[^a-z0-9]/g, 'x')

  try {
    const card = await createCard({
      creatorId: session.user.id,
      recipientName,
      recipientEmail,
      recipientPhone,
      theme: theme || 'getwell',
      message,
      music: music || 'gentle-piano',
      deadline: deadline || null,
      slug,
    })
    return NextResponse.json({ card })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
