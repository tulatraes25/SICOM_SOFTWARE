# Reclamos Vinculados al Expediente — v1.1.0

## Migración

`038_claims_module.sql`

## Tablas

| Tabla | Descripción |
|-------|-------------|
| `claims` | Reclamo principal |
| `claim_events` | Historial de eventos |
| `technician_notification_sends` | Envíos de notificación a técnico |
| `elevator_visit_entries.claim_id` | Vinculación con libro de visitas |

## Estados

```
open → assigned → in_progress → visited → resolved → closed
  ↘      ↘          ↘            ↘
  cancelled  cancelled  cancelled  cancelled
```

## RPCs

| RPC | Permisos |
|-----|----------|
| `create_claim()` | admin, supervisor |
| `assign_claim_technician()` | admin, supervisor |
| `start_claim_work()` | admin, supervisor, technician (asignado) |
| `resolve_claim()` | admin, supervisor, technician |
| `close_claim()` | admin, supervisor |
| `cancel_claim()` | admin, supervisor |

## Archivos creados

- `supabase/migrations/038_claims_module.sql`
- `src/services/claims.service.ts`
- `src/pages/admin/ClaimsPage.tsx`
- `src/pages/admin/ClaimCreatePage.tsx`
- `src/pages/admin/ClaimDetailPage.tsx`
- `src/components/pdf/ClaimReceiptPDF.tsx`
- `supabase/functions/send-technician-assignment-email/index.ts`

## SQL manual

```sql
-- Ejecutar en Supabase SQL Editor:
-- supabase/migrations/038_claims_module.sql
```
