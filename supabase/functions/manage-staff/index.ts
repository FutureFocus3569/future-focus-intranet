import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
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

function isLikelyEmailDeliveryIssue(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes('error sending confirmation email') ||
    lower.includes('smtp') ||
    lower.includes('rate limit') ||
    lower.includes('not authorized') ||
    lower.includes('recipient') ||
    lower.includes('mailbox')
  )
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

      const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
      if (!normalizedEmail) {
        return new Response(JSON.stringify({ error: 'Email is required' }), { status: 400, headers: corsHeaders })
      }

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

      const invitePayload = {
        data: {
          first_name,
          last_name,
          centre,
          inviter_name: inviterName || null,
          invite_message: invite_message?.trim() || null,
        },
        redirectTo,
      }

      // Create the auth user AND send invite email in one step.
      // If redirect URL is not allowed in project auth settings, retry with project default URL.
      let inviteDelivery: 'email' | 'manual_link' = 'email'
      let inviteLink: string | null = null
      let inviteNotice: string | null = null
      let invitedUserId: string | null = null

      let { data: newUser, error: createError } = await supabaseAdmin.auth.admin.inviteUserByEmail(normalizedEmail, invitePayload)

      if (createError) {
        const inviteErrorText = toErrorMessage(createError).toLowerCase()
        const likelyRedirectError = inviteErrorText.includes('redirect') || inviteErrorText.includes('not allowed')
        if (likelyRedirectError) {
          const retry = await supabaseAdmin.auth.admin.inviteUserByEmail(normalizedEmail, {
            data: invitePayload.data,
          })
          newUser = retry.data
          createError = retry.error
        }
      }

      if (!createError) {
        invitedUserId = newUser?.user?.id ?? null
      } else {
        const rawMessage = toErrorMessage(createError, 'Could not send invite email')
        if (isLikelyEmailDeliveryIssue(rawMessage)) {
          const { data: generatedLink, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
            type: 'invite',
            email: normalizedEmail,
            options: invitePayload,
          })

          if (linkError) {
            const linkMessage = toErrorMessage(linkError, 'Could not generate invite link')
            return new Response(
              JSON.stringify({
                error: `Invite email could not be sent, and fallback link generation failed. Email delivery error: ${rawMessage}. Fallback error: ${linkMessage}`,
              }),
              { status: 400, headers: corsHeaders }
            )
          }

          invitedUserId = generatedLink?.user?.id ?? null
          inviteLink = generatedLink?.properties?.action_link ?? null
          inviteDelivery = 'manual_link'
          inviteNotice = 'Automatic invite email could not be delivered. Copy the invite link and send it from your own email account.'
        } else {
          return new Response(JSON.stringify({ error: rawMessage }), { status: 400, headers: corsHeaders })
        }
      }

      if (!invitedUserId) {
        return new Response(JSON.stringify({ error: 'Invite user was created without a valid user id.' }), { status: 400, headers: corsHeaders })
      }

      const baseProfile = { id: invitedUserId, first_name, last_name, mobile, centre, role_title, permission }
      const profileWithOptionalDates = { ...baseProfile, date_of_birth: dob, start_date: start }

      // Insert profile with optional date fields; if the project schema does not yet have
      // those columns, gracefully retry with base fields so invites still work.
      let { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert(profileWithOptionalDates, { onConflict: 'id' })

      if (profileError) {
        const message = toErrorMessage(profileError).toLowerCase()
        const missingDateColumns = message.includes('date_of_birth') || message.includes('start_date')
        if (missingDateColumns) {
          const retry = await supabaseAdmin.from('profiles').upsert(baseProfile, { onConflict: 'id' })
          profileError = retry.error
        }
      }

      if (profileError) {
        await supabaseAdmin.auth.admin.deleteUser(invitedUserId)
        return new Response(JSON.stringify({ error: toErrorMessage(profileError, 'Could not create staff profile') }), { status: 400, headers: corsHeaders })
      }

      return new Response(
        JSON.stringify({ success: true, invite_delivery: inviteDelivery, invite_link: inviteLink, message: inviteNotice }),
        { status: 200, headers: corsHeaders }
      )
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

    if (req.method === 'PATCH') {
      const { userId, centre, role_title, permission, mobile, date_of_birth, start_date } = await req.json()

      if (!userId) {
        return new Response(JSON.stringify({ error: 'User ID is required' }), { status: 400, headers: corsHeaders })
      }

      const dob = normalizeDateInput(date_of_birth)
      const start = normalizeDateInput(start_date)

      const { data: targetProfile, error: targetProfileError } = await supabaseAdmin
        .from('profiles')
        .select('id, permission, centre')
        .eq('id', userId)
        .single()

      if (targetProfileError || !targetProfile) {
        return new Response(JSON.stringify({ error: 'Staff member not found' }), { status: 404, headers: corsHeaders })
      }

      // Centre leaders can only update staff in their own centre and cannot elevate permissions.
      if (callerProfile.permission === 'centre_leader') {
        if (targetProfile.centre !== callerProfile.centre || targetProfile.permission !== 'staff') {
          return new Response(JSON.stringify({ error: 'You can only update staff at your own centre' }), { status: 403, headers: corsHeaders })
        }
        if (permission && permission !== 'staff') {
          return new Response(JSON.stringify({ error: 'Centre leaders cannot change permission levels' }), { status: 403, headers: corsHeaders })
        }
      }

      const updates: Record<string, unknown> = {}
      if (typeof role_title === 'string') updates.role_title = role_title
      if (typeof mobile === 'string') updates.mobile = mobile
      if (start_date !== undefined) updates.start_date = start

      if (callerProfile.permission === 'super_admin') {
        if (date_of_birth !== undefined) updates.date_of_birth = dob
        if (typeof permission === 'string') updates.permission = permission
        if (typeof centre === 'string') updates.centre = centre
      }

      if (Object.keys(updates).length === 0) {
        return new Response(JSON.stringify({ error: 'No valid fields to update' }), { status: 400, headers: corsHeaders })
      }

      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update(updates)
        .eq('id', userId)

      if (updateError) {
        return new Response(JSON.stringify({ error: toErrorMessage(updateError, 'Could not update staff profile') }), { status: 400, headers: corsHeaders })
      }

      return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders })
  } catch (err) {
    return new Response(JSON.stringify({ error: toErrorMessage(err) }), { status: 500, headers: corsHeaders })
  }
})
