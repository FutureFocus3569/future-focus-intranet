-- Private, per-staff-member saved logins for external Quick Link tools
-- (Storypark, Xero, etc). Passwords are stored encrypted (AES-GCM) by the
-- tool-credentials edge function, never in plaintext. RLS additionally
-- restricts every row to its own owner, so even a direct table query from
-- the app's anon key can only ever see the caller's own saved logins.

CREATE TABLE IF NOT EXISTS quick_link_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  link_key TEXT NOT NULL,
  username TEXT,
  password_encrypted TEXT,
  password_iv TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, link_key)
);

ALTER TABLE quick_link_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own quick link credentials" ON quick_link_credentials;
CREATE POLICY "Users manage their own quick link credentials"
  ON quick_link_credentials
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
