import React, { useEffect, useMemo, useState } from 'react'
import { Eye, FileText, Search, ExternalLink, AlertCircle, Clock3, X } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { getSignedUrl } from '../lib/documentService.js'
import { DOCUMENT_CATEGORIES } from '../lib/documentTypes.js'
import { getPolicyFeedbackWindow, getPolicyReviewAlertState, isDocumentVisibleForCentre } from '../lib/policyReview.js'
import { PolicyPrintView } from '../components/PolicyPrintView.jsx'

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })
}

function getDaysRemaining(closingDate) {
  if (!closingDate) return null
  const today = new Date()
  const close = new Date(closingDate)
  const diff = Math.ceil((close - today) / (1000 * 60 * 60 * 24))
  return diff
}

function getReviewStateMeta(state) {
  if (state === 'open') return { label: 'Open now', color: '#0e9a8a', bg: '#e6f5f2' }
  if (state === 'upcoming') return { label: 'Upcoming', color: '#1a6eb5', bg: '#e6eff9' }
  if (state === 'overdue') return { label: 'Overdue', color: '#dc2626', bg: '#fee2e2' }
  return { label: 'No alert', color: '#6b7e8a', bg: '#eef2f6' }
}

function getFeedbackStatusLabel(status) {
  if (status === 'reviewed') return 'Reviewed (no feedback)'
  if (status === 'submitted') return 'Submitted'
  if (!status || status === 'not_submitted') return 'Not submitted'
  return status
}

export function PoliciesForReviewPage({ currentProfile }) {
  const [policies, setPolicies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [feedbackStatusMap, setFeedbackStatusMap] = useState({})
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [printViewDoc, setPrintViewDoc] = useState(null)
  const [feedbackForm, setFeedbackForm] = useState({
    section_reference: '',
    feedback: '',
    suggested_wording: '',
    works_in_practice: true,
    visibility: 'private_to_admins',
    no_feedback_to_provide: false,
  })
  const [submittingFeedback, setSubmittingFeedback] = useState(false)

  useEffect(() => {
    if (!currentProfile?.id) return
    loadPolicies()
  }, [currentProfile?.id, currentProfile?.centre])

  async function loadPolicies() {
    setLoading(true)
    setError('')

    try {
      const { data, error: docsError } = await supabase
        .from('documents')
        .select('*')
        .eq('status', 'published')
        .eq('is_current_version', true)
        .order('review_feedback_closes_at', { ascending: true })

      if (docsError) throw docsError

      const visiblePolicies = (data || [])
        .filter(doc => isDocumentVisibleForCentre(doc, currentProfile?.centre, currentProfile?.permission))
        .map(doc => {
          const window = getPolicyFeedbackWindow(doc)
          const reviewAlertState = getPolicyReviewAlertState(doc)
          return {
            ...doc,
            review_alert_state: reviewAlertState,
            review_feedback_opens_effective: window.opensAt,
            review_feedback_closes_effective: window.closesAt,
            review_due_effective: window.dueAt,
          }
        })
        .filter(doc => doc.review_alert_state !== 'none')
        .sort((a, b) => {
          const priority = { overdue: 0, open: 1, upcoming: 2 }
          const stateDiff = (priority[a.review_alert_state] ?? 9) - (priority[b.review_alert_state] ?? 9)
          if (stateDiff !== 0) return stateDiff
          return String(a.review_feedback_closes_effective || '').localeCompare(String(b.review_feedback_closes_effective || ''))
        })

      try {
        const { data: feedbackRows } = await supabase
          .from('policy_review_feedback')
          .select('document_id, status')
          .eq('user_id', currentProfile.id)

        const feedbackMap = Object.fromEntries((feedbackRows || []).map(row => [row.document_id, row.status]))
        setFeedbackStatusMap(feedbackMap)
      } catch {
        setFeedbackStatusMap({})
      }

      setPolicies(visiblePolicies)
    } catch (err) {
      setError(err.message || 'Could not load policies for review.')
      setPolicies([])
    }

    setLoading(false)
  }

  async function handleView(doc) {
    if (Array.isArray(doc.content_blocks) && doc.content_blocks.length > 0) {
      setPrintViewDoc(doc)
      return
    }
    try {
      const { signedUrl } = await getSignedUrl(doc.storage_path)
      window.open(signedUrl, '_blank', 'noopener,noreferrer')
    } catch {
      setError('Could not open policy. Please try again.')
    }
  }

  function openFeedbackModal(doc) {
    setSelectedDoc(doc)
    setFeedbackForm({
      section_reference: '',
      feedback: '',
      suggested_wording: '',
      works_in_practice: true,
      visibility: 'private_to_admins',
      no_feedback_to_provide: false,
    })
    setError('')
  }

  function closeFeedbackModal() {
    setSelectedDoc(null)
    setSubmittingFeedback(false)
  }

  async function handleFeedbackSubmit(e) {
    e.preventDefault()
    if (!selectedDoc || !currentProfile?.id) return

    setSubmittingFeedback(true)
    setError('')

    try {
      const { data: existingRows, error: lookupError } = await supabase
        .from('policy_review_feedback')
        .select('id')
        .eq('document_id', selectedDoc.id)
        .eq('user_id', currentProfile.id)
        .order('submitted_at', { ascending: false })
        .limit(1)

      if (lookupError) throw lookupError

      const reviewedWithoutFeedback = Boolean(feedbackForm.no_feedback_to_provide)
      const trimmedFeedback = feedbackForm.feedback.trim()

      if (!reviewedWithoutFeedback && !trimmedFeedback) {
        throw new Error('Provide feedback or choose "Reviewed, no feedback to provide".')
      }

      const payload = {
        document_id: selectedDoc.id,
        user_id: currentProfile.id,
        section_reference: reviewedWithoutFeedback ? null : (feedbackForm.section_reference || null),
        feedback: reviewedWithoutFeedback ? 'Reviewed, no feedback to provide.' : trimmedFeedback,
        suggested_wording: reviewedWithoutFeedback ? null : (feedbackForm.suggested_wording.trim() || null),
        works_in_practice: reviewedWithoutFeedback ? null : feedbackForm.works_in_practice,
        visibility: feedbackForm.visibility,
        status: reviewedWithoutFeedback ? 'reviewed' : 'submitted',
      }

      if (existingRows?.length) {
        const { error: updateError } = await supabase
          .from('policy_review_feedback')
          .update(payload)
          .eq('id', existingRows[0].id)
        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase
          .from('policy_review_feedback')
          .insert(payload)
        if (insertError) throw insertError
      }

      await loadPolicies()
      closeFeedbackModal()
    } catch (err) {
      setError(err.message || 'Could not save feedback. Please try again.')
    }

    setSubmittingFeedback(false)
  }

  const filteredPolicies = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return policies.filter(doc => {
      const matchesSearch = !query || [doc.title, doc.description, doc.category].filter(Boolean).join(' ').toLowerCase().includes(query)
      const matchesCategory = categoryFilter === 'all' || doc.category === categoryFilter
      return matchesSearch && matchesCategory
    })
  }, [policies, searchQuery, categoryFilter])

  const reviewAlertSummary = useMemo(() => {
    const summary = { open: 0, upcoming: 0, overdue: 0 }
    policies.forEach((doc) => {
      if (summary[doc.review_alert_state] !== undefined) summary[doc.review_alert_state] += 1
    })
    return summary
  }, [policies])

  return (
    <div className="review-page">
      <div className="review-header">
        <div>
          <h1>Policies for Review</h1>
          <p>Review current published policies and provide feedback while the review window is open.</p>
        </div>
        <div className="review-count-pill">{policies.length} alerts</div>
      </div>

      <div className="review-toolbar" style={{ marginBottom: 10 }}>
        <span className="review-chip review-chip-accent">Open now: {reviewAlertSummary.open}</span>
        <span className="review-chip">Upcoming: {reviewAlertSummary.upcoming}</span>
        <span className="review-chip" style={{ background: '#fee2e2', color: '#dc2626' }}>Overdue: {reviewAlertSummary.overdue}</span>
      </div>

      <div className="review-toolbar">
        <label className="review-search">
          <Search size={15} />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search policies…"
          />
        </label>
        <select className="review-select" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
          <option value="all">All categories</option>
          {DOCUMENT_CATEGORIES.map(category => (
            <option key={category.value} value={category.value}>{category.label}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="form-error" style={{ marginBottom: 16 }}><AlertCircle size={14} style={{ marginRight: 6 }} />{error}</div>
      )}

      {loading ? (
        <div className="review-empty">Loading policies…</div>
      ) : filteredPolicies.length === 0 ? (
        <div className="review-empty">
          <FileText size={36} style={{ color: '#c8d8e0', marginBottom: 12 }} />
          <strong>No review alerts for your centre</strong>
          <small>Upcoming, open, and overdue review items will appear here.</small>
        </div>
      ) : (
        <div className="review-list">
          {filteredPolicies.map(doc => {
            const categoryLabel = DOCUMENT_CATEGORIES.find(item => item.value === doc.category)?.label || doc.category
            const remainingDays = getDaysRemaining(doc.review_due_effective)
            const feedbackState = feedbackStatusMap[doc.id] || 'not_submitted'
            const reviewStateMeta = getReviewStateMeta(doc.review_alert_state)
            const canSubmitFeedback = doc.review_alert_state === 'open' || doc.review_alert_state === 'overdue'
            return (
              <article key={doc.id} className="review-card">
                <div className="review-card-main">
                  <div className="review-card-top">
                    <div>
                      <h3>{doc.title}</h3>
                      <p>{doc.description || 'Published policy awaiting your review.'}</p>
                    </div>
                    <div className="review-card-badges">
                      <span className="review-chip">{categoryLabel}</span>
                      <span className="review-chip" style={{ background: reviewStateMeta.bg, color: reviewStateMeta.color }}>{reviewStateMeta.label}</span>
                    </div>
                  </div>
                  <div className="review-meta-grid">
                    <div>
                      <span className="review-meta-label">Last reviewed</span>
                      <strong>{formatDate(doc.last_reviewed_date)}</strong>
                    </div>
                    <div>
                      <span className="review-meta-label">Review due</span>
                      <strong>{formatDate(doc.review_due_effective)}</strong>
                    </div>
                  </div>
                </div>
                <div className="review-card-side">
                  <div className="review-side-row">
                    <Clock3 size={14} />
                    <span>{remainingDays === null ? reviewStateMeta.label : remainingDays >= 0 ? `${remainingDays} day${remainingDays === 1 ? '' : 's'} left` : `${Math.abs(remainingDays)} day${Math.abs(remainingDays) === 1 ? '' : 's'} overdue`}</span>
                  </div>
                  <div className="review-side-row">
                    <span>Your feedback</span>
                    <strong>{getFeedbackStatusLabel(feedbackState)}</strong>
                  </div>
                  <div className="review-actions">
                    <button className="btn-secondary" onClick={() => handleView(doc)}>
                      <Eye size={14} /> View Policy
                    </button>
                    <button className={canSubmitFeedback ? 'btn-primary' : 'btn-secondary'} onClick={() => canSubmitFeedback && openFeedbackModal(doc)} disabled={!canSubmitFeedback}>
                      <ExternalLink size={14} /> {canSubmitFeedback ? 'Provide Feedback' : 'Feedback not open yet'}
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {selectedDoc && (
        <div className="modal-overlay" onClick={closeFeedbackModal}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <h2>Feedback for {selectedDoc.title}</h2>
              <button className="modal-close" onClick={closeFeedbackModal}><X size={20} /></button>
            </div>
            <form onSubmit={handleFeedbackSubmit} className="staff-form">
              <label>Section or clause reference
                <input
                  value={feedbackForm.section_reference}
                  onChange={e => setFeedbackForm({ ...feedbackForm, section_reference: e.target.value })}
                  placeholder="e.g. 2.3 Staff responsibilities"
                />
              </label>

              <label>Your feedback
                <textarea
                  value={feedbackForm.feedback}
                  onChange={e => setFeedbackForm({ ...feedbackForm, feedback: e.target.value })}
                  rows={5}
                  required={!feedbackForm.no_feedback_to_provide}
                  disabled={feedbackForm.no_feedback_to_provide}
                  placeholder="Share what works, what needs clarification, or any concerns."
                  style={{ fontFamily: 'inherit' }}
                />
              </label>

              <label>Suggested wording
                <textarea
                  value={feedbackForm.suggested_wording}
                  onChange={e => setFeedbackForm({ ...feedbackForm, suggested_wording: e.target.value })}
                  rows={4}
                  disabled={feedbackForm.no_feedback_to_provide}
                  placeholder="Optional wording that could improve the policy."
                  style={{ fontFamily: 'inherit' }}
                />
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={feedbackForm.no_feedback_to_provide}
                  onChange={e => setFeedbackForm({ ...feedbackForm, no_feedback_to_provide: e.target.checked })}
                />
                Reviewed, no feedback to provide
              </label>

              <div className="form-row">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={feedbackForm.works_in_practice}
                    onChange={e => setFeedbackForm({ ...feedbackForm, works_in_practice: e.target.checked })}
                    disabled={feedbackForm.no_feedback_to_provide}
                  />
                  This works in practice
                </label>
                <label>
                  Visibility
                  <select
                    value={feedbackForm.visibility}
                    onChange={e => setFeedbackForm({ ...feedbackForm, visibility: e.target.value })}
                  >
                    <option value="private_to_admins">Private to admins</option>
                    <option value="staff_only">Staff only</option>
                    <option value="public">Public</option>
                  </select>
                </label>
              </div>

              {error && <div className="form-error">{error}</div>}
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={closeFeedbackModal}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={submittingFeedback}>
                  {submittingFeedback ? 'Saving…' : 'Save Feedback'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {printViewDoc && <PolicyPrintView doc={printViewDoc} onClose={() => setPrintViewDoc(null)} />}
    </div>
  )
}
