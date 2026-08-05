-- Staff and centre leaders could see every published policy regardless of
-- which centre it was scoped to (is_centre_specific / centre_scope columns
-- already existed and are set correctly on upload, but were never enforced
-- on read). A West Dune staff member could see Livingstone Drive's
-- centre-specific "Accessing Information" policy, for example.
--
-- Replace the old policy with one that also allows company-wide documents
-- (is_centre_specific = false or null) plus centre-specific documents that
-- match the viewer's own centre. Super admin and policy admin are
-- unaffected -- they already have separate, unrestricted SELECT policies.
DROP POLICY IF EXISTS "centre_leader_select_published" ON public.documents;

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
