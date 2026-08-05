-- The previous centre-scoping migration (20260814_documents_centre_scoping)
-- dropped and recreated "centre_leader_select_published" as expected, but
-- staff could still see every document (including drafts and archived
-- ones), proving an additional, undocumented SELECT policy exists on this
-- table in the live database that was never captured in any migration file
-- (this project has a history of ad-hoc changes made directly via the SQL
-- editor -- see the licensing_criteria column and the events_created_by
-- foreign key from earlier work).
--
-- Rather than guess at that policy's name, drop every existing policy on
-- public.documents dynamically and recreate a fully known set: the original
-- super_admin/policy_admin policies, unchanged, plus the corrected
-- centre-scoped staff/centre_leader SELECT policy.
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'documents'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.documents', pol.policyname);
  END LOOP;
END $$;

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

-- CENTRE LEADER & STAFF: view only published current versions, and only if
-- the document is company-wide or scoped to their own centre.
CREATE POLICY "centre_leader_select_published" ON public.documents
  FOR SELECT USING (
    (SELECT permission FROM public.profiles WHERE id = auth.uid()) IN ('centre_leader', 'staff')
    AND status = 'published'
    AND is_current_version = true
    AND (
      is_centre_specific IS NOT TRUE
      OR centre_scope = (SELECT centre FROM public.profiles WHERE id = auth.uid())
    )
  );
