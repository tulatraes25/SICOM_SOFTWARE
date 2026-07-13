# Changelog

All notable changes to this project will be documented in this file.

---

## [1.0.0] - 2026-07-13

### Added
- Autenticación con Supabase Auth y 4 roles
- CRUD de clientes, edificios y ascensores
- Generación de QR por ascensor
- Vista pública del QR sin login
- Carga de mantenimientos por técnico
- Checklist de 10 items por mantenimiento
- Sistema de fotografías con Storage
- Revisión administrativa con aprobación/rechazo
- Generación de informes con IA (OpenAI)
- Generación de PDF profesional con @react-pdf/renderer
- Envío de correos con Resend
- Historial de envíos
- Dashboard por rol
- Portal público con historial de mantenimientos
- RPCs públicas seguras para QR
- RLS completo con mínimo privilegio
- Auditoría de acciones

### Changed
- Normalización de campo `final_report_text` como fuente única
- Manejo de fechas con zona horaria Argentina
- Botones unificados por acción
- Mensajes de error en español claro
- Responsive verificado en 4 tamaños

### Security
- RPCs públicas con validación de token
- RLS endurecido para service_records
- Checklist y fotos bloqueados después de envío
- Storage privado con signed URLs
- Sin acceso anónimo directo a tablas

### Fixed
- Logo SICOM Patagonia SRL unificado
- Teléfono actualizado a +54 297 421-4430
- PDF con datos reales del equipo
- Estados operativos con indicadores visuales
- Fechas sin problemas de zona horaria

### Documentation
- Guía de instalación desde cero
- Mapa de migraciones
- Manual de uso
- Guía de demo
- Documentación de seguridad

---

## [0.1.0] - 2026-07-09

### Added
- Versión inicial con funcionalidad básica
