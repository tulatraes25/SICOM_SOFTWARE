# Etapa 8: Pruebas Piloto y Preparación de Entrega

## Objetivo

Probar el sistema completo con datos reales o semi-reales, corregir errores, validar permisos y dejar preparada una versión funcional para entrega.

---

## Datos de Prueba Mínimos

### Usuarios
| Email | Contraseña | Rol |
|-------|------------|-----|
| admin@sicom.com | (definir) | admin |
| tecnico@sicom.com | (definir) | technician |
| supervisor@sicom.com | (definir) | supervisor |
| responsable@sicom.com | (definir) | responsible |

### Clientes
- Hospital Regional Comodoro Rivadavia
- Consorcio Edificio Centro
- Inmobiliaria Patagonia

### Edificios
- Hospital Regional - Sede Principal
- Edificio San Martín 450
- Torre Rada Tilly

### Ascensores
- ASC-0001 (Hospital Regional)
- ASC-0002 (Edificio San Martín)
- ASC-0003 (Torre Rada Tilly)

---

## Flujo de Prueba Completo

### 1. Administración
| # | Acción | Resultado Esperado | Estado |
|---|--------|-------------------|--------|
| 1.1 | Login como admin | Acceso a /admin | ⬜ |
| 1.2 | Crear cliente | Cliente visible en listado | ⬜ |
| 1.3 | Editar cliente | Cambios guardados | ⬜ |
| 1.4 | Crear edificio | Edificio visible, asociado a cliente | ⬜ |
| 1.5 | Crear ascensor | Ascensor visible con qr_token | ⬜ |
| 1.6 | Ver QR del ascensor | Modal con QR funcional | ⬜ |
| 1.7 | Descargar QR PNG | Archivo descargado | ⬜ |
| 1.8 | Copiar URL pública | URL copiada al portapapeles | ⬜ |

### 2. Vista Pública
| # | Acción | Resultado Esperado | Estado |
|---|--------|-------------------|--------|
| 2.1 | Abrir URL pública | Pantalla institucional SICOM | ⬜ |
| 2.2 | Hacer clic "Ver estado" | Ficha pública del ascensor | ⬜ |
| 2.3 | Verificar información visible | Código, edificio, estados | ⬜ |
| 2.4 | Verificar info NO visible | No mostrar historial, responsable | ⬜ |
| 2.5 | Probar token inexistente | Mensaje de error claro | ⬜ |

### 3. Técnico
| # | Acción | Resultado Esperado | Estado |
|---|--------|-------------------|--------|
| 3.1 | Login como technician | Acceso a /tecnico | ⬜ |
| 3.2 | Buscar ascensor | Resultados filtrados | ⬜ |
| 3.3 | Seleccionar ascensor | Formulario de carga | ⬜ |
| 3.4 | Completar checklist | Todos los items marcados | ⬜ |
| 3.5 | Guardar borrador | Registro guardado como draft | ⬜ |
| 3.6 | Enviar a revisión | Estado cambia a submitted | ⬜ |
| 3.7 | Ver mis mantenimientos | Listado con filtros | ⬜ |
| 3.8 | Ver detalle de mantenimiento | Información completa | ⬜ |

### 4. Supervisor
| # | Acción | Resultado Esperado | Estado |
|---|--------|-------------------|--------|
| 4.1 | Login como supervisor | Acceso a /supervisor | ⬜ |
| 4.2 | Ver registros pendientes | Listado de submitted | ⬜ |
| 4.3 | Abrir registro | Vista de revisión | ⬜ |
| 4.4 | Marcar en revisión | Estado in_review | ⬜ |
| 4.5 | Generar informe IA | Informe generado | ⬜ |
| 4.6 | Editar informe | Cambios guardados | ⬜ |
| 4.7 | Aprobar informe | Estado approved, ascensor actualizado | ⬜ |
| 4.8 | Verificar monthly_report | Informe mensual creado | ⬜ |
| 4.9 | Generar PDF | PDF generado en Storage | ⬜ |
| 4.10 | Descargar PDF | PDF descargado | ⬜ |
| 4.11 | Enviar por correo | Correos enviados | ⬜ |
| 4.12 | Verificar report_sends | Envíos registrados | ⬜ |

### 5. Responsable
| # | Acción | Resultado Esperado | Estado |
|---|--------|-------------------|--------|
| 5.1 | Login como responsible | Acceso a /responsable | ⬜ |
| 5.2 | Ver mis ascensores | Solo ascensores asignados | ⬜ |
| 5.3 | Ver historial | Registros aprobados | ⬜ |
| 5.4 | Ver informes | Informes aprobados | ⬜ |

### 6. Seguridad
| # | Acción | Resultado Esperado | Estado |
|---|--------|-------------------|--------|
| 6.1 | Técnico intenta acceder a /admin | Bloqueado | ⬜ |
| 6.2 | Responsable ve ascensores ajenos | No visible | ⬜ |
| 6.3 | Público accede a informes | No accesible | ⬜ |
| 6.4 | Técnico intenta aprobar | Botón no disponible | ⬜ |

---

## Errores Encontrados

| # | Descripción | Severidad | Corregido |
|---|-------------|-----------|-----------|
| | | | |

---

## Pendientes para Entrega

| # | Descripción | Prioridad |
|---|-------------|-----------|
| | | |

---

## Pendientes para Etapa Futura

| # | Descripción | Módulo |
|---|-------------|--------|
| | | |
