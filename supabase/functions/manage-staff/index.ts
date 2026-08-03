import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function toErrorMessage(err: unknown, fallback = 'Unexpected server error') {
  if (!err) return fallback
  if (typeof err === 'string') return err
  if (err instanceof Error && err.message) return err.message
  if (typeof err === 'object') {
    const maybeMessage = (err as { message?: unknown }).message
    const maybeDescription = (err as { error_description?: unknown }).error_description
    const maybeDetails = (err as { details?: unknown }).details
    const maybeHint = (err as { hint?: unknown }).hint
    if (typeof maybeMessage === 'string' && maybeMessage.trim()) return maybeMessage
    if (typeof maybeDescription === 'string' && maybeDescription.trim()) return maybeDescription
    if (typeof maybeDetails === 'string' && maybeDetails.trim()) return maybeDetails
    if (typeof maybeHint === 'string' && maybeHint.trim()) return maybeHint
    try {
      const serialized = JSON.stringify(err)
      if (serialized && serialized !== '{}' && serialized !== '[]') return serialized
    } catch {}
  }
  return fallback
}

function normalizeDateInput(value: unknown): string | null {
  if (!value || typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null

  // Already ISO date format.
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed

  // Support dd/mm/yyyy from locale-formatted browser inputs.
  const dmy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (dmy) {
    const day = dmy[1].padStart(2, '0')
    const month = dmy[2].padStart(2, '0')
    const year = dmy[3]
    return `${year}-${month}-${day}`
  }

  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
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
      return new Response(
        JSON.stringify({ error: 'Edge function is missing required Supabase environment variables.' }),
        { status: 500, headers: corsHeaders }
      )
    }

    // Client to verify the caller's identity
    const supabaseClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const { data: callerProfile } = await supabaseClient
      .from('profiles')
      .select('permission, centre, first_name, last_name')
      .eq('id', user.id)
      .single()

    const canManage = callerProfile?.permission === 'super_admin' || callerProfile?.permission === 'centre_leader'
    if (!canManage) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders })
    }

    // Admin client for privileged operations
    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey
    )

    if (req.method === 'POST') {
      const { first_name, last_name, email, mobile, centre, role_title, permission, date_of_birth, start_date, invite_message } = await req.json()

      const dob = normalizeDateInput(date_of_birth)
      const start = normalizeDateInput(start_date)

      const redirectTo =
        Deno.env.get('INVITE_REDIRECT_URL') ||
        Deno.env.get('SITE_URL') ||
        'https://future-focus-intranet.vercel.app'

      const inviterName = [callerProfile?.first_name, callerProfile?.last_name].filter(Boolean).join(' ').trim()

      // Centre leaders can only add staff (not admins) at their own centre
      if (callerProfile.permission === 'centre_leader') {
        if (permission !== 'staff') {
          return new Response(JSON.stringify({ error: 'Centre leaders can only add Staff members' }), { status: 403, headers: corsHeaders })
        }
        if (centre !== callerProfile.centre) {
          return new Response(JSON.stringify({ error: 'You can only add staff to your own centre' }), { status: 403, headers: corsHeaders })
        }
      }

      // Create the auth user AND send invite email in one step
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: {
          first_name,
          last_name,
          centre,
          inviter_name: inviterName || null,
          invite_message: invite_message?.trim() || null,
        },
        redirectTo,
      })

      if (createError) {
        return new Response(JSON.stringify({ error: toErrorMessage(createError, 'Could not send invite email') }), { status: 400, headers: corsHeaders })
      }

      const baseProfile = { id: newUser.user.id, first_name, last_name, mobile, centre, role_title, permission }
      const profileWithOptionalDates = { ...baseProfile, date_of_birth: dob, start_date: start }

      // Insert profile with optional date fields; if the project schema does not yet have
      // those columns, gracefully retry with base fields so invites still work.
      let { error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert(profileWithOptionalDates)

      if (profileError) {
        const message = toErrorMessage(profileError).toLowerCase()
        const missingDateColumns = message.includes('date_of_birth') || message.includes('start_date')
        if (missingDateColumns) {
          const retry = await supabaseAdmin.from('profiles').insert(baseProfile)
          profileError = retry.error
        }
      }

      if (profileError) {
        await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
        return new Response(JSON.stringify({ error: toErrorMessage(profileError, 'Could not create staff profile') }), { status: 400, headers: corsHeaders })
      }

      return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders })
    }

    if (req.method === 'DELETE') {
      const { userId } = await req.json()

      if (!userId) {
        return new Response(JSON.stringify({ error: 'User ID is required' }), { status: 400, headers: corsHeaders })
      }

      if (userId === user.id) {
        return new Response(JSON.stringify({ error: 'You cannot remove your own account' }), { status: 400, headers: corsHeaders })
      }

      // Look up the target profile
      const { data: targetProfile, error: targetProfileError } = await supabaseAdmin
        .from('profiles')
        .select('permission, centre')
        .eq('id', userId)
        .single()

      if (targetProfileError || !targetProfile) {
        return new Response(JSON.stringify({ error: 'Staff member not found' }), { status: 404, headers: corsHeaders })
      }

      // Centre leaders can only remove staff at their own centre
      if (callerProfile.permission === 'centre_leader') {
        if (targetProfile?.permission !== 'staff' || targetProfile?.centre !== callerProfile.centre) {
          return new Response(JSON.stringify({ error: 'You can only remove staff at your own centre' }), { status: 403, headers: corsHeaders })
        }
      }

      const { error: profileDeleteError } = await supabaseAdmin.from('profiles').delete().eq('id', userId)
      if (profileDeleteError) {
        return new Response(JSON.stringify({ error: toErrorMessage(profileDeleteError, 'Could not remove staff profile') }), { status: 400, headers: corsHeaders })
      }

      const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)
      if (authDeleteError && !String(authDeleteError.message || '').toLowerCase().includes('not found')) {
        return new Response(JSON.stringify({ error: toErrorMessage(authDeleteError, 'Could not remove auth account') }), { status: 400, headers: corsHeaders })
      }

      return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders })
  } catch (err) {
    return new Response(JSON.stringify({ error: toErrorMessage(err) }), { status: 500, headers: corsHeaders })
  }
})
