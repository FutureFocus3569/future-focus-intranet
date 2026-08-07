import React, { useEffect, useMemo, useState } from 'react'
import { Activity, BarChart3, Building2, ChevronLeft, ChevronRight, Globe2, Users } from 'lucide-react'
import { supabase, CENTRES } from '../lib/supabase.js'
import { showToast } from '../lib/toast.js'

const MOOD_WEIGHTS = {
  very_sad: 1,
  sad: 2,
  neutral: 3,
  happy: 4,
  very_happy: 5,
}

const MOOD_META = {
  very_sad: { label: 'Very sad', color: '#ef4444', img: '/mood-faces/mood-very-sad.png' },
  sad: { label: 'Sad', color: '#f97316', img: '/mood-faces/mood-sad.png' },
  neutral: { label: 'Neutral', color: '#eab308', img: '/mood-faces/mood-neutral.png' },
  happy: { label: 'Happy', color: '#14b8a6', img: '/mood-faces/mood-happy.png' },
  very_happy: { label: 'Very happy', color: '#22c55e', img: '/mood-faces/mood-very-happy.png' },
}

function isUrgentMood(mood) {
  return mood === 'sad' || mood === 'very_sad'
}

function getMoodMeta(mood) {
  return MOOD_META[mood] || { label: mood || 'Unknown', color: '#8fa3ad' }
}

function getInitials(firstName, lastName) {
  const initials = `${(firstName || '').trim()[0] || ''}${(lastName || '').trim()[0] || ''}`
  return initials ? initials.toUpperCase() : '?'
}

function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function getDayRange(day) {
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0)
  const end = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1, 0, 0, 0, 0)
  return { startIso: start.toISOString(), endIso: end.toISOString() }
}

function formatDayLabel(day) {
  const today = startOfDay(new Date())
  const yesterday = startOfDay(new Date(today))
  yesterday.setDate(yesterday.getDate() - 1)

  if (day.getTime() === today.getTime()) return 'Today'
  if (day.getTime() === yesterday.getTime()) return 'Yesterday'
  return day.toLocaleDateString('en-NZ', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: day.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  })
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

function buildWeeklyMoodAverages(rows, weeks = 12) {
  const weekMs = 7 * 24 * 60 * 60 * 1000
  const now = Date.now()
  const buckets = Array.from({ length: weeks }, (_, index) => {
    const offset = (weeks - 1 - index) * weekMs
    const d = new Date(now - offset)
    return {
      label: d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' }),
      sum: 0,
      count: 0,
    }
  })

  rows.forEach((row) => {
    if (!row.created_at) return
    const diff = now - new Date(row.created_at).getTime()
    if (diff < 0) return
    const weeksAgo = Math.floor(diff / weekMs)
    const bucketIndex = weeks - 1 - weeksAgo
    if (bucketIndex < 0 || bucketIndex >= weeks) return
    buckets[bucketIndex].sum += MOOD_WEIGHTS[row.mood] || 0
    buckets[bucketIndex].count += 1
  })

  return buckets.map((b) => ({
    label: b.label,
    avg: b.count > 0 ? b.sum / b.count : 0,
    count: b.count,
  }))
}

const APPRAISAL_STATUS_STYLES = {
  draft: { bg: '#eef2f5', text: '#5b6b78' },
  assigned: { bg: '#e6eff9', text: '#1a6eb5' },
  self_submitted: { bg: '#fef3c7', text: '#92400e' },
  manager_in_progress: { bg: '#fef3c7', text: '#92400e' },
  review_360_open: { bg: '#fef3c7', text: '#92400e' },
  review_360_closed: { bg: '#fde68a', text: '#78350f' },
  meeting_completed: { bg: '#dcfce7', text: '#166534' },
  signed_off: { bg: '#dcfce7', text: '#166534' },
  archived: { bg: '#f1f5f9', text: '#64748b' },
}

function getAppraisalStatusStyle(status) {
  return APPRAISAL_STATUS_STYLES[status] || { bg: '#eef2f5', text: '#5b6b78' }
}

function getCycleStatusLabel(status) {
  return String(status || '')
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
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

function TrendChart({ centreSeries, orgSeries, centreLabel }) {
  const points = centreSeries.map((point, index) => ({
    label: point.label,
    centreAvg: point.avg,
    centreCount: point.count,
    orgAvg: orgSeries[index]?.avg || 0,
    orgCount: orgSeries[index]?.count || 0,
  }))

  return (
    <>
      <div className="centre-trend-legend">
        <span><i className="centre-trend-swatch centre" />{centreLabel}</span>
        <span><i className="centre-trend-swatch org" />Organisation</span>
      </div>
      <div className="centre-trend-chart">
        {points.map((p, index) => {
          const centrePct = p.centreAvg > 0 ? Math.max(8, ((p.centreAvg - 1) / 4) * 100) : 0
          const orgPct = p.orgAvg > 0 ? Math.max(8, ((p.orgAvg - 1) / 4) * 100) : 0
          const showLabel = index % 3 === 0 || index === points.length - 1

          return (
            <div key={`${p.label}-${index}`} className="centre-trend-col">
              <div className="centre-trend-bars" title={`${centreLabel}: ${p.centreAvg ? p.centreAvg.toFixed(2) : 'No data'} | Organisation: ${p.orgAvg ? p.orgAvg.toFixed(2) : 'No data'}`}>
                <div className="centre-trend-bar centre" style={{ height: `${centrePct}%` }} />
                <div className="centre-trend-bar org" style={{ height: `${orgPct}%` }} />
              </div>
              <small>{showLabel ? p.label : ''}</small>
            </div>
          )
        })}
      </div>
    </>
  )
}

function FollowupControls({ checkin, followup, saving, supported, onSave }) {
  const [status, setStatus] = useState(followup?.status || 'open')
  const [notes, setNotes] = useState(followup?.notes || '')

  useEffect(() => {
    setStatus(followup?.status || 'open')
    setNotes(followup?.notes || '')
  }, [checkin.id, followup?.status, followup?.notes])

  if (!supported) {
    return <p className="checkin-followup-unsupported">Follow-up tracking table is not active yet.</p>
  }

  const isDirty = status !== (followup?.status || 'open') || notes !== (followup?.notes || '')

  return (
    <div className="checkin-followup">
      <div className="checkin-followup-top">
        <span className="checkin-followup-label">Follow-up</span>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          disabled={saving}
          className={`followup-status status-${status}`}
        >
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="closed">Closed</option>
        </select>
      </div>
      <textarea
        className="checkin-followup-textarea"
        placeholder="What did you do to check in with them?"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
      />
      <button
        type="button"
        className="btn-secondary checkin-followup-save"
        disabled={saving || !isDirty}
        onClick={() => onSave(checkin, status, notes)}
      >
        {saving ? 'Saving…' : 'Save follow-up'}
      </button>
    </div>
  )
}

export function CentresPage({ currentProfile, onOpenAppraisal }) {
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
  const [centreTrend, setCentreTrend] = useState([])
  const [orgTrend, setOrgTrend] = useState([])
  const [followupsByCheckinId, setFollowupsByCheckinId] = useState({})
  const [appraisalRows, setAppraisalRows] = useState([])
  const [followupsSupported, setFollowupsSupported] = useState(true)
  const [savingFollowupId, setSavingFollowupId] = useState(null)
  const [selectedDay, setSelectedDay] = useState(() => startOfDay(new Date()))
  const [dayCheckins, setDayCheckins] = useState([])
  const [dayCheckinsLoading, setDayCheckinsLoading] = useState(false)

  const activeCentre = isSuperAdmin ? selectedCentre : (currentProfile?.centre || '')
  const isViewingToday = selectedDay.getTime() === startOfDay(new Date()).getTime()

  useEffect(() => {
    if (!canAccess || !activeCentre) {
      setLoading(false)
      return
    }

    loadCentreData(activeCentre)
  }, [canAccess, activeCentre])

  useEffect(() => {
    if (!canAccess || !activeCentre) return
    loadDayCheckins(activeCentre, selectedDay)
  }, [canAccess, activeCentre, selectedDay])

  useEffect(() => {
    if (!canAccess || !activeCentre) return
    loadAppraisalSummary(activeCentre)
  }, [canAccess, activeCentre])

  async function loadCentreData(centreName) {
    setLoading(true)
    setError('')

    try {
      const ninetyDaysAgo = getStartDate(90)
      const thirtyDaysAgo = getStartDate(30)

      const [profilesRes, postsRes, checkinsRes] = await Promise.all([
        supabase.from('profiles').select('id, centre, first_name, last_name'),
        supabase.from('posts').select('id, centre, created_at').gte('created_at', thirtyDaysAgo),
        supabase
          .from('wellbeing_checkins')
          .select('id, user_id, mood, comment, centre_name, created_at')
          .gte('created_at', ninetyDaysAgo),
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

      const followupsRes = await supabase
        .from('wellbeing_followups')
        .select('checkin_id, status, notes, updated_at')
        .eq('centre_name', centreName)

      if (followupsRes.error) {
        const missingTable =
          followupsRes.error.message?.includes('wellbeing_followups') ||
          followupsRes.error.code === '42P01'

        if (missingTable) {
          setFollowupsSupported(false)
          setFollowupsByCheckinId({})
        } else {
          throw followupsRes.error
        }
      } else {
        const followupMap = Object.fromEntries((followupsRes.data || []).map((f) => [f.checkin_id, f]))
        setFollowupsSupported(true)
        setFollowupsByCheckinId(followupMap)
      }

      setStaffCount(staff.length)
      setUpdates30d(recentUpdates.length)
      setCentreSummary(summarizeCheckins(centreCheckins))
      setOrgSummary(summarizeCheckins(checkins))
      setCentreTrend(buildWeeklyMoodAverages(centreCheckins, 12))
      setOrgTrend(buildWeeklyMoodAverages(checkins, 12))
    } catch (err) {
      console.error('Failed to load centre page data:', err)
      setError('Could not load centre data right now.')
    }

    setLoading(false)
  }

  async function loadAppraisalSummary(centreName) {
    try {
      const { data: staffMembers, error: staffError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, centre')
        .eq('centre', centreName)

      if (staffError) {
        console.error('Failed to load centre staff for appraisals:', staffError)
        setAppraisalRows([])
        return
      }

      const staffIds = (staffMembers || []).map((person) => person.id).filter(Boolean)
      if (!staffIds.length) {
        setAppraisalRows([])
        return
      }

      const { data, error } = await supabase
        .from('appraisal_cycles')
        .select('id, staff_id, status, period_start, period_end, created_at, template:appraisal_templates(title), staff:profiles!appraisal_cycles_staff_id_fkey(first_name,last_name)')
        .in('staff_id', staffIds)

      if (error) {
        console.error('Failed to load centre appraisal summary:', error)
        setAppraisalRows([])
        return
      }

      setAppraisalRows((data || []).map((cycle) => ({
        ...cycle,
        template: Array.isArray(cycle.template) ? cycle.template[0] : cycle.template,
        staff: Array.isArray(cycle.staff) ? cycle.staff[0] : cycle.staff,
      })))
    } catch (err) {
      console.error('Centre appraisal summary error:', err)
      setAppraisalRows([])
    }
  }

  async function loadDayCheckins(centreName, day) {
    setDayCheckinsLoading(true)
    try {
      const { startIso, endIso } = getDayRange(day)
      const { data, error } = await supabase
        .from('wellbeing_checkins')
        .select('id, user_id, mood, comment, centre_name, created_at')
        .eq('centre_name', centreName)
        .gte('created_at', startIso)
        .lt('created_at', endIso)
        .order('created_at', { ascending: false })

      if (error) throw error

      const rows = data || []
      const userIds = [...new Set(rows.map((row) => row.user_id).filter(Boolean))]
      let profileMap = {}

      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .in('id', userIds)
        profileMap = Object.fromEntries((profilesData || []).map((profile) => [profile.id, profile]))
      }

      setDayCheckins(rows.map((row) => ({ ...row, profile: profileMap[row.user_id] || null })))
    } catch (err) {
      console.error('Failed to load daily check-ins:', err)
      setDayCheckins([])
    }
    setDayCheckinsLoading(false)
  }

  function goToPreviousDay() {
    setSelectedDay((day) => {
      const next = new Date(day)
      next.setDate(next.getDate() - 1)
      return next
    })
  }

  function goToNextDay() {
    setSelectedDay((day) => {
      if (day.getTime() === startOfDay(new Date()).getTime()) return day
      const next = new Date(day)
      next.setDate(next.getDate() + 1)
      return next
    })
  }

  function goToToday() {
    setSelectedDay(startOfDay(new Date()))
  }

  const selectedLabel = useMemo(() => activeCentre || 'Your Centre', [activeCentre])

  async function saveFollowup(checkin, status, notes) {
    if (!currentProfile?.id) return
    if (!followupsSupported) return

    setSavingFollowupId(checkin.id)
    const { error: upsertError } = await supabase
      .from('wellbeing_followups')
      .upsert(
        {
          checkin_id: checkin.id,
          centre_name: checkin.centre_name,
          user_id: checkin.user_id,
          status,
          notes,
          updated_by: currentProfile.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'checkin_id' }
      )

    if (upsertError) {
      console.error('Failed to save follow-up:', upsertError)
      setSavingFollowupId(null)
      return
    }

    setFollowupsByCheckinId((prev) => ({
      ...prev,
      [checkin.id]: {
        ...(prev[checkin.id] || {}),
        checkin_id: checkin.id,
        status,
        notes,
        updated_at: new Date().toISOString(),
      },
    }))
    setSavingFollowupId(null)
    showToast('Follow-up saved')
  }

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
            <article className="centre-module centre-appraisal-module">
              <div className="centre-module-header">
                <h3>Appraisal Status</h3>
                <small>Active and recent cycles</small>
              </div>
              {appraisalRows.length === 0 ? (
                <p>No appraisal cycles found for this centre yet.</p>
              ) : (
                <div className="appraisal-status-grid">
                  {appraisalRows.map((cycle) => {
                    const staffName = `${cycle.staff?.first_name || ''} ${cycle.staff?.last_name || ''}`.trim() || 'Unknown staff member'
                    const statusStyle = getAppraisalStatusStyle(cycle.status)
                    return (
                      <button
                        key={cycle.id}
                        type="button"
                        className="appraisal-status-item"
                        onClick={() => onOpenAppraisal?.(cycle.staff_id)}
                      >
                        <div className="appraisal-status-item-top">
                          <strong>{staffName}</strong>
                          <span className="appraisal-status-badge" style={{ background: statusStyle.bg, color: statusStyle.text }}>
                            {getCycleStatusLabel(cycle.status)}
                          </span>
                        </div>
                        <span>{cycle.template?.title || 'Appraisal template'}</span>
                        <span>{cycle.period_start} to {cycle.period_end}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </article>

            <article className="centre-module wellbeing-module">
              <div className="centre-module-header">
                <h3>Wellbeing Trend Snapshot</h3>
                <small>Last 90 days</small>
              </div>

              <TrendChart centreSeries={centreTrend} orgSeries={orgTrend} centreLabel={selectedLabel} />

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

          </section>

          <section className="centre-checkins-card">
            <div className="centre-checkins-header">
              <h3><Activity size={15} /> Daily Check-ins — {selectedLabel}</h3>
              <div className="centre-checkins-nav">
                <button type="button" onClick={goToPreviousDay} title="Previous day"><ChevronLeft size={16} /></button>
                <span className="centre-checkins-date-label">{formatDayLabel(selectedDay)}</span>
                <button type="button" onClick={goToNextDay} disabled={isViewingToday} title="Next day"><ChevronRight size={16} /></button>
                {!isViewingToday && (
                  <button type="button" className="centre-checkins-today-btn" onClick={goToToday}>Jump to today</button>
                )}
              </div>
            </div>

            {dayCheckinsLoading ? (
              <p>Loading check-ins…</p>
            ) : dayCheckins.length === 0 ? (
              <p>No check-ins submitted for {selectedLabel} — {formatDayLabel(selectedDay)}.</p>
            ) : (
              <div className="centre-checkin-list">
                {dayCheckins.map((checkin) => {
                  const mood = getMoodMeta(checkin.mood)
                  const fullName = `${checkin.profile?.first_name || ''} ${checkin.profile?.last_name || ''}`.trim() || 'Unknown staff member'
                  const urgent = isUrgentMood(checkin.mood)
                  return (
                    <article key={checkin.id} className={`centre-checkin-item${urgent ? ' urgent' : ''}`}>
                      <div className="centre-checkin-avatar">{getInitials(checkin.profile?.first_name, checkin.profile?.last_name)}</div>
                      <div className="centre-checkin-body">
                        <div className="centre-checkin-top">
                          <strong>{fullName}</strong>
                          <span className="centre-checkin-time">{new Date(checkin.created_at).toLocaleTimeString('en-NZ', { hour: 'numeric', minute: '2-digit' })}</span>
                        </div>
                        <span className="centre-checkin-mood">
                          <img className="centre-checkin-mood-face" src={mood.img} alt={mood.label} />
                          {mood.label}
                        </span>
                        <p className="centre-checkin-comment">{checkin.comment?.trim() ? checkin.comment : 'No comment provided.'}</p>
                        {urgent && (
                          <FollowupControls
                            checkin={checkin}
                            followup={followupsByCheckinId[checkin.id]}
                            saving={savingFollowupId === checkin.id}
                            supported={followupsSupported}
                            onSave={saveFollowup}
                          />
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
