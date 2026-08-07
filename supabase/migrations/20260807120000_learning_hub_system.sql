-- ============================================================
-- FUTURE FOCUS LEARNING HUB (Pataka Matauranga)
-- Phase 1: Core schema, future-proofed for later phases
-- (interactive video timeline, full question-type set, badges,
-- certificates, reporting -- tables exist now so later phases
-- are additive, not a redesign)
-- ============================================================

-- ============================================================
-- BADGES (created first so learning_courses can reference it)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.learning_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  icon text,
  criteria_type text NOT NULL DEFAULT 'course_completion'
    CHECK (criteria_type IN ('course_completion', 'points_threshold', 'streak', 'collection', 'manual')),
  criteria_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- COURSES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.learning_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  title text NOT NULL,
  slug text,
  description text,
  short_description text,
  thumbnail_url text,
  banner_url text,

  category text NOT NULL DEFAULT 'general',
  tags text[] NOT NULL DEFAULT '{}',
  difficulty text NOT NULL DEFAULT 'beginner'
    CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  duration_minutes integer,

  is_required boolean NOT NULL DEFAULT false,
  points_awarded integer NOT NULL DEFAULT 10,
  pd_hours numeric(5,2) NOT NULL DEFAULT 0,
  passing_score integer NOT NULL DEFAULT 80,
  max_attempts integer,
  certificate_enabled boolean NOT NULL DEFAULT false,
  badge_id uuid REFERENCES public.learning_badges(id) ON DELETE SET NULL,

  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  version text NOT NULL DEFAULT '1.0',
  publish_at timestamptz,
  expiry_date date,

  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_learning_courses_status ON public.learning_courses(status);
CREATE INDEX IF NOT EXISTS idx_learning_courses_category ON public.learning_courses(category);
CREATE INDEX IF NOT EXISTS idx_learning_courses_created_at ON public.learning_courses(created_at);

-- ============================================================
-- MODULES (course content, one row per content block)
-- content_type is deliberately an open text+CHECK, not an enum,
-- so a future content type is a one-line CHECK change, not a
-- schema migration.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.learning_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.learning_courses(id) ON DELETE CASCADE,

  title text NOT NULL,
  description text,
  content_type text NOT NULL
    CHECK (content_type IN ('video', 'pdf', 'slides', 'image', 'interactive_page', 'mixed', 'resource')),
  content_url text,
  content_body text,
  duration_minutes integer,
  sort_order integer NOT NULL DEFAULT 0,
  has_quiz boolean NOT NULL DEFAULT false,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learning_modules_course_id ON public.learning_modules(course_id);
CREATE INDEX IF NOT EXISTS idx_learning_modules_sort_order ON public.learning_modules(course_id, sort_order);

-- ============================================================
-- QUESTIONS
-- Full 13-type vocabulary supported from day one (options/
-- correct_answer are jsonb so new shapes don't need new columns);
-- Phase 1 UI only renders the first 5 types.
-- timestamp_seconds is reserved for Phase 4 in-video interactivity.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.learning_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.learning_modules(id) ON DELETE CASCADE,

  question_type text NOT NULL CHECK (question_type IN (
    'multiple_choice', 'multiple_select', 'true_false', 'drag_drop', 'matching',
    'order_steps', 'fill_blank', 'image_selection', 'hotspot', 'reflection_text',
    'short_answer', 'scenario', 'clickable_image'
  )),
  prompt text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_answer jsonb,
  explanation text,
  points integer NOT NULL DEFAULT 1,
  timestamp_seconds integer,
  sort_order integer NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learning_questions_module_id ON public.learning_questions(module_id);

-- ============================================================
-- ASSIGNMENTS (who a course is targeted at)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.learning_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.learning_courses(id) ON DELETE CASCADE,

  scope text NOT NULL CHECK (scope IN ('organisation', 'centre', 'role', 'staff', 'team', 'future_employees')),
  centre text,
  role text,
  staff_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  team_id uuid,

  due_date date,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learning_assignments_course_id ON public.learning_assignments(course_id);
CREATE INDEX IF NOT EXISTS idx_learning_assignments_staff_id ON public.learning_assignments(staff_id);
CREATE INDEX IF NOT EXISTS idx_learning_assignments_centre ON public.learning_assignments(centre);

-- ============================================================
-- ENROLLMENTS (one row per staff member per course -- the
-- "instance", same shape as appraisal_cycles)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.learning_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.learning_courses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  status text NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'in_progress', 'completed', 'overdue')),
  progress_percent integer NOT NULL DEFAULT 0,
  score integer,
  attempts integer NOT NULL DEFAULT 0,
  is_required boolean NOT NULL DEFAULT false,
  due_date date,
  is_favourite boolean NOT NULL DEFAULT false,

  started_at timestamptz,
  completed_at timestamptz,
  last_accessed_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (course_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_learning_enrollments_user_id ON public.learning_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_enrollments_course_id ON public.learning_enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_learning_enrollments_status ON public.learning_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_learning_enrollments_due_date ON public.learning_enrollments(due_date);

-- ============================================================
-- MODULE PROGRESS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.learning_module_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.learning_enrollments(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES public.learning_modules(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  status text NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'in_progress', 'completed')),
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  score integer,
  completed_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (enrollment_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_learning_module_progress_enrollment_id ON public.learning_module_progress(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_learning_module_progress_user_id ON public.learning_module_progress(user_id);

-- ============================================================
-- CERTIFICATES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.learning_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.learning_enrollments(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.learning_courses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  certificate_number text NOT NULL UNIQUE,
  pd_hours numeric(5,2) NOT NULL DEFAULT 0,
  storage_path text,
  issued_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learning_certificates_user_id ON public.learning_certificates(user_id);

-- ============================================================
-- ACHIEVEMENTS (badge earned by a user)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.learning_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_id uuid NOT NULL REFERENCES public.learning_badges(id) ON DELETE CASCADE,
  course_id uuid REFERENCES public.learning_courses(id) ON DELETE SET NULL,
  earned_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id, badge_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_learning_achievements_user_id ON public.learning_achievements(user_id);

-- ============================================================
-- ACTIVITY LOG (append-only ledger; points/streaks/PD-hour
-- totals are computed from this rather than stored redundantly,
-- so nothing can drift out of sync)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.learning_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  activity_type text NOT NULL
    CHECK (activity_type IN ('points', 'pd_hours', 'streak_day', 'course_completed', 'module_completed')),
  points integer NOT NULL DEFAULT 0,
  pd_hours numeric(5,2) NOT NULL DEFAULT 0,
  course_id uuid REFERENCES public.learning_courses(id) ON DELETE SET NULL,
  activity_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learning_activity_log_user_id ON public.learning_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_activity_log_activity_date ON public.learning_activity_log(user_id, activity_date);

-- ============================================================
-- updated_at trigger (shared across the tables that have it)
-- ============================================================
CREATE OR REPLACE FUNCTION public.learning_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_learning_courses_updated_at ON public.learning_courses;
CREATE TRIGGER trg_learning_courses_updated_at
BEFORE UPDATE ON public.learning_courses
FOR EACH ROW EXECUTE FUNCTION public.learning_set_updated_at();

DROP TRIGGER IF EXISTS trg_learning_modules_updated_at ON public.learning_modules;
CREATE TRIGGER trg_learning_modules_updated_at
BEFORE UPDATE ON public.learning_modules
FOR EACH ROW EXECUTE FUNCTION public.learning_set_updated_at();

DROP TRIGGER IF EXISTS trg_learning_enrollments_updated_at ON public.learning_enrollments;
CREATE TRIGGER trg_learning_enrollments_updated_at
BEFORE UPDATE ON public.learning_enrollments
FOR EACH ROW EXECUTE FUNCTION public.learning_set_updated_at();

DROP TRIGGER IF EXISTS trg_learning_module_progress_updated_at ON public.learning_module_progress;
CREATE TRIGGER trg_learning_module_progress_updated_at
BEFORE UPDATE ON public.learning_module_progress
FOR EACH ROW EXECUTE FUNCTION public.learning_set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.learning_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_module_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_activity_log ENABLE ROW LEVEL SECURITY;

-- ---- badges: readable by everyone signed in, managed by admins ----
CREATE POLICY "learning_badges_select" ON public.learning_badges
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "learning_badges_manage" ON public.learning_badges
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.permission IN ('super_admin', 'policy_admin'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.permission IN ('super_admin', 'policy_admin'))
  );

-- ---- courses: published readable by everyone signed in; full access for admins ----
CREATE POLICY "learning_courses_select_published" ON public.learning_courses
  FOR SELECT USING (status = 'published' AND auth.role() = 'authenticated');

CREATE POLICY "learning_courses_manage" ON public.learning_courses
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.permission IN ('super_admin', 'policy_admin'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.permission IN ('super_admin', 'policy_admin'))
  );

-- ---- modules & questions: readable if the parent course is readable; managed by admins ----
CREATE POLICY "learning_modules_select" ON public.learning_modules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.learning_courses c
      WHERE c.id = learning_modules.course_id
        AND (c.status = 'published' OR EXISTS (
          SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.permission IN ('super_admin', 'policy_admin')
        ))
    )
  );

CREATE POLICY "learning_modules_manage" ON public.learning_modules
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.permission IN ('super_admin', 'policy_admin'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.permission IN ('super_admin', 'policy_admin'))
  );

CREATE POLICY "learning_questions_select" ON public.learning_questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.learning_modules m
      JOIN public.learning_courses c ON c.id = m.course_id
      WHERE m.id = learning_questions.module_id
        AND (c.status = 'published' OR EXISTS (
          SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.permission IN ('super_admin', 'policy_admin')
        ))
    )
  );

CREATE POLICY "learning_questions_manage" ON public.learning_questions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.permission IN ('super_admin', 'policy_admin'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.permission IN ('super_admin', 'policy_admin'))
  );

-- ---- assignments: staff can see their own; centre leaders their centre's; admins everything ----
CREATE POLICY "learning_assignments_select" ON public.learning_assignments
  FOR SELECT USING (
    staff_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.permission IN ('super_admin', 'policy_admin')
          OR (p.permission = 'centre_leader' AND p.centre = learning_assignments.centre)
        )
    )
  );

CREATE POLICY "learning_assignments_manage" ON public.learning_assignments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.permission IN ('super_admin', 'policy_admin'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.permission IN ('super_admin', 'policy_admin'))
  );

-- ---- enrollments: staff manage their own; centre leaders read their centre; admins everything ----
CREATE POLICY "learning_enrollments_select_own" ON public.learning_enrollments
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.permission IN ('super_admin', 'policy_admin')
          OR (
            p.permission = 'centre_leader'
            AND EXISTS (
              SELECT 1 FROM public.profiles staff_p
              WHERE staff_p.id = learning_enrollments.user_id AND staff_p.centre = p.centre
            )
          )
        )
    )
  );

CREATE POLICY "learning_enrollments_insert_own" ON public.learning_enrollments
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.permission IN ('super_admin', 'policy_admin'))
  );

CREATE POLICY "learning_enrollments_update_own" ON public.learning_enrollments
  FOR UPDATE USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.permission IN ('super_admin', 'policy_admin'))
  ) WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.permission IN ('super_admin', 'policy_admin'))
  );

CREATE POLICY "learning_enrollments_delete_admin" ON public.learning_enrollments
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.permission IN ('super_admin', 'policy_admin'))
  );

-- ---- module progress: same shape as enrollments ----
CREATE POLICY "learning_module_progress_select_own" ON public.learning_module_progress
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.permission IN ('super_admin', 'policy_admin')
          OR (
            p.permission = 'centre_leader'
            AND EXISTS (
              SELECT 1 FROM public.profiles staff_p
              WHERE staff_p.id = learning_module_progress.user_id AND staff_p.centre = p.centre
            )
          )
        )
    )
  );

CREATE POLICY "learning_module_progress_insert_own" ON public.learning_module_progress
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.permission IN ('super_admin', 'policy_admin'))
  );

CREATE POLICY "learning_module_progress_update_own" ON public.learning_module_progress
  FOR UPDATE USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.permission IN ('super_admin', 'policy_admin'))
  ) WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.permission IN ('super_admin', 'policy_admin'))
  );

-- ---- certificates: staff read their own; admins everything; system (via authenticated user) inserts their own ----
CREATE POLICY "learning_certificates_select_own" ON public.learning_certificates
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.permission IN ('super_admin', 'policy_admin'))
  );

CREATE POLICY "learning_certificates_insert_own" ON public.learning_certificates
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.permission IN ('super_admin', 'policy_admin'))
  );

-- ---- achievements: staff read their own; admins everything; system inserts their own ----
CREATE POLICY "learning_achievements_select_own" ON public.learning_achievements
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.permission IN ('super_admin', 'policy_admin'))
  );

CREATE POLICY "learning_achievements_insert_own" ON public.learning_achievements
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.permission IN ('super_admin', 'policy_admin'))
  );

-- ---- activity log: staff read/write their own; admins read everything ----
CREATE POLICY "learning_activity_log_select_own" ON public.learning_activity_log
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.permission IN ('super_admin', 'policy_admin'))
  );

CREATE POLICY "learning_activity_log_insert_own" ON public.learning_activity_log
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.permission IN ('super_admin', 'policy_admin'))
  );
