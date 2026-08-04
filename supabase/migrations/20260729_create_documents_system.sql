-- ============================================================
-- FUTURE FOCUS KNOWLEDGE CENTRE - DOCUMENTS SYSTEM
-- Stage 2: Database Schema & Row Level Security
-- ============================================================

-- ============================================================
-- CREATE DOCUMENTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Document identity & metadata
  title text NOT NULL,
  slug text,
  description text,
  category text NOT NULL,
  document_type text NOT NULL DEFAULT 'policy',
  
  -- Ownership & access
  owner_id uuid,
  storage_bucket text NOT NULL DEFAULT 'policy-documents',
  storage_path text NOT NULL,
  original_filename text NOT NULL,
  mime_type text,
  file_size bigint,
  
  -- Versioning
  version text NOT NULL DEFAULT '1.0',
  parent_document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  previous_version_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  is_current_version boolean NOT NULL DEFAULT true,
  
  -- Status & workflow
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'published', 'archived')),
  approved_date timestamptz,
  approved_by uuid,
  
  -- Review tracking
  last_reviewed_date date,
  next_review_date date,
  review_frequency_months integer,
  effective_date date,
  
  -- Upload & audit trail
  uploaded_by uuid NOT NULL,
  created_by uuid NOT NULL,
  updated_by uuid,
  notes text,
  
  -- AI processing (preparation for future)
  extracted_text text,
  ai_processing_status text NOT NULL DEFAULT 'not_processed' CHECK (ai_processing_status IN ('not_processed', 'processing', 'completed', 'failed')),
  ai_extracted_metadata jsonb DEFAULT '{}'::jsonb,
  processing_error text,
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  archived_by uuid,
  
  CONSTRAINT valid_current_version CHECK (
    (is_current_version = true AND status IN ('published', 'archived')) OR
    (is_current_version = false)
  )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_documents_status ON public.documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_category ON public.documents(category);
CREATE INDEX IF NOT EXISTS idx_documents_next_review_date ON public.documents(next_review_date);
CREATE INDEX IF NOT EXISTS idx_documents_owner_id ON public.documents(owner_id);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON public.documents(created_at);
CREATE INDEX IF NOT EXISTS idx_documents_is_current_version ON public.documents(is_current_version);
CREATE INDEX IF NOT EXISTS idx_documents_parent_document_id ON public.documents(parent_document_id);

-- ============================================================
-- CREATE DOCUMENT AUDIT LOG TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.document_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_document_id ON public.document_audit_log(document_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON public.document_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.document_audit_log(created_at);

-- ============================================================
-- AUTO-UPDATE updated_at TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_documents_updated_at ON public.documents;
CREATE TRIGGER trigger_documents_updated_at
BEFORE UPDATE ON public.documents
FOR EACH ROW
EXECUTE FUNCTION public.update_documents_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_audit_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "super_admin_select_documents" ON public.documents;
DROP POLICY IF EXISTS "super_admin_insert_documents" ON public.documents;
DROP POLICY IF EXISTS "super_admin_update_documents" ON public.documents;
DROP POLICY IF EXISTS "super_admin_delete_documents" ON public.documents;
DROP POLICY IF EXISTS "policy_admin_select_documents" ON public.documents;
DROP POLICY IF EXISTS "policy_admin_insert_documents" ON public.documents;
DROP POLICY IF EXISTS "policy_admin_update_documents" ON public.documents;
DROP POLICY IF EXISTS "centre_leader_select_published" ON public.documents;
DROP POLICY IF EXISTS "staff_select_published" ON public.documents;
DROP POLICY IF EXISTS "super_admin_audit_log" ON public.document_audit_log;
DROP POLICY IF EXISTS "policy_admin_audit_log" ON public.document_audit_log;

-- SUPER ADMIN: Full access to all documents
CREATE POLICY "super_admin_select_documents" ON public.documents
  FOR SELECT USING (
    (SELECT permission FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

CREATE POLICY "super_admin_insert_documents" ON public.documents
  FOR INSERT WITH CHECK (
    (SELECT permission FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

CREATE POLICY "super_admin_update_documents" ON public.documents
  FOR UPDATE USING (
    (SELECT permission FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  ) WITH CHECK (
    (SELECT permission FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

CREATE POLICY "super_admin_delete_documents" ON public.documents
  FOR DELETE USING (
    (SELECT permission FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

-- POLICY ADMIN: View all, edit drafts/pending, create versions
CREATE POLICY "policy_admin_select_documents" ON public.documents
  FOR SELECT USING (
    (SELECT permission FROM public.profiles WHERE id = auth.uid()) = 'policy_admin'
  );

CREATE POLICY "policy_admin_insert_documents" ON public.documents
  FOR INSERT WITH CHECK (
    (SELECT permission FROM public.profiles WHERE id = auth.uid()) = 'policy_admin'
  );

CREATE POLICY "policy_admin_update_documents" ON public.documents
  FOR UPDATE USING (
    (SELECT permission FROM public.profiles WHERE id = auth.uid()) = 'policy_admin'
    AND status IN ('draft', 'pending_approval')
  ) WITH CHECK (
    (SELECT permission FROM public.profiles WHERE id = auth.uid()) = 'policy_admin'
    AND status IN ('draft', 'pending_approval')
  );

-- CENTRE LEADER & STAFF: View only published current versions
CREATE POLICY "centre_leader_select_published" ON public.documents
  FOR SELECT USING (
    (SELECT permission FROM public.profiles WHERE id = auth.uid()) IN ('centre_leader', 'staff')
    AND status = 'published'
    AND is_current_version = true
  );

-- AUDIT LOG: Only admins can read
CREATE POLICY "super_admin_audit_log" ON public.document_audit_log
  FOR SELECT USING (
    (SELECT permission FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

CREATE POLICY "policy_admin_audit_log" ON public.document_audit_log
  FOR SELECT USING (
    (SELECT permission FROM public.profiles WHERE id = auth.uid()) = 'policy_admin'
  );

-- AUDIT LOG: Insert for all actions (trigger will set user_id)
CREATE POLICY "anyone_can_insert_audit" ON public.document_audit_log
  FOR INSERT WITH CHECK (true);

-- ============================================================
-- AUDIT TRIGGER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION public.log_document_action()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.document_audit_log (document_id, user_id, action, details)
  VALUES (
    COALESCE(NEW.id, OLD.id),
    auth.uid(),
    TG_ARGV[0],
    jsonb_build_object(
      'title', COALESCE(NEW.title, OLD.title),
      'status', COALESCE(NEW.status, OLD.status),
      'version', COALESCE(NEW.version, OLD.version)
    )
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger for document creation
DROP TRIGGER IF EXISTS trigger_log_document_created ON public.documents;
CREATE TRIGGER trigger_log_document_created
AFTER INSERT ON public.documents
FOR EACH ROW
EXECUTE FUNCTION public.log_document_action('created');

-- Trigger for document updates
DROP TRIGGER IF EXISTS trigger_log_document_updated ON public.documents;
CREATE TRIGGER trigger_log_document_updated
AFTER UPDATE ON public.documents
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.version IS DISTINCT FROM NEW.version)
EXECUTE FUNCTION public.log_document_action('updated');

-- ============================================================
-- GRANT PERMISSIONS
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT SELECT, INSERT ON public.document_audit_log TO authenticated;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'documents_id_seq'
      AND c.relkind = 'S'
  ) THEN
    EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE public.documents_id_seq TO authenticated';
  END IF;
END
$$;

-- ============================================================
-- END MIGRATION
-- ============================================================
