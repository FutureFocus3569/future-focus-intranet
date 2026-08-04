-- ============================================================
-- FUTURE FOCUS KNOWLEDGE CENTRE - DOCUMENTS SYSTEM (SIMPLIFIED)
-- Stage 2: Database Schema Only
-- ============================================================

-- CREATE DOCUMENTS TABLE
CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text NOT NULL,
  document_type text NOT NULL DEFAULT 'policy',
  owner_id uuid,
  storage_bucket text NOT NULL DEFAULT 'policy-documents',
  storage_path text NOT NULL,
  original_filename text NOT NULL,
  mime_type text,
  file_size bigint,
  version text NOT NULL DEFAULT '1.0',
  parent_document_id uuid,
  previous_version_id uuid,
  is_current_version boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'draft',
  approved_date timestamptz,
  approved_by uuid,
  last_reviewed_date date,
  next_review_date date,
  review_frequency_months integer,
  effective_date date,
  uploaded_by uuid NOT NULL,
  created_by uuid NOT NULL,
  updated_by uuid,
  notes text,
  extracted_text text,
  ai_processing_status text NOT NULL DEFAULT 'not_processed',
  ai_extracted_metadata jsonb DEFAULT '{}'::jsonb,
  processing_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  archived_by uuid
);

-- CREATE DOCUMENT AUDIT LOG TABLE
CREATE TABLE IF NOT EXISTS public.document_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL,
  user_id uuid NOT NULL,
  action text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- END MIGRATION
-- ============================================================
