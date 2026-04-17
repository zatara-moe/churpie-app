// app/page.js
// Root route: logged-in users go to /dashboard, guests see a simple welcome
// that points them at the marketing site.

export const dynamic = 'force-dynamic'

import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

const INK = '#1A1410'
const INK_FADED = '#4A3F30'
const INK_GHOST = '#7A6E5C'
const PAPER = '#F5F0E8'
const PAPER_DARK = '#D4C9A8'
const PINK = '#D4266A'
const CYAN = '#0B9DAA'

export default async function RootPage() {
  const supabase = createServerComponentClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()

  if (session) {
    redirect('/dashboard')
  }

  // Not signed in — show a simple bridge page
  return (
    <div style={{
      minHeight: '100vh',
      background: PAPER,
      fontFamily: "'Courier Prime', 'Courier New', monospace",
      color: INK,
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{
        height: 4,
        background: `repeating-linear-gradient(90deg, ${PINK} 0 12px, ${CYAN} 12px 24px)`,
      }} />

      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}>
        <div style={{
          maxWidth: 440,
          textAlign: 'center',
          background: '#fff',
          border: `1px solid ${PAPER_DARK}`,
          padding: '40px 32px',
          boxShadow: `3px 3px 0 #EDE5D0, 6px 6px 0 ${PAPER_DARK}`,
        }}>
          <div style={{
            fontFamily: "'Permanent Marker', cursive",
            fontSize: 28,
            marginBottom: 20,
          }}>
            churpie<span style={{ color: PINK }}>.</span>
          </div>
          <h1 style={{
            fontFamily: "'DM Serif Display', Georgia, serif",
            fontSize: 28,
            lineHeight: 1.15,
            letterSpacing: '-0.4px',
            textTransform: 'lowercase',
            marginBottom: 14,
            fontWeight: 400,
          }}>
            welcome to the app.
          </h1>
          <p style={{
            fontSize: 14,
            color: INK_FADED,
            lineHeight: 1.7,
            marginBottom: 24,
          }}>
            Sign in to start a card, or learn more about what churpie is at{' '}
            <a href="https://churpie.me" style={{ color: PINK }}>churpie.me</a>.
          </p>
          <a
            href="/login"
            style={{
              display: 'inline-block',
              padding: '14px 28px',
              background: PINK,
              color: '#fff',
              fontFamily: 'inherit',
              fontSize: 12,
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              fontWeight: 700,
              textDecoration: 'none',
              boxShadow: `3px 3px 0 ${INK}`,
            }}
          >
            Sign in →
          </a>
        </div>
      </div>
    </div>
  )
}
