# Instalación Desde Cero - SICOM Patagonia SRL

## Requisitos Previos

- Cuenta en Supabase (supabase.com)
- Cuenta en Vercel (vercel.com)
- Cuenta en Resend (resend.com)
- Cuenta en OpenAI (opcional, para IA)
- Dominio propio (opcional)

---

## Paso 1: Crear Proyecto Supabase

1. Ir a https://supabase.com
2. "New Project"
3. Nombre: `sicom-qr-ascensores`
4. Contraseña de BD: generar y guardar
5. Región: South America (São Paulo)
6. Esperar creación

---

## Paso 2: Ejecutar Migraciones

1. Ir a **SQL Editor**
2. Ejecutar en orden:

```sql
-- Copiar y pegar cada archivo en orden
-- supabase/migrations/001_initial_schema.sql
-- supabase/migrations/002_qr_scan_logs.sql
-- ... hasta 019
```

**Orden:** 001 → 002 → 003 → ... → 019

---

## Paso 3: Crear Buckets Storage

En **Storage → New Bucket**:

| Bucket | Público |
|--------|---------|
| `reports` | Sí |
| `service-photos` | No |

---

## Paso 4: Configurar Secrets

En **Edge Functions → Secrets**:

| Secret | Valor |
|--------|-------|
| `OPENAI_API_KEY` | sk-... (opcional) |
| `RESEND_API_KEY` | re_... |
| `AI_MODEL` | gpt-4.1-mini |

---

## Paso 5: Desplegar Edge Functions

```bash
npx supabase functions deploy generate-report --project-ref TU_PROJECT_ID
npx supabase functions deploy generate-pdf --project-ref TU_PROJECT_ID
npx supabase functions deploy send-report-email --project-ref TU_PROJECT_ID
```

---

## Paso 6: Configurar Resend

1. Ir a https://resend.com
2. Agregar dominio: `sicompatagonia.com`
3. Verificar registros DNS (DKIM, SPF, MX)
4. Esperar verificación

---

## Paso 7: Deploy Vercel

1. Ir a https://vercel.com
2. "Add New" → "Project"
3. Importar repositorio `SICOM_SOFTWARE`
4. Framework: **Vite**
5. Variables de entorno:

```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_PUBLIC_APP_URL=https://sicompatagonia.com
```

6. Deploy

---

## Paso 8: Verificaciones

| Verificación | Comando/Acción |
|--------------|----------------|
| Login funciona | Abrir /login, ingresar credenciales |
| QR funciona | Escanear QR de un ascensor |
| Técnico carga servicio | Login técnico → Buscar → Cargar |
| Supervisor revisa | Login supervisor → Aprobar |
| PDF se genera | Descargar desde detalle aprobado |
| Correo se envía | Enviar desde detalle aprobado |
| Responsable ve historial | Login responsable → Ver ascensores |

---

## Troubleshooting

| Problema | Solución |
|----------|----------|
| Login falla | Verificar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY |
| QR no abre | Verificar VITE_PUBLIC_APP_URL y vercel.json |
| PDF no genera | Verificar que @react-pdf/renderer está instalado |
| Correo no llega | Verificar RESEND_API_KEY y dominio verificado |
| IA no funciona | Verificar OPENAI_API_KEY o usar mock |
| Imágenes no cargan | Verificar que están en public/images/sicom/ |
