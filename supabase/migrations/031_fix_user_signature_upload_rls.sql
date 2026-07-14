-- 031: Fix user signature upload RLS
-- Adds missing storage.objects policies and a secure RPC for signature upload.

-- ============================================================
-- 1. STORAGE POLICIES FOR user-signatures BUCKET
-- ============================================================

-- Allow authenticated users to upload to their own folder
DO $$
BEGIN
  DROP POLICY IF EXISTS "user_sig_insert_own" ON storage.objects;
  DROP POLICY IF EXISTS "user_sig_select_own" ON storage.objects;
  DROP POLICY IF EXISTS "user_sig_select_admin" ON storage.objects;
  DROP POLICY IF EXISTS "user_sig_delete_own" ON storage.objects;

  -- INSERT: authenticated users can upload to users/{their_uid}/
  CREATE POLICY "user_sig_insert_own" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'user-signatures'
      AND (storage.foldername(name))[1] = 'users'
      AND (storage.foldername(name))[2] = auth.uid()::text
    );

  -- SELECT: users can read their own files
  CREATE POLICY "user_sig_select_own" ON storage.objects
    FOR SELECT TO authenticated
    USING (
      bucket_id = 'user-signatures'
      AND (storage.foldername(name))[1] = 'users'
      AND (storage.foldername(name))[2] = auth.uid()::text
    );

  -- SELECT: admin can read all signature files
  CREATE POLICY "user_sig_select_admin" ON storage.objects
    FOR SELECT TO authenticated
    USING (
      bucket_id = 'user-signatures'
      AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

  -- DELETE: users can delete their own files (for rollback on failed insert)
  CREATE POLICY "user_sig_delete_own" ON storage.objects
    FOR DELETE TO authenticated
    USING (
      bucket_id = 'user-signatures'
      AND (storage.foldername(name))[1] = 'users'
      AND (storage.foldername(name))[2] = auth.uid()::text
    );
END $$;

-- ============================================================
-- 2. SECURE RPC: create_user_signature
-- ============================================================

CREATE OR REPLACE FUNCTION create_user_signature(
  p_signature_type text,
  p_storage_path text,
  p_original_filename text,
  p_mime_type text,
  p_file_size integer
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_role TEXT;
  v_profile RECORD;
  v_new_sig RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'No autenticado');
  END IF;

  -- Validate profile
  SELECT role, active INTO v_role, v_profile.active
  FROM profiles WHERE id = v_user_id;

  IF v_profile.active IS NOT true THEN
    RETURN jsonb_build_object('error', 'Perfil inactivo');
  END IF;

  -- Validate signature_type matches role
  IF v_role = 'technician' AND p_signature_type != 'technician' THEN
    RETURN jsonb_build_object('error', 'Como técnico solo podés cargar firma tipo Técnico');
  ELSIF v_role = 'supervisor' AND p_signature_type != 'supervisor' THEN
    RETURN jsonb_build_object('error', 'Como supervisor solo podés cargar firma tipo Supervisor');
  ELSIF v_role = 'admin' AND p_signature_type NOT IN ('administrator', 'supervisor') THEN
    RETURN jsonb_build_object('error', 'Como administrador podés cargar firma tipo Administrador o Supervisor');
  END IF;

  -- Validate storage path belongs to user
  IF p_storage_path NOT LIKE 'users/' || v_user_id::text || '/%' THEN
    RETURN jsonb_build_object('error', 'Ruta de almacenamiento no válida');
  END IF;

  -- Validate MIME type
  IF p_mime_type NOT IN ('image/png', 'image/jpeg') THEN
    RETURN jsonb_build_object('error', 'Solo se permiten PNG o JPEG');
  END IF;

  -- Deactivate existing signature of same type
  UPDATE user_signatures
  SET is_active = false,
      revoked_at = NOW(),
      revoked_by = v_user_id
  WHERE user_id = v_user_id
    AND signature_type = p_signature_type
    AND is_active = true;

  -- Insert new signature
  INSERT INTO user_signatures (
    user_id, signature_type, storage_path,
    original_filename, mime_type, file_size,
    is_active, uploaded_by
  ) VALUES (
    v_user_id, p_signature_type, p_storage_path,
    p_original_filename, p_mime_type, p_file_size,
    true, v_user_id
  )
  RETURNING * INTO v_new_sig;

  -- Audit
  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_data)
  VALUES (v_user_id, 'upload_signature', 'user_signatures', v_new_sig.id,
    jsonb_build_object('signature_type', p_signature_type, 'mime_type', p_mime_type));

  RETURN jsonb_build_object(
    'id', v_new_sig.id,
    'signature_type', v_new_sig.signature_type,
    'storage_path', v_new_sig.storage_path,
    'created_at', v_new_sig.created_at
  );
END;
$$;

REVOKE ALL ON FUNCTION create_user_signature(text, text, text, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION create_user_signature(text, text, text, text, integer) FROM anon;
GRANT EXECUTE ON FUNCTION create_user_signature(text, text, text, text, integer) TO authenticated;

-- ============================================================
-- DONE
-- ============================================================
