-- =====================================================
-- SICOM Patagonia Ascensores - Datos Demo Completos
-- =====================================================
-- Archivo de referencia para cargar datos de prueba
-- NO ejecutar directamente sin revisar
-- NO usar datos reales sin autorización

-- =====================================================
-- PASO 1: CLIENTES
-- =====================================================
INSERT INTO clients (code, name, tax_id, contact_name, contact_email, contact_phone, locality, province) VALUES
  ('CLI-001', 'Hospital Regional Comodoro Rivadavia', '30-71234567-9', 'Dr. Juan Pérez', 'contacto@hospitalregional.gov.ar', '+54 299 444-5555', 'Comodoro Rivadavia', 'Chubut'),
  ('CLI-002', 'Consorcio Edificio Centro', '30-79876543-1', 'Ing. María López', 'admin@edificiocentro.com', '+54 299 444-6666', 'Comodoro Rivadavia', 'Chubut'),
  ('CLI-003', 'Clínica Patagonia', '30-75551234-5', 'Dr. Carlos González', 'admin@clinicapatagonia.com', '+54 299 444-7777', 'Comodoro Rivadavia', 'Chubut'),
  ('CLI-004', 'Torre Rada Tilly', '30-76667890-2', 'Ing. Roberto Díaz', 'consorcio@radaTilly.com', '+54 299 444-8888', 'Comodoro Rivadavia', 'Chubut')
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- PASO 2: EDIFICIOS
-- =====================================================
INSERT INTO buildings (code, name, client_id, address, locality, province) VALUES
  ('EDI-001', 'Hospital Regional - Sede Principal',
   (SELECT id FROM clients WHERE code = 'CLI-001'),
   'Av. Belgrano 1234', 'Comodoro Rivadavia', 'Chubut'),
  ('EDI-002', 'Edificio San Martín 450',
   (SELECT id FROM clients WHERE code = 'CLI-002'),
   'San Martín 450', 'Comodoro Rivadavia', 'Chubut'),
  ('EDI-003', 'Clínica Patagonia - Sede Central',
   (SELECT id FROM clients WHERE code = 'CLI-003'),
   'Av. Rawson 789', 'Comodoro Rivadavia', 'Chubut'),
  ('EDI-004', 'Torre Costanera',
   (SELECT id FROM clients WHERE code = 'CLI-004'),
   'Costanera 1500', 'Comodoro Rivadavia', 'Chubut')
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- PASO 3: ASCENSORES
-- =====================================================
INSERT INTO elevators (code, building_id, client_id, elevator_type, serial_number, manufacturer, model, operational_status, conservation_status, contractual_status, floors_served) VALUES
  ('ASC-0001',
   (SELECT id FROM buildings WHERE code = 'EDI-001'),
   (SELECT id FROM clients WHERE code = 'CLI-001'),
   'hidraulico', 'OT-2020-12345', 'Otis', 'Gen2',
   'operativo', 'conforme', 'activo', 'PB,1,2,3,4,5'),
  ('ASC-0002',
   (SELECT id FROM buildings WHERE code = 'EDI-002'),
   (SELECT id FROM clients WHERE code = 'CLI-002'),
   'electrico', 'SC-2019-67890', 'Schindler', '5500',
   'operativo_con_observaciones', 'observado', 'activo', 'PB,1,2,3'),
  ('ASC-0003',
   (SELECT id FROM buildings WHERE code = 'EDI-003'),
   (SELECT id FROM clients WHERE code = 'CLI-003'),
   'traccion', 'TK-2021-11111', 'ThyssenKrupp', 'Synergy',
   'operativo', 'conforme', 'activo', 'PB,1,2,3,4'),
  ('ASC-0004',
   (SELECT id FROM buildings WHERE code = 'EDI-004'),
   (SELECT id FROM clients WHERE code = 'CLI-004'),
   'hidraulico', 'MT-2022-99999', 'Mitsubishi', 'NexieZ',
   'operativo', 'conforme', 'activo', 'PB,1,2,3,4,5,6,7')
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- PASO 4: DESTINATARIOS
-- =====================================================
INSERT INTO report_recipients (elevator_id, name, email, role) VALUES
  -- ASC-0001 (Hospital Regional)
  ((SELECT id FROM elevators WHERE code = 'ASC-0001'), 'Administración Hospital', 'administracion.demo@sicompatagonia.com', 'Administrador'),
  ((SELECT id FROM elevators WHERE code = 'ASC-0001'), 'Dirección General', 'direccion.demo@sicompatagonia.com', 'Director'),
  -- ASC-0002 (Edificio Centro)
  ((SELECT id FROM elevators WHERE code = 'ASC-0002'), 'Consorcio Edificio Centro', 'consorcio.demo@sicompatagonia.com', 'Consorcio'),
  -- ASC-0003 (Clínica Patagonia)
  ((SELECT id FROM elevators WHERE code = 'ASC-0003'), 'Contador Clínica', 'contador.demo@sicompatagonia.com', 'Contador'),
  ((SELECT id FROM elevators WHERE code = 'ASC-0003'), 'Dirección Clínica', 'direccion.demo@sicompatagonia.com', 'Director'),
  -- ASC-0004 (Torre Rada Tilly)
  ((SELECT id FROM elevators WHERE code = 'ASC-0004'), 'Administración Torre', 'administracion.demo@sicompatagonia.com', 'Administrador'),
  ((SELECT id FROM elevators WHERE code = 'ASC-0004'), 'Consorcio Torre', 'consorcio.demo@sicompatagonia.com', 'Consorcio');

-- =====================================================
-- PASO 5: USUARIOS (crear desde Supabase Auth)
-- =====================================================
-- IMPORTANTE: Crear estos usuarios desde Authentication > Users
-- Luego ejecutar los UPDATE para asignar roles

-- Usuarios a crear:
-- admin.demo@sicompatagonia.com     -> admin
-- tecnico.demo@sicompatagonia.com   -> technician
-- supervisor.demo@sicompatagonia.com -> supervisor
-- responsable.demo@sicompatagonia.com -> responsible

-- Después de crear los usuarios, ejecutar:
-- UPDATE profiles SET role = 'admin' WHERE email = 'admin.demo@sicompatagonia.com';
-- UPDATE profiles SET role = 'technician' WHERE email = 'tecnico.demo@sicompatagonia.com';
-- UPDATE profiles SET role = 'supervisor' WHERE email = 'supervisor.demo@sicompatagonia.com';
-- UPDATE profiles SET role = 'responsible' WHERE email = 'responsable.demo@sicompatagonia.com';

-- =====================================================
-- PASO 6: ASIGNAR RESPONSABLE
-- =====================================================
-- Asignar responsable autorizado a ASC-0001
-- UPDATE elevators SET responsible_user_id = (
--   SELECT id FROM profiles WHERE email = 'responsable.demo@sicompatagonia.com'
-- ) WHERE code = 'ASC-0001';

-- =====================================================
-- PASO 7: SERVICE RECORDS DEMO (opcional)
-- =====================================================
-- Estos registros se crean desde la interfaz del técnico
-- Aquí se muestran como referencia del flujo esperado

-- Flujo demo:
-- 1. Técnico crea service_record con status='draft'
-- 2. Técnico envía: status='submitted'
-- 3. Supervisor marca: status='in_review'
-- 4. Supervisor aprueba: status='approved'
-- 5. Se crea monthly_report
-- 6. Se genera PDF
-- 7. Se envía correo

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
-- Después de ejecutar, verificar:
-- SELECT COUNT(*) FROM clients; -- Debe ser 4
-- SELECT COUNT(*) FROM buildings; -- Debe ser 4
-- SELECT COUNT(*) FROM elevators; -- Debe ser 4
-- SELECT COUNT(*) FROM report_recipients; -- Debe ser 7
-- SELECT code, qr_token FROM elevators; -- Verificar QR tokens
