import React, { useEffect, useMemo, useState } from 'react'
import { Eye, FileText, Search, ExternalLink, AlertCircle, Clock3, X } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { getSignedUrl } from '../lib/documentService.js'
import { DOCUMENT_CATEGORIES } from '../lib/documentTypes.js'
import { isDocumentVisibleForCentre, isPolicyOpenForFeedback } from '../lib/policyReview.js'

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

export function PoliciesForReviewPage({ currentProfile }) {
  const [policies, setPolicies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [ownerProfiles, setOwnerProfiles] = useState({})
  const [feedbackStatusMap, setFeedbackStatusMap] = useState({})
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [feedbackForm, setFeedbackForm] = useState({
    section_reference: '',
    feedback: '',
    suggested_wording: '',
    works_in_practice: true,
    visibility: 'private_to_admins',
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

      const visiblePolicies = (data || []).filter(doc => {
        if (!doc.review_feedback_opens_at && !doc.review_feedback_closes_at && !doc.next_review_date) return false
        if (!isPolicyOpenForFeedback(doc)) return false
        return isDocumentVisibleForCentre(doc, currentProfile?.centre)
      })

      const ownerIds = [...new Set(visiblePolicies.map(doc => doc.policy_owner_id || doc.owner_id).filter(Boolean))]
      let profileMap = {}
      if (ownerIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .in('id', ownerIds)

        profileMap = Object.fromEntries((profilesData || []).map(profile => [profile.id, `${profile.first_name || ''} ${profile.last_name || ''}`.trim()]))
      }

      setOwnerProfiles(profileMap)

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

      const payload = {
        document_id: selectedDoc.id,
        user_id: currentProfile.id,
        section_reference: feedbackForm.section_reference || null,
        feedback: feedbackForm.feedback.trim(),
        suggested_wording: feedbackForm.suggested_wording.trim() || null,
        works_in_practice: feedbackForm.works_in_practice,
        visibility: feedbackForm.visibility,
        status: 'submitted',
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

  return (
    <div className="review-page">
      <div className="review-header">
        <div>
          <h1>Policies for Review</h1>
          <p>Review current published policies and provide feedback while the review window is open.</p>
        </div>
        <div className="review-count-pill">{policies.length} open</div>
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
          <strong>No policies currently open for feedback</strong>
          <small>New review windows will appear here when they open.</small>
        </div>
      ) : (
        <div className="review-list">
          {filteredPolicies.map(doc => {
            const categoryLabel = DOCUMENT_CATEGORIES.find(item => item.value === doc.category)?.label || doc.category
            const remainingDays = getDaysRemaining(doc.review_feedback_closes_at)
            const feedbackState = feedbackStatusMap[doc.id] || 'not_submitted'
            const ownerName = doc.policy_owner_id ? ownerProfiles[doc.policy_owner_id] || 'Assigned owner' : '—'
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
                      <span className="review-chip review-chip-accent">v{doc.version || '1.0'}</span>
                    </div>
                  </div>
                  <div className="review-meta-grid">
                    <div>
                      <span className="review-meta-label">Owner</span>
                      <strong>{ownerName}</strong>
                    </div>
                    <div>
                      <span className="review-meta-label">Last reviewed</span>
                      <strong>{formatDate(doc.last_reviewed_date)}</strong>
                    </div>
                    <div>
                      <span className="review-meta-label">Next review</span>
                      <strong>{formatDate(doc.next_review_date)}</strong>
                    </div>
                    <div>
                      <span className="review-meta-label">Feedback closes</span>
                      <strong>{formatDate(doc.review_feedback_closes_at)}</strong>
                    </div>
                  </div>
                </div>
                <div className="review-card-side">
                  <div className="review-side-row">
                    <Clock3 size={14} />
                    <span>{remainingDays === null ? 'Open' : remainingDays >= 0 ? `${remainingDays} day${remainingDays === 1 ? '' : 's'} left` : 'Closed'}</span>
                  </div>
                  <div className="review-side-row">
                    <span>Your feedback</span>
                    <strong>{feedbackState === 'not_submitted' ? 'Not submitted' : feedbackState}</strong>
                  </div>
                  <div className="review-actions">
                    <button className="btn-secondary" onClick={() => handleView(doc)}>
                      <Eye size={14} /> View Policy
                    </button>
                    <button className="btn-primary" onClick={() => openFeedbackModal(doc)}>
                      <ExternalLink size={14} /> Provide Feedback
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
                  required
                  placeholder="Share what works, what needs clarification, or any concerns."
                  style={{ fontFamily: 'inherit' }}
                />
              </label>

              <label>Suggested wording
                <textarea
                  value={feedbackForm.suggested_wording}
                  onChange={e => setFeedbackForm({ ...feedbackForm, suggested_wording: e.target.value })}
                  rows={4}
                  placeholder="Optional wording that could improve the policy."
                  style={{ fontFamily: 'inherit' }}
                />
              </label>

              <div className="form-row">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={feedbackForm.works_in_practice}
                    onChange={e => setFeedbackForm({ ...feedbackForm, works_in_practice: e.target.checked })}
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
    </div>
  )
}
