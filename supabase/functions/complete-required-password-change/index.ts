import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { Database } from "../_shared/database.types.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

type Json = Record<string, unknown>;

function json(body: Json, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

function log(code: string, userId?: string): void {
  const entry: Record<string, unknown> = { code };
  if (userId) entry.user_id = userId;
  console.error("[complete-required-password-change]", entry);
}

Deno.serve(async (req): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return json({ ok: true });
  }

  if (req.method !== "POST") {
    return json({ error: "Method Not Allowed" }, 405);
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    log("SERVER_CONFIG_MISSING");
    return json({ error: "Error interno del servidor" }, 500);
  }

  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // --- Authentication ---
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return json({ error: "No autenticado" }, 401);
  }

  const jwt = authHeader.slice(7);
  const { data: authData, error: authError } = await supabase.auth.getUser(jwt);

  if (authError || !authData.user) {
    return json({ error: "No autenticado" }, 401);
  }

  const userId = authData.user.id;

  // --- Body validation ---
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "La nueva contraseña debe tener entre 8 y 128 caracteres" }, 400);
  }

  if (typeof body !== "object" || body === null) {
    return json({ error: "La nueva contraseña debe tener entre 8 y 128 caracteres" }, 400);
  }

  const newPassword = (body as Record<string, unknown>).new_password;

  if (typeof newPassword !== "string") {
    return json({ error: "La nueva contraseña debe tener entre 8 y 128 caracteres" }, 400);
  }

  if (newPassword.trim().length === 0 || newPassword.length < 8 || newPassword.length > 128) {
    return json({ error: "La nueva contraseña debe tener entre 8 y 128 caracteres" }, 400);
  }

  // --- Profile validation ---
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, active, must_change_password")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    return json({ error: "Acceso no autorizado" }, 403);
  }

  if (profile.active !== true) {
    return json({ error: "Acceso no autorizado" }, 403);
  }

  if (profile.must_change_password !== true) {
    return json({ error: "El cambio de contraseña no está pendiente" }, 409);
  }

  // --- Update password in Supabase Auth ---
  const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
    password: newPassword,
  });

  if (updateError) {
    log("AUTH_PASSWORD_UPDATE_FAILED", userId);
    return json({ error: "No se pudo actualizar la contraseña" }, 400);
  }

  // --- Update profile ---
  const now = new Date().toISOString();
  const { error: profileUpdateError } = await supabase
    .from("profiles")
    .update({
      must_change_password: false,
      password_changed_at: now,
      updated_at: now,
    })
    .eq("id", userId)
    .eq("active", true)
    .eq("must_change_password", true);

  if (profileUpdateError) {
    log("PROFILE_COMPLETION_FAILED", userId);
    return json({ error: "La contraseña fue actualizada, pero no se pudo completar el proceso" }, 500);
  }

  // --- Audit log ---
  const { error: auditError } = await supabase
    .from("audit_logs")
    .insert({
      user_id: userId,
      action: "required_password_changed",
      entity_type: "profiles",
      entity_id: userId,
      new_data: { must_change_password: false },
    });

  if (auditError) {
    log("AUDIT_INSERT_FAILED", userId);
  }

  return json({ success: true });
});
