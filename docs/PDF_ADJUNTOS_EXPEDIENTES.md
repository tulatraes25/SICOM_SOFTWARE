# Adjuntar informes PDF a expedientes

## Uso

En **Expedientes → abrir un expediente → Documentos del Expediente**:

1. Seleccionar **Archivo PDF** (máximo 20 MB por archivo).
2. Revisar el título, completado inicialmente con el nombre del archivo.
3. Indicar la fecha original del informe, si se conoce. Es opcional y puede pertenecer a años anteriores.
4. Pulsar **Adjuntar PDF**.

El PDF aparece junto con las órdenes de servicio generadas, identificado como **PDF adjunto**. Conserva su nombre, título, fecha original y fecha de carga. Los botones **Ver** y **Descargar** requieren acceso al expediente y obtienen un enlace privado que vence a los cinco minutos.

Los administradores y supervisores activos pueden adjuntar. Los técnicos únicamente pueden consultar metadatos y archivos de expedientes que las políticas existentes les permiten leer. No hay acceso público ni por el QR del ascensor. Adjuntar un informe no crea un mantenimiento, no lo aprueba y no cambia el estado o la fecha del ascensor.

## Despliegue

Aplicar `supabase/migrations/073_service_case_documents.sql` antes de publicar el frontend de esta función. La migración crea:

- La tabla `public.service_case_documents` y su política de lectura por expediente autorizado.
- El bucket privado `service-case-documents`, limitado a `application/pdf` y 20 MB.
- Las políticas de carga, lectura y limpieza de cargas no registradas.
- La RPC `register_service_case_document`, con validación de rol activo, expediente, propietario del objeto, tipo y tamaño registrados por Storage.
- El evento `document_uploaded` y el registro de auditoría correspondiente.

Las rutas de objetos contienen únicamente los UUID del expediente, usuario y documento. No se permite sobrescribir ni borrar un documento registrado. La clave foránea hacia `storage.objects(id)` con `ON DELETE RESTRICT` impide que una limpieza concurrente elimine el objeto de un documento ya registrado; la política RLS por sí sola no ofrece esa garantía ante snapshots anteriores.

La interfaz valida además extensión, cabecera PDF, tamaño, nombre y fecha antes de transferir. No es un análisis antivirus del contenido. La validación de cabecera corresponde al navegador; Storage aplica el MIME y el límite de bytes, y la RPC verifica los metadatos del objeto cargado.

Si falla el registro, se comprueba si ya se confirmó en el servidor (por ejemplo, si se perdió la respuesta). De no encontrarlo, se intenta limpiar la carga sin registro. Si la conectividad impide confirmar el resultado, la interfaz pide actualizar los documentos antes de reintentar.

## Verificación

Las pruebas de servicio y componente cubren carga, errores, limpieza, respuesta perdida, diferencia entre PDF adjunto y generado, fecha histórica, bloqueo del doble envío y enlaces privados. Las pruebas SQL ejecutan la migración con PostgreSQL local y verifican los permisos y restricciones.

Después de desplegar, verificar en un entorno de prueba una carga y descarga con un PDF no sensible, el evento de historial y el rechazo para un usuario sin permisos. No crear expedientes o mantenimientos ficticios en producción para esta prueba. Si no hay acceso a Supabase, la publicación del backend queda pendiente: un build o despliegue de Vercel no aplica esta migración.

Para revertir la interfaz, volver al despliegue anterior. Conservar la tabla, el bucket y los archivos; no eliminar datos adjuntos como parte de un rollback.
