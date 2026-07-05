# Checklist de Entrega - SICOM QR Ascensores

## Infraestructura
- [ ] Proyecto Supabase creado
- [ ] Base de datos inicializada (SQL ejecutado)
- [ ] Tablas creadas correctamente
- [ ] RLS habilitado y configurado
- [ ] Storage bucket "reports" creado
- [ ] Storage bucket "service-photos" creado
- [ ] Edge Functions desplegadas

## Autenticación
- [ ] Login funcional
- [ ] Roles configurados (admin, technician, supervisor, responsible)
- [ ] Usuarios iniciales creados
- [ ] Perfiles asignados correctamente

## Configuración
- [ ] Variables de entorno configuradas (.env.local)
- [ ] VITE_SUPABASE_URL configurado
- [ ] VITE_SUPABASE_ANON_KEY configurado
- [ ] VITE_PUBLIC_APP_URL configurado
- [ ] RESEND_API_KEY configurado (producción)
- [ ] OPENAI_API_KEY configurado (producción)

## Funcionalidades
### Administración
- [ ] CRUD Clientes funcional
- [ ] CRUD Edificios funcional
- [ ] CRUD Ascensores funcional
- [ ] QR generado correctamente
- [ ] Descarga QR PNG funcional
- [ ] Gestión de destinatarios funcional

### Vista Pública
- [ ] URL pública accesible
- [ ] Pantalla institucional visible
- [ ] Ficha pública del ascensor visible
- [ ] Token inexistente muestra error
- [ ] No se muestra información sensible

### Técnico
- [ ] Búsqueda de ascensores funcional
- [ ] Carga de mantenimiento funcional
- [ ] Checklist funcional
- [ ] Guardar borrador funcional
- [ ] Enviar a revisión funcional
- [ ] Vista responsive en celular

### Supervisor
- [ ] Listado de revisiones funcional
- [ ] Marcar en revisión funcional
- [ ] Generar informe IA funcional (con mock o API real)
- [ ] Editar informe funcional
- [ ] Aprobar informe funcional
- [ ] Rechazar informe funcional
- [x] Generar PDF funcional ✅ (PDF real con @react-pdf/renderer)
- [x] Descargar PDF funcional ✅
- [ ] Enviar por correo funcional
- [ ] Historial de envíos visible

### Responsable
- [x] Vista funcional ✅
- [x] Ascensores asignados visibles ✅
- [x] Informes aprobados visibles ✅
- [x] PDFs descargables ✅

## Seguridad
- [ ] service_role key NO está en frontend
- [ ] API keys de IA/correo NO están en frontend
- [ ] RLS protege datos internos
- [ ] Público no accede a informes
- [ ] Técnico no puede aprobar
- [ ] Responsable solo ve sus ascensores

## Documentación
- [ ] Manual de uso creado
- [ ] Datos de prueba documentados
- [ ] Pendientes futuros documentados
- [ ] Guía de instalación completa

## Pruebas
- [ ] Flujo completo probado (paso 1 al 21)
- [ ] Errores críticos corregidos
- [ ] Responsive verificado
- [ ] Estados validados
- [ ] Auditoría verificada

## Despliegue
- [ ] Dominio configurado
- [ ] SSL habilitado
- [ ] DNS configurado
- [ ] Resend dominio verificado
- [ ] Backup inicial realizado
