-- 030: Document branding and electronic signatures
-- Idempotent where possible. Does NOT delete existing data.

-- ============================================================
-- 1. TABLES
-- ============================================================

-- Company document settings (singleton)
CREATE TABLE IF NOT EXISTS company_document_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true,
  company_name TEXT NOT NULL DEFAULT 'SICOM Patagonia SRL',
  legal_name TEXT,
  tax_id TEXT,
  address TEXT,
  phone TEXT DEFAULT '+54 297 421-4430',
  email TEXT,
  website TEXT DEFAULT 'https://sicompatagonia.com/',
  logo_path TEXT,
  header_text TEXT,
  footer_text TEXT,
  primary_color TEXT DEFAULT '#8DB600',
  secondary_color TEXT DEFAULT '#06172E',
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User signatures
CREATE TABLE IF NOT EXISTS user_signatures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  signature_type TEXT NOT NULL CHECK (signature_type IN ('technician', 'administrator', 'supervisor', 'representative')),
  storage_path TEXT NOT NULL,
  original_filename TEXT,
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/png', 'image/jpeg')),
  file_size INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  uploaded_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- Document signatures (snapshot)
CREATE TABLE IF NOT EXISTS document_signatures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_type TEXT NOT NULL CHECK (document_type IN (
    'service_report', 'budget', 'service_order',
    'visit_entry', 'visit_history', 'external_invoice_delivery', 'other'
  )),
  document_id UUID NOT NULL,
  service_case_id UUID REFERENCES service_cases(id) ON DELETE SET NULL,
  signer_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  signer_role TEXT NOT NULL,
  signature_id UUID REFERENCES user_signatures(id) ON DELETE SET NULL,
  signature_storage_path TEXT,
  signer_name_snapshot TEXT NOT NULL,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_user_signatures_user ON user_signatures(user_id);
CREATE INDEX IF NOT EXISTS idx_user_signatures_type ON user_signatures(signature_type);
CREATE INDEX IF NOT EXISTS idx_user_signatures_active ON user_signatures(user_id, signature_type, is_active);
CREATE INDEX IF NOT EXISTS idx_document_signatures_doc ON document_signatures(document_type, document_id);
CREATE INDEX IF NOT EXISTS idx_document_signatures_signer ON document_signatures(signer_user_id);
CREATE INDEX IF NOT EXISTS idx_document_signatures_case ON document_signatures(service_case_id);
CREATE INDEX IF NOT EXISTS idx_document_signatures_created ON document_signatures(created_at);

-- Unique constraint: one active signature per user per type
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_signatures_active_unique
  ON user_signatures(user_id, signature_type)
  WHERE is_active = true;

-- ============================================================
-- 3. BUCKET
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('user-signatures', 'user-signatures', false, 2097152, ARRAY['image/png', 'image/jpeg'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg'];

-- ============================================================
-- 4. RLS
-- ============================================================

ALTER TABLE company_document_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_signatures ENABLE ROW LEVEL SECURITY;

-- company_document_settings
DO $$
BEGIN
  DROP POLICY IF EXISTS "cds_select_all" ON company_document_settings;
  DROP POLICY IF EXISTS "cds_admin_update" ON company_document_settings;

  CREATE POLICY "cds_select_all" ON company_document_settings
    FOR SELECT USING (true);

  CREATE POLICY "cds_admin_update" ON company_document_settings
    FOR UPDATE USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
END $$;

-- user_signatures
DO $$
BEGIN
  DROP POLICY IF EXISTS "us_select_own" ON user_signatures;
  DROP POLICY IF EXISTS "us_insert_own" ON user_signatures;
  DROP POLICY IF EXISTS "us_update_own" ON user_signatures;
  DROP POLICY IF EXISTS "us_admin_all" ON user_signatures;

  -- Users can read their own signatures
  CREATE POLICY "us_select_own" ON user_signatures
    FOR SELECT USING (user_id = auth.uid());

  -- Admin can read all signatures
  CREATE POLICY "us_admin_all" ON user_signatures
    FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

  -- Users can insert their own signatures
  CREATE POLICY "us_insert_own" ON user_signatures
    FOR INSERT WITH CHECK (
      user_id = auth.uid()
      AND uploaded_by = auth.uid()
    );

  -- Users can update their own signatures (revoke)
  CREATE POLICY "us_update_own" ON user_signatures
    FOR UPDATE USING (
      user_id = auth.uid()
    );
END $$;

-- document_signatures (read-only for all)
DO $$
BEGIN
  DROP POLICY IF EXISTS "ds_select_admin" ON document_signatures;
  DROP POLICY IF EXISTS "ds_select_technician" ON document_signatures;

  CREATE POLICY "ds_select_admin" ON document_signatures
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'supervisor'))
    );

  CREATE POLICY "ds_select_technician" ON document_signatures
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'technician')
      AND signer_user_id = auth.uid()
    );
END $$;

-- ============================================================
-- 5. RPC: sign_document
-- ============================================================

CREATE OR REPLACE FUNCTION sign_document(
  p_document_type TEXT,
  p_document_id UUID,
  p_service_case_id UUID DEFAULT NULL,
  p_signer_role TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_role TEXT;
  v_sig RECORD;
  v_profile RECORD;
  v_existing RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'No autenticado');
  END IF;

  SELECT role INTO v_role FROM profiles WHERE id = v_user_id AND active = true;
  IF v_role IS NULL THEN
    RETURN jsonb_build_object('error', 'Perfil no encontrado');
  END IF;

  -- Check for existing signature on this document
  SELECT * INTO v_existing FROM document_signatures
  WHERE document_type = p_document_type
    AND document_id = p_document_id
    AND signer_user_id = v_user_id
    AND signer_role = COALESCE(p_signer_role, v_role);

  IF FOUND THEN
    RETURN jsonb_build_object(
      'id', v_existing.id,
      'signed_at', v_existing.signed_at,
      'message', 'Documento ya firmado por este usuario'
    );
  END IF;

  -- Find active signature
  SELECT * INTO v_sig FROM user_signatures
  WHERE user_id = v_user_id
    AND is_active = true
    AND signature_type = CASE
      WHEN v_role = 'technician' THEN 'technician'
      WHEN v_role = 'admin' THEN 'administrator'
      WHEN v_role = 'supervisor' THEN 'supervisor'
      ELSE 'representative'
    END
  ORDER BY created_at DESC
  LIMIT 1;

  -- Get profile name
  SELECT full_name INTO v_profile FROM profiles WHERE id = v_user_id;

  -- Create signature record
  INSERT INTO document_signatures (
    document_type, document_id, service_case_id,
    signer_user_id, signer_role,
    signature_id, signature_storage_path,
    signer_name_snapshot, metadata
  ) VALUES (
    p_document_type, p_document_id, p_service_case_id,
    v_user_id, COALESCE(p_signer_role, v_role),
    v_sig.id, v_sig.storage_path,
    COALESCE(v_profile.full_name, 'Usuario'),
    jsonb_build_object(
      'has_signature', v_sig.id IS NOT NULL,
      'role', v_role
    )
  )
  RETURNING * INTO v_sig;

  -- Audit
  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_data)
  VALUES (v_user_id, 'sign', 'document_signatures', v_sig.id,
    jsonb_build_object('document_type', p_document_type, 'document_id', p_document_id));

  RETURN jsonb_build_object(
    'id', v_sig.id,
    'signer_name', v_sig.signer_name_snapshot,
    'has_signature', v_sig.signature_id IS NOT NULL,
    'signed_at', v_sig.signed_at
  );
END;
$$;

REVOKE ALL ON FUNCTION sign_document(TEXT, UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION sign_document(TEXT, UUID, UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION sign_document(TEXT, UUID, UUID, TEXT) TO authenticated;

-- ============================================================
-- 6. RPC: get_document_settings
-- ============================================================

CREATE OR REPLACE FUNCTION get_document_settings()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_settings RECORD;
BEGIN
  SELECT * INTO v_settings FROM company_document_settings WHERE id = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Configuración no encontrada');
  END IF;

  RETURN jsonb_build_object(
    'company_name', v_settings.company_name,
    'legal_name', v_settings.legal_name,
    'tax_id', v_settings.tax_id,
    'address', v_settings.address,
    'phone', v_settings.phone,
    'email', v_settings.email,
    'website', v_settings.website,
    'logo_path', v_settings.logo_path,
    'header_text', v_settings.header_text,
    'footer_text', v_settings.footer_text,
    'primary_color', v_settings.primary_color,
    'secondary_color', v_settings.secondary_color
  );
END;
$$;

REVOKE ALL ON FUNCTION get_document_settings() FROM PUBLIC;
REVOKE ALL ON FUNCTION get_document_settings() FROM anon;
GRANT EXECUTE ON FUNCTION get_document_settings() TO authenticated;

-- ============================================================
-- 7. RPC: update_document_settings
-- ============================================================

CREATE OR REPLACE FUNCTION update_document_settings(
  p_company_name TEXT DEFAULT NULL,
  p_legal_name TEXT DEFAULT NULL,
  p_tax_id TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_website TEXT DEFAULT NULL,
  p_logo_path TEXT DEFAULT NULL,
  p_header_text TEXT DEFAULT NULL,
  p_footer_text TEXT DEFAULT NULL,
  p_primary_color TEXT DEFAULT NULL,
  p_secondary_color TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_role TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'No autenticado');
  END IF;

  SELECT role INTO v_role FROM profiles WHERE id = v_user_id AND active = true;
  IF v_role IS DISTINCT FROM 'admin' THEN
    RETURN jsonb_build_object('error', 'Solo administradores pueden modificar configuración documental');
  END IF;

  UPDATE company_document_settings SET
    company_name = COALESCE(p_company_name, company_name),
    legal_name = COALESCE(p_legal_name, legal_name),
    tax_id = COALESCE(p_tax_id, tax_id),
    address = COALESCE(p_address, address),
    phone = COALESCE(p_phone, phone),
    email = COALESCE(p_email, email),
    website = COALESCE(p_website, website),
    logo_path = COALESCE(p_logo_path, logo_path),
    header_text = COALESCE(p_header_text, header_text),
    footer_text = COALESCE(p_footer_text, footer_text),
    primary_color = COALESCE(p_primary_color, primary_color),
    secondary_color = COALESCE(p_secondary_color, secondary_color),
    updated_by = v_user_id,
    updated_at = NOW()
  WHERE id = true;

  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_data)
  VALUES (v_user_id, 'update_settings', 'company_document_settings', NULL,
    jsonb_build_object('updated_fields', jsonb_build_object(
      'company_name', p_company_name, 'phone', p_phone, 'email', p_email
    )));

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION update_document_settings(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION update_document_settings(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION update_document_settings(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================
-- 8. INITIAL CONFIGURATION (idempotent)
-- ============================================================

INSERT INTO company_document_settings (id, company_name, phone, website)
VALUES (true, 'SICOM Patagonia SRL', '+54 297 421-4430', 'https://sicompatagonia.com/')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 9. TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION update_user_signatures_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_user_signatures_updated_at ON user_signatures;
CREATE TRIGGER trigger_user_signatures_updated_at
  BEFORE UPDATE ON user_signatures
  FOR EACH ROW
  EXECUTE FUNCTION update_user_signatures_updated_at();

CREATE OR REPLACE FUNCTION update_company_document_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_company_document_settings_updated_at ON company_document_settings;
CREATE TRIGGER trigger_company_document_settings_updated_at
  BEFORE UPDATE ON company_document_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_company_document_settings_updated_at();

-- ============================================================
-- DONE
-- ============================================================
