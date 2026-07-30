export const REVIEW_STATUS_VALUES = [
  'not_due',
  'upcoming',
  'open_for_feedback',
  'feedback_closed',
  'drafting',
  'pending_approval',
  'completed',
]

function emptyToNull(value) {
  if (value === '') return null
  return value ?? null
}

function parseDateOnly(value) {
  if (!value) return null

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number)
    return new Date(Date.UTC(year, month - 1, day))
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

function formatDateOnly(value) {
  if (!value) return null
  const date = parseDateOnly(value)
  if (!date) return null
  return date.toISOString().slice(0, 10)
}

export function calculateNextReviewDate(lastReviewedDate, reviewFrequencyMonths) {
  const startDate = parseDateOnly(lastReviewedDate)
  const months = Number(reviewFrequencyMonths)

  if (!startDate || !Number.isFinite(months) || months <= 0) return null

  const nextDate = new Date(startDate)
  nextDate.setUTCMonth(nextDate.getUTCMonth() + months)
  return formatDateOnly(nextDate)
}

export function calculateFeedbackOpenDate(nextReviewDate) {
  const reviewDate = parseDateOnly(nextReviewDate)
  if (!reviewDate) return null

  const feedbackOpenDate = new Date(reviewDate)
  feedbackOpenDate.setUTCDate(feedbackOpenDate.getUTCDate() - 28)
  return formatDateOnly(feedbackOpenDate)
}

export function inferReviewStatus(documentData = {}) {
  const isAppendix = documentData.document_type === 'appendix' || Boolean(documentData.parent_document_id)
  if (isAppendix) return 'not_due'

  const status = documentData.review_status
  if (status && REVIEW_STATUS_VALUES.includes(status)) return status

  const today = new Date().toISOString().slice(0, 10)
  const openDate = documentData.review_feedback_opens_at || null
  const closeDate = documentData.review_feedback_closes_at || null

  if (openDate && closeDate && today >= openDate && today <= closeDate) {
    return 'open_for_feedback'
  }

  if (openDate && today < openDate) {
    return 'upcoming'
  }

  if (closeDate && today > closeDate) {
    return 'feedback_closed'
  }

  return 'not_due'
}

export function normalizeReviewPayload(documentData = {}) {
  const isAppendix = documentData.document_type === 'appendix' || Boolean(documentData.parent_document_id)
  if (isAppendix) {
    return {
      ...documentData,
      effective_date: emptyToNull(documentData.effective_date),
      last_reviewed_date: null,
      next_review_date: null,
      review_feedback_opens_at: null,
      review_feedback_closes_at: null,
      review_status: 'not_due',
      review_frequency_months: null,
      policy_owner_id: documentData.policy_owner_id || null,
      is_centre_specific: Boolean(documentData.is_centre_specific),
      centre_scope: documentData.centre_scope || null,
      parent_document_id: documentData.parent_document_id || null,
    }
  }

  const lastReviewedDate = documentData.last_reviewed_date || documentData.effective_date || null
  const reviewFrequencyMonths = Number(documentData.review_frequency_months ?? 12)
  const nextReviewDate = calculateNextReviewDate(lastReviewedDate, reviewFrequencyMonths)
  const feedbackOpenDate = documentData.review_feedback_opens_at || calculateFeedbackOpenDate(nextReviewDate)
  const feedbackCloseDate = documentData.review_feedback_closes_at || nextReviewDate || null

  return {
    ...documentData,
    effective_date: emptyToNull(documentData.effective_date),
    last_reviewed_date: emptyToNull(lastReviewedDate),
    next_review_date: nextReviewDate,
    review_feedback_opens_at: emptyToNull(feedbackOpenDate),
    review_feedback_closes_at: emptyToNull(feedbackCloseDate),
    review_status: inferReviewStatus({
      ...documentData,
      review_feedback_opens_at: feedbackOpenDate,
      review_feedback_closes_at: feedbackCloseDate,
      next_review_date: nextReviewDate,
    }),
    review_frequency_months: reviewFrequencyMonths,
    policy_owner_id: documentData.policy_owner_id || null,
    is_centre_specific: Boolean(documentData.is_centre_specific),
    centre_scope: documentData.centre_scope || null,
  }
}

export function isDocumentVisibleForCentre(documentData, centreName) {
  if (!documentData) return false
  if (!documentData.is_centre_specific) return true
  if (!centreName) return false
  return documentData.centre_scope === centreName
}

export function isPolicyOpenForFeedback(documentData) {
  if (!documentData) return false
  if (documentData.document_type === 'appendix' || documentData.parent_document_id) return false
  const today = new Date().toISOString().slice(0, 10)
  const opens = documentData.review_feedback_opens_at
  const closes = documentData.review_feedback_closes_at
  if (!opens || !closes) return false
  return today >= opens && today <= closes
}
