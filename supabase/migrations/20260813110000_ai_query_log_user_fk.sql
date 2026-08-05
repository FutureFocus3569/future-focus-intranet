-- Link ai_query_log.user_id to profiles so the admin Query Log view can
-- show who asked each question (previously only the question text and
-- timestamp were shown, with no way to identify the staff member).
ALTER TABLE public.ai_query_log
  DROP CONSTRAINT IF EXISTS ai_query_log_user_id_fkey;

ALTER TABLE public.ai_query_log
  ADD CONSTRAINT ai_query_log_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
