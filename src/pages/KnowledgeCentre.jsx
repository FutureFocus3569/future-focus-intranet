import React, { useState, useEffect, useRef } from 'react'
import { Plus, X, FileText, Search, ChevronDown, ChevronUp, Eye, Edit2, Check, BookOpen, Archive, Trash2, UploadCloud, AlertCircle, CheckCircle, RotateCcw, Zap, Printer } from 'lucide-react'
import { supabase, CENTRES } from '../lib/supabase.js'
import { analyzePolicyFeedback } from '../lib/policyAnalyzer.js'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

let pdfJsLibPromise = null

async function getPdfJsLib() {
  if (!pdfJsLibPromise) {
    pdfJsLibPromise = import('pdfjs-dist').then((mod) => {
      const lib = mod?.GlobalWorkerOptions ? mod : mod?.default
      if (!lib?.GlobalWorkerOptions) {
        throw new Error('Failed to load pdfjs worker configuration')
      }

      // Prefer a bundled worker to avoid extraction failures when CDN access is blocked.
      lib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl || `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${lib.version}/pdf.worker.min.mjs`
      return lib
    })
  }
  return pdfJsLibPromise
}
import {
  DOCUMENT_STATUS,
  DOCUMENT_TYPES,
  DOCUMENT_CATEGORIES,
  getStatusColor,
  isDocumentEditable,
  canApproveDocument,
  canPublishDocument,
  canArchiveDocument,
  canRestoreDocument,
} from '../lib/documentTypes.js'
import { getPolicyReviewAlertState } from '../lib/policyReview.js'
import {
  createDocument,
  createReviewedPolicyVersion,
  getDocument,
  updateDocument,
  getAllDocuments,
  approveDocument,
  publishDocument,
  archiveDocument,
  restoreDocument,
  deleteDocument,
  uploadDocumentFile,
  getSignedUrl,
} from '../lib/documentService.js'
import { calculateNextReviewDate, calculateFeedbackOpenDate, parseFlatTextToBlocks } from '../lib/policyReview.js'
import { PolicyPrintView } from '../components/PolicyPrintView.jsx'

// ──────────────────────────────────────────────────────────
// ADD / EDIT DOCUMENT MODAL
// ──────────────────────────────────────────────────────────
function DocumentModal({ onClose, onSaved, editDocument = null, currentUserId, parentDocument = null }) {
  const isEdit = !!editDocument
  const forceAppendix = Boolean(parentDocument)
  const [form, setForm] = useState({
    title: editDocument?.title ?? '',
    description: editDocument?.description ?? '',
    category: editDocument?.category ?? parentDocument?.category ?? 'policies',
    document_type: editDocument?.document_type ?? (forceAppendix ? 'appendix' : 'policy'),
    licensing_criteria: editDocument?.licensing_criteria ?? '',
    effective_date: editDocument?.effective_date ?? '',
    last_reviewed_date: editDocument?.last_reviewed_date ?? editDocument?.effective_date ?? '',
    review_frequency_months: editDocument?.review_frequency_months ?? 12,
    review_feedback_opens_at: editDocument?.review_feedback_opens_at ?? '',
    review_feedback_closes_at: editDocument?.review_feedback_closes_at ?? '',
    review_status: editDocument?.review_status ?? 'not_due',
    policy_owner_id: editDocument?.policy_owner_id ?? '',
    is_centre_specific: editDocument?.is_centre_specific ?? false,
    centre_scope: editDocument?.centre_scope ?? '',
    parent_document_id: editDocument?.parent_document_id ?? parentDocument?.id ?? '',
    notes: editDocument?.notes ?? '',
  })
  const [parentPolicies, setParentPolicies] = useState([])
  const [loadingParents, setLoadingParents] = useState(false)
  const [file, setFile] = useState(null)
  const [extracting, setExtracting] = useState(false)
  const [extractedText, setExtractedText] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef()

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  const isAppendix = forceAppendix || Boolean(form.parent_document_id)

  useEffect(() => {
    let mounted = true

    async function loadParentPolicies() {
      setLoadingParents(true)
      try {
        const { data } = await supabase
          .from('documents')
          .select('id, title, document_type, status')
          .eq('is_current_version', true)
          .neq('status', DOCUMENT_STATUS.ARCHIVED)
          .in('document_type', ['policy', 'procedure'])
          .order('title', { ascending: true })

        if (!mounted) return

        const available = (data || []).filter(doc => doc.id !== editDocument?.id)
        setParentPolicies(available)
      } catch {
        if (!mounted) return
        setParentPolicies([])
      }
      if (mounted) setLoadingParents(false)
    }

    loadParentPolicies()

    return () => {
      mounted = false
    }
  }, [editDocument?.id])

  const previewNextReviewDate = calculateNextReviewDate(form.last_reviewed_date || form.effective_date, form.review_frequency_months)
  const previewFeedbackOpenDate = form.review_feedback_opens_at || calculateFeedbackOpenDate(previewNextReviewDate)

  async function extractTextFromPdf(pdfFile) {
    if (pdfFile.type !== 'application/pdf') return ''
    try {
      setExtracting(true)
      const pdfjsLib = await getPdfJsLib()
      const arrayBuffer = await pdfFile.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      let fullText = ''
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        const pageText = content.items.map((item) => item.str).join(' ')
        fullText += pageText + '\n'
      }
      return fullText.trim()
    } catch (err) {
      console.error('PDF extraction error:', err)
      return ''
    } finally {
      setExtracting(false)
    }
  }

  async function pickFile(picked) {
    setFile(picked)
    setExtractedText('')
    if (picked?.type === 'application/pdf') {
      const text = await extractTextFromPdf(picked)
      setExtractedText(text)
    }
  }

  function handleDrag(e) {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true)
    else if (e.type === 'dragleave') setDragActive(false)
  }

  function handleDrop(e) {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    const dropped = e.dataTransfer.files?.[0]
    if (dropped) pickFile(dropped)
  }

  function handleFileChange(e) {
    const picked = e.target.files?.[0]
    if (picked) pickFile(picked)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim()) { setError('Title is required'); return }
    if (!isEdit && !file) { setError('Please attach a file'); return }
    if (!form.category) { setError('Category is required'); return }
    if (isAppendix && !form.parent_document_id) { setError('Please choose a parent policy'); return }

    setLoading(true)
    setError('')

    try {
      const payload = {
        ...form,
        parent_document_id: forceAppendix ? parentDocument.id : (form.parent_document_id || null),
      }

      if (isAppendix) {
        payload.document_type = 'appendix'
        payload.category = parentDocument?.category || payload.category
        payload.review_feedback_opens_at = null
        payload.review_feedback_closes_at = null
        payload.review_frequency_months = null
        payload.review_status = 'not_due'
      }

      if (isEdit) {
        await updateDocument(editDocument.id, payload, currentUserId)
      } else {
        // Create placeholder document first to get the ID
        const tempId = crypto.randomUUID()

        // Upload file
        const fileInfo = await uploadDocumentFile(file, tempId)

        // Create document record
        await createDocument({
          ...payload,
          storage_path: fileInfo.path,
          original_filename: fileInfo.originalFilename,
          mime_type: fileInfo.mimeType,
          file_size: fileInfo.fileSize,
          extracted_text: extractedText || null,
        }, currentUserId)
      }

      onSaved()
      onClose()
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    }

    setLoading(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card large" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? 'Edit Document' : 'Add Document'}</h2>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="staff-form">

          <label>Title *
            <input
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="e.g. Staff Leave Policy"
              required
            />
          </label>

          <label>Description
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              rows={2}
              placeholder="Brief summary of what this document covers…"
              style={{ fontFamily: 'inherit' }}
            />
          </label>

          {!forceAppendix && (
            <div className="form-row">
              <label>Category *
                <select value={form.category} onChange={e => set('category', e.target.value)}>
                  {DOCUMENT_CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </label>
              <label>Document Type
                <select value={isAppendix ? 'appendix' : form.document_type} onChange={e => set('document_type', e.target.value)} disabled={isAppendix}>
                  {DOCUMENT_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {forceAppendix && (
            <div className="kc-current-file" style={{ marginBottom: 12, padding: '12px 14px', borderRadius: '8px', background: '#eff6ff', border: '1px solid #bfdbfe' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1e40af', marginBottom: 6 }}>
                Additional information for: {parentDocument?.title}
              </div>
              <div style={{ fontSize: 12, color: '#334155', lineHeight: '1.6' }}>
                Add a title and upload the file. This appendix is attached to the selected policy.
              </div>
            </div>
          )}

          {!forceAppendix && (
            <label style={{ justifyContent: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={isAppendix}
                  onChange={e => set('parent_document_id', e.target.checked ? (parentPolicies[0]?.id || '') : '')}
                  style={{ width: 16, height: 16 }}
                />
                Attach as additional information (appendix) to an existing policy
              </span>
            </label>
          )}

          {isAppendix && !forceAppendix && (
            <label>Parent policy *
              <select
                value={form.parent_document_id}
                onChange={e => set('parent_document_id', e.target.value)}
              >
                <option value="">Select parent policy</option>
                {parentPolicies.map(policy => (
                  <option key={policy.id} value={policy.id}>{policy.title}</option>
                ))}
              </select>
              {loadingParents && <small style={{ color: '#667783' }}>Loading available policies…</small>}
            </label>
          )}

          {!forceAppendix && (
            <div className="form-row">
              <label>Licensing Criteria Code
                <input
                  value={form.licensing_criteria}
                  onChange={e => set('licensing_criteria', e.target.value)}
                  placeholder="e.g. HS101 (optional)"
                />
              </label>
              <label>Effective Date
                <input
                  type="date"
                  value={form.effective_date}
                  onChange={e => set('effective_date', e.target.value)}
                />
              </label>
            </div>
          )}
          {!isAppendix && !forceAppendix && (
            <div className="form-row">
              <label>Last Reviewed Date
                <input
                  type="date"
                  value={form.last_reviewed_date}
                  onChange={e => set('last_reviewed_date', e.target.value)}
                />
              </label>
              <label>Review Every (months)
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={form.review_frequency_months}
                  onChange={e => set('review_frequency_months', parseInt(e.target.value))}
                />
              </label>
            </div>
          )}



          {!forceAppendix && (
            <div className="form-row">
              <label style={{ justifyContent: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={Boolean(form.is_centre_specific)}
                    onChange={e => set('is_centre_specific', e.target.checked)}
                    style={{ width: 16, height: 16 }}
                  />
                  This document is specific to one centre
                </span>
              </label>
            </div>
          )}

          {!forceAppendix && form.is_centre_specific && (
            <label>Which centre?
              <select
                value={form.centre_scope}
                onChange={e => set('centre_scope', e.target.value)}
              >
                <option value="">Select centre</option>
                {CENTRES.map(centre => (
                  <option key={centre} value={centre}>{centre}</option>
                ))}
              </select>
            </label>
          )}

          {!isAppendix && !forceAppendix ? (
            <div className="kc-current-file" style={{ marginBottom: 12, padding: '12px 14px', borderRadius: '8px', background: '#f0fdf4', border: '1px solid #86efac' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#166534', marginBottom: 8 }}>Auto-calculated Review Dates</div>
              <div style={{ fontSize: 12, color: '#374151', lineHeight: '1.6' }}>
                <div>Next review: <strong>{previewNextReviewDate || 'Will calculate once saved'}</strong></div>
                <div>Feedback period opens: <strong>{previewFeedbackOpenDate || 'Will calculate once saved'}</strong></div>
                <div>Feedback closes: <strong>{previewNextReviewDate || 'Will calculate once saved'}</strong></div>
              </div>
            </div>
          ) : (
            <div className="kc-current-file" style={{ marginBottom: 12, padding: '12px 14px', borderRadius: '8px', background: '#eff6ff', border: '1px solid #bfdbfe' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1e40af', marginBottom: 6 }}>Appendix / Additional Information</div>
              <div style={{ fontSize: 12, color: '#334155', lineHeight: '1.6' }}>
                This file will be linked to the selected parent policy and excluded from policy review cycles.
                It remains searchable and available to FF AI once published.
              </div>
            </div>
          )}

          {!forceAppendix && (
            <label>Notes
              <textarea
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                rows={2}
                placeholder="Any internal notes…"
                style={{ fontFamily: 'inherit' }}
              />
            </label>
          )}

          {/* Current file indicator — on edit */}
          {isEdit && editDocument?.original_filename && (
            <div className="kc-current-file">
              <FileText size={15} style={{ color: '#1a6eb5', flexShrink: 0 }} />
              <span><strong>Current file:</strong> {editDocument.original_filename}</span>
              <span style={{ color: '#8fa3ad', fontSize: 11 }}>(to replace the file, delete this document and re-upload)</span>
            </div>
          )}

          {/* File upload — only on new documents */}
          {!isEdit && (
            <div>
              <div
                className={`kc-dropzone${dragActive ? ' kc-dropzone-active' : ''}${file ? ' kc-dropzone-has-file' : ''}`}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
                {file ? (
                  <div className="kc-dropzone-file">
                    <FileText size={20} style={{ color: '#1a6eb5' }} />
                    <span>{file.name}</span>
                    {extracting && <span style={{ color: '#667783', fontSize: 11 }}>Reading PDF…</span>}
                    {!extracting && extractedText && <span style={{ color: '#0e9a8a', fontSize: 11, display: 'flex', alignItems: 'center', gap: 3 }}><CheckCircle size={12}/> Text extracted</span>}
                    {!extracting && file.type === 'application/pdf' && !extractedText && <span style={{ color: '#e97316', fontSize: 11 }}>Could not extract text</span>}
                    <button
                      type="button"
                      className="kc-remove-file"
                      onClick={e => { e.stopPropagation(); setFile(null); setExtractedText('') }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <UploadCloud size={28} style={{ color: '#0e9a8a', marginBottom: 6 }} />
                    <strong>Drop file here or click to browse</strong>
                    <small>PDF, Word, Excel, PowerPoint, or Text files</small>
                  </>
                )}
              </div>
            </div>
          )}

          {error && <div className="form-error"><AlertCircle size={14} style={{ marginRight: 6 }} />{error}</div>}

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? (isEdit ? 'Saving…' : 'Uploading…') : (isEdit ? 'Save Changes' : 'Add Document')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────
// CONFIRM DELETE MODAL
// ──────────────────────────────────────────────────────────
function ConfirmDeleteModal({ document, onClose, onConfirm, loading }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Delete Document?</h2>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>
        <p>Are you sure you want to delete <strong>"{document?.title}"</strong>? This cannot be undone.</p>
        <div className="form-actions" style={{ padding: '0 28px 24px' }}>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" style={{ background: '#dc2626' }} onClick={onConfirm} disabled={loading}>
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────
// STATUS BADGE
// ──────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const color = getStatusColor(status)
  const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : '—'
  return (
    <span className="kc-status-badge" style={{ background: color + '22', color }}>
      {label}
    </span>
  )
}

// ──────────────────────────────────────────────────────────
// DOCUMENT ROW
// ──────────────────────────────────────────────────────────
function DocumentRow({ doc, canManage, onEdit, onApprove, onPublish, onArchive, onRestore, onDelete, onView, onAddAppendix, appendices = [] }) {
  const catLabel = DOCUMENT_CATEGORIES.find(c => c.value === doc.category)?.label || doc.category
  const typeLabel = DOCUMENT_TYPES.find(t => t.value === doc.document_type)?.label || doc.document_type

  const uploadDate = doc.created_at
    ? new Date(doc.created_at).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—'

  const reviewDate = doc.next_review_date
    ? new Date(doc.next_review_date).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })
    : null
  const isAppendix = doc.document_type === 'appendix' || Boolean(doc.parent_document_id)
  const canAttachAppendix = !isAppendix && ['policy', 'procedure'].includes(doc.document_type)
  const [showAppendices, setShowAppendices] = useState(false)

  // Flag if review is overdue or within 60 days
  const reviewSoon = doc.next_review_date
    ? (new Date(doc.next_review_date) - new Date()) / (1000 * 60 * 60 * 24) <= 60
    : false
  const reviewOverdue = doc.next_review_date
    ? new Date(doc.next_review_date) < new Date()
    : false

  return (
    <div className="kc-doc-row">
      <div className="kc-doc-icon">
        <FileText size={20} style={{ color: '#1a6eb5' }} />
      </div>
      <div className="kc-doc-main">
        <div className="kc-doc-title">{doc.title}</div>
        {doc.description && <div className="kc-doc-desc">{doc.description}</div>}
        {isAppendix && doc.parent_document?.title && (
          <div className="kc-doc-desc" style={{ color: '#1e40af' }}>
            Additional information for: <strong>{doc.parent_document.title}</strong>
          </div>
        )}
        <div className="kc-doc-meta">
          <span>{typeLabel}</span>
          {doc.licensing_criteria && (
            <>
              <span className="kc-dot" />
              <span style={{ color: '#1a6eb5', fontWeight: 600 }}>{doc.licensing_criteria}</span>
            </>
          )}
          <span className="kc-dot" />
          <span>Added {uploadDate}</span>
        </div>

        {appendices.length > 0 && (
          <div style={{ marginTop: 10, borderTop: '1px dashed #dbe6ee', paddingTop: 10 }}>
            <button
              type="button"
              onClick={() => setShowAppendices(v => !v)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                border: '1px solid #d8e4ef',
                background: '#f6fbff',
                color: '#34506a',
                borderRadius: 8,
                padding: '8px 10px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <span>Additional information ({appendices.length})</span>
              <span style={{ fontSize: 14 }}>{showAppendices ? '▾' : '▸'}</span>
            </button>

            {showAppendices && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                {appendices.map(appendix => (
                  <div key={appendix.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: '#f8fbff', border: '1px solid #e6eef7', borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1f3a52', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {appendix.title}
                      </div>
                      <div style={{ fontSize: 11, color: '#6b7e8a' }}>
                        {appendix.original_filename || 'Appendix file'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <StatusBadge status={appendix.status} />
                      <button className="kc-action-btn" title="View document" onClick={() => onView(appendix)}>
                        <Eye size={14} />
                      </button>
                      {canManage && isDocumentEditable(appendix) && (
                        <button className="kc-action-btn" title="Edit document" onClick={() => onEdit(appendix)}>
                          <Edit2 size={14} />
                        </button>
                      )}
                      {canManage && canApproveDocument(appendix) && (
                        <button className="kc-action-btn kc-action-approve" title="Approve document" onClick={() => onApprove(appendix)}>
                          <Check size={14} />
                        </button>
                      )}
                      {canManage && canPublishDocument(appendix) && (
                        <button className="kc-action-btn kc-action-publish" title="Publish document" onClick={() => onPublish(appendix)}>
                          <BookOpen size={14} />
                        </button>
                      )}
                      {canManage && canArchiveDocument(appendix) && (
                        <button className="kc-action-btn kc-action-archive" title="Archive document" onClick={() => onArchive(appendix)}>
                          <Archive size={14} />
                        </button>
                      )}
                      {canManage && canRestoreDocument(appendix) && (
                        <button className="kc-action-btn kc-action-publish" title="Restore to published" onClick={() => onRestore(appendix)}>
                          <RotateCcw size={14} />
                        </button>
                      )}
                      {canManage && (appendix.status === DOCUMENT_STATUS.DRAFT || appendix.status === DOCUMENT_STATUS.ARCHIVED) && (
                        <button className="kc-action-btn kc-action-delete" title="Delete document" onClick={() => onDelete(appendix)}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="kc-doc-status">
        <StatusBadge status={doc.status} />
        {reviewDate && !isAppendix && (
          <div className="kc-review-date" style={{
            color: reviewOverdue ? '#dc2626' : reviewSoon ? '#e97316' : '#667783'
          }}>
            Review {reviewDate}
          </div>
        )}
      </div>
      <div className="kc-doc-actions">
        <button className="kc-action-btn" title="View document" onClick={() => onView(doc)}>
          <Eye size={15} />
        </button>
        {canManage && isDocumentEditable(doc) && (
          <button className="kc-action-btn" title="Edit document" onClick={() => onEdit(doc)}>
            <Edit2 size={15} />
          </button>
        )}
        {canManage && canAttachAppendix && (
          <button className="kc-action-btn" title="Add additional information" onClick={() => onAddAppendix(doc)}>
            <Plus size={15} />
          </button>
        )}
        {canManage && canApproveDocument(doc) && (
          <button className="kc-action-btn kc-action-approve" title="Approve document" onClick={() => onApprove(doc)}>
            <Check size={15} />
          </button>
        )}
        {canManage && canPublishDocument(doc) && (
          <button className="kc-action-btn kc-action-publish" title="Publish document" onClick={() => onPublish(doc)}>
            <BookOpen size={15} />
          </button>
        )}
        {canManage && canArchiveDocument(doc) && (
          <button className="kc-action-btn kc-action-archive" title="Archive document" onClick={() => onArchive(doc)}>
            <Archive size={15} />
          </button>
        )}
        {canManage && canRestoreDocument(doc) && (
          <button className="kc-action-btn kc-action-publish" title="Restore to published" onClick={() => onRestore(doc)}>
            <RotateCcw size={15} />
          </button>
        )}
        {canManage && (doc.status === DOCUMENT_STATUS.DRAFT || doc.status === DOCUMENT_STATUS.ARCHIVED) && (
          <button className="kc-action-btn kc-action-delete" title="Delete document" onClick={() => onDelete(doc)}>
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────
// MAIN PAGE
// ──────────────────────────────────────────────────────────
export function KnowledgeCentrePage({ currentProfile }) {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('documents') // 'documents' | 'queries' | 'policy-review'

  // Query log state
  const [queryLog, setQueryLog] = useState([])
  const [queryLogLoading, setQueryLogLoading] = useState(false)

  // Policy review state
  const [policyReviewData, setPolicyReviewData] = useState([])
  const [policyReviewLoading, setPolicyReviewLoading] = useState(false)

  // Analysis modal state
  const [analysisPolicy, setAnalysisPolicy] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisError, setAnalysisError] = useState('')
  const [showCreateVersionModal, setShowCreateVersionModal] = useState(false)
  const [newPolicyBlocks, setNewPolicyBlocks] = useState([])
  const [newPolicyFrequency, setNewPolicyFrequency] = useState(12)
  const [newPolicyCategory, setNewPolicyCategory] = useState('')
  const [newPolicyLicensingCriteria, setNewPolicyLicensingCriteria] = useState('')
  const [creatingVersion, setCreatingVersion] = useState(false)
  const [createVersionError, setCreateVersionError] = useState('')
  const [createVersionSuccess, setCreateVersionSuccess] = useState('')
  const [originalPolicyBlocks, setOriginalPolicyBlocks] = useState([])
  const [showPrintView, setShowPrintView] = useState(null)

  // Close review state
  const [closingReviewId, setClosingReviewId] = useState(null)
  const [closeReviewError, setCloseReviewError] = useState('')

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterCategory, setFilterCategory] = useState('all')

  // Modals
  const [showAddModal, setShowAddModal] = useState(false)
  const [editDoc, setEditDoc] = useState(null)
  const [appendixParentDoc, setAppendixParentDoc] = useState(null)
  const [deleteDoc, setDeleteDoc] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(null)

  const userId = currentProfile?.id
  const canManage = currentProfile?.permission === 'super_admin' || currentProfile?.permission === 'policy_admin'

  useEffect(() => {
    loadDocuments()
  }, [filterStatus, filterCategory])

  useEffect(() => {
    if (activeTab === 'queries' && canManage) loadQueryLog()
    if (activeTab === 'policy-review' && canManage) loadPolicyReviewData()
  }, [activeTab])

  async function loadQueryLog() {
    setQueryLogLoading(true)
    try {
      const { data } = await supabase
        .from('ai_query_log')
        .select('id, question, created_at, user_id')
        .order('created_at', { ascending: false })
        .limit(100)
      setQueryLog(data || [])
    } catch { setQueryLog([]) }
    setQueryLogLoading(false)
  }

  async function loadPolicyReviewData() {
    setPolicyReviewLoading(true)
    try {
      // Get all published documents with review data
      const { data: docs } = await supabase
        .from('documents')
        .select('id, title, status, review_feedback_opens_at, review_feedback_closes_at, review_frequency_months, document_type, parent_document_id')
        .eq('status', 'published')
        .eq('document_type', 'policy')
        .is('parent_document_id', null)
        .order('title')

      if (!docs || docs.length === 0) {
        setPolicyReviewData([])
        return
      }

      // For each document, get feedback
      const reviewDocs = []

      for (const doc of docs) {
        const { data: feedback } = await supabase
          .from('policy_review_feedback')
          .select('id, section_reference, feedback, suggested_wording, works_in_practice, user_id, submitted_at, status, profiles(first_name, last_name)')
          .eq('document_id', doc.id)
          .order('submitted_at', { ascending: false })

        const reviewState = getPolicyReviewAlertState(doc)
        const isOpen = reviewState === 'open' || reviewState === 'overdue'

        reviewDocs.push({
          ...doc,
          reviewState,
          isOpen,
          feedbackCount: (feedback || []).length,
          feedback: feedback || [],
        })
      }

      setPolicyReviewData(reviewDocs)
    } catch (err) {
      console.error('Error loading policy review data:', err)
      setPolicyReviewData([])
    } finally {
      setPolicyReviewLoading(false)
    }
  }

  async function analyzePolicyFeedbackAction(policyDoc) {
    setAnalysisPolicy(policyDoc)
    setAnalysis(null)
    setAnalysisLoading(true)
    setAnalysisError('')
    try {
      // Collect all feedback for this policy
      const feedbackArray = policyDoc.feedback || []
      
      if (feedbackArray.length === 0) {
        setAnalysisError('No feedback to analyze.')
        setAnalysisLoading(false)
        return
      }

      // Call the analyzer
      const result = await analyzePolicyFeedback(feedbackArray, policyDoc.title, '')
      setAnalysis(result)
    } catch (err) {
      setAnalysisError(err.message || 'Failed to analyze feedback. Please try again.')
      console.error('Analysis error:', err)
    }
    setAnalysisLoading(false)
  }

  async function openCreateVersionModal() {
    if (!analysisPolicy) return
    setCreateVersionError('')
    setCreateVersionSuccess('')
    setCreatingVersion(true)
    try {
      const fullDoc = await getDocument(analysisPolicy.id)
      setAnalysisPolicy(fullDoc)
      const frequency = Number(fullDoc.review_frequency_months || 12)
      const blocks = Array.isArray(fullDoc.content_blocks) && fullDoc.content_blocks.length > 0
        ? fullDoc.content_blocks
        : parseFlatTextToBlocks(fullDoc.extracted_text)
      setOriginalPolicyBlocks(blocks)
      setNewPolicyBlocks(blocks.length > 0 ? blocks : [{ lead: '', text: '' }])
      setNewPolicyFrequency(frequency)
      setNewPolicyCategory(fullDoc.category || '')
      setNewPolicyLicensingCriteria(fullDoc.licensing_criteria || '')
      setShowCreateVersionModal(true)
    } catch (err) {
      setCreateVersionError(err.message || 'Could not load the full policy for editing.')
    }
    setCreatingVersion(false)
  }

  function resetDraftToCurrentPolicy() {
    setNewPolicyBlocks(originalPolicyBlocks.length > 0 ? originalPolicyBlocks : [{ lead: '', text: '' }])
  }

  function updatePolicyBlock(index, field, value) {
    setNewPolicyBlocks(blocks => blocks.map((block, i) => (i === index ? { ...block, [field]: value } : block)))
  }

  function addPolicyBlock() {
    setNewPolicyBlocks(blocks => [...blocks, { lead: '', text: '' }])
  }

  function removePolicyBlock(index) {
    setNewPolicyBlocks(blocks => blocks.filter((_, i) => i !== index))
  }

  function movePolicyBlock(index, direction) {
    setNewPolicyBlocks(blocks => {
      const target = index + direction
      if (target < 0 || target >= blocks.length) return blocks
      const next = [...blocks]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  async function handleCreatePolicyVersion() {
    if (!analysisPolicy) return

    const cleanedBlocks = newPolicyBlocks
      .map(block => ({ lead: (block.lead || '').trim(), text: (block.text || '').trim() }))
      .filter(block => block.lead || block.text)
    const frequency = Number(newPolicyFrequency)

    if (cleanedBlocks.length === 0) {
      setCreateVersionError('Please add at least one bullet point before creating a new version.')
      return
    }

    if (!Number.isFinite(frequency) || frequency <= 0) {
      setCreateVersionError('Review frequency must be a positive number of months.')
      return
    }

    setCreatingVersion(true)
    setCreateVersionError('')
    setCreateVersionSuccess('')
    try {
      await createReviewedPolicyVersion(
        analysisPolicy,
        {
          contentBlocks: cleanedBlocks,
          reviewFrequencyMonths: frequency,
          category: newPolicyCategory,
          licensingCriteria: newPolicyLicensingCriteria,
        },
        userId
      )

      setCreateVersionSuccess('New version published. Previous version archived. Review cycle has been reset.')
      setShowCreateVersionModal(false)
      setAnalysisPolicy(null)
      setAnalysis(null)
      setAnalysisError('')
      await loadPolicyReviewData()
      await loadDocuments()
    } catch (err) {
      setCreateVersionError(err.message || 'Could not create policy version.')
    }
    setCreatingVersion(false)
  }

  async function closeReviewEarly(policyDoc) {
    setClosingReviewId(policyDoc.id)
    setCloseReviewError('')
    try {
      const today = new Date().toISOString().slice(0, 10)
      const { error } = await supabase
        .from('documents')
        .update({ review_feedback_closes_at: today })
        .eq('id', policyDoc.id)
      
      if (error) throw error
      
      // Reload policy review data to update UI
      await loadPolicyReviewData()
    } catch (err) {
      setCloseReviewError(err.message || 'Failed to close review. Please try again.')
      console.error('Close review error:', err)
    }
    setClosingReviewId(null)
  }

  async function loadDocuments() {
    setLoading(true)
    setError('')
    try {
      const filters = {}
      if (filterStatus !== 'all') filters.status = filterStatus
      if (filterCategory !== 'all') filters.category = filterCategory
      const data = await getAllDocuments(filters)
      setDocuments(data || [])
    } catch (err) {
      setError('Could not load documents. Please try again.')
    }
    setLoading(false)
  }

  // Filter by search query client-side
  const filtered = documents.filter(doc => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      doc.title?.toLowerCase().includes(q) ||
      doc.description?.toLowerCase().includes(q) ||
      doc.category?.toLowerCase().includes(q)
    )
  })

  async function handleApprove(doc) {
    setActionLoading(doc.id)
    try {
      await approveDocument(doc.id, userId)
      await loadDocuments()
    } catch {
      setError('Could not approve document.')
    }
    setActionLoading(null)
  }

  async function handlePublish(doc) {
    setActionLoading(doc.id)
    try {
      await publishDocument(doc.id, userId)
      await loadDocuments()
    } catch {
      setError('Could not publish document.')
    }
    setActionLoading(null)
  }

  async function handleRestore(doc) {
    setActionLoading(doc.id)
    try {
      await restoreDocument(doc.id, userId)
      await loadDocuments()
    } catch {
      setError('Could not restore document.')
    }
    setActionLoading(null)
  }

  async function handleArchive(doc) {
    setActionLoading(doc.id)
    try {
      await archiveDocument(doc.id, userId)
      await loadDocuments()
    } catch {
      setError('Could not archive document.')
    }
    setActionLoading(null)
  }

  async function handleConfirmDelete() {
    if (!deleteDoc) return
    setDeleteLoading(true)
    try {
      await deleteDocument(deleteDoc.id, userId)
      setDeleteDoc(null)
      await loadDocuments()
    } catch {
      setError('Could not delete document.')
    }
    setDeleteLoading(false)
  }

  async function handleView(doc) {
    try {
      const { signedUrl } = await getSignedUrl(doc.storage_path)
      window.open(signedUrl, '_blank', 'noopener,noreferrer')
    } catch {
      setError('Could not open document. Please try again.')
    }
  }

  // Count per status for the summary pills
  const topLevelDocuments = documents.filter(d => !d.parent_document_id)
  const counts = {
    all: topLevelDocuments.length,
    draft: topLevelDocuments.filter(d => d.status === DOCUMENT_STATUS.DRAFT).length,
    approved: topLevelDocuments.filter(d => d.status === DOCUMENT_STATUS.APPROVED).length,
    published: topLevelDocuments.filter(d => d.status === DOCUMENT_STATUS.PUBLISHED).length,
    archived: topLevelDocuments.filter(d => d.status === DOCUMENT_STATUS.ARCHIVED).length,
  }

  return (
    <div className="kc-page">
      {/* Page Header */}
      <div className="kc-header">
        <div>
          <h1 className="kc-title">Knowledge Centre</h1>
          <p className="kc-subtitle">Manage policies, procedures and important documents</p>
        </div>
        {canManage && (
          <button className="btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={17} /> Add Document
          </button>
        )}
      </div>

      {/* Tabs — only super_admin sees query log */}
      {canManage && (
        <div className="kc-tabs">
          <button className={`kc-tab${activeTab === 'documents' ? ' kc-tab-active' : ''}`} onClick={() => setActiveTab('documents')}>
            <FileText size={14} /> Documents
          </button>
          <button className={`kc-tab${activeTab === 'queries' ? ' kc-tab-active' : ''}`} onClick={() => setActiveTab('queries')}>
            <Search size={14} /> AI Query Log
          </button>
          <button className={`kc-tab${activeTab === 'policy-review' ? ' kc-tab-active' : ''}`} onClick={() => setActiveTab('policy-review')}>
            <BookOpen size={14} /> Policy Review
          </button>
        </div>
      )}

      {activeTab === 'queries' ? (
        <div className="kc-query-log">
          {queryLogLoading ? (
            <div className="kc-empty">Loading…</div>
          ) : queryLog.length === 0 ? (
            <div className="kc-empty"><strong>No queries yet</strong><small>Staff questions will appear here once they use FF AI.</small></div>
          ) : (
            queryLog.map(q => (
              <div key={q.id} className="kc-query-row">
                <div className="kc-query-q">"{q.question}"</div>
                <div className="kc-query-meta">
                  {new Date(q.created_at).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))
          )}
        </div>
      ) : activeTab === 'policy-review' ? (
        <div className="kc-policy-review">
          {createVersionSuccess && (
            <div className="form-success" style={{ marginBottom: 12 }}>
              {createVersionSuccess}
            </div>
          )}
          {policyReviewLoading ? (
            <div className="kc-empty">Loading…</div>
          ) : policyReviewData.length === 0 ? (
            <div className="kc-empty"><strong>No policies for review</strong><small>Policies will appear here when they're in an active review window.</small></div>
          ) : (
            policyReviewData.map(doc => (
              <div key={doc.id} className="kc-policy-card">
                <div className="kc-policy-header">
                  <div>
                    <h3>{doc.title}</h3>
                    <div className="kc-policy-meta">
                      {doc.isOpen ? (
                        <span className="kc-badge kc-badge-open">Open for Review</span>
                      ) : (
                        <span className="kc-badge kc-badge-closed">Review Closed</span>
                      )}
                      <span className="kc-badge-count">{doc.feedbackCount} feedback submission{doc.feedbackCount !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <button
                    className="btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
                    onClick={async () => {
                      const fullDoc = await getDocument(doc.id)
                      setShowPrintView(fullDoc)
                    }}
                  >
                    <Printer size={14} /> Print / View
                  </button>
                </div>
                {doc.feedbackCount > 0 && (
                  <div className="kc-feedback-list">
                    {doc.feedback.map(fb => (
                      <div key={fb.id} className="kc-feedback-item">
                        <div className="kc-feedback-header">
                          <span className="kc-feedback-author">
                            {fb.profiles?.first_name} {fb.profiles?.last_name}
                          </span>
                          <span className="kc-feedback-date">
                            {new Date(fb.submitted_at).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        {fb.section_reference && (
                          <div className="kc-feedback-section">
                            <strong>Section:</strong> {fb.section_reference}
                          </div>
                        )}
                        <div className="kc-feedback-text">
                          {fb.status === 'reviewed' ? 'Reviewed, no feedback to provide.' : fb.feedback}
                        </div>
                        {fb.suggested_wording && (
                          <div className="kc-feedback-suggestion">
                            <strong>Suggested wording:</strong> {fb.suggested_wording}
                          </div>
                        )}
                        {fb.works_in_practice !== null && (
                          <div className="kc-feedback-works">
                            <strong>Works in practice:</strong> {fb.works_in_practice ? '✓ Yes' : '✗ No'}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {doc.feedbackCount > 0 && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                    <button
                      className="btn-secondary"
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, minWidth: 140 }}
                      onClick={() => analyzePolicyFeedbackAction(doc)}
                      disabled={analysisLoading && analysisPolicy?.id === doc.id}
                    >
                      <Zap size={15} />
                      {analysisLoading && analysisPolicy?.id === doc.id ? 'Analyzing...' : 'Analyze'}
                    </button>
                    {doc.isOpen && (
                      <button
                        className="btn-secondary"
                        style={{ flex: 1, minWidth: 140 }}
                        onClick={() => closeReviewEarly(doc)}
                        disabled={closingReviewId === doc.id}
                      >
                        {closingReviewId === doc.id ? 'Closing...' : 'Close Review'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        <>
      {/* Status summary pills */}
      <div className="kc-status-pills">
        {[
          { label: 'All', value: 'all' },
          { label: 'Draft', value: 'draft' },
          { label: 'Approved', value: 'approved' },
          { label: 'Published', value: 'published' },
          { label: 'Archived', value: 'archived' },
        ].map(s => (
          <button
            key={s.value}
            className={`kc-pill${filterStatus === s.value ? ' kc-pill-active' : ''}`}
            onClick={() => setFilterStatus(s.value)}
            style={filterStatus === s.value && s.value !== 'all' ? {
              background: getStatusColor(s.value) + '22',
              color: getStatusColor(s.value),
              borderColor: getStatusColor(s.value),
            } : {}}
          >
            {s.label}
            <span className="kc-pill-count">{counts[s.value]}</span>
          </button>
        ))}
      </div>

      {/* Search + filter bar */}
      <div className="kc-filters">
        <div className="kc-search-wrap">
          <Search size={16} />
          <input
            className="kc-search"
            placeholder="Search documents…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="kc-select-wrap">
          <select
            className="kc-select"
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
          >
            <option value="all">All Categories</option>
            {DOCUMENT_CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <ChevronDown size={14} className="kc-select-icon" />
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="form-error" style={{ margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={14} />{error}
        </div>
      )}

      {/* Document list - grouped by category */}
      <div className="kc-doc-list">
        {loading ? (
          <div className="kc-empty">Loading documents…</div>
        ) : filtered.length === 0 ? (
          <div className="kc-empty">
            <FileText size={36} style={{ color: '#c8d8e0', marginBottom: 12 }} />
            <strong>No documents found</strong>
            <small>{canManage ? 'Click "Add Document" to get started.' : 'No documents have been published yet.'}</small>
          </div>
        ) : (() => {
          // Group by category in the order defined in DOCUMENT_CATEGORIES
          const appendicesByParent = {}
          filtered.forEach(doc => {
            if (doc.parent_document_id) {
              if (!appendicesByParent[doc.parent_document_id]) appendicesByParent[doc.parent_document_id] = []
              appendicesByParent[doc.parent_document_id].push(doc)
            }
          })

          const grouped = {}
          filtered.filter(doc => !doc.parent_document_id).forEach(doc => {
            const key = doc.category || 'other'
            if (!grouped[key]) grouped[key] = []
            grouped[key].push(doc)
          })
          // Sort groups by DOCUMENT_CATEGORIES order
          const orderedKeys = DOCUMENT_CATEGORIES
            .map(c => c.value)
            .filter(k => grouped[k])
          // Add any unknown categories at the end
          Object.keys(grouped).forEach(k => { if (!orderedKeys.includes(k)) orderedKeys.push(k) })

          return orderedKeys.map(catKey => {
            const catLabel = DOCUMENT_CATEGORIES.find(c => c.value === catKey)?.label || catKey
            return (
              <div key={catKey} className="kc-category-group">
                <div className="kc-category-heading">{catLabel}</div>
                {grouped[catKey].map(doc => (
                  <DocumentRow
                    key={doc.id}
                    doc={doc}
                    canManage={canManage}
                    onEdit={setEditDoc}
                    onAddAppendix={setAppendixParentDoc}
                    onApprove={handleApprove}
                    onPublish={handlePublish}
                    onArchive={handleArchive}
                    onRestore={handleRestore}
                    onDelete={setDeleteDoc}
                    onView={handleView}
                    appendices={appendicesByParent[doc.id] || []}
                  />
                ))}
              </div>
            )
          })
        })()}
      </div>

      {/* Modals */}
      {showAddModal && (
        <DocumentModal
          onClose={() => setShowAddModal(false)}
          onSaved={loadDocuments}
          currentUserId={userId}
        />
      )}
      {appendixParentDoc && (
        <DocumentModal
          parentDocument={appendixParentDoc}
          onClose={() => setAppendixParentDoc(null)}
          onSaved={loadDocuments}
          currentUserId={userId}
        />
      )}
      {editDoc && (
        <DocumentModal
          editDocument={editDoc}
          onClose={() => setEditDoc(null)}
          onSaved={loadDocuments}
          currentUserId={userId}
        />
      )}
      {deleteDoc && (
        <ConfirmDeleteModal
          document={deleteDoc}
          onClose={() => setDeleteDoc(null)}
          onConfirm={handleConfirmDelete}
          loading={deleteLoading}
        />
      )}
        </>
      )}

      {analysisPolicy ? (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => { setAnalysisPolicy(null); setAnalysis(null); setAnalysisError('') }}>
          <div className="modal-card large" style={{ position: 'relative', zIndex: 10000, background: 'white', borderRadius: 12, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', maxWidth: 700, width: '90%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ padding: '20px 28px', borderBottom: '1px solid #edf2f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>AI Analysis: {analysisPolicy.title}</h2>
              <button className="modal-close" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7e8a' }} onClick={() => { setAnalysisPolicy(null); setAnalysis(null); setAnalysisError('') }}><X size={20} /></button>
            </div>
            <div style={{ padding: '28px', maxHeight: '70vh', overflow: 'auto' }}>
              {analysisLoading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#8fa3ad' }}>
                  <div style={{ fontSize: 14 }}>Analyzing feedback with AI...</div>
                </div>
              ) : analysisError ? (
                <div className="form-error" style={{ display: 'flex', gap: 8 }}>
                  <AlertCircle size={14} />{analysisError}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  {/* Key Themes */}
                  <div>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0d2b36', margin: '0 0 12px' }}>📋 Key Themes</h3>
                    <ul style={{ margin: 0, paddingLeft: 20, color: '#374151', fontSize: 13, lineHeight: 1.6 }}>
                      {analysis.themes && analysis.themes.length > 0 ? (
                        analysis.themes.map((theme, i) => <li key={i}>{theme}</li>)
                      ) : (
                        <li style={{ color: '#8fa3ad' }}>No themes identified</li>
                      )}
                    </ul>
                  </div>

                  {/* Suggested Changes */}
                  {analysis.suggestedChanges && analysis.suggestedChanges.length > 0 && (
                    <div>
                      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0d2b36', margin: '0 0 12px' }}>✏️ Suggested Wording Changes</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {analysis.suggestedChanges.map((change, i) => (
                          <div key={i} style={{ background: '#f9fbfc', border: '1px solid #e5e9ed', borderRadius: 8, padding: 12 }}>
                            {change.section && (
                              <div style={{ fontSize: 11, color: '#8fa3ad', marginBottom: 6 }}>Section: {change.section}</div>
                            )}
                            <div style={{ fontSize: 12, color: '#374151', marginBottom: 6 }}>
                              <strong>Current:</strong> {change.original}
                            </div>
                            <div style={{ fontSize: 12, color: '#059669', marginBottom: 6 }}>
                              <strong>Suggested:</strong> {change.suggested}
                            </div>
                            {change.reason && (
                              <div style={{ fontSize: 11, color: '#6b7e8a', fontStyle: 'italic' }}>Reason: {change.reason}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Contradictions */}
                  {analysis.contradictions && analysis.contradictions.length > 0 && (
                    <div>
                      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#991b1b', margin: '0 0 12px' }}>⚠️ Contradictions/Concerns</h3>
                      <ul style={{ margin: 0, paddingLeft: 20, color: '#374151', fontSize: 13, lineHeight: 1.6 }}>
                        {analysis.contradictions.map((contradiction, i) => (
                          <li key={i}>{contradiction}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Leadership Summary */}
                  <div>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0d2b36', margin: '0 0 12px' }}>🎯 Leadership Summary</h3>
                    <div style={{ background: '#fefce8', border: '1px solid #fcd34d', borderRadius: 8, padding: 12, color: '#78350f', fontSize: 13, lineHeight: 1.6 }}>
                      {analysis.leadershipSummary}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div style={{ padding: '16px 28px', borderTop: '1px solid #edf2f5', display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => { setAnalysisPolicy(null); setAnalysis(null); setAnalysisError('') }}>
                Close
              </button>
              <button className="btn-primary" disabled={!analysis || analysisLoading} onClick={openCreateVersionModal}>
                Create New Policy Version
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showCreateVersionModal && analysisPolicy ? (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001 }} onClick={() => { if (!creatingVersion) setShowCreateVersionModal(false) }}>
          <div className="modal-card large" style={{ position: 'relative', zIndex: 10002, background: 'white', borderRadius: 12, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', maxWidth: 880, width: '94%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ padding: '20px 28px', borderBottom: '1px solid #edf2f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Create New Policy Version</h2>
              <button className="modal-close" style={{ background: 'none', border: 'none', cursor: creatingVersion ? 'not-allowed' : 'pointer', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7e8a' }} disabled={creatingVersion} onClick={() => setShowCreateVersionModal(false)}><X size={20} /></button>
            </div>
            <div style={{ padding: 24, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ border: '1px solid #dbe5ea', borderRadius: 10, padding: '12px 14px', background: '#f8fbfc', display: 'flex', alignItems: 'center', gap: 12 }}>
                <img src="/logo.png" alt="Future Focus" style={{ width: 120, height: 'auto', display: 'block' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <strong style={{ fontSize: 14, color: '#16303b' }}>{analysisPolicy.title}</strong>
                  <span style={{ fontSize: 12, color: '#4a5f6b' }}>Review staff feedback, then edit the policy text below.</span>
                </div>
              </div>
              <div style={{ fontSize: 13, color: '#4a5f6b', lineHeight: 1.5 }}>
                You are editing the next live version of <strong>{analysisPolicy.title}</strong>. Saving will publish the new version immediately, archive the current one, and reset review dates from your selected frequency.
              </div>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 13, color: '#35505d', fontWeight: 600 }}>Review frequency (months)</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={newPolicyFrequency}
                  onChange={e => setNewPolicyFrequency(e.target.value)}
                  disabled={creatingVersion}
                  style={{ border: '1px solid #d8e3e9', borderRadius: 8, padding: '10px 12px', fontSize: 14 }}
                />
              </label>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 200px' }}>
                  <span style={{ fontSize: 13, color: '#35505d', fontWeight: 600 }}>Policy category</span>
                  <input
                    value={newPolicyCategory}
                    onChange={e => setNewPolicyCategory(e.target.value)}
                    disabled={creatingVersion}
                    placeholder="e.g. Governance, Management and Administration"
                    style={{ border: '1px solid #d8e3e9', borderRadius: 8, padding: '10px 12px', fontSize: 13 }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 200px' }}>
                  <span style={{ fontSize: 13, color: '#35505d', fontWeight: 600 }}>Licensing criteria</span>
                  <input
                    value={newPolicyLicensingCriteria}
                    onChange={e => setNewPolicyLicensingCriteria(e.target.value)}
                    disabled={creatingVersion}
                    placeholder="e.g. GMA102 Parent Involvement and Information"
                    style={{ border: '1px solid #d8e3e9', borderRadius: 8, padding: '10px 12px', fontSize: 13 }}
                  />
                </label>
              </div>

              {analysis && (
                <div style={{ border: '1px solid #e4ebef', borderRadius: 10, padding: 12, background: '#fff' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#173845', marginBottom: 8 }}>Feedback summary from analysis</div>
                  {analysis.themes?.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#35505d', marginBottom: 4 }}>Key Themes</div>
                      <ul style={{ margin: 0, paddingLeft: 18, color: '#334155', fontSize: 12, lineHeight: 1.5 }}>
                        {analysis.themes.map((theme, idx) => <li key={idx}>{theme}</li>)}
                      </ul>
                    </div>
                  )}
                  {analysis.suggestedChanges?.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#35505d', marginBottom: 4 }}>Suggested wording changes</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {analysis.suggestedChanges.map((change, idx) => (
                          <div key={idx} style={{ background: '#f8fbfd', border: '1px solid #e6edf1', borderRadius: 8, padding: 8, fontSize: 12, color: '#334155' }}>
                            {change.section ? <div style={{ color: '#64748b', marginBottom: 3 }}>Section: {change.section}</div> : null}
                            <div><strong>Current:</strong> {change.original || '-'}</div>
                            <div style={{ color: '#0f766e' }}><strong>Suggested:</strong> {change.suggested || '-'}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {analysis.leadershipSummary ? (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#35505d', marginBottom: 4 }}>Leadership summary</div>
                      <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.5 }}>{analysis.leadershipSummary}</div>
                    </div>
                  ) : null}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, color: '#35505d', fontWeight: 600 }}>
                  Policy points (each becomes a bullet in the published policy)
                </span>
                <button type="button" className="btn-secondary" onClick={resetDraftToCurrentPolicy} disabled={creatingVersion || originalPolicyBlocks.length === 0}>
                  Reset to Current
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {newPolicyBlocks.map((block, index) => (
                  <div key={index} style={{ border: '1px solid #d8e3e9', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, background: '#fbfdfd' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#8fa3ad', letterSpacing: '.3px' }}>BULLET {index + 1}</span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button type="button" className="btn-icon-edit" title="Move up" onClick={() => movePolicyBlock(index, -1)} disabled={creatingVersion || index === 0}>
                          <ChevronUp size={14} />
                        </button>
                        <button type="button" className="btn-icon-edit" title="Move down" onClick={() => movePolicyBlock(index, 1)} disabled={creatingVersion || index === newPolicyBlocks.length - 1}>
                          <ChevronDown size={14} />
                        </button>
                        <button type="button" className="btn-icon-danger" title="Remove bullet" onClick={() => removePolicyBlock(index)} disabled={creatingVersion}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <input
                      value={block.lead}
                      onChange={e => updatePolicyBlock(index, 'lead', e.target.value)}
                      disabled={creatingVersion}
                      placeholder="Bold lead-in (optional) — e.g. Information concerning your child"
                      style={{ border: '1px solid #d8e3e9', borderRadius: 8, padding: '8px 10px', fontSize: 13, fontWeight: 700, color: '#0d2b36' }}
                    />
                    <textarea
                      value={block.text}
                      onChange={e => updatePolicyBlock(index, 'text', e.target.value)}
                      disabled={creatingVersion}
                      rows={3}
                      placeholder="Bullet text"
                      style={{ width: '100%', border: '1px solid #d8e3e9', borderRadius: 8, padding: '8px 10px', fontSize: 13, lineHeight: 1.5, fontFamily: 'inherit', resize: 'vertical' }}
                    />
                  </div>
                ))}
                <button type="button" className="btn-secondary" onClick={addPolicyBlock} disabled={creatingVersion} style={{ alignSelf: 'flex-start' }}>
                  <Plus size={14} /> Add Bullet
                </button>
              </div>
              {createVersionError && (
                <div className="form-error" style={{ display: 'flex', gap: 8 }}>
                  <AlertCircle size={14} />{createVersionError}
                </div>
              )}
            </div>
            <div style={{ padding: '16px 28px', borderTop: '1px solid #edf2f5', display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setShowCreateVersionModal(false)} disabled={creatingVersion}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleCreatePolicyVersion} disabled={creatingVersion}>
                {creatingVersion ? 'Saving Version...' : 'Save & Replace Current Policy'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showPrintView && <PolicyPrintView doc={showPrintView} onClose={() => setShowPrintView(null)} />}
    </div>
  )
}
