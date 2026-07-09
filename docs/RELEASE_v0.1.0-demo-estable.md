# Release v0.1.0-demo-estable

**Fecha:** 9 de julio de 2026

**Estado:** Demo funcional estable

---

## Funcionalidades Incluidas

### Autenticación y Roles
- Login con Supabase Auth
- Roles: admin, technician, supervisor, responsible
- Protección de rutas por rol

### Administración
- CRUD de Clientes
- CRUD de Edificios
- CRUD de Ascensores
- Gestión de destinatarios de informes
- Dashboard con contadores reales
- Revisión de mantenimientos enviados

### QR y Vista Pública
- Generación de QR por ascensor
- Vista pública sin login: `/s/ascensor/{token}`
- Pantalla institucional SICOM Patagonia SRL
- Estado operativo y de conservación visibles
- Último mantenimiento aprobado visible
- Registro de escaneos

### Técnico
- Búsqueda de ascensores
- Carga de mantenimientos
- Checklist de 10 items
- Guardar borrador
- Editar mantenimiento
- Enviar a revisión
- Vista de detalle con checklist

### Supervisor/Admin
- Listado de mantenimientos pendientes
- Revisión de detalle completo
- Aprobación de mantenimientos
- Rechazo con motivo
- Actualización de estado del ascensor al aprobar

### IA (Asistencia)
- Edge Function `generate-report` desplegada
- Modelo: `gpt-4.1-mini-2025-04-14`
- Generación de borrador formal editable
- Prompt optimizado para informes técnicos

### PDF
- Generación con `@react-pdf/renderer`
- Logo real de SICOM Patagonia SRL
- Datos del equipo correctos
- Informe técnico incluido
- Checklist incluido
- Estado de aprobación
- Pie institucional

---

## Servicios Externos Requeridos

| Servicio | Uso | Configuración |
|----------|-----|---------------|
| Supabase | Auth, DB, Storage, Edge Functions | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| Vercel | Hosting frontend | Variables de entorno en Vercel |
| OpenAI | Generación de informes IA | Secret `OPENAI_API_KEY` en Supabase |

---

## Migraciones Aplicadas

| # | Archivo | Descripción |
|---|---------|-------------|
| 001 | `001_initial_schema.sql` | Esquema completo de tablas |
| 002 | `002_qr_scan_logs.sql` | Tabla de escaneos QR |
| 003 | `003_service_records_rls.sql` | RLS para technician |
| 004 | `004_supervisor_review_fields.sql` | Campos de revisión |
| 005 | `005_reports_pdf_email.sql` | PDF y envío de correos |
| 006 | `006_public_elevator_rpc.sql` | RPC para vista pública QR |
| 007 | `007_technician_records_rls.sql` | RLS para técnico |
| 008 | `008_admin_supervisor_review_rls.sql` | RLS para admin/supervisor |
| 009 | `009_ai_report_fields.sql` | Campos de IA |

---

## Edge Functions Desplegadas

| Función | Estado | Descripción |
|---------|--------|-------------|
| `generate-report` | ✅ Desplegada | Generación de informe con IA |

---

## Variables de Entorno

### Frontend (Vercel)
```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_PUBLIC_APP_URL
```

### Backend (Supabase Edge Functions Secrets)
```
OPENAI_API_KEY
```

---

## Limitaciones Conocidas

- No envío automático de email a destinatarios
- No módulo de usuarios completo (CRUD)
- No facturación ni cuenta corriente
- No informe mensual agrupado
- No firma digital
- No app nativa Android/iOS
- No modo offline
- No dashboard avanzado con gráficos
- No integración con organismos oficiales

---

## Próximo Bloque Sugerido

**Envío de PDF por correo a destinatarios registrados.**

Incluye:
- Edge Function `send-report-email` funcional
- Envío con Resend
- PDF adjuntado
- Registro de envíos en `report_sends`
- Múltiples destinatarios por ascensor

---

## Commits Incluidos

```
2903e76 chore: force vercel redeploy after pdf logo fix
51189df fix: prevent logo from breaking pdf export
dcb024a chore: force vercel redeploy after PDF logo fix
e8d125b fix: add SICOM logo to service report pdf
ff02568 fix: pdf equipment manufacturer model source
fe295f6 fix: improve approved service report pdf content
68d8a4b fix: disambiguate generate report technician relation
a7b999b feat: add AI assisted report draft
f0699fc feat: generate approved service record pdf
d9e3798 feat: add admin service review workflow
7d6874c fix: allow technician submit service record
8e58fbf fix: technician edit and submit service record flow
3aeba5c fix: disambiguate service record profile relations
c7d1ae5 fix: technician service record detail
931e9ac chore: force vercel redeploy after technician search fix
1f9acad fix: technician elevator search query
cf7c566 fix: update SICOM visual assets and company name
efb15a1 fix: correct public QR elevator URL
dbe097b fix: add vercel SPA rewrites
44ee85a docs: Datos demo completos para SICOM
9e9f1b1 fix: Estados, correo multi-proveedor IA, validación PDF
64ee326 feat: Sistema SICOM Patagonia Ascensores - v1.0
```
