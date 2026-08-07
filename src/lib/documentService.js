/**
 * DOCUMENT SERVICE
 * Functions for working with documents in Supabase
 */

import { supabase } from './supabase'
import { DOCUMENT_STATUS } from './documentTypes'
import { calculateFeedbackOpenDate, calculateNextReviewDate, normalizeReviewPayload, blocksToPlainText } from './policyReview'

/**
 * CREATE A NEW DOCUMENT
 * Saves document metadata and logs action
 * 
 * @param {Object} documentData - Document info to save
 * @param {string} userId - UUID of current user
 * @returns {Object} Created document
 */
export async function createDocument(documentData, userId) {
  try {
    const payload = {
      ...normalizeReviewPayload(documentData),
      created_by: userId,
      uploaded_by: userId,
      status: DOCUMENT_STATUS.DRAFT,
    }

    const { data, error } = await supabase
      .from('documents')
      .insert([payload])
      .select()
      .single()

    if (error) throw error

    // Log the action
    await logDocumentAction(data.id, userId, 'created', { title: documentData.title })

    return data
  } catch (error) {
    console.error('Error creating document:', error)
    throw error
  }
}

/**
 * UPDATE DOCUMENT METADATA
 * Updates title, description, category, dates, etc.
 * 
 * @param {string} documentId - UUID of document to update
 * @param {Object} updates - Fields to update
 * @param {string} userId - UUID of current user
 * @returns {Object} Updated document
 */
export async function updateDocument(documentId, updates, userId) {
  try {
    const payload = {
      ...normalizeReviewPayload(updates),
      updated_by: userId,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('documents')
      .update(payload)
      .eq('id', documentId)
      .select()
      .single()

    if (error) throw error

    // Log the action
    await logDocumentAction(documentId, userId, 'updated', updates)

    return data
  } catch (error) {
    console.error('Error updating document:', error)
    throw error
  }
}

/**
 * GET SINGLE DOCUMENT
 * Fetch a document by ID
 * 
 * @param {string} documentId - UUID of document
 * @returns {Object} Document data
 */
export async function getDocument(documentId) {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error fetching document:', error)
    throw error
  }
}

/**
 * GET ALL DOCUMENTS
 * Fetch documents with optional filtering
 * 
 * @param {Object} filters - { status, category, documentType }
 * @returns {Array} List of documents
 */
export async function getAllDocuments(filters = {}) {
  try {
    const applyFilters = (queryBuilder) => {
      let q = queryBuilder

      if (filters.status) {
        q = q.eq('status', filters.status)
      }
      if (filters.category) {
        q = q.eq('category', filters.category)
      }
      if (filters.documentType) {
        q = q.eq('document_type', filters.documentType)
      }

      return q
    }

    // Prefer enriched select with parent relationship (for appendix linking).
    // If the DB relation metadata is not available yet, gracefully fall back.
    let { data, error } = await applyFilters(
      supabase
        .from('documents')
        .select('*, parent_document:parent_document_id(id, title, document_type)')
    ).order('created_at', { ascending: false })

    if (error) {
      const fallback = await applyFilters(
        supabase
          .from('documents')
          .select('*')
      ).order('created_at', { ascending: false })

      data = fallback.data
      error = fallback.error
    }

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error fetching documents:', error)
    throw error
  }
}

/**
 * APPROVE DOCUMENT
 * Changes status from draft → approved
 * 
 * @param {string} documentId - UUID of document
 * @param {string} userId - UUID of approver
 * @returns {Object} Updated document
 */
export async function approveDocument(documentId, userId) {
  try {
    const { data, error } = await supabase
      .from('documents')
      .update({
        status: DOCUMENT_STATUS.APPROVED,
        approved_date: new Date().toISOString(),
        approved_by: userId,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId)
      .select()
      .single()

    if (error) throw error

    // Log the action
    await logDocumentAction(documentId, userId, 'approved', {})

    return data
  } catch (error) {
    console.error('Error approving document:', error)
    throw error
  }
}

/**
 * PUBLISH DOCUMENT
 * Changes status from approved → published
 * 
 * @param {string} documentId - UUID of document
 * @param {string} userId - UUID of publisher
 * @returns {Object} Updated document
 */
export async function publishDocument(documentId, userId) {
  try {
    const { data, error } = await supabase
      .from('documents')
      .update({
        status: DOCUMENT_STATUS.PUBLISHED,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId)
      .select()
      .single()

    if (error) throw error

    // Log the action
    await logDocumentAction(documentId, userId, 'published', {})

    return data
  } catch (error) {
    console.error('Error publishing document:', error)
    throw error
  }
}

/**
 * ARCHIVE DOCUMENT
 * Changes status to archived
 * 
 * @param {string} documentId - UUID of document
 * @param {string} userId - UUID of archiver
 * @returns {Object} Updated document
 */
export async function archiveDocument(documentId, userId) {
  try {
    const { data, error } = await supabase
      .from('documents')
      .update({
        status: DOCUMENT_STATUS.ARCHIVED,
        archived_at: new Date().toISOString(),
        archived_by: userId,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId)
      .select()
      .single()

    if (error) throw error

    // Log the action
    await logDocumentAction(documentId, userId, 'archived', {})

    return data
  } catch (error) {
    console.error('Error archiving document:', error)
    throw error
  }
}

/**
 * DELETE DOCUMENT
 * Only drafts can be deleted
 * 
 * @param {string} documentId - UUID of document
 * @param {string} userId - UUID of deleter
 * @returns {boolean} Success
 */
export async function deleteDocument(documentId, userId) {
  try {
    // First log the action
    await logDocumentAction(documentId, userId, 'deleted', {})

    // Then delete
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', documentId)

    if (error) throw error
    return true
  } catch (error) {
    console.error('Error deleting document:', error)
    throw error
  }
}

/**
 * LOG DOCUMENT ACTION
 * Records all actions (create, update, approve, etc.) in audit log
 * 
 * @param {string} documentId - UUID of document
 * @param {string} userId - UUID of user taking action
 * @param {string} action - Action name (created, updated, approved, etc.)
 * @param {Object} details - Additional details about the action
 */
export async function logDocumentAction(documentId, userId, action, details = {}) {
  try {
    await supabase.from('document_audit_log').insert([
      {
        document_id: documentId,
        user_id: userId,
        action,
        details: details || {},
      },
    ])
  } catch (error) {
    console.error('Error logging document action:', error)
    // Don't throw - logging errors shouldn't break the main operation
  }
}

/**
 * GET DOCUMENT HISTORY
 * Fetch all actions for a document (audit log)
 * 
 * @param {string} documentId - UUID of document
 * @returns {Array} List of audit log entries
 */
export async function getDocumentHistory(documentId) {
  try {
    const { data, error } = await supabase
      .from('document_audit_log')
      .select('*')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error fetching document history:', error)
    throw error
  }
}

/**
 * UPLOAD FILE TO STORAGE
 * Uploads PDF/file to Supabase storage (policy-documents bucket)
 * 
 * @param {File} file - File to upload
 * @param {string} documentId - UUID of document
 * @param {string} bucketName - Storage bucket name (default: 'policy-documents')
 * @returns {Object} { path, filename, publicUrl }
 */
export async function uploadDocumentFile(file, documentId, bucketName = 'policy-documents') {
  try {
    // Create unique filename
    const timestamp = new Date().getTime()
    const filename = `${documentId}_${timestamp}_${file.name}`
    const storagePath = `documents/${filename}`

    // Upload file
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(storagePath, file)

    if (uploadError) throw uploadError

    // Get public URL (this may be empty if bucket is private)
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(storagePath)

    return {
      path: storagePath,
      filename: file.name,
      originalFilename: file.name,
      mimeType: file.type,
      fileSize: file.size,
      publicUrl: urlData?.publicUrl || null,
    }
  } catch (error) {
    console.error('Error uploading file:', error)
    throw error
  }
}

/**
 * GET SIGNED URL
 * Creates temporary signed URL for private document access
 * Valid for 1 hour by default
 * 
 * @param {string} storagePath - Path to file in storage
 * @param {number} expiresIn - Seconds until URL expires (default: 3600 = 1 hour)
 * @param {string} bucketName - Storage bucket name
 * @returns {Object} { signedUrl, expiresAt }
 */
export async function getSignedUrl(storagePath, expiresIn = 3600, bucketName = 'policy-documents') {
  try {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(storagePath, expiresIn)

    if (error) throw error

    return {
      signedUrl: data.signedUrl,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    }
  } catch (error) {
    console.error('Error getting signed URL:', error)
    throw error
  }
}

/**
 * RESTORE DOCUMENT
 * Brings an archived document back to published
 *
 * @param {string} documentId - UUID of document
 * @param {string} userId - UUID of restorer
 * @returns {Object} Updated document
 */
export async function restoreDocument(documentId, userId) {
  try {
    const { data, error } = await supabase
      .from('documents')
      .update({
        status: DOCUMENT_STATUS.PUBLISHED,
        archived_at: null,
        archived_by: null,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId)
      .select()
      .single()

    if (error) throw error

    await logDocumentAction(documentId, userId, 'restored', {})

    return data
  } catch (error) {
    console.error('Error restoring document:', error)
    throw error
  }
}

/**
 * CREATE NEW VERSION
 * Create a new version of a document by copying it
 * 
 * @param {string} documentId - UUID of document to version
 * @param {string} userId - UUID of user creating version
 * @returns {Object} New document version
 */
export async function createNewVersion(documentId, userId) {
  try {
    // Get original document
    const original = await getDocument(documentId)

    // Create new version data
    const newVersion = {
      ...original,
      id: undefined, // Let database generate new ID
      version: incrementVersion(original.version),
      parent_document_id: documentId,
      previous_version_id: documentId,
      is_current_version: true,
      status: DOCUMENT_STATUS.DRAFT,
      created_by: userId,
      uploaded_by: userId,
      updated_by: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    // Mark old version as not current
    await supabase
      .from('documents')
      .update({ is_current_version: false })
      .eq('id', documentId)

    // Create new version
    const { data, error } = await supabase
      .from('documents')
      .insert([newVersion])
      .select()
      .single()

    if (error) throw error

    // Log the action
    await logDocumentAction(documentId, userId, 'new_version_created', { newVersionId: data.id })

    return data
  } catch (error) {
    console.error('Error creating new version:', error)
    throw error
  }
}

/**
 * CREATE REVIEWED POLICY VERSION
 * Creates a new published policy version from review edits, then archives the previous version.
 *
 * @param {Object} sourceDocument - Existing current document row
 * @param {Object} options - { editedText, reviewFrequencyMonths }
 * @param {string} userId - UUID of user creating version
 * @returns {Object} { newDocument, archivedDocument }
 */
export async function createReviewedPolicyVersion(sourceDocument, options, userId) {
  try {
    if (!sourceDocument?.id) throw new Error('Source policy is required')

    const contentBlocks = Array.isArray(options?.contentBlocks) ? options.contentBlocks : null
    const editedText = contentBlocks ? blocksToPlainText(contentBlocks) : (options?.editedText || '').trim()
    if (!editedText) throw new Error('Policy content cannot be empty')

    const reviewFrequencyMonths = Number(options?.reviewFrequencyMonths || sourceDocument.review_frequency_months || 12)
    if (!Number.isFinite(reviewFrequencyMonths) || reviewFrequencyMonths <= 0) {
      throw new Error('Review frequency must be a positive number of months')
    }

    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const nextReviewDate = calculateNextReviewDate(today, reviewFrequencyMonths)
    const feedbackOpenDate = calculateFeedbackOpenDate(nextReviewDate)
    const baseVersion = sourceDocument.version || '1.0'

    const reviewedPayload = normalizeReviewPayload({
      title: sourceDocument.title,
      description: sourceDocument.description || null,
      category: options?.category?.trim() || sourceDocument.category,
      licensing_criteria: options?.licensingCriteria?.trim() ?? sourceDocument.licensing_criteria ?? null,
      document_type: sourceDocument.document_type || 'policy',
      owner_id: sourceDocument.owner_id || null,
      storage_bucket: sourceDocument.storage_bucket || 'policy-documents',
      storage_path: sourceDocument.storage_path,
      original_filename: sourceDocument.original_filename || `${sourceDocument.title}.txt`,
      mime_type: sourceDocument.mime_type || 'text/plain',
      file_size: sourceDocument.file_size || null,
      version: incrementVersion(baseVersion),
      parent_document_id: sourceDocument.parent_document_id || null,
      previous_version_id: sourceDocument.id,
      is_current_version: true,
      status: DOCUMENT_STATUS.PUBLISHED,
      approved_date: new Date().toISOString(),
      approved_by: userId,
      effective_date: today,
      last_reviewed_date: today,
      next_review_date: nextReviewDate,
      review_feedback_opens_at: feedbackOpenDate,
      review_feedback_closes_at: nextReviewDate,
      review_frequency_months: reviewFrequencyMonths,
      policy_owner_id: sourceDocument.policy_owner_id || null,
      is_centre_specific: Boolean(sourceDocument.is_centre_specific),
      centre_scope: sourceDocument.centre_scope || null,
      uploaded_by: userId,
      created_by: userId,
      updated_by: userId,
      notes: sourceDocument.notes || null,
      extracted_text: editedText,
      content_blocks: contentBlocks,
      ai_processing_status: 'completed',
      ai_extracted_metadata: {
        source: 'policy-review-editor',
        previous_version_id: sourceDocument.id,
        reviewed_on: today,
      },
      processing_error: null,
    })

    const { data: newDocument, error: createError } = await supabase
      .from('documents')
      .insert([reviewedPayload])
      .select()
      .single()

    if (createError) throw createError

    const { data: archivedDocument, error: archiveError } = await supabase
      .from('documents')
      .update({
        status: DOCUMENT_STATUS.ARCHIVED,
        is_current_version: false,
        archived_at: new Date().toISOString(),
        archived_by: userId,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sourceDocument.id)
      .select()
      .single()

    if (archiveError) {
      // Best-effort cleanup to avoid leaving a duplicate current published document.
      await supabase
        .from('documents')
        .update({
          status: DOCUMENT_STATUS.ARCHIVED,
          is_current_version: false,
          archived_at: new Date().toISOString(),
          archived_by: userId,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', newDocument.id)
      throw archiveError
    }

    await logDocumentAction(sourceDocument.id, userId, 'superseded_by_review', {
      newVersionId: newDocument.id,
      oldVersion: sourceDocument.version || null,
      newVersion: newDocument.version || null,
    })

    await logDocumentAction(newDocument.id, userId, 'created_from_review', {
      previousVersionId: sourceDocument.id,
      previousVersion: sourceDocument.version || null,
    })

    return {
      newDocument,
      archivedDocument,
    }
  } catch (error) {
    console.error('Error creating reviewed policy version:', error)
    throw error
  }
}

/**
 * HELPER: Increment version number
 * Converts 1.0 → 1.1, 1.9 → 2.0, etc.
 */
function incrementVersion(currentVersion) {
  if (!currentVersion) return '1.0'
  const [major, minor] = currentVersion.split('.').map(Number)
  const newMinor = minor + 1
  if (newMinor >= 10) {
    return `${major + 1}.0`
  }
  return `${major}.${newMinor}`
}
