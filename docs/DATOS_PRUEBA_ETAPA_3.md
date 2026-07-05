# Datos de Prueba - Etapa 3

## Cliente de Prueba

```sql
INSERT INTO clients (code, name, tax_id, contact_name, contact_email, contact_phone, locality, province)
VALUES (
  'CLI-001',
  'Hospital Regional Comodoro Rivadavia',
  '30-71234567-9',
  'Dr. Juan Pérez',
  'direccion@hospitalregional.gov.ar',
  '+54 299 444-5555',
  'Comodoro Rivadavia',
  'Chubut'
);
```

## Edificio de Prueba

```sql
INSERT INTO buildings (code, name, client_id, address, locality, province)
VALUES (
  'EDI-001',
  'Hospital Regional - Sede Principal',
  (SELECT id FROM clients WHERE code = 'CLI-001'),
  'Av. Belgrano 1234',
  'Comodoro Rivadavia',
  'Chubut'
);
```

## Ascensor de Prueba

```sql
INSERT INTO elevators (code, building_id, client_id, elevator_type, serial_number, manufacturer, model, operational_status, conservation_status, contractual_status)
VALUES (
  'ASC-0001',
  (SELECT id FROM buildings WHERE code = 'EDI-001'),
  (SELECT id FROM clients WHERE code = 'CLI-001'),
  'hidraulico',
  'OT-2020-12345',
  'Otis',
  'Gen2',
  'operativo',
  'conforme',
  'activo'
);
```

## Destinatarios de Prueba

```sql
INSERT INTO report_recipients (elevator_id, name, email, role)
VALUES
  ((SELECT id FROM elevators WHERE code = 'ASC-0001'), 'Dirección General', 'direccion@hospitalregional.gov.ar', 'Director'),
  ((SELECT id FROM elevators WHERE code = 'ASC-0001'), 'Administración', 'admin@hospitalregional.gov.ar', 'Administrador'),
  ((SELECT id FROM elevators WHERE code = 'ASC-0001'), 'Comisión de Mantenimiento', 'comision@hospitalregional.gov.ar', 'Comisión');
```

---

## Instrucciones para cargar datos de prueba

1. Crear el proyecto en Supabase
2. Ejecutar el esquema SQL (`supabase/migrations/001_initial_schema.sql`)
3. Crear un usuario admin en Authentication → Users
4. Ejecutar los INSERTs anteriores en SQL Editor
5. Iniciar sesión con el usuario admin
6. Verificar que los datos aparecen en Clientes, Edificios y Ascensores

---

## Secuencia de carga recomendada

1. **Crear Cliente** → Cargar datos del cliente
2. **Crear Edificio** → Asociar al cliente creado
3. **Crear Ascensor** → Asociar al cliente y edificio
4. **Agregar Destinatarios** → Desde la vista de ascensores, ícono de usuarios
