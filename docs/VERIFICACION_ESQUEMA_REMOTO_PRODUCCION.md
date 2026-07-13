# Verificación de Esquema Remoto - Producción

**Fecha:** 14 de julio de 2026

---

## Consultas de Verificación

Ejecutar en **Supabase SQL Editor** antes de aplicar 021:

### 1. Tablas principales
```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
```

### 2. Columnas de service_records
```sql
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'service_records' ORDER BY ordinal_position;
```

### 3. Campos de IA
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'service_records' 
AND column_name IN ('ai_report_draft', 'final_report_text');
```

### 4. Funciones RPC
```sql
SELECT routine_name FROM information_schema.routines 
WHERE routine_name IN (
  'get_public_elevator_by_token',
  'get_public_elevator_history_by_token',
  'register_public_qr_scan',
  'start_service_review',
  'save_review_report',
  'approve_service_record',
  'reject_service_record'
) AND routine_type = 'FUNCTION';
```

### 5. Tablas nuevas
```sql
SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'building_report_recipients') AS exists;
SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'service_report_sends') AS exists;
```

### 6. Buckets
```sql
SELECT id, name, public FROM storage.buckets;
```

---

## Matriz de Verificación

| Objeto | Estado Esperado | Consulta | Estado Remoto | Acción |
|--------|-----------------|----------|---------------|--------|
| service_records.ai_report_draft | Existe | `SELECT column_name...` | Verificar | ADD COLUMN IF NOT EXISTS |
| service_records.final_report_text | Existe | `SELECT column_name...` | Verificar | ADD COLUMN IF NOT EXISTS |
| building_report_recipients | Existe | `SELECT...tables...` | Verificar | CREATE TABLE IF NOT EXISTS |
| service_report_sends | Existe | `SELECT...tables...` | Verificar | CREATE TABLE IF NOT EXISTS |
| get_public_elevator_by_token | Existe | `SELECT...routines...` | Verificar | CREATE OR REPLACE |
| start_service_review | Existe | `SELECT...routines...` | Verificar | CREATE OR REPLACE |
| approve_service_record | Existe | `SELECT...routines...` | Verificar | CREATE OR REPLACE |
| supervisor_update_service_records | No existe | `SELECT...policies...` | Verificar | DROP POLICY |
| bucket service-photos | Existe | `SELECT...buckets...` | Verificar | Crear si falta |

---

## Orden de Verificación

1. Ejecutar consultas de verificación
2. Documentar estado remoto en la columna "Estado Remoto"
3. Ejecutar solo las secciones de 021 que correspondan a objetos faltantes
4. Verificar después de ejecutar
