-- Dedicated public bucket for Learning Hub content (videos, PDFs,
-- slides, images, downloadable resources, thumbnails/banners).
INSERT INTO storage.buckets (id, name, public)
VALUES ('learning-media', 'learning-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Only super admins and policy admins (the course-authoring roles)
-- can upload, replace, or remove Learning Hub content.
DROP POLICY IF EXISTS "Learning media insert by admins" ON storage.objects;
CREATE POLICY "Learning media insert by admins"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'learning-media'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.permission IN ('super_admin', 'policy_admin')
  )
);

DROP POLICY IF EXISTS "Learning media update by admins" ON storage.objects;
CREATE POLICY "Learning media update by admins"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'learning-media'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.permission IN ('super_admin', 'policy_admin')
  )
)
WITH CHECK (
  bucket_id = 'learning-media'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.permission IN ('super_admin', 'policy_admin')
  )
);

DROP POLICY IF EXISTS "Learning media delete by admins" ON storage.objects;
CREATE POLICY "Learning media delete by admins"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'learning-media'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.permission IN ('super_admin', 'policy_admin')
  )
);
