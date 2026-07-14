# Membrete Institucional y Firmas Electrónicas — v1.1.0

## Alcance

Crear estructura reutilizable para membrete institucional y firma electrónica mediante imagen en documentos PDF.

**No es firma digital certificada.** Es una firma electrónica representada mediante imagen.

## Estructura

### Tablas creadas

| Tabla | Descripción |
|-------|-------------|
| `company_document_settings` | Configuración institucional (singleton) |
| `user_signatures` | Firmas de usuarios |
| `document_signatures` | Snapshot histórico de firmas en documentos |

### Bucket

| Bucket | Privado | Tamaño | Formatos |
|--------|---------|--------|----------|
| `user-signatures` | Sí | 2 MB | PNG, JPEG |

## Configuración institucional

Campos iniciales:
- company_name: SICOM Patagonia SRL
- phone: +54 297 421-4430
- website: https://sicompatagonia.com/
- email, legal_name, tax_id, address: null (pendientes)

## Firmas de usuarios

### Tipos

| Tipo | Uso |
|------|-----|
| `technician` | Técnico que realiza trabajos |
| `administrator` | Administrador que aprueba |
| `supervisor` | Supervisor que revisa |
| `representative` | Representante legal |

### Reglas

- Una sola firma activa por usuario y tipo
- Reemplazo revoca la anterior
- No borrar firmas utilizadas en documentos
- PNG con fondo transparente preferido

## Snapshot histórico

Cuando un documento se firma, `document_signatures` guarda:
- user_id del firmante
- role del firmante
- reference a la firma activa
- storage_path de la firma
- nombre del firmante
- fecha de firma

Si el usuario reemplaza su firma, documentos anteriores conservan la referencia.

## RPCs

| RPC | Permisos | Descripción |
|-----|----------|-------------|
| `sign_document()` | authenticated | Registra firma en documento |
| `get_document_settings()` | authenticated | Lee configuración |
| `update_document_settings()` | admin | Actualiza configuración |

## Componentes PDF reutilizables

| Componente | Ubicación | Descripción |
|------------|-----------|-------------|
| `DocumentHeader` | `src/components/pdf/common/` | Membrete con logo y datos |
| `DocumentFooter` | `src/components/pdf/common/` | Pie con datos y paginación |
| `DocumentSignatureBlock` | `src/components/pdf/common/` | Bloque de firmas |

## Interfaz

| Ruta | Página | Descripción |
|------|--------|-------------|
| `/perfil/firma` | UserSignaturePage | Gestionar firma personal |
| `/admin/configuracion/documentos` | DocumentSettingsPage | Configurar datos institucionales |

## RLS

| Tabla | Admin | Supervisor | Technician | Responsible |
|-------|-------|------------|------------|-------------|
| `company_document_settings` | SELECT, UPDATE | SELECT | SELECT | SELECT |
| `user_signatures` | ALL (admin) | SELECT propio | SELECT propio, INSERT propio | Sin acceso |
| `document_signatures` | SELECT | SELECT | SELECT propios | Sin acceso |

## Archivos creados

- `supabase/migrations/030_document_branding_and_signatures.sql`
- `src/services/documentSettings.service.ts`
- `src/services/userSignatures.service.ts`
- `src/services/documentSignatures.service.ts`
- `src/components/pdf/common/DocumentHeader.tsx`
- `src/components/pdf/common/DocumentFooter.tsx`
- `src/components/pdf/common/DocumentSignatureBlock.tsx`
- `src/pages/admin/UserSignaturePage.tsx`
- `src/pages/admin/DocumentSettingsPage.tsx`
- `src/test/documentBranding.test.ts`
- `docs/MEMBRETE_Y_FIRMAS_v1.1.0.md`

## Archivos modificados

- `src/types/database.ts` — CompanyDocumentSettings, UserSignature, DocumentSignature
- `src/config/constants.ts` — rutas ADMIN_DOCUMENT_SETTINGS, ADMIN_USER_SIGNATURE
- `src/router/AppRouter.tsx` — rutas protegidas

## Procedimiento de aplicación

```sql
-- Ejecutar en Supabase SQL Editor:
-- supabase/migrations/030_document_branding_and_signatures.sql
```

## No ejecutar automáticamente

La migración 030 debe aplicarse manualmente.
