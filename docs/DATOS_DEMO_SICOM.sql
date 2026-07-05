-- =====================================================
-- SICOM Patagonia Ascensores - Datos de Demo
-- =====================================================
-- Datos ficticios realistas para demostración
-- NO usar datos personales reales sin autorización

-- =====================================================
-- CLIENTES
-- =====================================================
INSERT INTO clients (code, name, tax_id, contact_name, contact_email, contact_phone, locality, province) VALUES
  ('CLI-001', 'Hospital Regional Comodoro Rivadavia', '30-71234567-9', 'Dr. Juan Pérez', 'direccion@hospitalregional.gov.ar', '+54 299 444-5555', 'Comodoro Rivadavia', 'Chubut'),
  ('CLI-002', 'Consorcio Edificio Centro', '30-79876543-1', 'Ing. María López', 'admin@edificiocentro.com', '+54 299 444-6666', 'Comodoro Rivadavia', 'Chubut'),
  ('CLI-003', 'Inmobiliaria Patagonia', '30-75551234-5', 'Carlos González', 'carlos@inmobiliariapatagonia.com', '+54 299 444-7777', 'Comodoro Rivadavia', 'Chubut')
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- EDIFICIOS
-- =====================================================
INSERT INTO buildings (code, name, client_id, address, locality, province) VALUES
  ('EDI-001', 'Hospital Regional - Sede Principal', 
   (SELECT id FROM clients WHERE code = 'CLI-001'),
   'Av. Belgrano 1234', 'Comodoro Rivadavia', 'Chubut'),
  ('EDI-002', 'Edificio San Martín 450', 
   (SELECT id FROM clients WHERE code = 'CLI-002'),
   'San Martín 450', 'Comodoro Rivadavia', 'Chubut'),
  ('EDI-003', 'Torre Rada Tilly', 
   (SELECT id FROM clients WHERE code = 'CLI-003'),
   'Av. Rada Tilly 900', 'Comodoro Rivadavia', 'Chubut')
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- ASCENSORES
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
   'operativo', 'conforme', 'activo', 'PB,1,2,3,4,5,6')
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- DESTINATARIOS
-- =====================================================
INSERT INTO report_recipients (elevator_id, name, email, role) VALUES
  ((SELECT id FROM elevators WHERE code = 'ASC-0001'), 'Dirección General', 'direccion@hospitalregional.gov.ar', 'Director'),
  ((SELECT id FROM elevators WHERE code = 'ASC-0001'), 'Administración Hospital', 'admin@hospitalregional.gov.ar', 'Administrador'),
  ((SELECT id FROM elevators WHERE code = 'ASC-0001'), 'Comisión de Mantenimiento', 'comision@hospitalregional.gov.ar', 'Comisión'),
  ((SELECT id FROM elevators WHERE code = 'ASC-0002'), 'Consorcio Admin', 'admin@edificiocentro.com', 'Administrador'),
  ((SELECT id FROM elevators WHERE code = 'ASC-0003'), 'Inmobiliaria', 'carlos@inmobiliariapatagonia.com', 'Propietario');

-- =====================================================
-- USUARIOS (crear desde Supabase Auth)
-- =====================================================
-- Paso 1: Crear usuarios en Authentication > Users
-- Paso 2: Ejecutar UPDATE para asignar roles:
-- UPDATE profiles SET role = 'admin' WHERE email = 'admin@sicom.com';
-- UPDATE profiles SET role = 'technician' WHERE email = 'tecnico@sicom.com';
-- UPDATE profiles SET role = 'supervisor' WHERE email = 'supervisor@sicom.com';
-- UPDATE profiles SET role = 'responsible' WHERE email = 'responsable@sicom.com';

-- =====================================================
-- ASIGNAR RESPONSABLE
-- =====================================================
-- UPDATE elevators SET responsible_user_id = (
--   SELECT id FROM profiles WHERE email = 'responsable@sicom.com'
-- ) WHERE code = 'ASC-0001';
