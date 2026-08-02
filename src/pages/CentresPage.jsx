import React, { useEffect, useMemo, useState } from 'react'
import { Activity, BarChart3, Building2, Globe2, Users } from 'lucide-react'
import { supabase, CENTRES } from '../lib/supabase.js'

const MOOD_WEIGHTS = {
  very_sad: 1,
  sad: 2,
  neutral: 3,
  happy: 4,
  very_happy: 5,
}

function getStartDate(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

function summarizeCheckins(rows) {
  const total = rows.length
  const moodCounts = { very_sad: 0, sad: 0, neutral: 0, happy: 0, very_happy: 0 }
  const uniqueDays = new Set()
  let scoreSum = 0

  rows.forEach((row) => {
    const mood = row.mood
    if (moodCounts[mood] !== undefined) moodCounts[mood] += 1
    scoreSum += MOOD_WEIGHTS[mood] || 0
    if (row.created_at) uniqueDays.add(row.created_at.slice(0, 10))
  })

  const positive = moodCounts.happy + moodCounts.very_happy
  const positiveRate = total > 0 ? Math.round((positive / total) * 100) : 0
  const averageMood = total > 0 ? (scoreSum / total).toFixed(2) : '0.00'

  return {
    total,
    moodCounts,
    daysCaptured: uniqueDays.size,
    positiveRate,
    averageMood,
  }
}

function MetricCard({ title, value, hint, Icon }) {
  return (
    <article className="centre-metric-card">
      <div className="centre-metric-icon"><Icon size={16} /></div>
      <div className="centre-metric-meta">
        <h4>{title}</h4>
        <strong>{value}</strong>
        {hint && <small>{hint}</small>}
      </div>
    </article>
  )
}

function MoodBars({ summary }) {
  const moods = [
    { key: 'very_sad', label: 'Very sad', color: '#ef4444' },
    { key: 'sad', label: 'Sad', color: '#f97316' },
    { key: 'neutral', label: 'Neutral', color: '#eab308' },
    { key: 'happy', label: 'Happy', color: '#14b8a6' },
    { key: 'very_happy', label: 'Very happy', color: '#22c55e' },
  ]

  return (
    <div className="centre-mood-bars">
      {moods.map((m) => {
        const count = summary.moodCounts[m.key] || 0
        const width = summary.total > 0 ? `${Math.max(4, (count / summary.total) * 100)}%` : '4%'
        return (
          <div key={m.key} className="centre-mood-row">
            <span>{m.label}</span>
            <div className="centre-mood-track">
              <div className="centre-mood-fill" style={{ width, background: m.color }} />
            </div>
            <b>{count}</b>
          </div>
        )
      })}
    </div>
  )
}

export function CentresPage({ currentProfile }) {
  const isSuperAdmin = currentProfile?.permission === 'super_admin'
  const isCentreLeader = currentProfile?.permission === 'centre_leader'
  const canAccess = isSuperAdmin || isCentreLeader

  const defaultCentre = isSuperAdmin ? (CENTRES[0] || '') : (currentProfile?.centre || '')
  const [selectedCentre, setSelectedCentre] = useState(defaultCentre)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [staffCount, setStaffCount] = useState(0)
  const [updates30d, setUpdates30d] = useState(0)
  const [centreSummary, setCentreSummary] = useState(summarizeCheckins([]))
  const [orgSummary, setOrgSummary] = useState(summarizeCheckins([]))

  const activeCentre = isSuperAdmin ? selectedCentre : (currentProfile?.centre || '')

  useEffect(() => {
    if (!canAccess || !activeCentre) {
      setLoading(false)
      return
    }

    loadCentreData(activeCentre)
  }, [canAccess, activeCentre])

  async function loadCentreData(centreName) {
    setLoading(true)
    setError('')

    try {
      const ninetyDaysAgo = getStartDate(90)
      const thirtyDaysAgo = getStartDate(30)

      const [profilesRes, postsRes, checkinsRes] = await Promise.all([
        supabase.from('profiles').select('id, centre'),
        supabase.from('posts').select('id, centre, created_at').gte('created_at', thirtyDaysAgo),
        supabase.from('wellbeing_checkins').select('mood, centre_name, created_at').gte('created_at', ninetyDaysAgo),
      ])

      if (profilesRes.error) throw profilesRes.error
      if (postsRes.error) throw postsRes.error
      if (checkinsRes.error) throw checkinsRes.error

      const profiles = profilesRes.data || []
      const posts = postsRes.data || []
      const checkins = checkinsRes.data || []

      const staff = profiles.filter((p) => p.centre === centreName)
      const recentUpdates = posts.filter((p) => p.centre === centreName || p.centre === null)
      const centreCheckins = checkins.filter((c) => c.centre_name === centreName)

      setStaffCount(staff.length)
      setUpdates30d(recentUpdates.length)
      setCentreSummary(summarizeCheckins(centreCheckins))
      setOrgSummary(summarizeCheckins(checkins))
    } catch (err) {
      console.error('Failed to load centre page data:', err)
      setError('Could not load centre data right now.')
    }

    setLoading(false)
  }

  const selectedLabel = useMemo(() => activeCentre || 'Your Centre', [activeCentre])

  if (!canAccess) {
    return (
      <div className="centre-page">
        <div className="staff-page-header">
          <div>
            <h1>Centre Hub</h1>
            <p>This page is available to centre leaders and super admins.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="centre-page">
      <div className="staff-page-header">
        <div>
          <h1>Centre Hub</h1>
          <p>Centre-specific information with organisation context.</p>
        </div>
        {isSuperAdmin && (
          <div className="centre-switcher">
            <label htmlFor="centre-select">Viewing centre</label>
            <select
              id="centre-select"
              value={selectedCentre}
              onChange={(e) => setSelectedCentre(e.target.value)}
            >
              {CENTRES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="staff-loading">Loading centre view…</div>
      ) : (
        <>
          {error && <div className="form-error" style={{ marginBottom: 16 }}>{error}</div>}

          <section className="centre-metrics-grid">
            <MetricCard title="Centre" value={selectedLabel} hint="Current workspace" Icon={Building2} />
            <MetricCard title="Staff" value={staffCount} hint="Profiles in this centre" Icon={Users} />
            <MetricCard title="Updates (30 days)" value={updates30d} hint="Posts visible to this centre" Icon={BarChart3} />
            <MetricCard title="Wellbeing check-ins" value={centreSummary.total} hint="Last 90 days" Icon={Activity} />
          </section>

          <section className="centre-modules-grid">
            <article className="centre-module wellbeing-module">
              <div className="centre-module-header">
                <h3>Wellbeing Trend Snapshot</h3>
                <small>Last 90 days</small>
              </div>

              <div className="centre-wellbeing-grid">
                <div className="centre-wellbeing-panel">
                  <h4>{selectedLabel}</h4>
                  <div className="centre-wellbeing-stats">
                    <span>Positive mood rate: <b>{centreSummary.positiveRate}%</b></span>
                    <span>Average mood score: <b>{centreSummary.averageMood}</b></span>
                    <span>Days captured: <b>{centreSummary.daysCaptured}</b></span>
                  </div>
                  <MoodBars summary={centreSummary} />
                </div>

                <div className="centre-wellbeing-panel">
                  <h4><Globe2 size={14} /> Organisation</h4>
                  <div className="centre-wellbeing-stats">
                    <span>Positive mood rate: <b>{orgSummary.positiveRate}%</b></span>
                    <span>Average mood score: <b>{orgSummary.averageMood}</b></span>
                    <span>Days captured: <b>{orgSummary.daysCaptured}</b></span>
                  </div>
                  <MoodBars summary={orgSummary} />
                </div>
              </div>
            </article>

            <article className="centre-module">
              <div className="centre-module-header">
                <h3>Centre Priorities</h3>
                <small>Module scaffold</small>
              </div>
              <p>This module is ready for centre-specific priorities, updates, and actions.</p>
            </article>

            <article className="centre-module">
              <div className="centre-module-header">
                <h3>Organisation Updates</h3>
                <small>Module scaffold</small>
              </div>
              <p>This space can surface key organisation-wide items relevant to this centre.</p>
            </article>
          </section>
        </>
      )}
    </div>
  )
}
