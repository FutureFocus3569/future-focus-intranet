-- Wellbeing follow-up tracking for centre leaders and super admins
CREATE TABLE IF NOT EXISTS wellbeing_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checkin_id UUID NOT NULL UNIQUE REFERENCES wellbeing_checkins(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  centre_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'closed')),
  notes TEXT,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE wellbeing_followups ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_wellbeing_followups_checkin_id ON wellbeing_followups(checkin_id);
CREATE INDEX IF NOT EXISTS idx_wellbeing_followups_centre_name ON wellbeing_followups(centre_name);
CREATE INDEX IF NOT EXISTS idx_wellbeing_followups_status ON wellbeing_followups(status);

CREATE OR REPLACE FUNCTION set_wellbeing_followups_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wellbeing_followups_updated_at ON wellbeing_followups;
CREATE TRIGGER trg_wellbeing_followups_updated_at
BEFORE UPDATE ON wellbeing_followups
FOR EACH ROW
EXECUTE FUNCTION set_wellbeing_followups_updated_at();

CREATE POLICY "Centre leaders and super admins can read followups"
  ON wellbeing_followups
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND (
          profiles.permission = 'super_admin'
          OR (profiles.permission = 'centre_leader' AND profiles.centre = wellbeing_followups.centre_name)
        )
    )
  );

CREATE POLICY "Centre leaders and super admins can insert followups"
  ON wellbeing_followups
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND (
          profiles.permission = 'super_admin'
          OR (profiles.permission = 'centre_leader' AND profiles.centre = wellbeing_followups.centre_name)
        )
    )
  );

CREATE POLICY "Centre leaders and super admins can update followups"
  ON wellbeing_followups
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND (
          profiles.permission = 'super_admin'
          OR (profiles.permission = 'centre_leader' AND profiles.centre = wellbeing_followups.centre_name)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND (
          profiles.permission = 'super_admin'
          OR (profiles.permission = 'centre_leader' AND profiles.centre = wellbeing_followups.centre_name)
        )
    )
  );
