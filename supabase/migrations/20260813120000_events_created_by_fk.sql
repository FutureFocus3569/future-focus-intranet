-- Link events.created_by to profiles so the Calendar & Events page can show
-- who published each event (previously created_by was stored but never
-- joined/displayed). A constraint with this name already exists (likely
-- referencing auth.users, which PostgREST can't embed profile data
-- through) -- drop and recreate pointing at public.profiles.
ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_created_by_fkey;

ALTER TABLE public.events
  ADD CONSTRAINT events_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
