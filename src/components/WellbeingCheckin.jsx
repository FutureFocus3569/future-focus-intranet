import React, { useState, useEffect } from 'react'
import { Send } from 'lucide-react'
import { getTodayCheckIn, submitCheckIn } from '../lib/wellbeingService.js'
import { MoodFaces } from './MoodFaces.jsx'

/**
 * Wellbeing Check-in Component
 * Allows staff to submit daily mood (5 levels) + optional comment
 * One submission per day per person
 */
export default function WellbeingCheckin({ userId, centreName }) {
  const [todayCheckIn, setTodayCheckIn] = useState(null)
  const [selectedMood, setSelectedMood] = useState(null)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const moods = ['very_sad', 'sad', 'neutral', 'happy', 'very_happy']
  const moodLabels = {
    very_sad: 'Very Sad',
    sad: 'Sad',
    neutral: 'Neutral',
    happy: 'Happy',
    very_happy: 'Very Happy',
  }

  // Load today's check-in on mount
  useEffect(() => {
    loadCheckIn()
  }, [userId])

  async function loadCheckIn() {
    try {
      setLoading(true)
      const checkIn = await getTodayCheckIn(userId)
      if (checkIn) {
        setTodayCheckIn(checkIn)
        setSelectedMood(checkIn.mood)
        setComment(checkIn.comment || '')
      }
    } catch (err) {
      console.error('Error loading check-in:', err)
      setError('Failed to load your check-in')
    }
    setLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!selectedMood) {
      setError('Please select a mood')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const checkIn = await submitCheckIn(userId, centreName, selectedMood, comment || null)
      setTodayCheckIn(checkIn)
      setSelectedMood(null)
      setComment('')
    } catch (err) {
      console.error('Error submitting check-in:', err)
      if (err.message.includes('duplicate')) {
        setError('You have already checked in today. Check in again tomorrow!')
      } else {
        setError('Failed to submit check-in. Please try again.')
      }
    }
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div style={{ padding: '24px', background: '#f5f7f9', borderRadius: 12, textAlign: 'center', color: '#8fa3ad' }}>
        Loading your check-in...
      </div>
    )
  }

  if (todayCheckIn) {
    return (
      <div style={{ padding: '24px', background: '#f0fdf4', borderRadius: 12, border: '1px solid #bbf7d0' }}>
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>
            {React.createElement(MoodFaces[todayCheckIn.mood], { selected: true, onClick: () => {} })}
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#15803d', marginBottom: 4 }}>Check-in Submitted!</div>
          <div style={{ fontSize: 13, color: '#6b7e8a' }}>
            You checked in as {moodLabels[todayCheckIn.mood].toLowerCase()} today. Come back tomorrow!
          </div>
          {todayCheckIn.comment && (
            <div style={{ fontSize: 13, color: '#374151', marginTop: 12, fontStyle: 'italic', lineHeight: 1.5 }}>
              "{todayCheckIn.comment}"
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '8px 0 0 0' }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

        {/* Left: faces */}
        <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 0, marginBottom: 8 }}>
            {moods.map((mood) => {
              const moodInfo = {
                very_sad: { en: 'Struggling', mi: 'He ra uaua', img: '/mood-faces/mood-very-sad.png', color: '#E8796B' },
                sad: { en: 'Not great', mi: 'Kāore e pai', img: '/mood-faces/mood-sad.png', color: '#E8A76B' },
                neutral: { en: 'Okay', mi: 'Āe, kei te pai', img: '/mood-faces/mood-neutral.png', color: '#F4D25C' },
                happy: { en: 'Good', mi: 'Kei te pai!', img: '/mood-faces/mood-happy.png', color: '#A8D5BA' },
                very_happy: { en: 'Great', mi: 'Tino pai!', img: '/mood-faces/mood-very-happy.png', color: '#7ECDC9' },
              };
              const info = moodInfo[mood];
              const isSelected = selectedMood === mood;
              return (
                <div key={mood} style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <button
                    onClick={() => { setSelectedMood(mood); setError('') }}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      display: 'block',
                      transition: 'all 0.2s',
                      transform: isSelected ? 'scale(1.15)' : 'scale(1)',
                      filter: isSelected ? 'drop-shadow(0 0 6px rgba(13,43,54,0.5))' : 'none',
                    }}
                  >
                    <img src={info.img} alt={info.en} style={{ width: '100%', maxWidth: 165, height: 'auto', display: 'block', margin: '0 auto' }} />
                  </button>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#0d2b36' }}>{info.en}</div>
                  <div style={{ fontSize: 9, color: '#6b8e7b' }}>{info.mi}</div>
                  <div style={{ width: 20, height: 2, backgroundColor: info.color }}></div>
                </div>
              );
            })}
          </div>
          <div style={{ textAlign: 'center', fontSize: 11, color: '#6b8e7b', paddingTop: 8, borderTop: '1px solid #e0e0e0' }}>
            E manaaki ana mātou i a koe | We care about you
          </div>
        </div>

        {/* Right: comment + submit */}
        <form onSubmit={handleSubmit} style={{ flex: '0 0 160px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Tell us why you picked this mood..."
            rows={3}
            style={{
              width: '100%',
              padding: '8px 10px',
              border: '1px solid #d1d5db',
              borderRadius: 8,
              fontSize: 12,
              fontFamily: 'inherit',
              resize: 'vertical',
              boxSizing: 'border-box',
              lineHeight: 1.4,
            }}
          />
          {error && (
            <div style={{ fontSize: 11, color: '#dc2626', padding: '6px 10px', background: '#fee2e2', borderRadius: 6 }}>
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={!selectedMood || submitting}
            style={{
              width: '100%',
              padding: '8px 16px',
              background: selectedMood ? 'linear-gradient(135deg, #1a6eb5, #0e9a8a)' : '#d1d5db',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: selectedMood ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'background 0.2s',
            }}
          >
            <Send size={14} />
            {submitting ? 'Submitting...' : 'Submit Check-in'}
          </button>
        </form>

      </div>
    </div>
  )
}
