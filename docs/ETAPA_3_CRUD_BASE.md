# Etapa 3: CRUD de Clientes, Edificios y Ascensores

## Objetivo

Implementar las pantallas y servicios necesarios para que un usuario admin pueda cargar, editar, listar, buscar y consultar clientes, edificios y ascensores reales de SICOM Patagonia SRL.

---

## Módulos Implementados

### 1. Clientes (`/admin/clientes`)

**Funcionalidades:**
- Listado de clientes con búsqueda
- Alta de cliente
- Edición de cliente
- Activar/desactivar cliente
- Búsqueda por nombre, CUIT o localidad

**Campos:**
- Código (único)
- Nombre
- CUIT
- Nombre del contacto
- Email del contacto
- Teléfono del contacto
- Dirección
- Localidad
- Provincia
- Estado (activo/inactivo)

### 2. Edificios (`/admin/edificios`)

**Funcionalidades:**
- Listado de edificios con búsqueda
- Filtrado por cliente
- Alta de edificio
- Edición de edificio
- Desactivar edificio

**Campos:**
- Código (único)
- Nombre
- Cliente (seleccionable)
- Dirección
- Localidad
- Provincia
- Latitud/Longitud (opcional)
- Estado (activo/inactivo)

### 3. Ascensores (`/admin/ascensores`)

**Funcionalidades:**
- Listado de ascensores con búsqueda
- Filtrado por cliente, estado operativo, conservación y contractual
- Alta de ascensor
- Edición de ascensor
- Desactivar ascensor
- Gestión de destinatarios de informes

**Campos:**
- Código (único)
- Cliente (seleccionable)
- Edificio (seleccionable según cliente)
- Tipo de elevador
- Número de serie
- Fabricante
- Modelo
- Capacidad (kg)
- Pisos
- Año de instalación
- Estado operativo
- Estado de conservación
- Estado contractual
- Responsable autorizado
- Empresa conservadora
- Supervisor
- Notas

### 4. Destinatarios de Informes

**Funcionalidades:**
- Listar destinatarios de un ascensor
- Agregar destinatario
- Editar destinatario
- Eliminar destinatario

**Campos:**
- Nombre
- Email
- Rol/Descripción

---

## Rutas Disponibles

| Ruta | Descripción | Rol |
|------|-------------|-----|
| `/admin` | Dashboard administrativo | admin |
| `/admin/clientes` | Gestión de clientes | admin |
| `/admin/edificios` | Gestión de edificios | admin |
| `/admin/ascensores` | Gestión de ascensores | admin |

---

## Servicios Creados

| Servicio | Archivo |
|----------|---------|
| Clientes | `src/services/clients.service.ts` |
| Edificios | `src/services/buildings.service.ts` |
| Ascensores | `src/services/elevators.service.ts` |
| Destinatarios | `src/services/reportRecipients.service.ts` |
| Perfiles | `src/services/profiles.service.ts` |
| Auditoría | `src/services/audit.service.ts` |

---

## Cómo Probar

### 1. Login
1. Ir a `/login`
2. Ingresar con credenciales de admin
3. Verificar que se redirige a `/admin`

### 2. Crear Cliente
1. Ir a `/admin/clientes`
2. Hacer clic en "Nuevo Cliente"
3. Completar código, nombre y campos obligatorios
4. Guardar
5. Verificar que aparece en el listado

### 3. Crear Edificio
1. Ir a `/admin/edificios`
2. Hacer clic en "Nuevo Edificio"
3. Seleccionar el cliente creado
4. Completar código, nombre y dirección
5. Guardar
6. Verificar que aparece en el listado

### 4. Crear Ascensor
1. Ir a `/admin/ascensores`
2. Hacer clic en "Nuevo Ascensor"
3. Seleccionar cliente y edificio
4. Completar código y datos técnicos
5. Seleccionar estados
6. Guardar
7. Verificar que aparece en el listado

### 5. Agregar Destinatarios
1. En el listado de ascensores, hacer clic en el ícono de usuarios
2. Hacer clic en "Agregar"
3. Completar nombre, email y rol
4. Guardar
5. Verificar que aparece en la lista

---

## Estados Implementados

### Estado Operativo
- `operativo`
- `operativo_con_observaciones`
- `no_operativo`
- `fuera_de_servicio_preventivo`
- `fuera_de_servicio_por_reparacion`

### Estado de Conservación
- `conforme`
- `observado`
- `requiere_reparacion`
- `fuera_de_servicio`
- `pendiente_de_verificacion`

### Estado Contractual
- `activo`
- `stand_by`
- `servicio_suspendido`
- `baja_definitiva`

---

## Auditoría

Las siguientes acciones se registran en `audit_logs`:

- Crear/editar/desactivar cliente
- Crear/editar/desactivar edificio
- Crear/editar/desactivar ascensor
- Crear/editar/eliminar destinatario

---

## Limitaciones de Esta Etapa

- No se generan QR visuales aún
- No se puede ver la vista pública del QR
- No hay carga de mantenimientos
- No hay generación de informes
- No hay envío de correos
- No hay dashboard avanzado

---

## Pendientes para Etapa 4

- Generación visual de QR
- Vista pública del ascensor por token
- Código QR imprimible
- Configuración de datos de empresa
- Pantalla institucional previa al QR
