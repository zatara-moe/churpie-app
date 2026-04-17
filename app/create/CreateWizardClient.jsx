// app/create/CreateWizardClient.jsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// ─── Palette ────────────────────────────────────────────────────
const INK = '#1A1410'
const INK_FADED = '#4A3F30'
const INK_GHOST = '#7A6E5C'
const PAPER = '#F5F0E8'
const PAPER_AGED = '#EDE5D0'
const PAPER_DARK = '#D4C9A8'
const PINK = '#D4266A'
const PINK_PALE = '#FAE0EC'
const CYAN = '#0B9DAA'
const AMBER_PALE = '#FAEEDA'

// Theme values match schema v2 normalized set + string audit labels
const THEMES = [
  { id: 'birthday', label: 'Birthday', sub: 'Celebration' },
  { id: 'milestone', label: 'Milestone', sub: 'Graduation, promotion, big moment' },
  { id: 'recovery', label: 'Recovery', sub: 'Hospital, illness, healing' },
  { id: 'welcome_home', label: 'Welcome home', sub: 'Back from somewhere' },
  { id: 'honoring_service', label: 'Honoring service', sub: 'Veteran, first responder' },
  { id: 'injured_athlete', label: 'Injured athlete', sub: 'Team sending support' },
  { id: 'hard_stretch', label: 'Hard stretch', sub: 'Grief, loss, tough season' },
  { id: 'something_else', label: 'Something else', sub: 'Whatever this is' },
]

const MESSAGE_PLACEHOLDERS = {
  birthday: "We're making a video for Rosa's 70th. Record 15 seconds — a favorite memory, a wish, anything you want her to hear.",
  milestone: "We're putting together a video for Alex's graduation. Record 15 seconds — congrats, advice, or anything you want them to hear.",
  recovery: "Rosa is recovering and we're bringing a whole room of people to her. Record 15 seconds — what you'd tell her if you could walk in today.",
  welcome_home: "Marcus is coming home after 9 months deployed. Record 15 seconds to welcome him back.",
  honoring_service: "We're honoring Sgt. Ramirez's service. Record 15 seconds — what you'd say in person if you could.",
  injured_athlete: "We're sending Jordan love from the team. Record 15 seconds — encouragement, a favorite memory from the season, anything.",
  hard_stretch: "Priya is going through a really hard stretch. Record 15 seconds — no pressure to be wise, just be present.",
  something_else: "We're making a little something for Sam. Record 15 seconds of whatever you want them to hear.",
}

export default function CreateWizardClient() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Form state — persisted to sessionStorage so refresh doesn't wipe progress
  const [form, setForm] = useState({
    recipientName: '',
    theme: '',
    message: '',
    deadlineType: 'date', // 'date' | 'open'
    deadlineDate: '',
    recipientEmail: '',
    music: 'gentle-piano',
  })

  const [createdCard, setCreatedCard] = useState(null)
  const [origin, setOrigin] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setOrigin(window.location.origin)
    const saved = sessionStorage.getItem('churpie-wizard-form')
    if (saved) {
      try { setForm(JSON.parse(saved)) } catch {}
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (createdCard) return
    sessionStorage.setItem('churpie-wizard-form', JSON.stringify(form))
  }, [form, createdCard])

  const updateForm = (patch) => setForm(f => ({ ...f, ...patch }))

  const canContinue = () => {
    if (step === 1) return form.recipientName.trim() && form.theme
    if (step === 2) return form.message.trim().length >= 10
    if (step === 3) {
      if (form.deadlineType === 'date') return !!form.deadlineDate
      return true
    }
    return true
  }

  const submitCard = async () => {
    setLoading(true)
    setError(null)
    try {
      // Convert deadline to ISO string or null
      const deadline = (form.deadlineType === 'date' && form.deadlineDate)
        ? new Date(form.deadlineDate).toISOString()
        : null

      const res = await fetch('/api/cards/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientName: form.recipientName.trim(),
          recipientEmail: form.recipientEmail.trim() || null,
          theme: form.theme,
          message: form.message.trim(),
          music: form.music,
          deadline,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong')

      sessionStorage.removeItem('churpie-wizard-form')
      setCreatedCard(data.card)
      setStep(4)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const contributorUrl = createdCard && origin
    ? `${origin}/c/${createdCard.slug}`
    : ''

  const copyLink = async () => {
    if (!contributorUrl) return
    try {
      await navigator.clipboard.writeText(contributorUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      alert(`Copy this link: ${contributorUrl}`)
    }
  }

  return (
    <div style={wrap}>
      <div style={stripe} />

      <nav style={navBar}>
        <a href="/dashboard" style={logo}>
          churpie<span style={{ color: PINK }}>.</span>
        </a>
        {!createdCard && (
          <a href="/dashboard" style={backLink}>&larr; Cancel</a>
        )}
      </nav>

      <main style={main}>
        {!createdCard && (
          <div style={stepIndicator}>Step {step} of 4</div>
        )}

        {/* ─── STEP 1: Recipient + theme ─── */}
        {step === 1 && (
          <section>
            <h1 style={stepTitle}>who&rsquo;s this one for?</h1>
            <p style={stepSub}>Just a first name is fine. Only the people recording will see it.</p>

            <label style={inputLabel}>Their name</label>
            <input
              type="text"
              value={form.recipientName}
              onChange={e => updateForm({ recipientName: e.target.value })}
              placeholder="e.g. Aunt Rosa"
              style={textInput}
              autoFocus
            />

            <label style={{ ...inputLabel, marginTop: 24 }}>What&rsquo;s the occasion?</label>
            <div style={themeGrid}>
              {THEMES.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => updateForm({ theme: t.id })}
                  style={{
                    ...themeBtn,
                    background: form.theme === t.id ? PINK_PALE : '#fff',
                    borderColor: form.theme === t.id ? PINK : PAPER_DARK,
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{t.label}</div>
                  <div style={{ fontSize: 11, color: INK_GHOST }}>{t.sub}</div>
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 32 }}>
              <button
                onClick={() => setStep(2)}
                disabled={!canContinue()}
                style={{ ...primaryBtn, opacity: canContinue() ? 1 : 0.4 }}
              >
                Continue &rarr;
              </button>
            </div>
          </section>
        )}

        {/* ─── STEP 2: The message ─── */}
        {step === 2 && (
          <section>
            <h1 style={stepTitle}>what do you want them to say?</h1>
            <p style={stepSub}>
              This is the first thing everyone sees when they open the link.
              Write it like you&rsquo;re texting a friend. They&rsquo;ll follow your tone.
            </p>

            <label style={inputLabel}>Your message to contributors</label>
            <textarea
              value={form.message}
              onChange={e => updateForm({ message: e.target.value })}
              placeholder={MESSAGE_PLACEHOLDERS[form.theme] || MESSAGE_PLACEHOLDERS.something_else}
              style={{ ...textInput, minHeight: 140, resize: 'vertical', lineHeight: 1.6 }}
              autoFocus
            />

            <div style={tipBox}>
              <div style={tipHead}>One thing to know</div>
              <div style={{ fontSize: 13, color: INK_FADED, lineHeight: 1.65 }}>
                Your ask sets the tone. Ask for a memory, you&rsquo;ll get memories.
                Ask what they mean to people, you&rsquo;ll get feelings. Either works —
                pick whichever fits the moment.
              </div>
            </div>

            <div style={stepNav}>
              <button onClick={() => setStep(1)} style={secondaryBtn}>&larr; Back</button>
              <button
                onClick={() => setStep(3)}
                disabled={!canContinue()}
                style={{ ...primaryBtn, opacity: canContinue() ? 1 : 0.4 }}
              >
                Continue &rarr;
              </button>
            </div>
          </section>
        )}

        {/* ─── STEP 3: Deadline + recipient email ─── */}
        {step === 3 && (
          <section>
            <h1 style={stepTitle}>when should they get it?</h1>
            <p style={stepSub}>Pick a date, or keep it open-ended. You can change this anytime.</p>

            <div style={{ display: 'grid', gap: 12, marginBottom: 8 }}>
              <label style={{
                ...radioRow,
                background: form.deadlineType === 'date' ? PINK_PALE : '#fff',
                borderColor: form.deadlineType === 'date' ? PINK : PAPER_DARK,
              }}>
                <input
                  type="radio"
                  checked={form.deadlineType === 'date'}
                  onChange={() => updateForm({ deadlineType: 'date' })}
                  style={{ marginRight: 12 }}
                />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>On a specific date</div>
                  <div style={{ fontSize: 12, color: INK_GHOST, marginTop: 2 }}>
                    We&rsquo;ll assemble it the day before so you can review
                  </div>
                </div>
              </label>

              <label style={{
                ...radioRow,
                background: form.deadlineType === 'open' ? PINK_PALE : '#fff',
                borderColor: form.deadlineType === 'open' ? PINK : PAPER_DARK,
              }}>
                <input
                  type="radio"
                  checked={form.deadlineType === 'open'}
                  onChange={() => updateForm({ deadlineType: 'open' })}
                  style={{ marginRight: 12 }}
                />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>Send when I&rsquo;m ready</div>
                  <div style={{ fontSize: 12, color: INK_GHOST, marginTop: 2 }}>
                    You press send whenever it feels right
                  </div>
                </div>
              </label>
            </div>

            {form.deadlineType === 'date' && (
              <div style={{ marginTop: 16 }}>
                <label style={inputLabel}>The big day</label>
                <input
                  type="date"
                  value={form.deadlineDate}
                  onChange={e => updateForm({ deadlineDate: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                  style={textInput}
                />
              </div>
            )}

            <label style={{ ...inputLabel, marginTop: 24 }}>
              Where should we send it when it&rsquo;s ready?
            </label>
            <input
              type="email"
              value={form.recipientEmail}
              onChange={e => updateForm({ recipientEmail: e.target.value })}
              placeholder="their email"
              style={textInput}
            />
            <div style={{ fontSize: 11, color: INK_GHOST, marginTop: 6, fontStyle: 'italic' }}>
              Optional — you can add this later on the card&rsquo;s page
            </div>

            <div style={tipBox}>
              <div style={tipHead}>Worth knowing</div>
              <div style={{ fontSize: 13, color: INK_FADED, lineHeight: 1.65 }}>
                Set the date for 1 day before the real event. That gives you time
                to review, swap any clips that didn&rsquo;t come out right, and still
                land it on the day that matters.
              </div>
            </div>

            <div style={stepNav}>
              <button onClick={() => setStep(2)} style={secondaryBtn}>&larr; Back</button>
              <button
                onClick={submitCard}
                disabled={!canContinue() || loading}
                style={{ ...primaryBtn, opacity: canContinue() && !loading ? 1 : 0.4 }}
              >
                {loading ? 'Creating…' : 'Create the card →'}
              </button>
            </div>

            {error && (
              <div style={errorBox}>
                <strong>Something hiccuped:</strong> {error}
              </div>
            )}
          </section>
        )}

        {/* ─── STEP 4: Share the link ─── */}
        {createdCard && step === 4 && (
          <section>
            <div style={successLabel}>Your card&rsquo;s ready</div>
            <h1 style={{ ...stepTitle, textAlign: 'center' }}>
              now rally everyone<br />who loves {form.recipientName}.
            </h1>
            <p style={{ ...stepSub, textAlign: 'center' }}>
              One link. Anyone can open it. No account needed.
            </p>

            <div style={shareBox}>
              <div style={shareLabel}>The link to share</div>
              <div style={shareRow}>
                <div style={shareUrl}>{contributorUrl}</div>
                <button style={copyBtn} onClick={copyLink}>
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div style={shareHint}>
                Drop this in a group chat. Text it. Email it. Anyone who opens it can record.
              </div>
            </div>

            <div style={tipBox}>
              <div style={tipHead}>One thing worth noting</div>
              <div style={{ fontSize: 13, color: INK_FADED, lineHeight: 1.65 }}>
                10 to 20 is the sweet spot. More than 30 and they&rsquo;ll cry for
                a week (also, it gets long). Aim for the people who actually matter.
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 32 }}>
              <a href={`/cards/${createdCard.id}`} style={primaryBtn}>
                See your cards &rarr;
              </a>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

// ─── Styles ─────────────────────────────────────────────────────
const wrap = { minHeight: '100vh', background: PAPER, fontFamily: "'Courier Prime', 'Courier New', monospace", color: INK, paddingBottom: 80 }
const stripe = { height: 4, background: `repeating-linear-gradient(90deg, ${PINK} 0 12px, ${CYAN} 12px 24px)` }
const navBar = { maxWidth: 640, margin: '0 auto', padding: '24px 24px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }
const logo = { fontFamily: "'Permanent Marker', cursive", fontSize: 22, color: INK, textDecoration: 'none' }
const backLink = { fontSize: 11, color: INK_FADED, textDecoration: 'none', letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 700 }
const main = { maxWidth: 640, margin: '0 auto', padding: 24 }

const stepIndicator = { fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: PINK, fontWeight: 700, marginBottom: 16 }
const stepTitle = { fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 'clamp(28px, 5vw, 40px)', lineHeight: 1.1, letterSpacing: '-0.5px', textTransform: 'lowercase', marginBottom: 12, fontWeight: 400 }
const stepSub = { fontSize: 14, color: INK_FADED, lineHeight: 1.6, marginBottom: 32, maxWidth: 520 }
const stepNav = { display: 'flex', justifyContent: 'space-between', marginTop: 32, gap: 12, flexWrap: 'wrap' }

const inputLabel = { display: 'block', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: INK_FADED, fontWeight: 700, marginBottom: 8 }
const textInput = { width: '100%', padding: '14px 16px', fontSize: 15, border: `1px solid ${PAPER_DARK}`, background: '#fff', fontFamily: 'inherit', color: INK, outline: 'none', borderRadius: 2, boxSizing: 'border-box' }

const themeGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8, marginBottom: 8 }
const themeBtn = { padding: '14px 16px', border: `1px solid ${PAPER_DARK}`, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', color: INK, borderRadius: 2, transition: 'all 0.15s' }

const radioRow = { display: 'flex', alignItems: 'center', padding: '16px 18px', border: `1px solid ${PAPER_DARK}`, cursor: 'pointer', borderRadius: 2, transition: 'all 0.15s' }

const primaryBtn = { padding: '14px 26px', background: PINK, color: '#fff', border: 'none', fontFamily: 'inherit', fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 700, cursor: 'pointer', boxShadow: `3px 3px 0 ${INK}`, borderRadius: 2, textDecoration: 'none', display: 'inline-block' }
const secondaryBtn = { padding: '14px 20px', background: 'transparent', color: INK_FADED, border: `1px solid ${PAPER_DARK}`, fontFamily: 'inherit', fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 700, cursor: 'pointer', borderRadius: 2 }

const tipBox = { background: AMBER_PALE, border: `1px solid #C68B00`, padding: '16px 18px', marginTop: 24, borderRadius: 2 }
const tipHead = { fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: '#854F0B', fontWeight: 700, marginBottom: 8 }

const errorBox = { background: '#FBE3E3', border: `1px solid #B22222`, padding: '14px 16px', marginTop: 20, fontSize: 13, color: '#7A1F1F', borderRadius: 2 }

const successLabel = { fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: PINK, fontWeight: 700, marginBottom: 16, textAlign: 'center' }
const shareBox = { background: PINK_PALE, border: `1px solid ${PINK}`, padding: '22px 22px 18px', marginTop: 20, borderRadius: 2 }
const shareLabel = { fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: PINK, fontWeight: 700, marginBottom: 10 }
const shareRow = { display: 'flex', gap: 10, alignItems: 'stretch', flexWrap: 'wrap' }
const shareUrl = { flex: 1, minWidth: 200, background: '#fff', padding: '12px 14px', fontSize: 12, border: `1px solid ${PAPER_DARK}`, fontFamily: 'inherit', color: INK_FADED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderRadius: 2 }
const copyBtn = { padding: '12px 20px', background: PINK, color: '#fff', border: 'none', fontFamily: 'inherit', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 700, cursor: 'pointer', borderRadius: 2, minWidth: 90 }
const shareHint = { fontSize: 11, color: INK_FADED, marginTop: 12, fontStyle: 'italic', lineHeight: 1.5 }
