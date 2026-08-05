import React, { useState, useEffect } from 'react'
import { supabase, CENTRES } from '../lib/supabase.js'
import { Plus, Trash2, X, CalendarDays, Clock, Edit2, ChevronLeft, ChevronRight } from 'lucide-react'

const ALL = 'all'

const CENTRE_COLORS = {
  'All Centres': { text: '#fff', bg: '#0e9a8a' },
  'Papamoa Beach': { text: '#fff', bg: '#1a6eb5' },
  'The Boulevard': { text: '#fff', bg: '#0e9a8a' },
  'Terrace Views': { text: '#fff', bg: '#0084b3' },
  'Livingstone': { text: '#fff', bg: '#12956d' },
  'West Dune': { text: '#fff', bg: '#3b82c4' },
  'Head Office': { text: '#fff', bg: '#2eb89f' },
}

function getCentreColor(centre) {
  return CENTRE_COLORS[centre] || { text: '#fff', bg: '#6b7e8a' }
}

function MonthlyCalendar({ events, month, onMonthChange, onDateClick }) {
  const [hoveredDate, setHoveredDate] = useState(null)
  const [hoveredEvents, setHoveredEvents] = useState([])

  const year = month.getFullYear()
  const monthNum = month.getMonth()
  const firstDay = new Date(year, monthNum, 1)
  const lastDay = new Date(year, monthNum + 1, 0)
  const startDate = new Date(firstDay)
  startDate.setDate(startDate.getDate() - firstDay.getDay())
  
  const days = []
  let current = new Date(startDate)
  while (days.length < 42) {
    days.push(new Date(current))
    current.setDate(current.getDate() + 1)
  }

  const eventsByDate = events.reduce((acc, event) => {
    if (!acc[event.date]) acc[event.date] = []
    acc[event.date].push(event)
    return acc
  }, {})

  function handleDayHover(dateStr) {
    setHoveredDate(dateStr)
    setHoveredEvents(eventsByDate[dateStr] || [])
  }

  function handleDayClick(dateStr) {
    const dayEvents = eventsByDate[dateStr]
    if (dayEvents && dayEvents.length > 0) {
      onDateClick(dayEvents, dateStr)
    }
  }

  function handlePrevMonth() {
    onMonthChange(new Date(year, monthNum - 1, 1))
  }

  function handleNextMonth() {
    onMonthChange(new Date(year, monthNum + 1, 1))
  }

  const monthName = month.toLocaleString('en-NZ', { month: 'long', year: 'numeric' })
  const today = formatDateLocal(new Date())

  return (
    <div className="monthly-calendar">
      <div className="calendar-header">
        <button onClick={handlePrevMonth} className="calendar-nav"><ChevronLeft size={18}/></button>
        <h3>{monthName}</h3>
        <button onClick={handleNextMonth} className="calendar-nav"><ChevronRight size={18}/></button>
      </div>

      <div className="calendar-weekdays">
        <div>Sun</div>
        <div>Mon</div>
        <div>Tue</div>
        <div>Wed</div>
        <div>Thu</div>
        <div>Fri</div>
        <div>Sat</div>
      </div>

      <div className="calendar-days">
        {days.map((day, i) => {
          const dateStr = formatDateLocal(day)
          const isCurrentMonth = day.getMonth() === monthNum
          const hasEvent = !!eventsByDate[dateStr]?.length
          const isToday = dateStr === today
          
          return (
            <div
              key={i}
              className={`calendar-day ${isCurrentMonth ? '' : 'other-month'} ${hasEvent ? 'has-event clickable' : ''} ${isToday ? 'today' : ''}`}
              onMouseEnter={() => hasEvent && handleDayHover(dateStr)}
              onMouseLeave={() => setHoveredDate(null)}
              onClick={() => handleDayClick(dateStr)}
            >
              <span>{day.getDate()}</span>
              {hasEvent && <div className="event-dot"></div>}
            </div>
          )
        })}
      </div>

      {hoveredDate && hoveredEvents.length > 0 && (
        <div className="calendar-tooltip">
          <div className="tooltip-date">{new Date(hoveredDate + 'T00:00:00').toLocaleDateString('en-NZ', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
          {hoveredEvents.map(event => (
            <div key={event.id} className="tooltip-event">{event.title}</div>
          ))}
          <div className="tooltip-hint">Click to view details</div>
        </div>
      )}
    </div>
  )
}

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

function EditEventModal({ event, onClose, onSaved, callerProfile }) {
  const isAdmin = callerProfile?.permission === 'super_admin'
  const [form, setForm] = useState({
    title: event.title,
    date: event.date,
    start_time: event.start_time || '',
    end_time: event.end_time || '',
    centre: event.centre || '',
    description: event.description || '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function set(field, value) { setForm(f => ({ ...f, [field]: value })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.from('events').update({
      title: form.title,
      date: form.date,
      start_time: form.start_time,
      end_time: form.end_time,
      centre: form.centre || null,
      description: form.description,
    }).eq('id', event.id)
    if (error) { setError(error.message); setLoading(false); return }
    onSaved(); onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit Event</h2>
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
            <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Saving…' : 'Save Changes'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function getEventAuthor(event) {
  const name = [event.profiles?.first_name, event.profiles?.last_name].filter(Boolean).join(' ')
  return name || null
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

// Format date as YYYY-MM-DD using local time (no timezone conversion)
function formatDateLocal(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function EventsPage({ currentProfile }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState(ALL)
  const [showAdd, setShowAdd] = useState(false)
  const [editingEvent, setEditingEvent] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [showPastEvents, setShowPastEvents] = useState(false)
  const [calendarMonth, setCalendarMonth] = useState(new Date())
  const [selectedDateEvents, setSelectedDateEvents] = useState(null)
  const [selectedDateStr, setSelectedDateStr] = useState(null)

  const isAdmin = currentProfile?.permission === 'super_admin'
  const isCentreLeader = currentProfile?.permission === 'centre_leader'
  const canManage = isAdmin || isCentreLeader

  useEffect(() => { loadEvents() }, [])

  async function loadEvents() {
    setLoading(true)
    const { data } = await supabase.from('events').select('*, profiles(first_name, last_name)').order('date').order('start_time')
    setEvents(data || [])
    setLoading(false)
  }

  async function handleDelete(event) {
    setDeleting(event.id)
    await supabase.from('events').delete().eq('id', event.id)
    setEvents(ev => ev.filter(e => e.id !== event.id))
    setDeleting(null)
  }

  function canEditEvent(event) {
    if (isAdmin) return true
    if (isCentreLeader && (event.centre === currentProfile.centre || !event.centre)) return true
    return false
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

  const today = formatDateLocal(new Date())
  const upcomingEvents = filtered.filter(e => e.date >= today)
  const pastEvents = filtered.filter(e => e.date < today)

  // Group by month
  const groupByMonth = (evts) => evts.reduce((acc, event) => {
    const month = new Date(event.date + 'T00:00:00').toLocaleString('en-NZ', { month: 'long', year: 'numeric' })
    if (!acc[month]) acc[month] = []
    acc[month].push(event)
    return acc
  }, {})

  const upcomingGrouped = groupByMonth(upcomingEvents)
  const pastGrouped = groupByMonth(pastEvents)

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
        <button
          className={`filter-tab ${filter === ALL ? 'active' : ''}`}
          onClick={() => setFilter(ALL)}
          style={filter === ALL ? { background: getCentreColor('All Centres').bg, borderColor: getCentreColor('All Centres').bg, color: getCentreColor('All Centres').text } : {}}
        >
          All Centres
        </button>
        {CENTRES.map(c => (
          <button
            key={c}
            className={`filter-tab ${filter === c ? 'active' : ''}`}
            onClick={() => setFilter(c)}
            style={filter === c ? { background: getCentreColor(c).bg, borderColor: getCentreColor(c).bg, color: getCentreColor(c).text } : {}}
          >
            {c}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="staff-loading">Loading events…</div>
      ) : (
        <div className="events-container">
          <div className="events-main">
            {upcomingEvents.length === 0 && pastEvents.length === 0 ? (
              <div className="staff-empty">No events{filter !== ALL ? ` for ${filter}` : ''}.</div>
            ) : (
              <>
                {upcomingEvents.length > 0 && (
                  <div className="events-section">
                    <div className="events-section-title">Upcoming Events</div>
                    {Object.entries(upcomingGrouped).map(([month, monthEvents]) => (
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
                                  <span
                                    className="event-centre-badge"
                                    style={{
                                      background: getCentreColor(event.centre || 'All Centres').bg,
                                      color: getCentreColor(event.centre || 'All Centres').text,
                                    }}
                                  >
                                    {event.centre || 'All Centres'}
                                  </span>
                                  {getEventAuthor(event) && (
                                    <span className="event-author">Posted by {getEventAuthor(event)}</span>
                                  )}
                                </div>
                                {event.description && <p className="event-desc">{event.description}</p>}
                              </div>
                              <div className="event-actions">
                                {canEditEvent(event) && (
                                  <button className="btn-icon-primary" onClick={() => setEditingEvent(event)} title="Edit event">
                                    <Edit2 size={15}/>
                                  </button>
                                )}
                                {canDeleteEvent(event) && (
                                  <button className="btn-icon-danger" onClick={() => handleDelete(event)} disabled={deleting === event.id} title="Delete event">
                                    <Trash2 size={15}/>
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                )}

                {pastEvents.length > 0 && (
                  <div className="events-section">
                    <button 
                      className="events-section-title past-events-toggle"
                      onClick={() => setShowPastEvents(!showPastEvents)}
                    >
                      Past Events {showPastEvents ? '▼' : '▶'}
                    </button>
                    {showPastEvents && (
                      Object.entries(pastGrouped).map(([month, monthEvents]) => (
                        <div key={month} className="event-group past-events">
                          <div className="event-group-header">{month}</div>
                          {monthEvents.map(event => {
                            const { month: m, day, full } = formatDate(event.date)
                            return (
                              <div className="event-card past" key={event.id}>
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
                                    <span
                                      className="event-centre-badge"
                                      style={{
                                        background: getCentreColor(event.centre || 'All Centres').bg,
                                        color: getCentreColor(event.centre || 'All Centres').text,
                                      }}
                                    >
                                      {event.centre || 'All Centres'}
                                    </span>
                                    {getEventAuthor(event) && (
                                      <span className="event-author">Posted by {getEventAuthor(event)}</span>
                                    )}
                                  </div>
                                  {event.description && <p className="event-desc">{event.description}</p>}
                                </div>
                                <div className="event-actions">
                                  {canEditEvent(event) && (
                                    <button className="btn-icon-primary" onClick={() => setEditingEvent(event)} title="Edit event">
                                      <Edit2 size={15}/>
                                    </button>
                                  )}
                                  {canDeleteEvent(event) && (
                                    <button className="btn-icon-danger" onClick={() => handleDelete(event)} disabled={deleting === event.id} title="Delete event">
                                      <Trash2 size={15}/>
                                    </button>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="events-sidebar">
            <MonthlyCalendar 
              events={events} 
              month={calendarMonth} 
              onMonthChange={setCalendarMonth}
              onDateClick={(dayEvents, dateStr) => {
                setSelectedDateEvents(dayEvents)
                setSelectedDateStr(dateStr)
              }}
            />
          </div>
        </div>
      )}

      {showAdd && <AddEventModal onClose={() => setShowAdd(false)} onSaved={loadEvents} callerProfile={currentProfile} />}
      {editingEvent && <EditEventModal event={editingEvent} onClose={() => setEditingEvent(null)} onSaved={loadEvents} callerProfile={currentProfile} />}
      {selectedDateEvents && (
        <div className="modal-overlay" onClick={() => setSelectedDateEvents(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Events on {selectedDateStr ? new Date(selectedDateStr + 'T00:00:00').toLocaleDateString('en-NZ', { weekday: 'long', month: 'long', day: 'numeric' }) : ''}</h2>
              <button className="modal-close" onClick={() => setSelectedDateEvents(null)}><X size={20}/></button>
            </div>
            <div className="staff-form">
              {selectedDateEvents.map(event => {
                const { month: m, day } = formatDate(event.date)
                return (
                  <div key={event.id} className="event-card" style={{marginBottom: '12px'}}>
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
                        <span
                          className="event-centre-badge"
                          style={{
                            background: getCentreColor(event.centre || 'All Centres').bg,
                            color: getCentreColor(event.centre || 'All Centres').text,
                          }}
                        >
                          {event.centre || 'All Centres'}
                        </span>
                        {getEventAuthor(event) && (
                          <span className="event-author">Posted by {getEventAuthor(event)}</span>
                        )}
                      </div>
                      {event.description && <p className="event-desc">{event.description}</p>}
                    </div>
                    <div className="event-actions">
                      {canEditEvent(event) && (
                        <button className="btn-icon-primary" onClick={() => {
                          setEditingEvent(event)
                          setSelectedDateEvents(null)
                        }} title="Edit event">
                          <Edit2 size={15}/>
                        </button>
                      )}
                      {canDeleteEvent(event) && (
                        <button className="btn-icon-danger" onClick={() => handleDelete(event)} disabled={deleting === event.id} title="Delete event">
                          <Trash2 size={15}/>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
