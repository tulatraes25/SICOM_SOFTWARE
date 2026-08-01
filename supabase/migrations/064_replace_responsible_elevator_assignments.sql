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
  v_current_ids uuid[] := '{}'::uuid[];
  v_expected_ids uuid[] := '{}'::uuid[];
  v_sorted_new uuid[] := '{}'::uuid[];
  v_added uuid[] := '{}'::uuid[];
  v_removed uuid[] := '{}'::uuid[];
  v_final_ids uuid[] := '{}'::uuid[];
  v_requested_count bigint;
  v_row_count bigint;
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

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Responsable no encontrado';
  END IF;

  IF v_target_role <> 'responsible' THEN
    RAISE EXCEPTION 'El usuario indicado no es responsable';
  END IF;

  -- 3. Validate elevator_ids
  IF p_elevator_ids IS NULL OR cardinality(p_elevator_ids) = 0 THEN
    RAISE EXCEPTION 'Debe seleccionar al menos un ascensor';
  END IF;

  IF cardinality(p_elevator_ids) > 100 THEN
    RAISE EXCEPTION 'No se pueden asignar más de 100 ascensores';
  END IF;

  -- Check for null elements
  IF EXISTS (
    SELECT 1 FROM unnest(p_elevator_ids) AS eid WHERE eid IS NULL
  ) THEN
    RAISE EXCEPTION 'La selección de ascensores es inválida';
  END IF;

  -- Check duplicates
  IF cardinality(p_elevator_ids) <>
     (SELECT count(DISTINCT elevator_id) FROM unnest(p_elevator_ids) AS requested(elevator_id)) THEN
    RAISE EXCEPTION 'No se permiten ascensores duplicados';
  END IF;

  -- Normalize sorted new elevators
  v_sorted_new := ARRAY(
    SELECT elevator_id
    FROM unnest(p_elevator_ids) AS requested(elevator_id)
    ORDER BY elevator_id
  );

  -- 4. Validate expected_current_elevator_ids
  v_expected_ids := ARRAY(
    SELECT elevator_id
    FROM unnest(
      COALESCE(p_expected_current_elevator_ids, '{}'::uuid[])
    ) AS expected(elevator_id)
    ORDER BY elevator_id
  );

  -- Check for null elements in expected
  IF EXISTS (
    SELECT 1 FROM unnest(COALESCE(p_expected_current_elevator_ids, '{}'::uuid[])) AS eid WHERE eid IS NULL
  ) THEN
    RAISE EXCEPTION 'La selección de ascensores es inválida';
  END IF;

  -- Check duplicates in expected
  IF cardinality(v_expected_ids) > 0 AND
     cardinality(v_expected_ids) <>
     (SELECT count(DISTINCT elevator_id) FROM unnest(v_expected_ids) AS expected(elevator_id)) THEN
    RAISE EXCEPTION 'No se permiten ascensores duplicados';
  END IF;

  -- Reject absurdly large expected arrays
  IF cardinality(v_expected_ids) > 100 THEN
    RAISE EXCEPTION 'La selección de ascensores es inválida';
  END IF;

  -- 5. Lock elevators in stable order (single query for both sets)
  PERFORM e.id
  FROM elevators e
  WHERE
    e.responsible_user_id = p_responsible_id
    OR e.id = ANY(v_sorted_new)
  ORDER BY e.id
  FOR UPDATE;

  -- Load current assignments after lock
  SELECT COALESCE(
    array_agg(e.id ORDER BY e.id),
    '{}'::uuid[]
  )
  INTO v_current_ids
  FROM elevators e
  WHERE e.responsible_user_id = p_responsible_id;

  -- 6. Optimistic concurrency check
  IF v_current_ids IS DISTINCT FROM v_expected_ids THEN
    RAISE EXCEPTION 'Las asignaciones cambiaron. Actualizá la página e intentá nuevamente';
  END IF;

  -- 7. Check all requested elevators exist
  SELECT count(*)
  INTO v_requested_count
  FROM elevators e
  WHERE e.id = ANY(v_sorted_new);

  IF v_requested_count <> cardinality(v_sorted_new) THEN
    RAISE EXCEPTION 'Uno o más ascensores no están disponibles';
  END IF;

  -- 8. Validate availability (active and not assigned to another responsible)
  IF EXISTS (
    SELECT 1
    FROM elevators e
    WHERE e.id = ANY(v_sorted_new)
      AND (
        e.active IS DISTINCT FROM true
        OR (
          e.responsible_user_id IS NOT NULL
          AND e.responsible_user_id <> p_responsible_id
        )
      )
  ) THEN
    RAISE EXCEPTION 'Uno o más ascensores no están disponibles';
  END IF;

  -- 9. Compute added and removed (stable order)
  v_added := ARRAY(
    SELECT unnest(v_sorted_new) EXCEPT SELECT unnest(v_current_ids)
    ORDER BY 1
  );

  v_removed := ARRAY(
    SELECT unnest(v_current_ids) EXCEPT SELECT unnest(v_sorted_new)
    ORDER BY 1
  );

  -- 10. Release removed elevators
  UPDATE elevators
  SET responsible_user_id = NULL, updated_at = now()
  WHERE id = ANY(v_removed)
    AND responsible_user_id = p_responsible_id;

  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  IF v_row_count <> cardinality(v_removed) THEN
    RAISE EXCEPTION 'Error al liberar ascensores';
  END IF;

  -- 11. Assign only added elevators
  UPDATE elevators
  SET responsible_user_id = p_responsible_id, updated_at = now()
  WHERE id = ANY(v_added)
    AND active = true
    AND responsible_user_id IS NULL;

  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  IF v_row_count <> cardinality(v_added) THEN
    RAISE EXCEPTION 'Error al asignar ascensores';
  END IF;

  -- 12. Verify final state matches exactly
  SELECT COALESCE(
    array_agg(e.id ORDER BY e.id),
    '{}'::uuid[]
  )
  INTO v_final_ids
  FROM elevators e
  WHERE e.responsible_user_id = p_responsible_id;

  IF v_final_ids IS DISTINCT FROM v_sorted_new THEN
    RAISE EXCEPTION 'Error en la verificación final de asignaciones';
  END IF;

  -- 13. Audit log
  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_data)
  VALUES (
    p_actor_id,
    'responsible_assignments_replaced',
    'profiles',
    p_responsible_id,
    jsonb_build_object(
      'previous_elevator_ids', to_jsonb(v_current_ids),
      'assigned_elevator_ids', to_jsonb(v_final_ids),
      'added_elevator_ids', to_jsonb(v_added),
      'removed_elevator_ids', to_jsonb(v_removed)
    )
  );

  -- 14. Return result
  RETURN jsonb_build_object(
    'responsible_user_id', p_responsible_id,
    'previous_elevator_ids', to_jsonb(v_current_ids),
    'assigned_elevator_ids', to_jsonb(v_final_ids),
    'added_elevator_ids', to_jsonb(v_added),
    'removed_elevator_ids', to_jsonb(v_removed)
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
