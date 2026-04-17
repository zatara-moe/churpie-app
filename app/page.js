// app/page.js
export const dynamic = 'force-dynamic'

import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function RootPage() {
  const supabase = createServerComponentClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()

  if (session) {
    redirect('/dashboard')
  }

  return (
    <div style={pageStyle}>
      <div style={stripeStyle} />
      <div style={centerStyle}>
        <div style={cardStyle}>
          <div style={logoStyle}>
            churpie<span style={{ color: '#D4266A' }}>.</span>
          </div>
          <h1 style={headingStyle}>welcome to the app.</h1>
          <p style={bodyStyle}>
            Sign in to start a card, or learn more at{' '}
            <a href="https://churpie.me" style={{ color: '#D4266A' }}>churpie.me</a>.
          </p>
          <a href="/login" style={buttonStyle}>Sign in</a>
        </div>
      </div>
    </div>
  )
}

const pageStyle = {
  minHeight: '100vh',
  background: '#F5F0E8',
  fontFamily: "'Courier Prime', 'Courier New', monospace",
  color: '#1A1410',
  display: 'flex',
  flexDirection: 'column',
}

const stripeStyle = {
  height: 4,
  background: 'repeating-linear-gradient(90deg, #D4266A 0 12px, #0B9DAA 12px 24px)',
}

const centerStyle = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
}

const cardStyle = {
  maxWidth: 440,
  textAlign: 'center',
  background: '#fff',
  border: '1px solid #D4C9A8',
  padding: '40px 32px',
  boxShadow: '3px 3px 0 #EDE5D0, 6px 6px 0 #D4C9A8',
}

const logoStyle = {
  fontFamily: "'Permanent Marker', cursive",
  fontSize: 28,
  marginBottom: 20,
}

const headingStyle = {
  fontFamily: "'DM Serif Display', Georgia, serif",
  fontSize: 28,
  lineHeight: 1.15,
  letterSpacing: '-0.4px',
  textTransform: 'lowercase',
  marginBottom: 14,
  fontWeight: 400,
}

const bodyStyle = {
  fontSize: 14,
  color: '#4A3F30',
  lineHeight: 1.7,
  marginBottom: 24,
}

const buttonStyle = {
  display: 'inline-block',
  padding: '14px 28px',
  background: '#D4266A',
  color: '#fff',
  fontFamily: 'inherit',
  fontSize: 12,
  letterSpacing: 1.5,
  textTransform: 'uppercase',
  fontWeight: 700,
  textDecoration: 'none',
  boxShadow: '3px 3px 0 #1A1410',
}
