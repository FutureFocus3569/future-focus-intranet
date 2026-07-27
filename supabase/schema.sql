-- ============================================================
-- Future Focus Staff Portal — Supabase Setup
-- Run this in your Supabase project → SQL Editor → New Query
-- ============================================================

-- 1. Create the profiles table
CREATE TABLE public.profiles (
  id          UUID        REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  first_name  TEXT        NOT NULL,
  last_name   TEXT        NOT NULL,
  mobile      TEXT,
  centre      TEXT,
  role_title  TEXT,
  permission  TEXT        NOT NULL DEFAULT 'staff'
                          CHECK (permission IN ('super_admin', 'centre_leader', 'staff')),
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 2. Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Helper: get the calling user's permission level
CREATE OR REPLACE FUNCTION public.my_permission()
RETURNS TEXT LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT permission FROM public.profiles WHERE id = auth.uid()
$$;

-- Helper: get the calling user's centre
CREATE OR REPLACE FUNCTION public.my_centre()
RETURNS TEXT LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT centre FROM public.profiles WHERE id = auth.uid()
$$;

-- Policy: everyone can read their own profile
CREATE POLICY "own_profile_read" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Policy: super_admin can read all profiles
CREATE POLICY "admin_read_all" ON public.profiles
  FOR SELECT USING (public.my_permission() = 'super_admin');

-- Policy: centre_leader can read profiles at their centre
CREATE POLICY "leader_read_centre" ON public.profiles
  FOR SELECT USING (
    public.my_permission() = 'centre_leader'
    AND centre = public.my_centre()
  );

-- Policy: everyone can update their own profile (name, mobile etc.)
CREATE POLICY "own_profile_update" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Policy: service role bypasses RLS (used by Edge Functions — automatic in Supabase)
