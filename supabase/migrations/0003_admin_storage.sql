-- ORBIT — باکت تصاویر ادمین + پالیسی‌های Storage (idempotent)

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('admin-uploads', 'admin-uploads', true, 2097152, ARRAY['image/jpeg','image/png','image/webp','image/avif'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 2097152, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "admin_uploads_read" ON storage.objects;
CREATE POLICY "admin_uploads_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'admin-uploads');

DROP POLICY IF EXISTS "admin_uploads_write" ON storage.objects;
CREATE POLICY "admin_uploads_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'admin-uploads' AND public.is_admin());

DROP POLICY IF EXISTS "admin_uploads_delete" ON storage.objects;
CREATE POLICY "admin_uploads_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'admin-uploads' AND public.is_admin());
