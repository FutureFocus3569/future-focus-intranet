/**
 * Wellbeing Check-in Service
 * Handles staff wellbeing mood tracking and admin analytics
 */

import { supabase } from './supabase.js'

/**
 * Get today's check-in for current user (if exists)
 */
export async function getTodayCheckIn(userId) {
  const today = new Date().toISOString().slice(0, 10)
  
  const { data, error } = await supabase
    .from('wellbeing_checkins')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', `${today}T00:00:00`)
    .lt('created_at', `${today}T23:59:59`)
    .single()

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
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

  const { data, error } = await supabase
    .from('wellbeing_checkins')
    .insert([
      {
        user_id: userId,
        centre_name: centreName,
        mood,
        comment: comment || null,
        created_at: new Date().toISOString(),
      },
    ])
    .select()

  if (error) throw error
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
    .select('id, user_id, mood, comment, created_at, profiles:user_id(first_name, last_name)')
    .eq('centre_name', centreName)
    .gte('created_at', startDateStr)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
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
    .select('id, user_id, centre_name, mood, comment, created_at, profiles:user_id(first_name, last_name)')
    .gte('created_at', startDateStr)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}
