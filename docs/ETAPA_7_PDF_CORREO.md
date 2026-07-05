# Etapa 7: PDF Profesional y Envío de Correos (Actualizado)

## Estado Actual del PDF

### ✅ PDF REAL IMPLEMENTADO

**Implementación:** `@react-pdf/renderer` v4.x

**Cómo funciona:**
1. El supervisor abre el detalle del informe mensual
2. Hace clic en "Descargar PDF"
3. El PDF se genera en el navegador (client-side)
4. Se valida que sea PDF real (magic number `%PDF-`)
5. Se sube a Supabase Storage en bucket `reports`
6. Se guarda `pdf_url` en `monthly_reports`
7. Se registra auditoría

**Ventajas:**
- No depende de Puppeteer ni Chromium en servidor
- Funciona en Supabase Edge Functions sin dependencias pesadas
- PDF real, descargable, con formato profesional
- Generación rápida en el navegador

**Archivos clave:**
- `src/components/pdf/ReportPDF.tsx` - Plantilla del PDF
- `src/components/pdf/ReportPDFGenerator.tsx` - Componente con descarga y vista previa
- `src/lib/pdf.tsx` - Utilidades de generación

---

## Contenido del PDF

El PDF incluye:
- Encabezado: SICOM Patagonia SRL
- Título: Informe Técnico Mensual de Mantenimiento de Ascensor
- Período
- Datos del equipo (código, edificio, cliente, tipo, fabricante)
- Datos del informe (fecha aprobación, supervisor, servicios)
- Estados del equipo (operativo, conservación)
- Contenido del informe
- Pie aclaratorio

---

## Variables de Entorno

### Frontend
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

### Backend (Edge Functions)
```
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
RESEND_API_KEY=... (opcional para mock)
REPORT_FROM_EMAIL=informes@sicompatagonia.com
REPORT_FROM_NAME=SICOM Patagonia SRL
```

---

## Storage

**Bucket:** `reports`

**Estructura:**
```
reports/{elevator_code}/{period}/informe-{elevator_code}-{period}.pdf
```

---

## Envío de Correos

**Edge Function:** `send-report-email`

**Flujo:**
1. Verifica que el informe tenga PDF generado
2. Obtiene destinatarios activos del ascensor
3. Envía correo con Resend (o mock si no hay API key)
4. Registra cada envío en `report_sends`
5. Actualiza estado a `sent`

**Mock:** Sin `RESEND_API_KEY` simula envíos exitosos.

---

## Cómo Probar

### Generar PDF
1. Login como supervisor
2. Ir a `/supervisor/informes`
3. Seleccionar informe aprobado
4. Clic en "Descargar PDF"
5. Verificar descarga de archivo `.pdf`

### Verificar PDF válido
1. Abrir PDF descargado
2. Verificar que se abre en lector de PDF
3. Verificar contenido completo

### Enviar por correo
1. Configurar `RESEND_API_KEY`
2. Verificar destinatarios
3. Clic en "Enviar por Correo"
4. Verificar recepción

---

## Pendientes Anteriores Resueltos

| Pendiente | Estado |
|-----------|--------|
| PDF real (no HTML) | ✅ Resuelto con @react-pdf/renderer |
| Descarga de PDF | ✅ Implementado |
| Almacenamiento en Storage | ✅ Implementado |
| Validación de PDF válido | ✅ Implementado |

---

## Pendientes Restantes

| Pendiente | Descripción |
|-----------|-------------|
| Logo institucional | Agregar logo real de SICOM al PDF |
| Numeración de páginas | Agregar paginación |
| Firma digital | Opcional, para certificación |
