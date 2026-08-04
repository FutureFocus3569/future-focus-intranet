-- One-time reset for today's wellbeing check-in for Courtney Everest.
-- This keeps the normal one-check-in-per-day behavior for everyone.
DO $$
DECLARE
  target_user UUID;
BEGIN
  SELECT id
  INTO target_user
  FROM profiles
  WHERE lower(first_name) = 'courtney'
    AND lower(last_name) = 'everest'
  LIMIT 1;

  IF target_user IS NOT NULL THEN
    DELETE FROM wellbeing_checkins
    WHERE user_id = target_user
      AND DATE(created_at) = CURRENT_DATE;
  END IF;
END $$;