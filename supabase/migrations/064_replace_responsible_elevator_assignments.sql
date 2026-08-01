-- Migration 064: Transactional RPC to replace responsible elevator assignments
-- SECURITY DEFINER — invoked exclusively by admin-users Edge Function via service_role

CREATE OR REPLACE FUNCTION public.replace_responsible_elevator_assignments(
  p_responsible_id uuid,
  p_elevator_ids uuid[],
  p_expected_current_elevator_ids uuid[],
  p_actor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_admin boolean;
  v_target_role text;
  v_target_found boolean;
  v_current_ids uuid[];
  v_added uuid[];
  v_removed uuid[];
  v_sorted_new uuid[];
  v_sorted_old uuid[];
  v_sorted_added uuid[];
  v_sorted_removed uuid[];
  v_final_count integer;
BEGIN
  -- 1. Validate actor
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_actor_id AND role = 'admin' AND active = true
  ) INTO v_actor_admin;

  IF NOT v_actor_admin THEN
    RAISE EXCEPTION 'Acceso no autorizado' USING ERRCODE = '42501';
  END IF;

  -- 2. Validate responsible (FOR UPDATE locks the row)
  IF p_responsible_id IS NULL THEN
    RAISE EXCEPTION 'Responsable no encontrado';
  END IF;

  SELECT role INTO v_target_role
  FROM profiles
  WHERE id = p_responsible_id
  FOR UPDATE;

  GET DIAGNOSTICS v_target_found = ROW_COUNT;

  IF v_target_found = 0 THEN
    RAISE EXCEPTION 'Responsable no encontrado';
  END IF;

  IF v_target_role <> 'responsible' THEN
    RAISE EXCEPTION 'El usuario indicado no es responsable';
  END IF;

  -- 3. Validate elevator_ids
  IF p_elevator_ids IS NULL OR array_length(p_elevator_ids, 1) = 0 THEN
    RAISE EXCEPTION 'Debe seleccionar al menos un ascensor';
  END IF;

  IF array_length(p_elevator_ids, 1) > 100 THEN
    RAISE EXCEPTION 'No se pueden asignar más de 100 ascensores';
  END IF;

  -- Check duplicates by comparing array length with distinct array length
  IF array_length(p_elevator_ids, 1) <> array_length(SELECT ARRAY(SELECT DISTINCT unnest(p_elevator_ids))) THEN
    RAISE EXCEPTION 'No se permiten ascensores duplicados';
  END IF;

  -- 4. Validate expected_current_elevator_ids (no duplicates)
  IF p_expected_current_elevator_ids IS NOT NULL
     AND array_length(p_expected_current_elevator_ids, 1) > 0
     AND array_length(p_expected_current_elevator_ids, 1) <> array_length(SELECT ARRAY(SELECT DISTINCT unnest(p_expected_current_elevator_ids))) THEN
    RAISE EXCEPTION 'No se permiten ascensores duplicados';
  END IF;

  -- 5. Lock current assignments for this responsible (order by id to reduce deadlock risk)
  SELECT ARRAY(
    SELECT id FROM elevators
    WHERE responsible_user_id = p_responsible_id
    ORDER BY id
  ) INTO v_current_ids;

  -- Lock current rows
  PERFORM 1 FROM elevators
  WHERE responsible_user_id = p_responsible_id
  FOR UPDATE OF elevators;

  -- Lock requested rows (order by id)
  v_sorted_new := ARRAY(SELECT unnest(p_elevator_ids) ORDER BY 1);

  PERFORM 1 FROM elevators
  WHERE id = ANY(v_sorted_new)
  FOR UPDATE OF elevators;

  -- 6. Optimistic concurrency check
  v_sorted_old := ARRAY(SELECT unnest(v_current_ids) ORDER BY 1);

  IF COALESCE(array_length(v_sorted_old, 1), 0) <> COALESCE(array_length(p_expected_current_elevator_ids, 1), 0)
     OR v_sorted_old IS DISTINCT FROM (
       SELECT ARRAY(SELECT unnest(p_expected_current_elevator_ids) ORDER BY 1)
     ) THEN
    RAISE EXCEPTION 'Las asignaciones cambiaron. Actualizá la página e intentá nuevamente';
  END IF;

  -- 7. Validate all requested elevators exist, are active, and are available
  IF EXISTS (
    SELECT 1 FROM elevators
    WHERE id = ANY(v_sorted_new)
      AND (active IS DISTINCT FROM true OR responsible_user_id IS DISTINCT FROM NULL AND responsible_user_id <> p_responsible_id)
  ) THEN
    RAISE EXCEPTION 'Uno o más ascensores no están disponibles';
  END IF;

  -- 8. Compute added and removed
  v_added := ARRAY(
    SELECT unnest(v_sorted_new) EXCEPT SELECT unnest(v_sorted_old)
  );
  v_removed := ARRAY(
    SELECT unnest(v_sorted_old) EXCEPT SELECT unnest(v_sorted_new)
  );

  v_sorted_added := ARRAY(SELECT unnest(v_added) ORDER BY 1);
  v_sorted_removed := ARRAY(SELECT unnest(v_removed) ORDER BY 1);

  -- 9. Release removed elevators
  UPDATE elevators
  SET responsible_user_id = NULL, updated_at = now()
  WHERE id = ANY(v_sorted_removed)
    AND responsible_user_id = p_responsible_id;

  GET DIAGNOSTICS v_final_count = ROW_COUNT;
  IF v_final_count <> array_length(v_sorted_removed, 1) THEN
    RAISE EXCEPTION 'Error al liberar ascensores';
  END IF;

  -- 10. Assign all requested elevators
  UPDATE elevators
  SET responsible_user_id = p_responsible_id, updated_at = now()
  WHERE id = ANY(v_sorted_new)
    AND (responsible_user_id IS DISTINCT FROM p_responsible_id);

  GET DIAGNOSTICS v_final_count = ROW_COUNT;
  -- v_final_count may be less than array length if some were already assigned; that's OK

  -- 11. Verify final state matches exactly
  IF EXISTS (
    SELECT 1 FROM elevators
    WHERE responsible_user_id = p_responsible_id
      AND id <> ALL(v_sorted_new)
  ) OR (
    SELECT count(*) FROM elevators
    WHERE responsible_user_id = p_responsible_id
  ) <> array_length(v_sorted_new, 1) THEN
    RAISE EXCEPTION 'Error en la verificación final de asignaciones';
  END IF;

  -- 12. Audit log
  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_data)
  VALUES (
    p_actor_id,
    'responsible_assignments_replaced',
    'profiles',
    p_responsible_id,
    jsonb_build_object(
      'previous_elevator_ids', to_jsonb(v_sorted_old),
      'assigned_elevator_ids', to_jsonb(v_sorted_new),
      'added_elevator_ids', to_jsonb(v_sorted_added),
      'removed_elevator_ids', to_jsonb(v_sorted_removed)
    )
  );

  -- 13. Return result
  RETURN jsonb_build_object(
    'responsible_user_id', p_responsible_id,
    'previous_elevator_ids', to_jsonb(v_sorted_old),
    'assigned_elevator_ids', to_jsonb(v_sorted_new),
    'added_elevator_ids', to_jsonb(v_sorted_added),
    'removed_elevator_ids', to_jsonb(v_sorted_removed)
  );
END;
$$;

COMMENT ON FUNCTION public.replace_responsible_elevator_assignments(
  uuid, uuid[], uuid[], uuid
) IS 'Reemplaza de forma transaccional las asignaciones de ascensores de un responsable. Destinada exclusivamente a admin-users Edge Function mediante service_role. Usa control de concurrencia optimista con p_expected_current_elevator_ids.';

-- Permissions
REVOKE ALL ON FUNCTION public.replace_responsible_elevator_assignments(
  uuid, uuid[], uuid[], uuid
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.replace_responsible_elevator_assignments(
  uuid, uuid[], uuid[], uuid
) FROM anon;

REVOKE ALL ON FUNCTION public.replace_responsible_elevator_assignments(
  uuid, uuid[], uuid[], uuid
) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.replace_responsible_elevator_assignments(
  uuid, uuid[], uuid[], uuid
) TO service_role;
