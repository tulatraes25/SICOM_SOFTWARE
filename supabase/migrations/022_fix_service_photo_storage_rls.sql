-- =====================================================
-- SICOM Patagonia SRL - Fix Storage RLS para fotos
-- Versión: 1.0.22
-- Fecha: 2026-07-13
-- =====================================================
-- Corrige políticas de storage.objects para bucket service-photos.
-- La ruta es: service-records/{serviceRecordId}/{uuid}.{ext}
-- El serviceRecordId está en el SEGMENTO 2, no en el 1.
-- =====================================================

-- Eliminar políticas anteriores
DROP POLICY IF EXISTS "technician_select_own_photos_storage" ON storage.objects;
DROP POLICY IF EXISTS "technician_insert_own_photos_draft" ON storage.objects;
DROP POLICY IF EXISTS "technician_delete_own_photos_draft" ON storage.objects;

-- TECHNICIAN SELECT: Ver fotos de sus propios registros
CREATE POLICY "technician_select_own_photos_storage"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'service-photos'
  AND (string_to_array(storage.objects.name, '/'))[1] = 'service-records'
  AND EXISTS (
    SELECT 1 FROM service_records sr
    WHERE sr.id = (string_to_array(storage.objects.name, '/'))[2]::uuid
    AND sr.technician_id = auth.uid()
  )
);

-- TECHNICIAN INSERT: Subir solo en draft/rejected
-- Path: service-records/{serviceRecordId}/{uuid}.{ext}
CREATE POLICY "technician_insert_own_photos_draft"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'service-photos'
  AND (string_to_array(storage.objects.name, '/'))[1] = 'service-records'
  AND EXISTS (
    SELECT 1 FROM service_records sr
    WHERE sr.id = (string_to_array(storage.objects.name, '/'))[2]::uuid
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
  AND (string_to_array(storage.objects.name, '/'))[1] = 'service-records'
  AND EXISTS (
    SELECT 1 FROM service_records sr
    WHERE sr.id = (string_to_array(storage.objects.name, '/'))[2]::uuid
    AND sr.technician_id = auth.uid()
    AND sr.status IN ('draft', 'rejected')
  )
);
