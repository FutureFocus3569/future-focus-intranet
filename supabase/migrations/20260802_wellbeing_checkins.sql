-- Wellbeing Check-in Table
CREATE TABLE IF NOT EXISTS wellbeing_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  centre_name TEXT NOT NULL,
  mood TEXT NOT NULL CHECK (mood IN ('very_sad', 'sad', 'neutral', 'happy', 'very_happy')),
  comment TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Normalize created_at to timestamp without timezone for deterministic day index.
ALTER TABLE wellbeing_checkins
  ALTER COLUMN created_at TYPE TIMESTAMP
  USING created_at AT TIME ZONE 'UTC';

-- One check-in per user per day (expression index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_wellbeing_checkins_user_day
  ON wellbeing_checkins (user_id, (DATE(created_at)));

-- Enable RLS
ALTER TABLE wellbeing_checkins ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_wellbeing_checkins_user_id ON wellbeing_checkins(user_id);
CREATE INDEX IF NOT EXISTS idx_wellbeing_checkins_centre_name ON wellbeing_checkins(centre_name);
CREATE INDEX IF NOT EXISTS idx_wellbeing_checkins_created_at ON wellbeing_checkins(created_at);

-- RLS Policies
DROP POLICY IF EXISTS "Users can see their own wellbeing check-ins" ON wellbeing_checkins;
DROP POLICY IF EXISTS "Users can create their own wellbeing check-ins" ON wellbeing_checkins;
DROP POLICY IF EXISTS "Centre leaders can see their centre's wellbeing check-ins" ON wellbeing_checkins;
DROP POLICY IF EXISTS "Super admins can see all wellbeing check-ins" ON wellbeing_checkins;

-- Staff can see only their own check-ins
CREATE POLICY "Users can see their own wellbeing check-ins"
  ON wellbeing_checkins
  FOR SELECT
  USING (auth.uid() = user_id);

-- Staff can create their own check-ins
CREATE POLICY "Users can create their own wellbeing check-ins"
  ON wellbeing_checkins
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Centre leaders can see their centre's check-ins
CREATE POLICY "Centre leaders can see their centre's wellbeing check-ins"
  ON wellbeing_checkins
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.permission IN ('centre_leader', 'super_admin')
      AND (
        profiles.permission = 'super_admin'
        OR (profiles.permission = 'centre_leader' AND profiles.centre = wellbeing_checkins.centre_name)
      )
    )
  );

-- Super admins can see all check-ins
CREATE POLICY "Super admins can see all wellbeing check-ins"
  ON wellbeing_checkins
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.permission = 'super_admin'
    )
  );
