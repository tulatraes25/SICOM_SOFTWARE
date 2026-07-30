-- Migration 062: Required password change foundation
-- Adds columns and function to enforce temporary password replacement.

-- 1. Columns on public.profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS temporary_password_issued_at TIMESTAMPTZ NULL;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ NULL;

-- 2. Column documentation
COMMENT ON COLUMN public.profiles.must_change_password
IS 'Indica que el usuario debe reemplazar la contraseña temporal antes de acceder a su panel.';

COMMENT ON COLUMN public.profiles.temporary_password_issued_at
IS 'Fecha en la que un administrador emitió o restableció una contraseña temporal.';

COMMENT ON COLUMN public.profiles.password_changed_at
IS 'Fecha del último cambio obligatorio de contraseña confirmado por el usuario.';

-- 3. Function to complete the required password change
CREATE OR REPLACE FUNCTION public.complete_required_password_change()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid;
BEGIN
  uid := auth.uid();

  IF uid IS NULL THEN
    RAISE EXCEPTION 'Sesión no autenticada';
  END IF;

  UPDATE public.profiles
  SET must_change_password = false,
      password_changed_at  = now(),
      updated_at           = now()
  WHERE id = uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil no encontrado';
  END IF;
END;
$$;

-- 4. Permissions
REVOKE ALL
ON FUNCTION public.complete_required_password_change()
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.complete_required_password_change()
FROM anon;

GRANT EXECUTE
ON FUNCTION public.complete_required_password_change()
TO authenticated;
