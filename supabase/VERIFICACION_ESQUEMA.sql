-- =====================================================
-- VERIFICACIÓN DE ESQUEMA REMOTO - PRODUCCIÓN
-- Ejecutar en SQL Editor de Supabase (solo lectura)
-- =====================================================

-- 1. Verificar tablas principales
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- 2. Verificar columnas de service_records
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'service_records'
ORDER BY ordinal_position;

-- 3. Verificar si existen campos de IA
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'service_records' 
AND column_name IN ('ai_report_draft', 'final_report_text');

-- 4. Verificar políticas RLS de service_records
SELECT policyname, cmd, qual
FROM pg_policies 
WHERE tablename = 'service_records'
ORDER BY policyname;

-- 5. Verificar políticas de service_checklist_items
SELECT policyname, cmd
FROM pg_policies 
WHERE tablename = 'service_checklist_items';

-- 6. Verificar políticas de service_photos
SELECT policyname, cmd
FROM pg_policies 
WHERE tablename = 'service_photos';

-- 7. Verificar funciones RPC
SELECT routine_name, routine_type
FROM information_schema.routines 
WHERE routine_name IN (
  'get_public_elevator_by_token',
  'get_public_elevator_history_by_token',
  'register_public_qr_scan',
  'start_service_review',
  'save_review_report',
  'approve_service_record',
  'reject_service_record',
  'increment_services_count'
)
AND routine_type = 'FUNCTION';

-- 8. Verificar tablas de destinatarios
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_name = 'building_report_recipients'
) AS building_recipients_exists;

SELECT EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_name = 'service_report_sends'
) AS service_report_sends_exists;

-- 9. Verificar buckets de Storage
SELECT id, name, public FROM storage.buckets;

-- 10. Verificar políticas de Storage
SELECT policyname, cmd
FROM pg_policies 
WHERE tablename = 'objects'
AND qual LIKE '%service-photos%';

-- 11. Contar migraciones aplicadas (aproximado)
SELECT COUNT(*) as total_migrations
FROM supabase_migrations.schema_migrations;
