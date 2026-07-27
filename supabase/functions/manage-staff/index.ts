import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Client to verify the caller's identity
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const { data: callerProfile } = await supabaseClient
      .from('profiles')
      .select('permission, centre')
      .eq('id', user.id)
      .single()

    const canManage = callerProfile?.permission === 'super_admin' || callerProfile?.permission === 'centre_leader'
    if (!canManage) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders })
    }

    // Admin client for privileged operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    if (req.method === 'POST') {
      const { first_name, last_name, email, mobile, centre, role_title, permission, date_of_birth, start_date } = await req.json()

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
        data: { first_name, last_name },
        redirectTo: 'https://future-focus-intranet-8qax.vercel.app',
      })

      if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), { status: 400, headers: corsHeaders })
      }

      // Insert their profile
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({ id: newUser.user.id, first_name, last_name, mobile, centre, role_title, permission, date_of_birth: date_of_birth || null, start_date: start_date || null })

      if (profileError) {
        await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
        return new Response(JSON.stringify({ error: profileError.message }), { status: 400, headers: corsHeaders })
      }

      return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders })
    }

    if (req.method === 'DELETE') {
      const { userId } = await req.json()

      // Look up the target profile
      const { data: targetProfile } = await supabaseAdmin
        .from('profiles')
        .select('permission, centre')
        .eq('id', userId)
        .single()

      // Centre leaders can only remove staff at their own centre
      if (callerProfile.permission === 'centre_leader') {
        if (targetProfile?.permission !== 'staff' || targetProfile?.centre !== callerProfile.centre) {
          return new Response(JSON.stringify({ error: 'You can only remove staff at your own centre' }), { status: 403, headers: corsHeaders })
        }
      }

      await supabaseAdmin.from('profiles').delete().eq('id', userId)
      await supabaseAdmin.auth.admin.deleteUser(userId)

      return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})
