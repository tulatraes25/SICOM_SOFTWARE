# Libro Digital de Visitas — v1.1.0

## Objetivo

Crear un libro digital por ascensor que registre cronológicamente visitas, mantenimientos, reclamos, inspecciones, emergencias, verificaciones y documentos vinculados.

## Estructura

### Tablas creadas

| Tabla | Descripción |
|-------|-------------|
| `elevator_visit_entries` | Asientos del libro (uno por visita) |
| `elevator_visit_numbering` | Secuencia de numeración por ascensor |

### Columna agregada

| Tabla | Columna | Tipo |
|-------|---------|------|
| `service_records` | `visit_entry_id` | UUID nullable → elevator_visit_entries(id) |

## Diferencia: Visita vs Registro

| Concepto | Descripción |
|----------|-------------|
| **Fecha de visita** | Fecha real en que se realizó el trabajo |
| **Fecha de registro** | Fecha y hora en que se cargó en el sistema |

Ejemplo:
- Visita realizada: 14/07/2026
- Registrada: 15/07/2026 08:42

## Numeración por ascensor

Cada ascensor numerar sus asientos desde 1:
- ASC-0001: Asiento 1, 2, 3...
- ASC-0002: Asiento 1, 2...

La numeración es segura (RPC con FOR UPDATE).

## Tipos de asiento

| Tipo | Descripción |
|------|-------------|
| `scheduled_service` | Servicio programado |
| `preventive_maintenance` | Mantenimiento preventivo |
| `corrective_maintenance` | Mantenimiento correctivo |
| `claim_visit` | Visita por reclamo |
| `inspection` | Inspección |
| `emergency` | Emergencia |
| `verification` | Verificación |
| `other` | Otro |

## Estados

| Estado | Descripción |
|--------|-------------|
| `draft` | Borrador |
| `submitted` | Enviado a revisión |
| `approved` | Aprobado |
| `rectified` | Rectificado (original conservado) |
| `cancelled` | Anulado |

## RPCs

| RPC | Permisos | Descripción |
|-----|----------|-------------|
| `create_elevator_visit_entry()` | admin, supervisor, technician | Crea asiento con número automático |
| `submit_elevator_visit_entry()` | admin, supervisor, technician | Envía a revisión |
| `approve_elevator_visit_entry()` | admin, supervisor | Aprueba asiento |
| `rectify_elevator_visit_entry()` | admin, supervisor | Rectifica (conserva original) |
| `cancel_elevator_visit_entry()` | admin, supervisor | Anula con motivo |
| `create_visit_entry_from_service_record()` | admin, supervisor | Crea asiento desde mantenimiento aprobado |

## Rectificación

No se editan asientos aprobados. La rectificación:
1. Marca original como `rectified`
2. Crea nuevo asiento con número siguiente
3. Referencia el original en `rectifies_entry_id`
4. Registra motivo y campos corregidos

## Creación automática desde mantenimiento

Cuando un `service_record` pasa a `approved`, se puede crear un asiento del libro usando `create_visit_entry_from_service_record()`. Evita duplicados mediante `UNIQUE(service_record_id)`.

## RLS

| Tabla | Admin | Supervisor | Technician | Responsible |
|-------|-------|------------|------------|-------------|
| `elevator_visit_entries` | ALL | ALL | SELECT propios, INSERT draft | Sin acceso |
| `elevator_visit_numbering` | ALL | ALL | SELECT | Sin acceso |

## Interfaz

| Ruta | Página |
|------|--------|
| `/admin/ascensores/:elevatorId/libro` | ElevatorVisitBookPage |
| `/admin/ascensores/:elevatorId/libro/nuevo` | VisitEntryCreatePage |
| `/admin/ascensores/:elevatorId/libro/:entryId` | VisitEntryDetailPage |

## Archivos creados

- `supabase/migrations/029_elevator_visit_book.sql`
- `src/services/elevatorVisitBook.service.ts`
- `src/pages/admin/ElevatorVisitBookPage.tsx`
- `src/pages/admin/VisitEntryDetailPage.tsx`
- `src/pages/admin/VisitEntryCreatePage.tsx`
- `src/components/pdf/VisitBookPDF.tsx`
- `src/test/elevatorVisitBook.test.ts`
- `docs/LIBRO_DIGITAL_VISITAS_v1.1.0.md`

## Archivos modificados

- `src/types/database.ts` — ElevatorVisitEntry, types, labels
- `src/config/constants.ts` — rutas del libro
- `src/router/AppRouter.tsx` — rutas protegidas

## Procedimiento de aplicación

```bash
# Aplicar migración en Supabase SQL Editor
# Archivo: supabase/migrations/029_elevator_visit_book.sql
```

## No ejecutar automáticamente

La migración 029 debe aplicarse manualmente.
