import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

function toErrorMessage(err: unknown, fallback = 'Unexpected server error') {
  if (!err) return fallback
  if (typeof err === 'string') return err
  if (err instanceof Error && err.message) return err.message
  return fallback
}

async function getEncryptionKey(): Promise<CryptoKey> {
  const raw = Deno.env.get('CREDENTIALS_ENCRYPTION_KEY') ?? ''
  if (!raw) throw new Error('Server is missing CREDENTIALS_ENCRYPTION_KEY.')
  const keyBytes = Uint8Array.from(atob(raw), c => c.charCodeAt(0))
  return crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

function bytesToB64(bytes: Uint8Array) {
  let binary = ''
  bytes.forEach(b => { binary += String.fromCharCode(b) })
  return btoa(binary)
}

function b64ToBytes(b64: string) {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0))
}

async function encryptSecret(plaintext: string) {
  const key = await getEncryptionKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(plaintext)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
  return { password_encrypted: bytesToB64(new Uint8Array(ciphertext)), password_iv: bytesToB64(iv) }
}

async function decryptSecret(ciphertextB64: string, ivB64: string) {
  const key = await getEncryptionKey()
  const iv = b64ToBytes(ivB64)
  const ciphertext = b64ToBytes(ciphertextB64)
  const plainBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
  return new TextDecoder().decode(plainBuffer)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return json({ error: 'Edge function is missing required Supabase environment variables.' }, 500)
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) return json({ error: 'Unauthorized' }, 401)

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
    const url = new URL(req.url)

    if (req.method === 'GET') {
      const reveal = url.searchParams.get('reveal')

      if (reveal) {
        const { data, error } = await supabaseAdmin
          .from('quick_link_credentials')
          .select('username, password_encrypted, password_iv')
          .eq('user_id', user.id)
          .eq('link_key', reveal)
          .maybeSingle()

        if (error) return json({ error: toErrorMessage(error, 'Could not load saved login') }, 400)
        if (!data || !data.password_encrypted || !data.password_iv) {
          return json({ username: data?.username ?? null, password: null })
        }

        const password = await decryptSecret(data.password_encrypted, data.password_iv)
        return json({ username: data.username, password })
      }

      const { data, error } = await supabaseAdmin
        .from('quick_link_credentials')
        .select('link_key, username, password_encrypted, updated_at')
        .eq('user_id', user.id)

      if (error) return json({ error: toErrorMessage(error, 'Could not load saved logins') }, 400)

      const items = (data || []).map(row => ({
        link_key: row.link_key,
        username: row.username,
        has_password: Boolean(row.password_encrypted),
        updated_at: row.updated_at,
      }))
      return json({ items })
    }

    if (req.method === 'POST') {
      const body = await req.json()
      const linkKey = typeof body?.link_key === 'string' ? body.link_key.trim() : ''
      const username = typeof body?.username === 'string' ? body.username.trim() : ''
      const password = typeof body?.password === 'string' ? body.password : ''

      if (!linkKey) return json({ error: 'link_key is required' }, 400)

      let passwordFields: { password_encrypted?: string; password_iv?: string } = {}
      if (password) {
        const encrypted = await encryptSecret(password)
        passwordFields = encrypted
      }

      const { error } = await supabaseAdmin
        .from('quick_link_credentials')
        .upsert(
          { user_id: user.id, link_key: linkKey, username: username || null, ...passwordFields, updated_at: new Date().toISOString() },
          { onConflict: 'user_id,link_key' }
        )

      if (error) return json({ error: toErrorMessage(error, 'Could not save login') }, 400)
      return json({ success: true })
    }

    if (req.method === 'DELETE') {
      const body = await req.json()
      const linkKey = typeof body?.link_key === 'string' ? body.link_key.trim() : ''
      if (!linkKey) return json({ error: 'link_key is required' }, 400)

      const { error } = await supabaseAdmin
        .from('quick_link_credentials')
        .delete()
        .eq('user_id', user.id)
        .eq('link_key', linkKey)

      if (error) return json({ error: toErrorMessage(error, 'Could not remove saved login') }, 400)
      return json({ success: true })
    }

    return json({ error: 'Method not allowed' }, 405)
  } catch (err) {
    return json({ error: toErrorMessage(err) }, 500)
  }
})
