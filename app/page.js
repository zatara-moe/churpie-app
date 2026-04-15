// app/page.js
// Home page — detects if user is signed in, shows the right entry point
'use client'
import { useEffect, useState } from 'react'
import { createBrowserClient } from '../lib/supabase'
import AppShell from '../components/AppShell'

export default function HomePage() {
  const [session, setSession] = useState(undefined) // undefined = loading
  const supabase = createBrowserClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) return <LoadingScreen />
  return <AppShell session={session} />
}

function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0ebe6' }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid #C23B6B', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
