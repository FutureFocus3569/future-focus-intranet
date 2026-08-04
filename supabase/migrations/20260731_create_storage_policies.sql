-- ============================================================
-- SUPABASE STORAGE POLICIES - policy-documents BUCKET
-- ============================================================
-- 
-- These policies must be created in the Supabase Dashboard:
-- Storage > policy-documents > Policies
--
-- OR run via Supabase CLI / SQL Editor
-- ============================================================

-- Enable Row Level Security on the bucket (best effort)
DO $$
BEGIN
  BEGIN
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Skipping ALTER TABLE storage.objects ENABLE RLS (insufficient privilege)';
  END;
END
$$;

-- ============================================================
-- UPLOAD POLICY: Only super_admin and policy_admin can upload
-- ============================================================

DO $$
BEGIN
  BEGIN
    DROP POLICY IF EXISTS "super_admin_policy_admin_upload" ON storage.objects;
    CREATE POLICY "super_admin_policy_admin_upload"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'policy-documents'
      AND (
        (SELECT permission FROM public.profiles WHERE id = auth.uid()) IN ('super_admin', 'policy_admin')
      )
    );
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Skipping storage upload policy migration (insufficient privilege)';
  END;
END
$$;

-- ============================================================
-- UPDATE POLICY: Only admins can replace files (new versions)
-- ============================================================

DO $$
BEGIN
  BEGIN
    DROP POLICY IF EXISTS "super_admin_policy_admin_update" ON storage.objects;
    CREATE POLICY "super_admin_policy_admin_update"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'policy-documents'
      AND (
        (SELECT permission FROM public.profiles WHERE id = auth.uid()) IN ('super_admin', 'policy_admin')
      )
    )
    WITH CHECK (
      bucket_id = 'policy-documents'
      AND (
        (SELECT permission FROM public.profiles WHERE id = auth.uid()) IN ('super_admin', 'policy_admin')
      )
    );
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Skipping storage update policy migration (insufficient privilege)';
  END;
END
$$;

-- ============================================================
-- DELETE POLICY: Only super_admin and policy_admin can delete
-- ============================================================

DO $$
BEGIN
  BEGIN
    DROP POLICY IF EXISTS "super_admin_policy_admin_delete" ON storage.objects;
    CREATE POLICY "super_admin_policy_admin_delete"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'policy-documents'
      AND (
        (SELECT permission FROM public.profiles WHERE id = auth.uid()) IN ('super_admin', 'policy_admin')
      )
    );
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Skipping storage delete policy migration (insufficient privilege)';
  END;
END
$$;

-- ============================================================
-- READ POLICY: Authenticated users can read if:
-- 1. Associated document is published (status = 'published'), OR
-- 2. User is super_admin or policy_admin
-- ============================================================

DO $$
BEGIN
  BEGIN
    DROP POLICY IF EXISTS "read_published_or_admin" ON storage.objects;
    CREATE POLICY "read_published_or_admin"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'policy-documents'
      AND (
        -- Super admin and policy admin can read all
        (SELECT permission FROM public.profiles WHERE id = auth.uid()) IN ('super_admin', 'policy_admin')
        OR
        -- Others can read if associated document is published
        (
          EXISTS (
            SELECT 1 FROM public.documents
            WHERE storage_path = storage.objects.name
            AND status = 'published'
            AND is_current_version = true
          )
        )
      )
    );
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Skipping storage read policy migration (insufficient privilege)';
  END;
END
$$;

-- ============================================================
-- No anonymous access
-- ============================================================
-- The bucket is private and only authenticated users matching
-- the policies above can access files. Unauthenticated users
-- cannot access any files in this bucket.

-- ============================================================
-- END STORAGE POLICIES
-- ============================================================
