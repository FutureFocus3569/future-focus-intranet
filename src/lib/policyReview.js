// Older uploaded policy PDFs often had a metadata footer ("Policy Category:
// ... Licensing Criteria: ... Date adapted: ... Next review date: ...")
// tacked onto the end with no separator from the last bullet, since it's a
// document footer, not a list item. This pulls it out (and the category /
// licensing criteria values out of it) so it doesn't get mistaken for a
// bullet when auto-splitting legacy text.
export function extractPolicyFooterMetadata(text) {
  const source = text || ''
  const match = source.match(/Policy Category:\s*/i)

  if (!match) {
    return { cleanedText: source.trim(), category: '', licensingCriteria: '' }
  }

  const footerStart = match.index
  const cleanedText = source.slice(0, footerStart).trim()
  const footer = source.slice(footerStart)

  const categoryMatch = footer.match(/Policy Category:\s*([^]*?)\s*(?:Licensing Criteria:|Date adapted:|Next review date:|$)/i)
  const licensingMatch = footer.match(/Licensing Criteria:\s*([^]*?)\s*(?:Date adapted:|Next review date:|$)/i)

  return {
    cleanedText,
    category: categoryMatch ? categoryMatch[1].trim() : '',
    licensingCriteria: licensingMatch ? licensingMatch[1].trim() : '',
  }
}

// Fallback, non-AI conversion from legacy flat text into structured blocks —
// splits on "•" markers left over from PDF extraction. Used when the AI
// structuring call (requestPolicyStructure) fails or hasn't been run yet.
// Bold lead-ins can't be reliably guessed from flat text, so lead starts
// empty. Any trailing metadata footer is stripped first so it doesn't end
// up glued onto the last bullet.
export function parseFlatTextToBlocks(text) {
  const { cleanedText } = extractPolicyFooterMetadata(text)
  const cleaned = cleanedText.replace(/[ \t]{2,}/g, ' ').trim()
  if (!cleaned) return []

  const parts = cleaned.split(/\s*•\s*/).map(part => part.trim()).filter(Boolean)
  if (parts.length === 0) return []

  return parts.map(part => ({ type: 'bullet', lead: '', text: part }))
}

// Calls the policy-structure-extract edge function, which uses AI to split
// legacy flat policy text into heading/paragraph/bullet blocks without
// changing any wording — adapting to each document's actual layout instead
// of assuming every policy is a flat bullet list. Falls back to the local
// bullet-splitter on any failure so the editor never blocks.
export async function requestPolicyStructure(supabase, { text, title }) {
  const { cleanedText } = extractPolicyFooterMetadata(text)
  if (!cleanedText.trim()) return []

  try {
    const { data, error } = await supabase.functions.invoke('policy-structure-extract', {
      body: { text: cleanedText, title },
    })
    if (error) throw error
    if (Array.isArray(data?.blocks) && data.blocks.length > 0) return data.blocks
  } catch {
    // fall through to local fallback
  }
  return parseFlatTextToBlocks(text)
}

// Flattens structured blocks back into plain text, used as the
// extracted_text fallback (e.g. for the FF AI assistant's policy search,
// which reads extracted_text directly). Blocks without a "type" (older
// saved policies) are treated as bullets for backwards compatibility.
export function blocksToPlainText(blocks) {
  if (!Array.isArray(blocks) || blocks.length === 0) return ''
  return blocks
    .map(block => {
      const type = block?.type || 'bullet'
      const lead = (block?.lead || '').trim()
      const text = (block?.text || '').trim()
      if (!lead && !text) return null
      if (type === 'heading') return text
      if (type === 'paragraph') return text
      return lead ? `${lead} – ${text}` : text
    })
    .filter(Boolean)
    .join('\n\n')
}

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

  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
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

export function isDocumentVisibleForCentre(documentData, centreName, permission = null) {
  if (!documentData) return false
  if (permission === 'super_admin' || permission === 'policy_admin') return true
  if (!documentData.is_centre_specific) return true
  if (!centreName) return false
  return documentData.centre_scope === centreName
}

export function getPolicyFeedbackWindow(documentData) {
  if (!documentData) {
    return {
      opensAt: null,
      closesAt: null,
      nextReviewDate: null,
    }
  }

  const nextReviewDate = formatDateOnly(documentData.next_review_date || null)
  const closesAt = formatDateOnly(documentData.review_feedback_closes_at || nextReviewDate || null)
  const opensAt = formatDateOnly(documentData.review_feedback_opens_at || calculateFeedbackOpenDate(nextReviewDate || closesAt))
  const dueAt = nextReviewDate || closesAt || null

  return {
    opensAt,
    closesAt,
    nextReviewDate,
    dueAt,
    alertStartsAt: opensAt || (dueAt ? calculateFeedbackOpenDate(dueAt) : null),
  }
}

export function getPolicyReviewAlertState(documentData) {
  if (!documentData) return 'none'
  if (documentData.document_type === 'appendix' || documentData.parent_document_id) return 'none'

  const today = formatDateOnly(new Date())
  const { opensAt, closesAt, nextReviewDate, dueAt, alertStartsAt } = getPolicyFeedbackWindow(documentData)

  const todayDate = parseDateOnly(today)
  const opensDate = parseDateOnly(opensAt)
  const closesDate = parseDateOnly(closesAt)
  const dueDate = parseDateOnly(dueAt)
  const alertStartsDate = parseDateOnly(alertStartsAt)

  if (!opensAt && !closesAt && !nextReviewDate && !dueAt) return 'none'

  // Primary overdue rule: once the review due date has passed, it is overdue.
  if (dueDate && todayDate && dueDate < todayDate) return 'overdue'

  // No alert before the 4-week review window starts.
  if (alertStartsDate && todayDate && todayDate < alertStartsDate) return 'none'

  // Inside the pre-review alert window but not overdue yet.
  if (dueDate && alertStartsDate && todayDate && todayDate >= alertStartsDate && todayDate <= dueDate) {
    // If explicit feedback dates exist and we're within them, mark as open.
    if (opensDate && closesDate && todayDate >= opensDate && todayDate <= closesDate) return 'open'
    return 'upcoming'
  }

  if (opensDate && closesDate && todayDate && todayDate >= opensDate && todayDate <= closesDate) return 'open'

  return 'none'
}

export function isPolicyOpenForFeedback(documentData) {
  return getPolicyReviewAlertState(documentData) === 'open'
}
