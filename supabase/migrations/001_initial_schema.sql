-- =====================================================
-- SICOM QR Ascensores - Schema Inicial
-- Versión: 1.0.0
-- Fecha: 2026-07-03
-- =====================================================

-- Habilitar extensión para UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABLA: profiles (extiende auth.users de Supabase)
-- =====================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'technician', 'supervisor', 'responsible')),
  phone TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLA: clients
-- =====================================================
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  address TEXT,
  locality TEXT,
  province TEXT DEFAULT 'Chubut',
  tax_id TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLA: buildings
-- =====================================================
CREATE TABLE buildings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  locality TEXT NOT NULL,
  province TEXT DEFAULT 'Chubut',
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLA: elevators (ASCENSORES)
-- =====================================================
CREATE TABLE elevators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  qr_token TEXT UNIQUE NOT NULL,
  building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE RESTRICT,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  
  -- Datos del ascensor
  serial_number TEXT,
  manufacturer TEXT,
  model TEXT,
  elevator_type TEXT CHECK (elevator_type IN ('hidraulico', 'electrico', 'traccion', 'sin_cabina', 'otro')),
  capacity_kg INTEGER,
  floors_served TEXT,
  year_installed INTEGER,
  
  -- Estados
  operational_status TEXT DEFAULT 'operativo' CHECK (operational_status IN (
    'operativo',
    'operativo_con_observaciones',
    'no_operativo',
    'fuera_de_servicio_preventivo',
    'fuera_de_servicio_por_reparacion'
  )),
  conservation_status TEXT DEFAULT 'conforme' CHECK (conservation_status IN (
    'conforme',
    'observado',
    'requiere_reparacion',
    'fuera_de_servicio',
    'pendiente_de_verificacion'
  )),
  contractual_status TEXT DEFAULT 'activo' CHECK (contractual_status IN (
    'activo',
    'stand_by',
    'servicio_suspendido',
    'baja_definitiva'
  )),
  
  -- Asignaciones
  responsible_user_id UUID REFERENCES profiles(id),
  conservation_company TEXT,
  supervisor_name TEXT,
  supervisor_phone TEXT,
  
  -- Contacto del edificio
  building_contact_name TEXT,
  building_contact_phone TEXT,
  building_access_code TEXT,
  
  -- Metadatos
  last_service_date DATE,
  next_service_date DATE,
  notes TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLA: report_recipients (DESTINATARIOS DE INFORMES)
-- =====================================================
CREATE TABLE report_recipients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  elevator_id UUID NOT NULL REFERENCES elevators(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLA: service_records (REGISTROS DE MANTENIMIENTO)
-- =====================================================
CREATE TABLE service_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  elevator_id UUID NOT NULL REFERENCES elevators(id) ON DELETE RESTRICT,
  technician_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  
  -- Datos del servicio
  service_date DATE NOT NULL DEFAULT CURRENT_DATE,
  service_time TIME,
  service_type TEXT NOT NULL CHECK (service_type IN (
    'preventivo',
    'correctivo',
    'emergencia',
    'inspeccion',
    'instalacion',
    'otro'
  )),
  
  -- Estados
  status TEXT DEFAULT 'draft' CHECK (status IN (
    'draft',
    'submitted',
    'in_review',
    'approved',
    'rejected'
  )),
  
  -- Contenido técnico
  description TEXT,
  technical_report TEXT,
  observations TEXT,
  
  -- Estados del ascensor al momento del servicio
  operational_status_at_service TEXT,
  conservation_status_at_service TEXT,
  
  -- Aprobación
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  -- IA
  ai_generated_report TEXT,
  supervisor_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLA: service_checklist_items
-- =====================================================
CREATE TABLE service_checklist_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_record_id UUID NOT NULL REFERENCES service_records(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  status TEXT DEFAULT 'ok' CHECK (status IN ('ok', 'needs_attention', 'failed', 'na')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLA: service_photos
-- =====================================================
CREATE TABLE service_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_record_id UUID NOT NULL REFERENCES service_records(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  photo_type TEXT DEFAULT 'general' CHECK (photo_type IN ('before', 'after', 'general')),
  caption TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLA: monthly_reports (INFORMES MENSUALES)
-- =====================================================
CREATE TABLE monthly_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  elevator_id UUID NOT NULL REFERENCES elevators(id) ON DELETE RESTRICT,
  period TEXT NOT NULL,
  
  -- Contenido
  title TEXT,
  content TEXT,
  summary TEXT,
  
  -- Estado
  status TEXT DEFAULT 'draft' CHECK (status IN (
    'draft',
    'generated',
    'reviewed',
    'approved',
    'sent'
  )),
  
  -- Aprobación
  created_by UUID REFERENCES profiles(id),
  reviewed_by UUID REFERENCES profiles(id),
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  
  -- PDF
  pdf_storage_path TEXT,
  pdf_generated_at TIMESTAMPTZ,
  
  -- Envío
  sent_at TIMESTAMPTZ,
  
  -- Metadatos del período
  services_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(elevator_id, period)
);

-- =====================================================
-- TABLA: report_sends (REGISTRO DE ENVÍOS)
-- =====================================================
CREATE TABLE report_sends (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  monthly_report_id UUID NOT NULL REFERENCES monthly_reports(id) ON DELETE RESTRICT,
  recipient_id UUID REFERENCES report_recipients(id) ON DELETE SET NULL,
  
  recipient_name TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  
  -- Estado del envío
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',
    'sent',
    'failed',
    'bounced'
  )),
  
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  resend_id TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLA: audit_logs (LIBRO DIGITAL INTERNO)
-- =====================================================
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  
  old_data JSONB,
  new_data JSONB,
  
  ip_address INET,
  user_agent TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLA: budget_estimates (PRESUPUESTOS)
-- =====================================================
CREATE TABLE budget_estimates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  elevator_id UUID REFERENCES elevators(id) ON DELETE SET NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  
  description TEXT NOT NULL,
  amount DECIMAL(12,2),
  currency TEXT DEFAULT 'ARS',
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',
    'approved',
    'rejected',
    'in_progress',
    'completed'
  )),
  
  valid_until DATE,
  notes TEXT,
  
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- ÍNDICES
-- =====================================================
CREATE INDEX idx_buildings_client ON buildings(client_id);
CREATE INDEX idx_elevators_building ON elevators(building_id);
CREATE INDEX idx_elevators_client ON elevators(client_id);
CREATE INDEX idx_elevators_qr_token ON elevators(qr_token);
CREATE INDEX idx_elevators_responsible ON elevators(responsible_user_id);
CREATE INDEX idx_report_recipients_elevator ON report_recipients(elevator_id);
CREATE INDEX idx_service_records_elevator ON service_records(elevator_id);
CREATE INDEX idx_service_records_technician ON service_records(technician_id);
CREATE INDEX idx_service_records_status ON service_records(status);
CREATE INDEX idx_monthly_reports_elevator ON monthly_reports(elevator_id);
CREATE INDEX idx_monthly_reports_period ON monthly_reports(period);
CREATE INDEX idx_monthly_reports_status ON monthly_reports(status);
CREATE INDEX idx_report_sends_report ON report_sends(monthly_report_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);

-- =====================================================
-- FUNCIÓN: Generar QR token único
-- =====================================================
CREATE OR REPLACE FUNCTION generate_qr_token()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..12 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCIÓN: Auto-generar profile al registrar usuario
-- =====================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'technician')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para auto-crear profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =====================================================
-- FUNCIÓN: Auto-generar qr_token para ascensores
-- =====================================================
CREATE OR REPLACE FUNCTION set_elevator_qr_token()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.qr_token IS NULL OR NEW.qr_token = '' THEN
    NEW.qr_token := generate_qr_token();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_qr_token_before_insert ON elevators;
CREATE TRIGGER set_qr_token_before_insert
  BEFORE INSERT ON elevators
  FOR EACH ROW EXECUTE FUNCTION set_elevator_qr_token();

-- =====================================================
-- FUNCIÓN: Actualizar updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_clients_updated_at ON clients;
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_buildings_updated_at ON buildings;
CREATE TRIGGER update_buildings_updated_at
  BEFORE UPDATE ON buildings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_elevators_updated_at ON elevators;
CREATE TRIGGER update_elevators_updated_at
  BEFORE UPDATE ON elevators
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_service_records_updated_at ON service_records;
CREATE TRIGGER update_service_records_updated_at
  BEFORE UPDATE ON service_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_monthly_reports_updated_at ON monthly_reports;
CREATE TRIGGER update_monthly_reports_updated_at
  BEFORE UPDATE ON monthly_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_budget_estimates_updated_at ON budget_estimates;
CREATE TRIGGER update_budget_estimates_updated_at
  BEFORE UPDATE ON budget_estimates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE elevators ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_estimates ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLÍTICAS RLS: profiles
-- =====================================================
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admin can view all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin can update any profile"
  ON profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- POLÍTICAS RLS: clients
-- =====================================================
CREATE POLICY "Admin can manage clients"
  ON clients FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Supervisor can view clients"
  ON clients FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'supervisor'
    )
  );

CREATE POLICY "Technician can view clients"
  ON clients FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'technician'
    )
  );

CREATE POLICY "Responsible can view clients"
  ON clients FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'responsible'
    )
  );

-- =====================================================
-- POLÍTICAS RLS: buildings
-- =====================================================
CREATE POLICY "Admin can manage buildings"
  ON buildings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Supervisor can view buildings"
  ON buildings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'supervisor'
    )
  );

CREATE POLICY "Technician can view buildings"
  ON buildings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'technician'
    )
  );

CREATE POLICY "Responsible can view buildings"
  ON buildings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'responsible'
    )
  );

-- =====================================================
-- POLÍTICAS RLS: elevators
-- =====================================================
CREATE POLICY "Admin can manage elevators"
  ON elevators FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Supervisor can view all elevators"
  ON elevators FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'supervisor'
    )
  );

CREATE POLICY "Technician can view all elevators"
  ON elevators FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'technician'
    )
  );

CREATE POLICY "Responsible can view assigned elevators"
  ON elevators FOR SELECT
  USING (
    responsible_user_id = auth.uid()
  );

-- =====================================================
-- POLÍTICAS RLS: report_recipients
-- =====================================================
CREATE POLICY "Admin can manage recipients"
  ON report_recipients FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Supervisor can view recipients"
  ON report_recipients FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'supervisor'
    )
  );

-- =====================================================
-- POLÍTICAS RLS: service_records
-- =====================================================
CREATE POLICY "Technician can insert own service records"
  ON service_records FOR INSERT
  WITH CHECK (
    technician_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'technician'
    )
  );

CREATE POLICY "Technician can view own service records"
  ON service_records FOR SELECT
  USING (
    technician_id = auth.uid()
  );

CREATE POLICY "Supervisor can view all service records"
  ON service_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'supervisor'
    )
  );

CREATE POLICY "Supervisor can update service records"
  ON service_records FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'supervisor'
    )
  );

CREATE POLICY "Admin can manage service records"
  ON service_records FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Responsible can view service records for assigned elevators"
  ON service_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM elevators e
      WHERE e.id = service_records.elevator_id
      AND e.responsible_user_id = auth.uid()
    )
  );

-- =====================================================
-- POLÍTICAS RLS: service_checklist_items
-- =====================================================
CREATE POLICY "Technician can manage own checklist items"
  ON service_checklist_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM service_records sr
      WHERE sr.id = service_record_id
      AND sr.technician_id = auth.uid()
    )
  );

CREATE POLICY "Supervisor can view all checklist items"
  ON service_checklist_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'supervisor'
    )
  );

-- =====================================================
-- POLÍTICAS RLS: service_photos
-- =====================================================
CREATE POLICY "Technician can manage own photos"
  ON service_photos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM service_records sr
      WHERE sr.id = service_record_id
      AND sr.technician_id = auth.uid()
    )
  );

CREATE POLICY "Supervisor can view all photos"
  ON service_photos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'supervisor'
    )
  );

-- =====================================================
-- POLÍTICAS RLS: monthly_reports
-- =====================================================
CREATE POLICY "Supervisor can manage monthly reports"
  ON monthly_reports FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'supervisor'
    )
  );

CREATE POLICY "Admin can view monthly reports"
  ON monthly_reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Technician can view monthly reports"
  ON monthly_reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'technician'
    )
  );

CREATE POLICY "Responsible can view reports for assigned elevators"
  ON monthly_reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM elevators e
      WHERE e.id = monthly_reports.elevator_id
      AND e.responsible_user_id = auth.uid()
    )
  );

-- =====================================================
-- POLÍTICAS RLS: report_sends
-- =====================================================
CREATE POLICY "Supervisor can manage report sends"
  ON report_sends FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'supervisor'
    )
  );

CREATE POLICY "Admin can view report sends"
  ON report_sends FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- POLÍTICAS RLS: audit_logs
-- =====================================================
CREATE POLICY "Admin can view audit logs"
  ON audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Solo service_role puede insertar (vía Edge Functions)

-- =====================================================
-- POLÍTICAS RLS: budget_estimates
-- =====================================================
CREATE POLICY "Admin can manage budgets"
  ON budget_estimates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Supervisor can view budgets"
  ON budget_estimates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'supervisor'
    )
  );

-- =====================================================
-- FIN DEL SCHEMA
-- =====================================================
