-- =====================================================
-- SICOM Patagonia SRL - Eliminar UPDATE directo supervisor
-- Versión: 1.0.20
-- Fecha: 2026-07-14
-- =====================================================

-- Eliminar política general de UPDATE para supervisor
DROP POLICY IF EXISTS "supervisor_update_service_records" ON service_records;

-- NOTA: El supervisor ahora usa RPCs para modificar service_records:
-- - start_service_review
-- - save_review_report
-- - approve_service_record
-- - reject_service_record
