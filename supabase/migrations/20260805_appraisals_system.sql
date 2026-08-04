-- Appraisal templates (role-based)
CREATE TABLE IF NOT EXISTS appraisal_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  role_scope TEXT NOT NULL CHECK (role_scope IN ('staff', 'centre_leader', 'all_roles')),
  description TEXT,
  template_schema JSONB NOT NULL DEFAULT '{"sections":[]}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Appraisal cycles/assignments
CREATE TABLE IF NOT EXISTS appraisal_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES appraisal_templates(id) ON DELETE RESTRICT,
  staff_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'assigned' CHECK (
    status IN (
      'draft',
      'assigned',
      'self_submitted',
      'manager_in_progress',
      'review_360_open',
      'review_360_closed',
      'meeting_completed',
      'signed_off',
      'archived'
    )
  ),
  self_due_at DATE,
  manager_due_at DATE,
  review_360_opens_at DATE,
  review_360_closes_at DATE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Self and manager responses
CREATE TABLE IF NOT EXISTS appraisal_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES appraisal_cycles(id) ON DELETE CASCADE,
  responder_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  response_type TEXT NOT NULL CHECK (response_type IN ('self', 'manager')),
  responses JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (cycle_id, response_type)
);

-- Ongoing notes across cycle
CREATE TABLE IF NOT EXISTS appraisal_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES appraisal_cycles(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  visibility TEXT NOT NULL DEFAULT 'manager_only' CHECK (visibility IN ('manager_only', 'shared_with_staff')),
  note_text TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 360 feedback entries
CREATE TABLE IF NOT EXISTS appraisal_feedback_360 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES appraisal_cycles(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  feedback JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (cycle_id, reviewer_id)
);

CREATE INDEX IF NOT EXISTS idx_appraisal_templates_role_scope ON appraisal_templates(role_scope);
CREATE INDEX IF NOT EXISTS idx_appraisal_cycles_staff_id ON appraisal_cycles(staff_id);
CREATE INDEX IF NOT EXISTS idx_appraisal_cycles_reviewer_id ON appraisal_cycles(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_appraisal_cycles_status ON appraisal_cycles(status);
CREATE INDEX IF NOT EXISTS idx_appraisal_responses_cycle_id ON appraisal_responses(cycle_id);
CREATE INDEX IF NOT EXISTS idx_appraisal_notes_cycle_id ON appraisal_notes(cycle_id);
CREATE INDEX IF NOT EXISTS idx_appraisal_feedback_360_cycle_id ON appraisal_feedback_360(cycle_id);

ALTER TABLE appraisal_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE appraisal_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE appraisal_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE appraisal_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE appraisal_feedback_360 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Appraisal templates readable by authenticated" ON appraisal_templates;
DROP POLICY IF EXISTS "Appraisal templates editable by super admin" ON appraisal_templates;
DROP POLICY IF EXISTS "Appraisal cycles readable by participants" ON appraisal_cycles;
DROP POLICY IF EXISTS "Appraisal cycles manageable by super admin" ON appraisal_cycles;
DROP POLICY IF EXISTS "Appraisal responses readable by participants" ON appraisal_responses;
DROP POLICY IF EXISTS "Appraisal self responses writable by appraisee" ON appraisal_responses;
DROP POLICY IF EXISTS "Appraisal manager responses writable by reviewer" ON appraisal_responses;
DROP POLICY IF EXISTS "Appraisal responses writable by super admin" ON appraisal_responses;
DROP POLICY IF EXISTS "Appraisal notes readable by participants" ON appraisal_notes;
DROP POLICY IF EXISTS "Appraisal notes writable by manager or super admin" ON appraisal_notes;
DROP POLICY IF EXISTS "Appraisal notes writable by appraisee shared only" ON appraisal_notes;
DROP POLICY IF EXISTS "360 feedback readable by manager and super admin" ON appraisal_feedback_360;
DROP POLICY IF EXISTS "360 feedback writable by staff participants" ON appraisal_feedback_360;

CREATE POLICY "Appraisal templates readable by authenticated"
  ON appraisal_templates
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Appraisal templates editable by super admin"
  ON appraisal_templates
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.permission = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.permission = 'super_admin'
    )
  );

CREATE POLICY "Appraisal cycles readable by participants"
  ON appraisal_cycles
  FOR SELECT
  USING (
    auth.uid() = staff_id
    OR auth.uid() = reviewer_id
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.permission = 'super_admin'
    )
  );

CREATE POLICY "Appraisal cycles manageable by super admin"
  ON appraisal_cycles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.permission = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.permission = 'super_admin'
    )
  );

CREATE POLICY "Appraisal responses readable by participants"
  ON appraisal_responses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM appraisal_cycles c
      WHERE c.id = appraisal_responses.cycle_id
      AND (
        c.staff_id = auth.uid()
        OR c.reviewer_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid() AND p.permission = 'super_admin'
        )
      )
    )
  );

CREATE POLICY "Appraisal self responses writable by appraisee"
  ON appraisal_responses
  FOR INSERT
  WITH CHECK (
    response_type = 'self'
    AND responder_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM appraisal_cycles c
      WHERE c.id = appraisal_responses.cycle_id
      AND c.staff_id = auth.uid()
    )
  );

CREATE POLICY "Appraisal manager responses writable by reviewer"
  ON appraisal_responses
  FOR INSERT
  WITH CHECK (
    response_type = 'manager'
    AND responder_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM appraisal_cycles c
      WHERE c.id = appraisal_responses.cycle_id
      AND c.reviewer_id = auth.uid()
    )
  );

CREATE POLICY "Appraisal responses writable by super admin"
  ON appraisal_responses
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.permission = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.permission = 'super_admin'
    )
  );

CREATE POLICY "Appraisal notes readable by participants"
  ON appraisal_notes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM appraisal_cycles c
      WHERE c.id = appraisal_notes.cycle_id
      AND (
        c.reviewer_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid() AND p.permission = 'super_admin'
        )
        OR (
          c.staff_id = auth.uid()
          AND appraisal_notes.visibility = 'shared_with_staff'
        )
      )
    )
  );

CREATE POLICY "Appraisal notes writable by manager or super admin"
  ON appraisal_notes
  FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM appraisal_cycles c
      WHERE c.id = appraisal_notes.cycle_id
      AND (
        c.reviewer_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid() AND p.permission = 'super_admin'
        )
      )
    )
  );

CREATE POLICY "Appraisal notes writable by appraisee shared only"
  ON appraisal_notes
  FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND visibility = 'shared_with_staff'
    AND EXISTS (
      SELECT 1
      FROM appraisal_cycles c
      WHERE c.id = appraisal_notes.cycle_id
      AND c.staff_id = auth.uid()
    )
  );

CREATE POLICY "360 feedback readable by manager and super admin"
  ON appraisal_feedback_360
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM appraisal_cycles c
      WHERE c.id = appraisal_feedback_360.cycle_id
      AND (
        c.reviewer_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid() AND p.permission = 'super_admin'
        )
      )
    )
  );

CREATE POLICY "360 feedback writable by staff participants"
  ON appraisal_feedback_360
  FOR INSERT
  WITH CHECK (
    reviewer_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM appraisal_cycles c
      WHERE c.id = appraisal_feedback_360.cycle_id
      AND c.staff_id <> auth.uid()
    )
  );

INSERT INTO appraisal_templates (
  title,
  role_scope,
  description,
  template_schema,
  created_by,
  updated_by
)
SELECT
  'Centre Leader Appraisal (Draft)',
  'centre_leader',
  'Initial template scaffold pending final framework wording.',
  '{
    "sections": [
      {
        "title": "Leadership and Culture",
        "questions": [
          {"id":"q1","prompt":"How effectively did you lead your team this cycle?"},
          {"id":"q2","prompt":"What actions strengthened centre culture and wellbeing?"}
        ]
      },
      {
        "title": "Teaching and Pedagogy",
        "questions": [
          {"id":"q3","prompt":"How did you support curriculum quality and learning outcomes?"},
          {"id":"q4","prompt":"What evidence demonstrates impact for tamariki and whanau?"}
        ]
      },
      {
        "title": "Operations and Compliance",
        "questions": [
          {"id":"q5","prompt":"How well were operational standards and compliance maintained?"},
          {"id":"q6","prompt":"What risks were identified and how were they managed?"}
        ]
      },
      {
        "title": "Growth and Next Steps",
        "questions": [
          {"id":"q7","prompt":"What are your top development priorities for the next period?"},
          {"id":"q8","prompt":"What support is needed from your reviewer and organisation?"}
        ]
      }
    ]
  }'::jsonb,
  auth.uid(),
  auth.uid()
WHERE NOT EXISTS (
  SELECT 1 FROM appraisal_templates t
  WHERE t.title = 'Centre Leader Appraisal (Draft)'
);
