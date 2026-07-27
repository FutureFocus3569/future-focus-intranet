import React, { useState, useEffect } from 'react'
import { supabase, CENTRES } from '../lib/supabase.js'
import { Plus, Trash2, X, CalendarDays, Clock } from 'lucide-react'

const ALL = 'all'

function AddEventModal({ onClose, onSaved, callerProfile }) {
  const isAdmin = callerProfile?.permission === 'super_admin'
  const [form, setForm] = useState({
    title: '',
    date: '',
    start_time: '',
    end_time: '',
    centre: isAdmin ? '' : callerProfile?.centre ?? '',
    description: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function set(field, value) { setForm(f => ({ ...f, [field]: value })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true); setError('')
    const { data: { session } } = await supabase.auth.getSession()
    const { error } = await supabase.from('events').insert({
      ...form,
      centre: form.centre || null,
      created_by: session.user.id,
    })
    if (error) { setError(error.message); setLoading(false); return }
    onSaved(); onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add Event</h2>
          <button className="modal-close" onClick={onClose}><X size={20}/></button>
        </div>
        <form onSubmit={handleSubmit} className="staff-form">
          <label>Event Title <input value={form.title} onChange={e => set('title', e.target.value)} required placeholder="e.g. Leadership Hui" /></label>
          <div className="form-row">
            <label>Date <input type="date" value={form.date} onChange={e => set('date', e.target.value)} required /></label>
            <label>Centre
              <select value={form.centre} onChange={e => set('centre', e.target.value)} disabled={!isAdmin}>
                {isAdmin && <option value="">All Centres</option>}
                {CENTRES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>
          <div className="form-row">
            <label>Start Time <input type="time" value={form.start_time} onChange={e => set('start_time', e.target.value)} /></label>
            <label>End Time <input type="time" value={form.end_time} onChange={e => set('end_time', e.target.value)} /></label>
          </div>
          <label>Description (optional) <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3} placeholder="Additional details…" /></label>
          {error && <div className="form-error">{error}</div>}
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Saving…' : 'Add Event'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function formatTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':')
  const hour = parseInt(h)
  return `${hour % 12 || 12}:${m} ${hour < 12 ? 'AM' : 'PM'}`
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return {
    month: d.toLocaleString('en-NZ', { month: 'short' }).toUpperCase(),
    day: d.getDate(),
    full: d.toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
  }
}

export function EventsPage({ currentProfile }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState(ALL)
  const [showAdd, setShowAdd] = useState(false)
  const [deleting, setDeleting] = useState(null)

  const isAdmin = currentProfile?.permission === 'super_admin'
  const isCentreLeader = currentProfile?.permission === 'centre_leader'
  const canManage = isAdmin || isCentreLeader

  useEffect(() => { loadEvents() }, [])

  async function loadEvents() {
    setLoading(true)
    const { data } = await supabase.from('events').select('*').order('date').order('start_time')
    setEvents(data || [])
    setLoading(false)
  }

  async function handleDelete(event) {
    setDeleting(event.id)
    await supabase.from('events').delete().eq('id', event.id)
    setEvents(ev => ev.filter(e => e.id !== event.id))
    setDeleting(null)
  }

  function canDeleteEvent(event) {
    if (isAdmin) return true
    if (isCentreLeader && event.centre === currentProfile.centre) return true
    return false
  }

  const filtered = events.filter(e => {
    if (filter === ALL) return true
    return e.centre === filter || e.centre === null
  })

  // Group by month
  const grouped = filtered.reduce((acc, event) => {
    const month = new Date(event.date + 'T00:00:00').toLocaleString('en-NZ', { month: 'long', year: 'numeric' })
    if (!acc[month]) acc[month] = []
    acc[month].push(event)
    return acc
  }, {})

  return (
    <div className="events-page">
      <div className="staff-page-header">
        <div>
          <h1>Calendar &amp; Events</h1>
          <p>Upcoming events across Future Focus</p>
        </div>
        {canManage && (
          <button className="btn-primary" onClick={() => setShowAdd(true)}>
            <Plus size={16}/> Add Event
          </button>
        )}
      </div>

      <div className="events-filter-bar">
        <button className={`filter-tab ${filter === ALL ? 'active' : ''}`} onClick={() => setFilter(ALL)}>All Centres</button>
        {CENTRES.map(c => (
          <button key={c} className={`filter-tab ${filter === c ? 'active' : ''}`} onClick={() => setFilter(c)}>{c}</button>
        ))}
      </div>

      {loading ? (
        <div className="staff-loading">Loading events…</div>
      ) : filtered.length === 0 ? (
        <div className="staff-empty">No upcoming events{filter !== ALL ? ` for ${filter}` : ''}.</div>
      ) : (
        Object.entries(grouped).map(([month, monthEvents]) => (
          <div key={month} className="event-group">
            <div className="event-group-header">{month}</div>
            {monthEvents.map(event => {
              const { month: m, day, full } = formatDate(event.date)
              return (
                <div className="event-card" key={event.id}>
                  <div className="event-date-box">
                    <small>{m}</small>
                    <strong>{day}</strong>
                  </div>
                  <div className="event-info">
                    <strong>{event.title}</strong>
                    <div className="event-meta">
                      {(event.start_time || event.end_time) && (
                        <span><Clock size={12}/> {formatTime(event.start_time)}{event.end_time ? ` – ${formatTime(event.end_time)}` : ''}</span>
                      )}
                      <span className="event-centre-badge">{event.centre || 'All Centres'}</span>
                    </div>
                    {event.description && <p className="event-desc">{event.description}</p>}
                  </div>
                  {canDeleteEvent(event) && (
                    <button className="btn-icon-danger" onClick={() => handleDelete(event)} disabled={deleting === event.id} title="Delete event">
                      <Trash2 size={15}/>
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        ))
      )}

      {showAdd && <AddEventModal onClose={() => setShowAdd(false)} onSaved={loadEvents} callerProfile={currentProfile} />}
    </div>
  )
}
