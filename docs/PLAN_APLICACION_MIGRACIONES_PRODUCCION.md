# Plan de Aplicación de Migraciones - Producción

**Fecha:** 14 de julio de 2026

---

## Resumen

| Total migraciones | Última | Acción manual |
|-------------------|--------|---------------|
| 21 | 020 | Ejecutar en SQL Editor |

---

## Orden de Ejecución

| # | Archivo | Descripción | Idempotente | Acción |
|---|---------|-------------|-------------|--------|
| 001 | initial_schema | Esquema completo | ✅ | Ejecutar |
| 002 | qr_scan_logs | Tabla escaneos | ✅ | Ejecutar |
| 003 | service_records_rls | RLS inicial | ✅ | Ejecutar |
| 004 | supervisor_review_fields | Campos revisión | ✅ | Ejecutar |
| 005 | reports_pdf_email | PDF y email | ✅ | Ejecutar |
| 006 | public_elevator_rpc | RPC pública QR | ✅ | Ejecutar |
| 007_fix | technician submit RLS | Fix RLS | ✅ | Ejecutar |
| 007_tech | technician records RLS | RLS técnico | ✅ | Ejecutar |
| 008 | admin supervisor review | RLS admin/supervisor | ✅ | Ejecutar |
| 009 | ai_report_fields | Campos IA | ✅ | Ejecutar |
| 010 | service_report_sends | Envíos | ✅ | Ejecutar |
| 011 | fix report recipients RLS | Fix destinatarios | ✅ | Ejecutar |
| 012 | building_report_recipients | Destinatarios edificio | ✅ | Ejecutar |
| 013 | public service history RPC | Historial público | ✅ | Ejecutar |
| 014 | harden service records | Endurecer RLS | ✅ | Ejecutar |
| 015 | fix service record permissions | Fix permisos | ✅ | Ejecutar |
| 016 | rpcs service review | RPCs revisión | ✅ | Ejecutar |
| 017 | lock service children | Bloquear checklist/fotos | ✅ | Ejecutar |
| 018 | harden service photos storage | Storage fotos | ✅ | Ejecutar |
| 019 | secure public qr rpc | RPCs públicas | ✅ | Ejecutar |
| 020 | remove supervisor direct update | Eliminar UPDATE supervisor | ✅ | Ejecutar |

---

## SQL de Verificación

```sql
-- 1. Verificar políticas service_records
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'service_records';

-- 2. Verificar RPCs
SELECT routine_name FROM information_schema.routines 
WHERE routine_name LIKE '%service%' AND routine_type = 'FUNCTION';

-- 3. Verificar tablas
SELECT tablename FROM pg_tables WHERE schemaname = 'public';

-- 4. Verificar buckets
SELECT id, name, public FROM storage.buckets;
```

---

## Orden Recomendado

Ejecutar en SQL Editor de Supabase:

```sql
-- Copiar y pegar cada migración en orden
-- 001 → 002 → 003 → ... → 020
```

**Todas las migraciones son idempotentes (DROP IF EXISTS).**

---

## Acción Manual Requerida

1. Ejecutar migraciones 001-020 en SQL Editor
2. Crear buckets en Storage
3. Configurar secrets en Edge Functions
4. Desplegar Edge Functions
