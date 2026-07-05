# Manual de Uso - SICOM QR Ascensores

## 1. Ingreso al Sistema

1. Acceda a la URL del sistema
2. Ingrese su correo electrónico y contraseña
3. El sistema lo redirigirá según su rol

---

## 2. Rol Administrador

### Panel de Control
- Vista general del sistema
- Estadísticas de clientes, edificios y ascensores

### Gestión de Clientes
1. Ir a **Clientes**
2. Clic en **Nuevo Cliente**
3. Completar código, nombre y datos de contacto
4. Guardar

### Gestión de Edificios
1. Ir a **Edificios**
2. Clic en **Nuevo Edificio**
3. Seleccionar el cliente
4. Completar dirección y localidad
5. Guardar

### Gestión de Ascensores
1. Ir a **Ascensores**
2. Clic en **Nuevo Ascensor**
3. Seleccionar cliente y edificio
4. Completar datos técnicos
5. Seleccionar estados
6. Guardar

### Visualización de QR
1. En listado de ascensores, clic en ícono QR
2. Ver código QR generado
3. Copiar URL pública
4. Descargar imagen PNG
5. Imprimir etiqueta

### Gestión de Destinatarios
1. En listado de ascensores, clic en ícono usuarios
2. Agregar destinatarios de informes
3. Completar nombre, email y rol

---

## 3. Consulta Pública (QR)

### Desde un Celular
1. Escanear el código QR pegado en el ascensor
2. Se muestra la pantalla institucional de SICOM
3. Hacer clic en "Ver estado del ascensor"
4. Se muestra la ficha pública con:
   - Código del ascensor
   - Ubicación
   - Estado operativo
   - Estado de conservación
   - Último mantenimiento

---

## 4. Rol Técnico

### Panel del Técnico
- Estadísticas personales
- Acceso rápido a búsqueda

### Buscar Ascensor
1. Ir a **Buscar Ascensor**
2. Escribir código, dirección o localidad
3. Seleccionar el ascensor

### Cargar Mantenimiento
1. Completar fecha y tipo de servicio
2. Seleccionar estados resultantes
3. Completar checklist (10 items)
4. Escribir descripción y observaciones
5. Agregar mini informe técnico
6. Opcional: subir fotos

### Guardar Borrador
- El registro queda como "Borrador"
- Puede editarlo después

### Enviar a Revisión
- El registro pasa a "Enviado"
- El supervisor lo revisará

---

## 5. Rol Supervisor

### Panel del Supervisor
- Estadísticas de revisiones
- Acceso rápido a pendientes

### Revisar Mantenimiento
1. Ir a **Revisiones**
2. Seleccionar registro pendiente
3. Marcar como "En Revisión"
4. Revisar checklist, observaciones e informe

### Generar Informe con IA
1. Clic en "Generar Informe con IA"
2. Esperar generación
3. Revisar el informe generado
4. Editar si es necesario
5. Guardar borrador

### Aprobar Informe
1. Verificar que el informe sea correcto
2. Clic en "Aprobar Informe"
3. El sistema:
   - Actualiza estado del ascensor
   - Crea informe mensual

### Rechazar Informe
1. Clic en "Rechazar"
2. Ingresar motivo
3. El técnico podrá editarlo y reenviar

### Generar PDF
1. Ir a **Informes Mensuales**
2. Seleccionar informe aprobado
3. Clic en "Generar PDF"
4. Descargar PDF

### Enviar por Correo
1. Verificar destinatarios configurados
2. Clic en "Enviar por Correo"
3. El sistema envía a todos los destinatarios activos

---

## 6. Rol Responsable

### Panel del Responsable
- Ascensores asignados
- Informes disponibles

### Consultar Historial
1. Ver listado de ascensores asignados
2. Ver estados actuales
3. Consultar informes aprobados
4. Descargar PDFs disponibles

---

## 7. Estados del Sistema

### Service Records (Registros de Mantenimiento)
| Estado | Descripción |
|--------|-------------|
| Borrador | Guardado, no enviado |
| Enviado | Pendiente de revisión |
| En Revisión | Supervisor revisando |
| Aprobado | Informe aprobado |
| Rechazado | Rechazado por supervisor |

### Monthly Reports (Informes Mensuales)
| Estado | Descripción |
|--------|-------------|
| Borrador | Creado, sin contenido |
| Revisado | Contenido revisado |
| Aprobado | Informe aprobado |
| Enviado | Enviado por correo |

### Elevators (Ascensores)
| Campo | Estados Posibles |
|-------|------------------|
| Operativo | Operativo, Operativo con observaciones, No operativo, Fuera de servicio |
| Conservación | Conforme, Observado, Requiere reparación, Fuera de servicio |
| Contractual | Activo, Stand by, Servicio suspendido, Baja definitiva |

---

## 8. Preguntas Frecuentes

**¿Cómo genero un QR para un ascensor?**
Desde el panel de admin, vaya a Ascensores, busque el ascensor y haga clic en el ícono QR.

**¿Qué ve el público cuando escanea el QR?**
Ve una pantalla institucional de SICOM y luego el estado público del ascensor (código, ubicación, estados).

**¿Puede el técnico aprobar informes?**
No. Solo el supervisor puede aprobar o rechazar informes.

**¿Cómo se envían los informes por correo?**
El supervisor genera el PDF y luego hace clic en "Enviar por Correo" desde el detalle del informe mensual.

**¿Qué pasa si no hay destinatarios configurados?**
El sistema muestra un error indicando que no hay destinatarios. Debe configurarlos desde la administración de ascensores.

**¿El estado del ascensor se actualiza automáticamente?**
No. Solo se actualiza cuando el supervisor aprueba un mantenimiento.
