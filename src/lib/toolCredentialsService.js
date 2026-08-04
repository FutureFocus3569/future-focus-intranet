import { supabase } from './supabase.js'

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('Not signed in')
  return {
    Authorization: `Bearer ${token}`,
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
  }
}

function endpoint(path = '') {
  return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tool-credentials${path}`
}

export async function listSavedLogins() {
  const headers = await authHeaders()
  const res = await fetch(endpoint(), { headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Could not load saved logins')
  return data.items || []
}

export async function revealSavedLogin(linkKey) {
  const headers = await authHeaders()
  const res = await fetch(endpoint(`?reveal=${encodeURIComponent(linkKey)}`), { headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Could not load saved login')
  return data
}

export async function saveLogin(linkKey, username, password) {
  const headers = await authHeaders()
  const res = await fetch(endpoint(), {
    method: 'POST',
    headers,
    body: JSON.stringify({ link_key: linkKey, username, password }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Could not save login')
  return data
}

export async function deleteLogin(linkKey) {
  const headers = await authHeaders()
  const res = await fetch(endpoint(), {
    method: 'DELETE',
    headers,
    body: JSON.stringify({ link_key: linkKey }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Could not remove saved login')
  return data
}
