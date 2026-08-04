/**
 * Wellbeing Check-in Service
 * Handles staff wellbeing mood tracking and admin analytics
 */

import { supabase } from './supabase.js'

const WELLBEING_TIME_ZONE = 'Pacific/Auckland'

function getTimeZoneParts(date, timeZone = WELLBEING_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  return Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)])
  )
}

function zonedTimeToUtc(parts, timeZone = WELLBEING_TIME_ZONE) {
  const targetUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour || 0, parts.minute || 0, parts.second || 0)
  const utcGuess = new Date(targetUtc)
  const guessParts = getTimeZoneParts(utcGuess, timeZone)
  const guessUtc = Date.UTC(
    guessParts.year,
    guessParts.month - 1,
    guessParts.day,
    guessParts.hour || 0,
    guessParts.minute || 0,
    guessParts.second || 0
  )

  return new Date(targetUtc + (targetUtc - guessUtc))
}

function getAucklandDayRange(now = new Date()) {
  const today = getTimeZoneParts(now, WELLBEING_TIME_ZONE)
  const startUtc = zonedTimeToUtc({
    year: today.year,
    month: today.month,
    day: today.day,
    hour: 0,
    minute: 0,
    second: 0,
  })
  const endUtc = zonedTimeToUtc({
    year: today.year,
    month: today.month,
    day: today.day + 1,
    hour: 0,
    minute: 0,
    second: 0,
  })

  return { startUtc, endUtc }
}

function toPostgresTimestamp(date) {
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`
}

async function resolveCentreName(userId, centreName) {
  const normalized = String(centreName || '').trim()
  if (normalized) return normalized

  if (userId) {
    const { data } = await supabase
      .from('profiles')
      .select('centre')
      .eq('id', userId)
      .single()

    const profileCentre = String(data?.centre || '').trim()
    if (profileCentre) return profileCentre
  }

  return 'Head Office'
}

/**
 * Get today's check-in for current user (if exists)
 */
export async function getTodayCheckIn(userId) {
  if (!userId) return null

  const { startUtc, endUtc } = getAucklandDayRange()
  
  const { data, error } = await supabase
    .from('wellbeing_checkins')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', toPostgresTimestamp(startUtc))
    .lt('created_at', toPostgresTimestamp(endUtc))
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data || null
}

/**
 * Submit a wellbeing check-in
 */
export async function submitCheckIn(userId, centreName, mood, comment = null) {
  if (!['very_sad', 'sad', 'neutral', 'happy', 'very_happy'].includes(mood)) {
    throw new Error('Invalid mood value')
  }

  const resolvedCentreName = await resolveCentreName(userId, centreName)

  const { data, error } = await supabase
    .from('wellbeing_checkins')
    .insert([
      {
        user_id: userId,
        centre_name: resolvedCentreName,
        mood,
        comment: comment || null,
        created_at: new Date().toISOString(),
      },
    ])
    .select()

  if (error) {
    if (error.code === '23505') throw new Error('duplicate_checkin')
    if (error.code === '42501') throw new Error('permission_denied')
    if (error.code === '23502' && error.message?.includes('centre_name')) throw new Error('missing_centre')
    throw error
  }
  return data?.[0] || null
}

/**
 * Get centre-wide wellbeing stats for dashboard
 * Returns: mood counts for today, this week, this month
 */
export async function getCentreWellbeingStats(centreName, days = 30) {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  const startDateStr = startDate.toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('wellbeing_checkins')
    .select('mood, created_at')
    .eq('centre_name', centreName)
    .gte('created_at', startDateStr)
    .order('created_at', { ascending: false })

  if (error) throw error

  // Aggregate by date and mood
  const statsByDate = {}
  const moodCounts = { happy: 0, neutral: 0, sad: 0 }

  data?.forEach(checkin => {
    const date = checkin.created_at.slice(0, 10)
    moodCounts[checkin.mood]++

    if (!statsByDate[date]) {
      statsByDate[date] = { happy: 0, neutral: 0, sad: 0 }
    }
    statsByDate[date][checkin.mood]++
  })

  return {
    totalCheckIns: data?.length || 0,
    moodCounts,
    statsByDate,
  }
}

/**
 * Get individual staff member's wellbeing history
 */
export async function getStaffWellbeingHistory(userId, days = 30) {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  const startDateStr = startDate.toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('wellbeing_checkins')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', startDateStr)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

/**
 * Get all centre staff wellbeing data for admin view
 */
export async function getCentreAllStaffWellbeing(centreName, days = 30) {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  const startDateStr = startDate.toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('wellbeing_checkins')
    .select('id, user_id, mood, comment, created_at')
    .eq('centre_name', centreName)
    .gte('created_at', startDateStr)
    .order('created_at', { ascending: false })

  if (error) throw error

  const rows = data || []
  const userIds = [...new Set(rows.map((row) => row.user_id).filter(Boolean))]
  if (!userIds.length) return rows

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, first_name, last_name')
    .in('id', userIds)

  if (profilesError) throw profilesError

  const profileById = Object.fromEntries((profiles || []).map((profile) => [profile.id, profile]))
  return rows.map((row) => ({ ...row, profile: profileById[row.user_id] || null }))
}

/**
 * Get all wellbeing data (super admin only)
 */
export async function getAllWellbeingData(days = 30) {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  const startDateStr = startDate.toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('wellbeing_checkins')
    .select('id, user_id, centre_name, mood, comment, created_at')
    .gte('created_at', startDateStr)
    .order('created_at', { ascending: false })

  if (error) throw error

  const rows = data || []
  const userIds = [...new Set(rows.map((row) => row.user_id).filter(Boolean))]
  if (!userIds.length) return rows

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, first_name, last_name')
    .in('id', userIds)

  if (profilesError) throw profilesError

  const profileById = Object.fromEntries((profiles || []).map((profile) => [profile.id, profile]))
  return rows.map((row) => ({ ...row, profile: profileById[row.user_id] || null }))
}
