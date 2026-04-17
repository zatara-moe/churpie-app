// app/login/page.js
'use client'
import { useState, Suspense } from 'react'
import { createBrowserClient } from '../../lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'

const ROSE = '#C23B6B'
const INK = '#0d0d0d'

function LoginContent() {
  const [loading, setLoading] = useState(null)
  const supabase = createBrowserClient()
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get('next') || '/dashboard'

  const signIn = async (provider) => {
    setLoading(provider)
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(next)}`,
      },
    })
    if (error) { setLoading(null); alert(error.message) }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F0E8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 20px' }}>
      <div style={{ width: '100%', maxWidth: 380, background: '#fff', borderRadius: 2, padding: '40px 28px', border: '1px solid #D4C9A8', boxShadow: '3px 3px 0 #EDE5D0, 6px 6px 0 #D4C9A8' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontFamily: "'Permanent Marker', cursive", fontSize: 28, marginBottom: 10, color: '#1A1410' }}>
            churpie<span style={{ color: '#D4266A' }}>.</span>
          </div>
          <div style={{ fontSize: 13, color: '#7A6E5C', fontFamily: "'Courier Prime', monospace" }}>
            Sign in to start a card
          </div>
        </div>
        <button onClick={() => signIn('google')} disabled={loading === 'google'}
          style={{ width: '100%', padding: '14px 0', background: '#fff', color: '#1a1a1a', fontSize: 14, fontWeight: 500, border: '1px solid #D4C9A8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, opacity: loading === 'google' ? 0.7 : 1, fontFamily: 'inherit' }}>
          <GoogleLogo />
          {loading === 'google' ? 'Signing in...' : 'Continue with Google'}
        </button>
        <div style={{ fontSize: 11, color: '#999', textAlign: 'center', lineHeight: 1.6, marginTop: 24, fontFamily: "'Courier Prime', monospace" }}>
          No password needed. Contributors don't need to sign in.
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#F5F0E8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: "'Permanent Marker', cursive", fontSize: 24, color: '#1A1410' }}>
          churpie<span style={{ color: '#D4266A' }}>.</span>
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}

function GoogleLogo() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M15.5 8.2c0-.6-.1-1.1-.2-1.7H8v3.1h4.2c-.2 1-.7 1.8-1.5 2.4v2h2.5c1.4-1.3 2.3-3.3 2.3-5.8z" fill="#4285F4"/><path d="M8 16c2.1 0 3.9-.7 5.2-1.9l-2.5-2c-.7.5-1.7.7-2.7.7-2.1 0-3.8-1.4-4.4-3.3H1v2.1C2.3 14.1 5 16 8 16z" fill="#34A853"/><path d="M3.6 9.5c-.2-.5-.3-1-.3-1.5s.1-1 .3-1.5V4.4H1C.4 5.5 0 6.7 0 8s.4 2.5 1 3.6l2.6-2.1z" fill="#FBBC05"/><path d="M8 3.2c1.2 0 2.2.4 3 1.2L13.6 2C12.2.7 10.3 0 8 0 5 0 2.3 1.9 1 4.4l2.6 2.1C4.2 4.6 5.9 3.2 8 3.2z" fill="#EA4335"/></svg>
}
