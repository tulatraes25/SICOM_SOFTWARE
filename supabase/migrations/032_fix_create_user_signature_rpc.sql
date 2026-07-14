-- 032: Fix create_user_signature RPC runtime error
-- Replaces the function from 031 with corrected variable handling.

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
  v_active BOOLEAN;
  v_new_sig RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'No autenticado');
  END IF;

  -- Validate profile
  SELECT role, active
  INTO v_role, v_active
  FROM profiles
  WHERE id = v_user_id;

  IF v_role IS NULL THEN
    RETURN jsonb_build_object('error', 'Perfil no encontrado');
  END IF;

  IF v_active IS NOT true THEN
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

  -- Audit (non-blocking: log failure but don't fail the RPC)
  BEGIN
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_data)
    VALUES (v_user_id, 'upload_signature', 'user_signatures', v_new_sig.id,
      jsonb_build_object('signature_type', p_signature_type, 'mime_type', p_mime_type));
  EXCEPTION WHEN OTHERS THEN
    -- Audit failure is non-critical; signature is already saved
    NULL;
  END;

  RETURN jsonb_build_object(
    'id', v_new_sig.id,
    'signature_type', v_new_sig.signature_type,
    'storage_path', v_new_sig.storage_path,
    'created_at', v_new_sig.created_at
  );
END;
$$;

-- Permissions (idempotent)
REVOKE ALL ON FUNCTION create_user_signature(text, text, text, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION create_user_signature(text, text, text, text, integer) FROM anon;
GRANT EXECUTE ON FUNCTION create_user_signature(text, text, text, text, integer) TO authenticated;
