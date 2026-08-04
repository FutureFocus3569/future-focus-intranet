WITH ranked_checkins AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, DATE((created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Pacific/Auckland')
      ORDER BY created_at DESC, id DESC
    ) AS row_num
  FROM wellbeing_checkins
)
DELETE FROM wellbeing_checkins
WHERE id IN (
  SELECT id
  FROM ranked_checkins
  WHERE row_num > 1
);

DROP INDEX IF EXISTS idx_wellbeing_checkins_user_day;

CREATE UNIQUE INDEX IF NOT EXISTS idx_wellbeing_checkins_user_day
  ON wellbeing_checkins (
    user_id,
    (DATE((created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Pacific/Auckland'))
  );