-- 027: Restrict service-photos bucket to JPEG only
-- Idempotent: safe to run multiple times

UPDATE storage.buckets
SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg']
WHERE id = 'service-photos';

-- Verify
DO $$
BEGIN
  RAISE NOTICE 'Bucket service-photos updated: allowed_mime_types = [image/jpeg], file_size_limit = 10MB';
END $$;
