# Etapa 6: Supervisor, IA e Informes

## Objetivo

Implementar el flujo de revisión por supervisor, generación de informe técnico preliminar con asistencia IA, edición humana obligatoria, aprobación del informe y preparación del informe mensual.

---

## Referencia de Repositorios

### De sonic-elevator se tomó:
- **Flujo técnico → supervisor**: Revisión, aprobación, rechazo
- **Dashboard por rol**: Estadísticas y listados separados
- **Separación de estados**: submitted → in_review → approved/rejected

### De APPEL se tomó:
- **Service records**: Estructura de registros de servicio
- **Audit logging**: Registro de acciones
- **Trazabilidad**: Estados y cambios

### De ai-report-generator se tomó:
- **Prompt structure**: Técnico → formal
- **Manejo de datos faltantes**: "No informado" en lugar de inventar
- **Estructura de informe**: Título, datos, trabajos, observaciones, recomendaciones

### Se descartó:
- Python (usamos TypeScript en Edge Functions)
- WeasyPrint (PDF en Etapa 7)
- Flask API (no aplica)

---

## Módulos Implementados

### 1. Servicio de Supervisor (`src/services/supervisor.service.ts`)

**Funciones:**
- `listPendingServiceRecords()` - Registros pendientes
- `listApprovedServiceRecords()` - Aprobados recientes
- `getServiceRecordForReview(id)` - Detalle para revisión
- `markInReview(id)` - Marcar como en revisión
- `generateAIReportDraft(id)` - Generar con IA
- `saveSupervisorReportDraft(id, content)` - Guardar borrador
- `approveServiceRecord(id, report)` - Aprobar
- `rejectServiceRecord(id, reason)` - Rechazar
- `updateElevatorStatusFromApprovedService(id)` - Actualizar ascensor
- `createOrUpdateMonthlyReport(id)` - Crear informe mensual
- `getSupervisorStats()` - Estadísticas

### 2. Dashboard Supervisor (`/supervisor`)

**Muestra:**
- Estadísticas: Pendientes, En Revisión, Aprobados, Rechazados
- Listado de registros pendientes
- Acceso rápido a revisiones

### 3. Listado de Revisiones (`/supervisor/revisiones`)

**Tabs:**
- Pendientes (submitted, in_review, rejected)
- Aprobados

**Filtros:**
- Por estado

### 4. Vista de Revisión (`/supervisor/revisiones/:id`)

**Panel izquierdo:**
- Datos del ascensor
- Datos del servicio
- Checklist completo
- Descripción y observaciones
- Fotos

**Panel derecho:**
- Acciones (Marcar en revisión, Generar IA, Guardar, Aprobar, Rechazar)
- Editor de informe

### 5. Edge Function para IA (`supabase/functions/generate-report`)

**Flujo:**
1. Valida usuario autenticado (supervisor/admin)
2. Obtiene datos del servicio, ascensor, checklist
3. Construye prompt técnico
4. Llama a OpenAI API (o usa mock)
5. Devuelve informe formal

**Mock de desarrollo:**
- Sin OPENAI_API_KEY usa mock controlado
- Marcado claramente como "MOCK"
- No se usa en producción

### 6. Prompt IA

**Estructura del informe generado:**
1. Título
2. Datos generales
3. Fecha de intervención
4. Técnico interviniente
5. Trabajos realizados
6. Resultado del checklist
7. Observaciones
8. Estado informado
9. Recomendaciones
10. Cierre

**Reglas:**
- Tono técnico y formal
- No inventar datos faltantes
- Indicar "No informado" cuando falte info
- No agregar certificaciones no registradas

---

## Estados del Flujo

```
Técnico envía → submitted
     ↓
Supervisor marca → in_review
     ↓
Supervisor genera IA → informe guardado
     ↓
Supervisor edita → borrador actualizado
     ↓
Supervisor aprueba → approved
     ↓
Se actualiza ascensor
Se crea monthly_report
```

---

## Variables de Entorno

### Frontend (.env.local)
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

### Backend (Edge Functions)
```
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=... (opcional para mock)
AI_MODEL=gpt-4o-mini (opcional)
```

---

## RLS Implementado

- Supervisor puede ver registros submitted/in_review
- Supervisor puede actualizar registros en revisión
- Technician no puede aprobar
- Responsible solo ve registros approved
- Público no accede

---

## Cómo Probar

### 1. Login como Supervisor
1. Ir a `/login`
2. Credenciales de supervisor
3. Verificar acceso a `/supervisor`

### 2. Revisar Mantenimiento
1. Ir a "Revisiones"
2. Seleccionar registro submitted
3. Marcar como "En Revisión"
4. Generar informe con IA
5. Editar informe
6. Aprobar o rechazar

### 3. Probar Aprobación
1. Aprobar un registro
2. Verificar que el ascensor actualiza estado
3. Verificar que se crea monthly_report

### 4. Probar Rechazo
1. Rechazar con motivo
2. Verificar que el técnico puede ver el rechazo

---

## Migraciones

- `004_supervisor_review_fields.sql` - Campos adicionales para revisión

---

## Pendientes para Etapa 7

- Generación de PDF
- Envío de correos
- Envío a múltiples destinatarios
- Historial de envíos
- Confirmación de entrega

---

## Archivos Creados/Modificados

### Nuevos
- `src/services/supervisor.service.ts`
- `src/pages/supervisor/SupervisorDashboard.tsx`
- `src/pages/supervisor/PendingReviewsPage.tsx`
- `src/pages/supervisor/ServiceReviewPage.tsx`
- `supabase/functions/generate-report/index.ts`
- `supabase/migrations/004_supervisor_review_fields.sql`
- `docs/ETAPA_6_SUPERVISOR_IA_INFORMES.md`

### Modificados
- `src/components/layout/Sidebar.tsx`
- `src/router/AppRouter.tsx`
