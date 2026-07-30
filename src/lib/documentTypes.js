/**
 * DOCUMENT TYPES & INTERFACES
 * Defines the structure of documents in the Knowledge Centre
 */

/**
 * Document Object Structure
 * @typedef {Object} Document
 * @property {string} id - Unique identifier (auto-generated UUID)
 * @property {string} title - Document name/title
 * @property {string} description - Short summary of document
 * @property {string} category - Category (e.g., 'Policies', 'Procedures', 'Guidelines')
 * @property {string} document_type - Type (e.g., 'policy', 'template', 'guide', 'form')
 * @property {string} owner_id - UUID of person who owns the document
 * @property {string} storage_path - File path in Supabase storage
 * @property {string} original_filename - Original uploaded filename
 * @property {string} mime_type - File type (e.g., 'application/pdf')
 * @property {number} file_size - File size in bytes
 * @property {string} version - Version number (e.g., '1.0', '2.3')
 * @property {string} status - 'draft', 'approved', 'published', 'archived'
 * @property {string} approved_date - Date approved (ISO format)
 * @property {string} uploaded_by - UUID of person who uploaded
 * @property {string} created_by - UUID of person who created
 * @property {string} effective_date - When document becomes effective
 * @property {string} next_review_date - When document should be reviewed
 * @property {number} review_frequency_months - How often to review (e.g., 12)
 * @property {string} created_at - Timestamp created
 * @property {string} updated_at - Timestamp updated
 * @property {string} archived_at - Timestamp archived (if applicable)
 */

// Document Status Constants
export const DOCUMENT_STATUS = {
  DRAFT: 'draft',
  APPROVED: 'approved',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
}

// Document Type Constants
export const DOCUMENT_TYPES = [
  { value: 'policy', label: 'Policy' },
  { value: 'appendix', label: 'Appendix / Additional Information' },
  { value: 'procedure', label: 'Procedure' },
  { value: 'template', label: 'Template' },
  { value: 'guide', label: 'Guide' },
  { value: 'form', label: 'Form' },
  { value: 'moe', label: 'MOE' },
  { value: 'other', label: 'Other' },
]

// Document Categories
export const DOCUMENT_CATEGORIES = [
  { value: 'policies', label: 'Policies' },
  { value: 'procedures', label: 'Procedures' },
  { value: 'health-safety', label: 'Health & Safety' },
  { value: 'curriculum', label: 'Curriculum' },
  { value: 'premises-facilities', label: 'Premises and Facilities' },
  { value: 'gma', label: 'GMA' },
  { value: 'moe', label: 'MOE' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'staff-resources', label: 'Staff Resources' },
  { value: 'operations', label: 'Operations' },
  { value: 'training', label: 'Training' },
  { value: 'other', label: 'Other' },
]

/**
 * Create Document Payload
 * Data sent when creating a new document
 */
export const createDocumentPayload = {
  title: '',
  description: '',
  category: '',
  document_type: 'policy',
  effective_date: null,
  last_reviewed_date: null,
  review_frequency_months: 12,
  review_feedback_opens_at: null,
  review_feedback_closes_at: null,
  review_status: 'not_due',
  policy_owner_id: null,
  is_centre_specific: false,
  centre_scope: '',
  notes: '',
}

/**
 * Helper: Check if document is editable
 * Drafts and published documents can be edited (not archived)
 */
export function isDocumentEditable(document) {
  return document?.status !== DOCUMENT_STATUS.ARCHIVED
}

/**
 * Helper: Check if document can be approved
 * Draft documents can be approved
 */
export function canApproveDocument(document) {
  return document?.status === DOCUMENT_STATUS.DRAFT
}

/**
 * Helper: Check if document can be published
 * Approved documents can be published
 */
export function canPublishDocument(document) {
  return document?.status === DOCUMENT_STATUS.APPROVED
}

/**
 * Helper: Check if document can be archived
 * Published documents can be archived
 */
export function canArchiveDocument(document) {
  return document?.status === DOCUMENT_STATUS.PUBLISHED
}

/**
 * Helper: Check if document can be restored
 * Archived documents can be restored to published
 */
export function canRestoreDocument(document) {
  return document?.status === DOCUMENT_STATUS.ARCHIVED
}

/**
 * Helper: Get status badge color
 */
export function getStatusColor(status) {
  const colors = {
    [DOCUMENT_STATUS.DRAFT]: '#8b5cf6',      // purple
    [DOCUMENT_STATUS.APPROVED]: '#1a6eb5',   // blue
    [DOCUMENT_STATUS.PUBLISHED]: '#0e9a8a',  // green
    [DOCUMENT_STATUS.ARCHIVED]: '#999999',   // grey
  }
  return colors[status] || '#999999'
}
