import React, { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { ChevronLeft, PartyPopper, Trophy, Send } from 'lucide-react'

function getInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'FF'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase()
}

function normalizePhotoUrl(photoUrl) {
  const value = String(photoUrl || '').trim()
  if (!value || value === 'null' || value === 'undefined') return ''
  return value
}

function formatTimeAgo(createdAt) {
  const diffSec = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000)
  if (diffSec < 60) return 'Just now'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  return `${Math.floor(diffSec / 86400)}d ago`
}

function nextBirthday(dateOfBirth) {
  if (!dateOfBirth) return null
  const today = new Date()
  const dob = new Date(dateOfBirth)
  if (Number.isNaN(dob.getTime())) return null
  const next = new Date(today.getFullYear(), dob.getMonth(), dob.getDate())
  if (next < today) next.setFullYear(today.getFullYear() + 1)
  return next
}

function nextAnniversary(startDate) {
  if (!startDate) return null
  const today = new Date()
  const start = new Date(startDate)
  if (Number.isNaN(start.getTime())) return null
  const next = new Date(today.getFullYear(), start.getMonth(), start.getDate())
  if (next < today) next.setFullYear(today.getFullYear() + 1)
  return next
}

function buildBirthdayList(staff) {
  return (staff || [])
    .filter(p => p?.date_of_birth)
    .map(p => {
      const next = nextBirthday(p.date_of_birth)
      if (!next) return null
      const name = `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unknown Staff'
      const monthDay = `${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`
      return {
        id: p.id,
        name,
        centre: p.centre || 'No Centre',
        photoUrl: normalizePhotoUrl(p.photo_url),
        nextDate: next,
        displayDate: next.toLocaleDateString('en-NZ', { weekday: 'short', month: 'short', day: 'numeric' }),
        threadKey: `birthday:${p.id}:${monthDay}`,
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.nextDate - b.nextDate)
}

function buildAnniversaryList(staff) {
  const today = new Date()
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const oneMonthDays = 31

  return (staff || [])
    .filter(p => p?.start_date)
    .map(p => {
      const start = new Date(p.start_date)
      if (Number.isNaN(start.getTime())) return null

      const next = nextAnniversary(p.start_date)
      if (!next) return null

      const milestoneYears = next.getFullYear() - start.getFullYear()
      if (milestoneYears <= 0) return null

      const nextAnniversaryDay = new Date(next.getFullYear(), next.getMonth(), next.getDate())
      const daysUntil = Math.ceil((nextAnniversaryDay.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24))

      // Show anniversary celebrations only in the month leading into their next year mark.
      if (daysUntil < 0 || daysUntil > oneMonthDays) return null

      const name = `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unknown Staff'
      const monthDay = `${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`
      return {
        id: p.id,
        name,
        centre: p.centre || 'No Centre',
        photoUrl: normalizePhotoUrl(p.photo_url),
        years: milestoneYears,
        nextDate: nextAnniversaryDay,
        displayDate: `${milestoneYears} year${milestoneYears === 1 ? '' : 's'}`,
        subtitle: next ? next.toLocaleDateString('en-NZ', { weekday: 'short', month: 'short', day: 'numeric' }) : '',
        threadKey: `anniversary:${p.id}:${monthDay}`,
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.nextDate - b.nextDate)
}

export function CelebrationsPage({ currentProfile, type = 'birthdays', staff = [], onBack }) {
  const isBirthday = type === 'birthdays'
  const title = isBirthday ? 'Birthdays' : 'Anniversaries'
  const icon = isBirthday ? <PartyPopper size={16} /> : <Trophy size={16} />

  const people = useMemo(() => (isBirthday ? buildBirthdayList(staff) : buildAnniversaryList(staff)), [isBirthday, staff])

  const [openThread, setOpenThread] = useState('')
  const [commentsByThread, setCommentsByThread] = useState({})
  const [loadingThread, setLoadingThread] = useState('')
  const [sendingThread, setSendingThread] = useState('')
  const [draftByThread, setDraftByThread] = useState({})
  const [brokenPhotoKeys, setBrokenPhotoKeys] = useState(new Set())

  async function loadComments(threadKey) {
    setLoadingThread(threadKey)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) {
        setCommentsByThread(prev => ({ ...prev, [threadKey]: [] }))
        setLoadingThread('')
        return
      }

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/celebration-comments?thread=${encodeURIComponent(threadKey)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
      })

      if (!res.ok) {
        setCommentsByThread(prev => ({ ...prev, [threadKey]: [] }))
        setLoadingThread('')
        return
      }

      const payload = await res.json().catch(() => ({}))
      setCommentsByThread(prev => ({ ...prev, [threadKey]: Array.isArray(payload?.comments) ? payload.comments : [] }))
    } catch {
      setCommentsByThread(prev => ({ ...prev, [threadKey]: [] }))
    }
    setLoadingThread('')
  }

  async function toggleThread(threadKey) {
    if (openThread === threadKey) {
      setOpenThread('')
      return
    }

    setOpenThread(threadKey)
    if (!commentsByThread[threadKey]) {
      await loadComments(threadKey)
    }
  }

  async function sendComment(threadKey) {
    const message = (draftByThread[threadKey] || '').trim()
    if (!message) return

    setSendingThread(threadKey)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) {
        setSendingThread('')
        return
      }

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/celebration-comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ thread: threadKey, message }),
      })

      if (!res.ok) {
        setSendingThread('')
        return
      }

      const payload = await res.json().catch(() => ({}))
      const newComment = payload?.comment
      if (newComment) {
        setCommentsByThread(prev => ({
          ...prev,
          [threadKey]: [...(prev[threadKey] || []), newComment],
        }))
      }

      setDraftByThread(prev => ({ ...prev, [threadKey]: '' }))
    } catch {
      // no-op
    }
    setSendingThread('')
  }

  return (
    <div className="celebrations-page">
      <div className="celebrations-header">
        <button className="btn-secondary" onClick={onBack}><ChevronLeft size={15} /> Back</button>
        <div>
          <h1>{title}</h1>
          <p>{icon} All staff across Future Focus can view and celebrate together.</p>
        </div>
      </div>

      {people.length === 0 ? (
        <div className="staff-empty">No {isBirthday ? 'birthday' : 'anniversary'} records found yet.</div>
      ) : (
        <div className="celebration-cards">
          {people.map(person => {
            const comments = commentsByThread[person.threadKey] || []
            const isOpen = openThread === person.threadKey
            const showPhoto = Boolean(person.photoUrl) && !brokenPhotoKeys.has(person.threadKey)

            return (
              <article key={person.threadKey} className="celebration-card">
                <div className="celebration-person-head">
                  {showPhoto ? (
                    <img
                      src={person.photoUrl}
                      alt={person.name}
                      className="celebration-avatar"
                      onError={() => {
                        setBrokenPhotoKeys(prev => {
                          const next = new Set(prev)
                          next.add(person.threadKey)
                          return next
                        })
                      }}
                    />
                  ) : (
                    <div className="celebration-avatar celebration-avatar-fallback">{getInitials(person.name)}</div>
                  )}
                  <div className="celebration-person-meta">
                    <h3>{person.name}</h3>
                    <p>{person.centre}</p>
                    <small>{isBirthday ? person.displayDate : `${person.displayDate} • Next on ${person.subtitle}`}</small>
                  </div>
                  <button className="btn-secondary" onClick={() => toggleThread(person.threadKey)}>
                    {isOpen ? 'Hide comments' : 'Open comments'}
                  </button>
                </div>

                {isOpen && (
                  <div className="celebration-comments">
                    {loadingThread === person.threadKey ? (
                      <div className="staff-loading">Loading comments…</div>
                    ) : comments.length === 0 ? (
                      <p className="celebration-empty-note">Be the first to say {isBirthday ? 'happy birthday' : 'congratulations'}.</p>
                    ) : (
                      <div className="celebration-comment-list">
                        {comments.map(comment => (
                          <div key={comment.id} className="celebration-comment-item">
                            <div className="celebration-comment-top">
                              <strong>{comment.author_name || 'Team Member'}</strong>
                              <span>{formatTimeAgo(comment.created_at)}</span>
                            </div>
                            <p>{comment.message}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="celebration-comment-form">
                      <input
                        value={draftByThread[person.threadKey] || ''}
                        onChange={e => setDraftByThread(prev => ({ ...prev, [person.threadKey]: e.target.value }))}
                        placeholder={isBirthday ? `Say happy birthday to ${person.name}...` : `Congratulate ${person.name}...`}
                        maxLength={300}
                      />
                      <button
                        className="btn-primary"
                        onClick={() => sendComment(person.threadKey)}
                        disabled={sendingThread === person.threadKey}
                      >
                        <Send size={14} /> {sendingThread === person.threadKey ? 'Sending…' : 'Send'}
                      </button>
                    </div>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
