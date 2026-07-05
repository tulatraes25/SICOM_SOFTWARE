# Etapa 5: Carga Técnica de Mantenimientos

## Objetivo

Implementar el módulo para que un usuario técnico pueda buscar o escanear un ascensor, cargar el mantenimiento realizado, completar datos básicos del servicio, registrar estado del equipo, escribir observaciones y enviar el registro para revisión del supervisor.

---

## Referencia de Repositorios

### De APPEL se tomó:
- **Modelo Service**: Relación Elevator → Service con technician_id
- **Checklist como JSON**: Array de items con status y notes
- **Estados del servicio**: `draft → submitted → approved/rejected`
- **Audit logging**: Registro de acciones relevantes

### De sonic-elevator se tomó:
- **Flujo técnico → supervisor**: Crear → Enviar → Esperar revisión
- **Dashboard por rol**: Accesos rápidos y listado de registros
- **Checklist interactivo**: Items verificables con opciones claras

### Se descartó:
- Sync offline (APPEL) — No aplica para SICOM web
- Chat en tiempo real (APPEL) — Fuera de alcance
- Login social (sonic-elevator) — Ya implementado con Supabase Auth

---

## Módulos Implementados

### 1. Servicio de Mantenimientos (`src/services/serviceRecords.service.ts`)

**Funciones:**
- `listMyServiceRecords(technicianId)` - Lista registros del técnico
- `listServiceRecordsByElevator(elevatorId)` - Lista por ascensor
- `getServiceRecordById(id)` - Detalle completo
- `createServiceRecord(data)` - Crear nuevo registro
- `updateServiceRecord(id, data)` - Actualizar registro
- `submitServiceRecord(id)` - Enviar a revisión
- `deleteDraftServiceRecord(id)` - Eliminar borrador
- `getChecklistByServiceRecord(id)` - Obtener checklist
- `createChecklistItems(items)` - Crear items de checklist
- `getPhotosByServiceRecord(id)` - Obtener fotos
- `uploadServicePhoto(id, file, type)` - Subir foto
- `deleteServicePhoto(id)` - Eliminar foto
- `searchElevatorsForTechnician(query)` - Buscar ascensores

### 2. Dashboard Técnico (`/tecnico`)

**Muestra:**
- Accesos rápidos (Buscar Ascensor)
- Estadísticas: Borradores, En Revisión, Aprobados
- Últimos mantenimientos cargados

### 3. Búsqueda de Ascensores (`/tecnico/ascensores`)

**Permite buscar por:**
- Código del ascensor
- Dirección
- Localidad

**Muestra:**
- Código
- Edificio
- Estado operativo
- Botón "Cargar Mantenimiento"

### 4. Formulario de Mantenimiento (`/tecnico/ascensores/:elevatorId/mantenimiento/nuevo`)

**Campos:**
- Fecha del servicio
- Tipo de servicio (preventivo, correctivo, emergencia, inspección, otro)
- Estado operativo resultante
- Estado de conservación resultante
- Checklist de 10 items
- Descripción general
- Observaciones
- Mini informe técnico
- Fotos (opcional)

**Acciones:**
- Guardar borrador
- Enviar a revisión

### 5. Checklist de Mantenimiento (`src/components/service/ServiceChecklist.tsx`)

**Items predefinidos:**
1. Estado de puertas
2. Botonera de cabina
3. Botoneras de piso
4. Nivelación
5. Iluminación de cabina
6. Sala de máquinas
7. Sistema de freno
8. Ruidos o vibraciones
9. Limpieza general
10. Seguridad general

**Estados por ítem:**
- OK
- Observado
- Requiere intervención
- No aplica

**Nota opcional por ítem.**

### 6. Carga de Fotos (`src/components/service/ServicePhotoUpload.tsx`)

**Permite:**
- Subir múltiples fotos
- Límite de 5MB por foto
- Eliminar fotos
- Almacenamiento en Supabase Storage

### 7. Detalle de Mantenimiento (`/tecnico/mantenimientos/:id`)

**Muestra:**
- Datos del ascensor
- Fecha y tipo de servicio
- Estados operativo y de conservación
- Checklist completo
- Descripción y observaciones
- Mini informe técnico
- Fotos
- Estado del registro

**Permite:**
- Editar si está en borrador o rechazado

---

## Rutas Implementadas

| Ruta | Descripción | Rol |
|------|-------------|-----|
| `/tecnico` | Dashboard técnico | technician, admin |
| `/tecnico/ascensores` | Buscar ascensores | technician, admin |
| `/tecnico/ascensores/:elevatorId/mantenimiento/nuevo` | Cargar mantenimiento | technician, admin |
| `/tecnico/mantenimientos` | Lista de mantenimientos | technician, admin |
| `/tecnico/mantenimientos/:id` | Detalle de mantenimiento | technician, admin |

---

## Estados del Registro

| Estado | Descripción | Edita Técnico | Edita Supervisor |
|--------|-------------|---------------|------------------|
| `draft` | Borrador | ✅ | ❌ |
| `submitted` | Enviado a revisión | ❌ | ✅ |
| `in_review` | En revisión del supervisor | ❌ | ✅ |
| `approved` | Aprobado | ❌ | ❌ |
| `rejected` | Rechazado | ✅ | ✅ |

---

## Flujo de Trabajo

1. **Técnico busca ascensor** → `/tecnico/ascensores`
2. **Selecciona ascensor** → Abre formulario
3. **Carga datos del servicio** → Fecha, tipo, estados, checklist, informe
4. **Guarda borrador** o **Envía a revisión**
5. **Supervisor revisa** (Etapa 6)
6. **Si aprueba** → Se actualiza estado del ascensor

---

## Seguridad (RLS)

- Technician solo puede crear registros con su propio `technician_id`
- Technician solo puede ver/editar sus propios registros
- Technician solo puede editar registros en `draft` o `rejected`
- Supervisor puede ver/actualizar todos los registros
- Admin puede todo
- Responsible solo ve registros `approved` de sus ascensores

---

## Auditoría

Acciones registradas:
- Crear mantenimiento
- Enviar a revisión
- Editar registro
- Cambio de estado

---

## Cómo Probar

### 1. Login como Technician
1. Ir a `/login`
2. Credenciales de técnico
3. Verificar acceso a `/tecnico`

### 2. Buscar Ascensor
1. Ir a "Buscar Ascensor"
2. Escribir código o dirección
3. Verificar resultados
4. Hacer clic en "Cargar Mantenimiento"

### 3. Cargar Mantenimiento
1. Completar fecha y tipo
2. Seleccionar estados resultantes
3. Completar checklist
4. Escribir descripción e informe
5. Guardar borrador o enviar a revisión

### 4. Ver Detalle
1. Ir a "Mis Mantenimientos"
2. Hacer clic en un registro
3. Verificar información completa

---

## Pendientes para Etapa 6

- Revisión y aprobación por supervisor
- Generación de informe con IA
- Generación de PDF
- Envío de correos
- Actualización automática de estados al aprobar

---

## Archivos Creados/Modificados

### Nuevos
- `src/services/serviceRecords.service.ts`
- `src/components/service/ServiceChecklist.tsx`
- `src/components/service/ServicePhotoUpload.tsx`
- `src/pages/technician/TechnicianElevatorSearch.tsx`
- `src/pages/technician/ServiceRecordForm.tsx`
- `src/pages/technician/ServiceRecordDetail.tsx`
- `supabase/migrations/003_service_records_rls.sql`
- `docs/ETAPA_5_CARGA_TECNICA.md`

### Modificados
- `src/pages/technician/TechDashboard.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/router/AppRouter.tsx`
