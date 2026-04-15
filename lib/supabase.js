// lib/supabase.js
// Two clients: one for the browser (uses anon key),
// one for server API routes (uses service key, bypasses RLS)

import { createClient } from '@supabase/supabase-js'
import { createClientComponentClient, createServerComponentClient } from '@supabase/auth-helpers-nextjs'

// Browser client — use in React components
export function createBrowserClient() {
  return createClientComponentClient()
}

// Server client — use in API routes and Server Components
// cookies is imported lazily to avoid breaking client-side builds
export function createServerClient() {
  const { cookies } = require('next/headers')
  return createServerComponentClient({ cookies })
}

// Service client — use in API routes that need to bypass RLS
// (e.g. confirming a clip, triggering compile)
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// ─── DB helpers ───────────────────────────────────────────────────

export async function getCardBySlug(slug) {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('cards')
    .select('*')
    .eq('slug', slug)
    .single()
  if (error) return null
  return data
}

export async function getCardWithClips(cardId) {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('cards')
    .select('*, clips(*)')
    .eq('id', cardId)
    .single()
  if (error) return null
  return data
}

export async function getCreatorCards(userId) {
  const sb = createServiceClient()
  const { data } = await sb
    .from('cards')
    .select('*, clips(count)')
    .eq('creator_id', userId)
    .order('created_at', { ascending: false })
  return data || []
}

export async function createCard({ creatorId, recipientName, recipientEmail,
  recipientPhone, theme, message, music, deadline, slug }) {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('cards')
    .insert({
      creator_id: creatorId,
      slug,
      recipient_name: recipientName,
      recipient_email: recipientEmail || null,
      recipient_phone: recipientPhone || null,
      theme,
      contributor_message: message,
      music_choice: music || 'gentle-piano',
      deadline_at: deadline || null,
      status: 'live',
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCardStatus(cardId, status) {
  const sb = createServiceClient()
  await sb.from('cards').update({ status }).eq('id', cardId)
}

export async function getDelivery(cardId) {
  const sb = createServiceClient()
  const { data } = await sb
    .from('deliveries')
    .select('*')
    .eq('card_id', cardId)
    .single()
  return data
}
