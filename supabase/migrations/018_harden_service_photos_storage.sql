-- =====================================================
-- SICOM Patagonia SRL - Endurecer Storage Fotos
-- Versión: 1.0.18
-- Fecha: 2026-07-13
-- =====================================================

-- =====================================================
-- POLÍTICAS PARA storage.objects (bucket service-photos)
-- =====================================================

-- Eliminar políticas existentes del bucket
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete" ON storage.objects;

-- TECHNICIAN SELECT: Ver fotos de sus propios registros
CREATE POLICY "technician_select_own_photos_storage"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'service-photos'
  AND EXISTS (
    SELECT 1 FROM service_records sr
    WHERE sr.id = (string_to_array(storage.objects.name, '/'))[1]::uuid
    AND sr.technician_id = auth.uid()
  )
);

-- TECHNICIAN INSERT: Subir solo en draft/rejected
CREATE POLICY "technician_insert_own_photos_draft"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'service-photos'
  AND (string_to_array(storage.objects.name, '/'))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (
    SELECT 1 FROM service_records sr
    WHERE sr.id = (string_to_array(storage.objects.name, '/'))[1]::uuid
    AND sr.technician_id = auth.uid()
    AND sr.status IN ('draft', 'rejected')
  )
);

-- TECHNICIAN DELETE: Eliminar solo en draft/rejected
CREATE POLICY "technician_delete_own_photos_draft"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'service-photos'
  AND EXISTS (
    SELECT 1 FROM service_records sr
    WHERE sr.id = (string_to_array(storage.objects.name, '/'))[1]::uuid
    AND sr.technician_id = auth.uid()
    AND sr.status IN ('draft', 'rejected')
  )
);

-- ADMIN: Gestión total
CREATE POLICY "admin_all_photos_storage"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'service-photos'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin' AND active = true
  )
);

-- SUPERVISOR: Solo SELECT
CREATE POLICY "supervisor_select_photos_storage"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'service-photos'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'supervisor' AND active = true
  )
);

-- =====================================================
-- FUNCIÓN HELPER: Validar service_record_id
-- =====================================================
CREATE OR REPLACE FUNCTION is_valid_service_record_id(path TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  parts TEXT[];
  record_id UUID;
BEGIN
  parts := string_to_array(path, '/');
  IF array_length(parts, 1) < 2 THEN
    RETURN FALSE;
  END IF;
  
  BEGIN
    record_id := parts[1]::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
  END;
  
  RETURN EXISTS (
    SELECT 1 FROM service_records WHERE id = record_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
