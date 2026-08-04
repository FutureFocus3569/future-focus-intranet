-- ============================================================
-- FUTURE FOCUS POLICY REVIEW WORKFLOW + CENTRE SCOPING
-- ============================================================

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS last_reviewed_date date,
  ADD COLUMN IF NOT EXISTS next_review_date date,
  ADD COLUMN IF NOT EXISTS review_feedback_opens_at date,
  ADD COLUMN IF NOT EXISTS review_feedback_closes_at date,
  ADD COLUMN IF NOT EXISTS review_frequency_months integer DEFAULT 12,
  ADD COLUMN IF NOT EXISTS review_status text DEFAULT 'not_due' CHECK (review_status IN ('not_due','upcoming','open_for_feedback','feedback_closed','drafting','pending_approval','completed')),
  ADD COLUMN IF NOT EXISTS policy_owner_id uuid,
  ADD COLUMN IF NOT EXISTS is_centre_specific boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS centre_scope text;

CREATE TABLE IF NOT EXISTS public.policy_review_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  opens_at timestamptz NOT NULL DEFAULT now(),
  closes_at timestamptz,
  due_date date,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','drafting','pending_approval','completed')),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  closed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  summary text
);

CREATE TABLE IF NOT EXISTS public.policy_review_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  review_cycle_id uuid REFERENCES public.policy_review_cycles(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  section_reference text,
  feedback text NOT NULL,
  suggested_wording text,
  works_in_practice boolean,
  visibility text NOT NULL DEFAULT 'private_to_admins' CHECK (visibility IN ('private_to_admins','staff_only','public')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('draft','submitted','withdrawn','reviewed','incorporated','not_incorporated')),
  admin_note text
);

CREATE INDEX IF NOT EXISTS idx_policy_review_cycles_document_id ON public.policy_review_cycles(document_id);
CREATE INDEX IF NOT EXISTS idx_policy_review_feedback_document_id ON public.policy_review_feedback(document_id);
CREATE INDEX IF NOT EXISTS idx_policy_review_feedback_user_id ON public.policy_review_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_policy_review_feedback_cycle_id ON public.policy_review_feedback(review_cycle_id);

ALTER TABLE public.policy_review_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_review_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS policy_review_cycles_select_all ON public.policy_review_cycles;
DROP POLICY IF EXISTS policy_review_cycles_insert_admin ON public.policy_review_cycles;
DROP POLICY IF EXISTS policy_review_cycles_update_admin ON public.policy_review_cycles;
DROP POLICY IF EXISTS policy_review_feedback_select_staff_own ON public.policy_review_feedback;
DROP POLICY IF EXISTS policy_review_feedback_insert_staff_own ON public.policy_review_feedback;
DROP POLICY IF EXISTS policy_review_feedback_update_staff_own ON public.policy_review_feedback;
DROP POLICY IF EXISTS policy_review_feedback_admin_select ON public.policy_review_feedback;
DROP POLICY IF EXISTS policy_review_feedback_admin_update ON public.policy_review_feedback;

CREATE POLICY policy_review_cycles_select_all ON public.policy_review_cycles
  FOR SELECT USING (
    (SELECT permission FROM public.profiles WHERE id = auth.uid()) IN ('super_admin','policy_admin')
  );

CREATE POLICY policy_review_cycles_insert_admin ON public.policy_review_cycles
  FOR INSERT WITH CHECK (
    (SELECT permission FROM public.profiles WHERE id = auth.uid()) IN ('super_admin','policy_admin')
  );

CREATE POLICY policy_review_cycles_update_admin ON public.policy_review_cycles
  FOR UPDATE USING (
    (SELECT permission FROM public.profiles WHERE id = auth.uid()) IN ('super_admin','policy_admin')
  );

CREATE POLICY policy_review_feedback_select_staff_own ON public.policy_review_feedback
  FOR SELECT USING (
    user_id = auth.uid()
    OR (SELECT permission FROM public.profiles WHERE id = auth.uid()) IN ('super_admin','policy_admin')
  );

CREATE POLICY policy_review_feedback_insert_staff_own ON public.policy_review_feedback
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
  );

CREATE POLICY policy_review_feedback_update_staff_own ON public.policy_review_feedback
  FOR UPDATE USING (
    user_id = auth.uid()
    AND (SELECT permission FROM public.profiles WHERE id = auth.uid()) NOT IN ('super_admin','policy_admin')
  );

CREATE POLICY policy_review_feedback_admin_select ON public.policy_review_feedback
  FOR SELECT USING (
    (SELECT permission FROM public.profiles WHERE id = auth.uid()) IN ('super_admin','policy_admin')
  );

CREATE POLICY policy_review_feedback_admin_update ON public.policy_review_feedback
  FOR UPDATE USING (
    (SELECT permission FROM public.profiles WHERE id = auth.uid()) IN ('super_admin','policy_admin')
  );

GRANT SELECT, INSERT, UPDATE ON public.policy_review_cycles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.policy_review_feedback TO authenticated;
