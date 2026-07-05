# Configuración de Storage - SICOM Patagonia Ascensores

## Buckets Requeridos

Crear estos buckets desde **Supabase Dashboard → Storage → New Bucket**:

### 1. reports
- **Nombre:** `reports`
- **Público:** Sí (para URLs directas de PDF)
- **Nota:** Para producción, considerar usar signed URLs

### 2. service-photos
- **Nombre:** `service-photos`
- **Público:** No (privado)
- **Nota:** Acceso solo vía autenticación

---

## Configuración de Políticas RLS

### Bucket: reports (público)

```sql
-- Permitir lectura pública
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
USING (bucket_id = 'reports');

-- Solo authenticated pueden subir
CREATE POLICY "Authenticated upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'reports' AND auth.role() = 'authenticated');

-- Solo authenticated pueden eliminar
CREATE POLICY "Authenticated delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'reports' AND auth.role() = 'authenticated');
```

### Bucket: service-photos (privado)

```sql
-- Solo authenticated pueden leer
CREATE POLICY "Authenticated read"
ON storage.objects FOR SELECT
USING (bucket_id = 'service-photos' AND auth.role() = 'authenticated');

-- Solo authenticated pueden subir
CREATE POLICY "Authenticated upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'service-photos' AND auth.role() = 'authenticated');

-- Solo authenticated pueden eliminar
CREATE POLICY "Authenticated delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'service-photos' AND auth.role() = 'authenticated');
```

---

## Estructura de Archivos

```
reports/
├── {elevator_code}/
│   └── {period}/
│       └── informe-{elevator_code}-{period}.pdf

service-photos/
└── {service_record_id}/
    └── {timestamp}.{ext}
```

---

## Notas para Demo

- **reports** público: Permite descargar PDFs sin autenticación
- Para producción: considerar signed URLs con expiración
- Los PDFs contienen información técnica, no datos sensibles
- Si se necesita mayor seguridad, cambiar bucket a privado

---

## Verificación

1. Crear buckets en Supabase Dashboard
2. Aplicar políticas RLS
3. Probar subida de PDF desde la app
4. Verificar que la URL del PDF es accesible
