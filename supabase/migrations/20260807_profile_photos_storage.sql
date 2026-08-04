-- Create a dedicated public bucket for staff profile photos.
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-photos', 'profile-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Authenticated users can upload their own profile photo files.
DROP POLICY IF EXISTS "Profile photos insert own" ON storage.objects;
CREATE POLICY "Profile photos insert own"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-photos'
  AND name LIKE ('profiles/' || auth.uid()::text || '-%')
);

-- Authenticated users can replace their own profile photo files.
DROP POLICY IF EXISTS "Profile photos update own" ON storage.objects;
CREATE POLICY "Profile photos update own"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-photos'
  AND name LIKE ('profiles/' || auth.uid()::text || '-%')
)
WITH CHECK (
  bucket_id = 'profile-photos'
  AND name LIKE ('profiles/' || auth.uid()::text || '-%')
);

-- Authenticated users can delete their own profile photo files.
DROP POLICY IF EXISTS "Profile photos delete own" ON storage.objects;
CREATE POLICY "Profile photos delete own"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-photos'
  AND name LIKE ('profiles/' || auth.uid()::text || '-%')
);
