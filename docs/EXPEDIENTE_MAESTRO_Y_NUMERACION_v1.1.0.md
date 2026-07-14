# Expediente Maestro y Numeración — v1.1.0

## Finalidad

Crear la estructura central que permite vincular bajo un mismo número: presupuesto, reclamo, orden de servicio, visitas, informe técnico, fotografías, factura externa y correos enviados.

## Estructura

### Tablas creadas

| Tabla | Descripción |
|-------|-------------|
| `service_cases` | Entidad central: un expediente = un número único |
| `document_numbering_settings` | Configuración de numeración (fila única) |
| `service_case_events` | Historial de eventos del expediente |

### Columna agregada

| Tabla | Columna | Tipo |
|-------|---------|------|
| `service_records` | `service_case_id` | UUID nullable → service_cases(id) |

## Rangos de numeración

| Modo | Rango | Uso |
|------|-------|-----|
| `test` | 1900–1999 | Desarrollo y validación |
| `production` | 2000+ | Producción real |

## Prioridad de origen

1. **Presupuesto** → genera el número
2. **Reclamo** (si no hay presupuesto) → genera el número
3. **Informe directo** (si no hay presupuesto ni reclamo) → genera el número

El número identifica al **expediente completo**, no a cada documento individual.

## Modo pruebas

- Inicia en `test` con `next_test_number = 1900`
- Permite pruebas hasta 1999
- Se identifican visualmente como **PRUEBA**

## Activación productiva

- Acción explícita del admin
- Cambia a `production`
- Próximo número: 2000
- No se puede volver a test
- No se reinicia el contador

## RPCs

| RPC | Permisos | Descripción |
|-----|----------|-------------|
| `create_service_case()` | admin, supervisor | Crea expediente con número automático |
| `close_service_case()` | admin, supervisor | Cierra expediente |
| `cancel_service_case()` | admin, supervisor | Anula expediente (requiere motivo) |
| `activate_production_numbering()` | admin | Activa modo productivo |
| `get_numbering_settings()` | admin, supervisor | Consulta configuración |

## RLS

| Tabla | Admin | Supervisor | Technician | Responsible |
|-------|-------|------------|------------|-------------|
| `service_cases` | SELECT todo | SELECT todo | SELECT asignados | Sin acceso |
| `document_numbering_settings` | SELECT | SELECT | Sin acceso | Sin acceso |
| `service_case_events` | SELECT | SELECT | Sin acceso | Sin acceso |

## Interfaz administrativa

| Ruta | Página | Descripción |
|------|--------|-------------|
| `/admin/expedientes` | ServiceCasesPage | Listado con filtros |
| `/admin/expedientes/nuevo` | ServiceCaseCreatePage | Formulario de creación |
| `/admin/expedientes/:id` | ServiceCaseDetailPage | Detalle con historial |
| `/admin/configuracion/numeracion` | NumberingConfigPage | Configuración de numeración |

## Archivos creados/modificados

### Nuevos
- `supabase/migrations/028_service_cases_and_numbering.sql`
- `src/services/serviceCases.service.ts`
- `src/pages/admin/ServiceCasesPage.tsx`
- `src/pages/admin/ServiceCaseDetailPage.tsx`
- `src/pages/admin/ServiceCaseCreatePage.tsx`
- `src/pages/admin/NumberingConfigPage.tsx`
- `src/test/serviceCases.test.ts`
- `docs/EXPEDIENTE_MAESTRO_Y_NUMERACION_v1.1.0.md`

### Modificados
- `src/types/database.ts` — tipos ServiceCase, ServiceCaseEvent, DocumentNumberingSettings
- `src/config/constants.ts` — rutas ADMIN_SERVICE_CASES, ADMIN_NUMBERING_CONFIG
- `src/components/layout/Sidebar.tsx` — menú Expedientes
- `src/router/AppRouter.tsx` — rutas protegidas

## Procedimiento de aplicación

```bash
# 1. Aplicar migración en Supabase SQL Editor
# Archivo: supabase/migrations/028_service_cases_and_numbering.sql

# 2. Verificar tablas
SELECT * FROM document_numbering_settings;

# 3. Verificar que service_records tiene service_case_id
SELECT column_name FROM information_schema.columns
WHERE table_name = 'service_records' AND column_name = 'service_case_id';
```

## Rollback lógico

```sql
-- Para deshacer (no destruye datos existentes):
ALTER TABLE service_records DROP COLUMN IF EXISTS service_case_id;
DROP TABLE IF EXISTS service_case_events;
DROP TABLE IF EXISTS service_cases;
DROP TABLE IF EXISTS document_numbering_settings;
```

## Pruebas incluidas

- Primer expediente de prueba = 1900
- Segundo = 1901
- RPC correcta para crear, cerrar, anular
- Constants de origen y estado
- Formato de número con prefijo PRUEBA/N.º

## Nota

**No ejecutar la migración automáticamente.** Aplicar manualmente en Supabase SQL Editor.
