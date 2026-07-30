-- Migration 063: Remove client-accessible password change RPC
-- The mandatory password change will be enforced via a protected Edge Function.
-- This RPC allowed any authenticated user to bypass the requirement
-- by calling complete_required_password_change() directly from the client.

DROP FUNCTION IF EXISTS public.complete_required_password_change();
