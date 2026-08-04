ALTER TABLE IF EXISTS post_comments ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON TABLE post_comments TO authenticated;

DROP POLICY IF EXISTS "Post comments readable by authenticated" ON post_comments;
CREATE POLICY "Post comments readable by authenticated"
  ON post_comments
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Post comments insert by owner" ON post_comments;
CREATE POLICY "Post comments insert by owner"
  ON post_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);