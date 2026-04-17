// app/api/auth/callback/route.js

export const dynamic = 'force-dynamic'

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') || '/dashboard'

  if (code) {
    const supabase = createRouteHandlerClient({ cookies })
    await supabase.auth.exchangeCodeForSession(code)
  }

  // Use a 303 redirect to force the browser to issue a fresh GET
  // with the new session cookie attached. This avoids a race where
  // middleware checks the session before the cookie is written.
  return NextResponse.redirect(`${origin}${next}`, { status: 303 })
}
