import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type CelebrationComment = {
  id: string
  thread: string
  message: string
  user_id: string
  author_name: string
  created_at: string
}

function sanitizeThread(input: string | null): string {
  const value = String(input || '').trim()
  return value.replace(/[^a-zA-Z0-9:_-]/g, '').slice(0, 120)
}

async function readComments(adminClient: ReturnType<typeof createClient>, filePath: string): Promise<CelebrationComment[]> {
  const { data, error } = await adminClient.storage.from('post-media').download(filePath)
  if (error || !data) return []

  const text = await data.text().catch(() => '[]')
  const parsed = JSON.parse(text || '[]')
  return Array.isArray(parsed) ? parsed : []
}

async function writeComments(adminClient: ReturnType<typeof createClient>, filePath: string, comments: CelebrationComment[]) {
  const payload = JSON.stringify(comments)
  const { error } = await adminClient.storage.from('post-media').upload(filePath, payload, {
    upsert: true,
    contentType: 'application/json',
  })
  return error
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'Missing Supabase environment variables' }), { status: 500, headers: corsHeaders })
    }

    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: userError } = await callerClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    if (req.method === 'GET') {
      const url = new URL(req.url)
      const thread = sanitizeThread(url.searchParams.get('thread'))
      if (!thread) {
        return new Response(JSON.stringify({ error: 'Thread is required' }), { status: 400, headers: corsHeaders })
      }

      const filePath = `celebrations/comments/${thread}.json`
      const comments = await readComments(adminClient, filePath)
      return new Response(JSON.stringify({ comments }), { status: 200, headers: corsHeaders })
    }

    if (req.method === 'POST') {
      const body = await req.json()
      const thread = sanitizeThread(body?.thread)
      const message = String(body?.message || '').trim()

      if (!thread) {
        return new Response(JSON.stringify({ error: 'Thread is required' }), { status: 400, headers: corsHeaders })
      }

      if (!message) {
        return new Response(JSON.stringify({ error: 'Comment message is required' }), { status: 400, headers: corsHeaders })
      }

      if (message.length > 300) {
        return new Response(JSON.stringify({ error: 'Comment message is too long' }), { status: 400, headers: corsHeaders })
      }

      const { data: profile } = await adminClient
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', user.id)
        .single()

      const authorName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'Team Member'
      const filePath = `celebrations/comments/${thread}.json`
      const existing = await readComments(adminClient, filePath)

      const newComment: CelebrationComment = {
        id: crypto.randomUUID(),
        thread,
        message,
        user_id: user.id,
        author_name: authorName,
        created_at: new Date().toISOString(),
      }

      const updated = [...existing, newComment].slice(-250)
      const writeError = await writeComments(adminClient, filePath, updated)
      if (writeError) {
        return new Response(JSON.stringify({ error: writeError.message || 'Could not save comment' }), { status: 400, headers: corsHeaders })
      }

      return new Response(JSON.stringify({ comment: newComment }), { status: 200, headers: corsHeaders })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected server error'
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: corsHeaders })
  }
})
