// components/VideoFrame.jsx
// Branded ticket-stub frame that wraps the 9:16 video player.
// Used on the creator preview and recipient watch pages.

'use client'

import { forwardRef } from 'react'

// ─── Palette (kept local so this file is self-contained) ─────────
const INK = '#1A1410'
const INK_GHOST = '#7A6E5C'
const PINK = '#D4266A'
const PAPER_AGED = '#EDE5D0'
const PAPER_DARK = '#D4C9A8'

const THEME_LABELS = {
  birthday: 'birthday',
  milestone: 'milestone',
  recovery: 'recovery',
  welcome_home: 'welcome home',
  honoring_service: 'honoring service',
  injured_athlete: 'injured athlete',
  hard_stretch: 'hard stretch',
  something_else: 'something else',
  // Aliases used by older cards:
  getwell: 'recovery',
  homecoming: 'welcome home',
  veteran: 'honoring service',
  athlete: 'injured athlete',
  grief: 'hard stretch',
  other: 'something else',
  support: 'hard stretch',
  graduation: 'milestone',
  justbecause: 'something else',
}

function formatLength(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds || 0))
  const mm = Math.floor(s / 60).toString().padStart(2, '0')
  const ss = (s % 60).toString().padStart(2, '0')
  return `${mm}:${ss}`
}

function formatShortDate(input) {
  const d = input ? new Date(input) : new Date()
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).toLowerCase()
}

const VideoFrame = forwardRef(function VideoFrame({
  videoUrl,
  recipientName,
  clipCount,
  durationSeconds,
  theme,
  variant = 'watch',
  deliveredAt = null,
  videoProps = {},
}, ref) {
  const firstName = (recipientName || '').split(' ')[0]
  const themeLabel = THEME_LABELS[theme] || theme || '—'
  const lengthStr = formatLength(durationSeconds)

  const topRightLabel = variant === 'preview'
    ? 'PREVIEW'
    : formatShortDate(deliveredAt)
  const topRightColor = variant === 'preview' ? PINK : INK_GHOST

  return (
    <div style={frameWrap}>
      <article style={frameCard}>

        <div style={frameHeader}>
          <div style={wordmark}>
            churpie<span style={{ color: PINK }}>.</span>
          </div>
          <div style={{ ...headerLabel, color: topRightColor }}>
            {topRightLabel}
          </div>
        </div>

        <div style={videoSlot}>
          {videoUrl ? (
            <video
              ref={ref}
              src={videoUrl}
              playsInline
              style={videoEl}
              {...videoProps}
            />
          ) : (
            <div style={videoFallback}>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, textAlign: 'center', padding: 20 }}>
                Video isn&rsquo;t ready yet. Try refreshing.
              </div>
            </div>
          )}
        </div>

        <div style={frameFooter}>
          <div style={forBlock}>
            <div style={metaLabel}>For</div>
            <div style={forName}>{firstName}</div>
          </div>
          <div style={metaRow}>
            <div style={metaCol}>
              <div style={metaLabel}>Clips</div>
              <div style={metaValue}>{clipCount ?? '—'}</div>
            </div>
            <div style={{ ...metaCol, textAlign: 'center' }}>
              <div style={metaLabel}>Length</div>
              <div style={metaValue}>{lengthStr}</div>
            </div>
            <div style={{ ...metaCol, textAlign: 'right' }}>
              <div style={metaLabel}>Theme</div>
              <div style={metaValue}>{themeLabel}</div>
            </div>
          </div>
        </div>

      </article>
    </div>
  )
})

export default VideoFrame

const frameWrap = {
  display: 'flex',
  justifyContent: 'center',
  padding: '4px 0',
}
const frameCard = {
  background: '#fff',
  border: `1px solid ${PAPER_DARK}`,
  boxShadow: `4px 4px 0 ${PAPER_AGED}, 8px 8px 0 ${PAPER_DARK}`,
  width: '100%',
  maxWidth: 320,
  overflow: 'hidden',
  fontFamily: "'Courier Prime', 'Courier New', monospace",
}
const frameHeader = {
  padding: '12px 16px 9px',
  borderBottom: `2px dashed ${PAPER_DARK}`,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
}
const wordmark = {
  fontFamily: "'Permanent Marker', cursive",
  fontSize: 16,
  color: INK,
  lineHeight: 1,
}
const headerLabel = {
  fontSize: 9,
  letterSpacing: 1.5,
  textTransform: 'uppercase',
  fontWeight: 700,
}
const videoSlot = {
  background: '#000',
  aspectRatio: '9 / 16',
  width: '100%',
  position: 'relative',
  overflow: 'hidden',
}
const videoEl = {
  width: '100%',
  height: '100%',
  display: 'block',
  objectFit: 'contain',
  background: '#000',
}
const videoFallback = {
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}
const frameFooter = {
  padding: '14px 18px 16px',
  borderTop: `2px dashed ${PAPER_DARK}`,
}
const forBlock = {
  textAlign: 'center',
  marginBottom: 12,
}
const forName = {
  fontFamily: "'DM Serif Display', Georgia, serif",
  fontSize: 26,
  color: INK,
  lineHeight: 1,
  fontWeight: 400,
}
const metaRow = {
  display: 'flex',
  justifyContent: 'space-between',
  paddingTop: 12,
  borderTop: `1px dashed ${PAPER_DARK}`,
  gap: 8,
}
const metaCol = { flex: 1 }
const metaLabel = {
  fontSize: 9,
  letterSpacing: 1.5,
  textTransform: 'uppercase',
  color: INK_GHOST,
  fontWeight: 700,
  marginBottom: 3,
}
const metaValue = {
  fontSize: 13,
  color: INK,
  fontWeight: 700,
}
