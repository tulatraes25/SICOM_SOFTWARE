import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VALID_ACTIONS = new Set([
  "list_users", "get_user", "create_user", "update_user", "reset_password", "send_recovery", "create_responsible",
]);

const VALID_ROLES = ["admin", "supervisor", "technician", "responsible"] as const;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function log(code: string, adminId?: string, targetId?: string): void {
  const entry: Record<string, unknown> = { code };
  if (adminId) entry.admin_user_id = adminId;
  if (targetId) entry.target_user_id = targetId;
  console.error("[admin-users]", entry);
}

let authenticatedAdminId: string | undefined;

serve(async (req): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return json({ ok: true });
  }

  if (req.method !== "POST") {
    return json({ error: "Method Not Allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      log("SERVER_CONFIG_MISSING");
      return json({ error: "Error interno del servidor" }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
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
      log("AUTH_FAILED");
      return json({ error: "No autenticado" }, 401);
    }

    authenticatedAdminId = authData.user.id;
    const adminId = authenticatedAdminId;

    // --- Admin profile check ---
    const { data: adminProfile, error: adminProfileError } = await supabase
      .from("profiles")
      .select("id, role, active")
      .eq("id", adminId)
      .single();

    if (adminProfileError || !adminProfile || adminProfile.role !== "admin" || adminProfile.active !== true) {
      log("ADMIN_PROFILE_FAILED", adminId);
      return json({ error: "Acceso no autorizado" }, 403);
    }

    // --- Body validation ---
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Acción no válida" }, 400);
    }

    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return json({ error: "Acción no válida" }, 400);
    }

    const { action, data } = body as Record<string, unknown>;

    if (typeof action !== "string" || !VALID_ACTIONS.has(action)) {
      return json({ error: "Acción no válida" }, 400);
    }

    if (data !== undefined && (typeof data !== "object" || data === null || Array.isArray(data))) {
      return json({ error: "Acción no válida" }, 400);
    }

    // --- Actions ---
    switch (action) {
      case "list_users": {
        const { data: users, error: listError } = await supabase.auth.admin.listUsers();
        if (listError) {
          log("LIST_USERS_FAILED", adminId);
          return json({ error: "No se pudo obtener la lista de usuarios" }, 400);
        }

        const userIds = users.users.map((u) => u.id);
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name, role, active, created_at, must_change_password, temporary_password_issued_at, password_changed_at")
          .in("id", userIds);

        if (profilesError) {
          log("LIST_USERS_FAILED", adminId);
          return json({ error: "No se pudo obtener la lista de usuarios" }, 400);
        }

        const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
        const result = users.users.map((u) => ({
          id: u.id,
          email: u.email,
          full_name: profileMap.get(u.id)?.full_name || "",
          role: profileMap.get(u.id)?.role || "technician",
          active: profileMap.get(u.id)?.active ?? true,
          created_at: profileMap.get(u.id)?.created_at || u.created_at,
          last_sign_in_at: u.last_sign_in_at,
          must_change_password: profileMap.get(u.id)?.must_change_password ?? false,
          temporary_password_issued_at: profileMap.get(u.id)?.temporary_password_issued_at ?? null,
          password_changed_at: profileMap.get(u.id)?.password_changed_at ?? null,
        }));

        return json({ users: result });
      }

      case "get_user": {
        const d = data as Record<string, unknown>;
        const user_id = d?.user_id;
        if (typeof user_id !== "string" || !user_id) {
          return json({ error: "user_id es obligatorio" }, 400);
        }

        const { data: u, error: authGetError } = await supabase.auth.admin.getUserById(user_id);
        if (authGetError) {
          log("GET_USER_FAILED", adminId, user_id);
          return json({ error: "Usuario no encontrado" }, 404);
        }

        const { data: p, error: profileGetError } = await supabase
          .from("profiles")
          .select("id, full_name, role, active, created_at, must_change_password, temporary_password_issued_at, password_changed_at")
          .eq("id", user_id)
          .single();

        if (profileGetError || !p) {
          log("GET_USER_FAILED", adminId, user_id);
          return json({ error: "Usuario no encontrado" }, 404);
        }

        return json({
          id: u.user.id,
          email: u.user.email,
          full_name: p.full_name || "",
          role: p.role || "technician",
          active: p.active ?? true,
          created_at: p.created_at || u.user.created_at,
          last_sign_in_at: u.user.last_sign_in_at,
          must_change_password: p.must_change_password ?? false,
          temporary_password_issued_at: p.temporary_password_issued_at ?? null,
          password_changed_at: p.password_changed_at ?? null,
        });
      }

      case "create_user": {
        const d = data as Record<string, unknown>;
        const email = typeof d?.email === "string" ? d.email.trim().toLowerCase() : "";
        const password = typeof d?.password === "string" ? d.password : "";
        const full_name = typeof d?.full_name === "string" ? d.full_name.trim() : "";
        const role = typeof d?.role === "string" ? d.role : "";

        const hasActive = Object.prototype.hasOwnProperty.call(d, "active");
        if (hasActive && typeof d.active !== "boolean") {
          return json({ error: "El estado activo debe ser booleano" }, 400);
        }
        const active = hasActive ? (d.active as boolean) : true;

        if (!email || !password || !full_name || !role) {
          return json({ error: "email, password, full_name y role son obligatorios" }, 400);
        }

        if (!(VALID_ROLES as readonly string[]).includes(role)) {
          return json({ error: "Rol inválido" }, 400);
        }

        if (role === "responsible") {
          return json({ error: "Los responsables deben crearse desde Responsables de edificios" }, 409);
        }

        if (typeof password !== "string" || password.trim().length === 0 || password.length < 8 || password.length > 128) {
          return json({ error: "La contraseña debe tener entre 8 y 128 caracteres" }, 400);
        }

        const requiresPasswordChange = role === "responsible";
        const issuedAt = requiresPasswordChange ? new Date().toISOString() : null;

        // Create in Auth
        const { data: authUser, error: createError } = await supabase.auth.admin.createUser({
          email, password, email_confirm: true,
          user_metadata: { full_name, role },
        });

        if (createError) {
          log("CREATE_AUTH_USER_FAILED", adminId);
          return json({ error: "No se pudo crear el usuario" }, 400);
        }

        // Create or update profile (compatible with trigger)
        const { error: profileError } = await supabase
          .from("profiles")
          .upsert(
            {
              id: authUser.user.id,
              email,
              full_name,
              role,
              active,
              must_change_password: requiresPasswordChange,
              temporary_password_issued_at: issuedAt,
              password_changed_at: null,
            },
            { onConflict: "id" },
          );

        if (profileError) {
          // Rollback: delete auth user
          const { error: rollbackError } = await supabase.auth.admin.deleteUser(authUser.user.id);
          if (rollbackError) {
            log("CREATE_AUTH_ROLLBACK_FAILED", adminId, authUser.user.id);
          }
          log("CREATE_PROFILE_FAILED", adminId, authUser.user.id);
          return json({ error: "No se pudo completar la creación del usuario" }, 500);
        }

        // Audit
        const { error: auditError } = await supabase.from("audit_logs").insert({
          user_id: adminId, action: "user_created", entity_type: "profiles",
          entity_id: authUser.user.id,
          new_data: { email, full_name, role, active, must_change_password: requiresPasswordChange },
        });
        if (auditError) {
          log("AUDIT_INSERT_FAILED", adminId, authUser.user.id);
        }

        return json({
          id: authUser.user.id,
          email,
          full_name,
          role,
          active,
          must_change_password: requiresPasswordChange,
          temporary_password_issued_at: issuedAt,
          password_changed_at: null,
        });
      }

      case "update_user": {
        const d = data as Record<string, unknown>;
        const user_id = typeof d?.user_id === "string" ? d.user_id : "";
        if (!user_id) {
          return json({ error: "user_id es obligatorio" }, 400);
        }

        const full_name = typeof d?.full_name === "string" ? d.full_name.trim() : undefined;
        const role = typeof d?.role === "string" ? d.role : undefined;
        const active = typeof d?.active === "boolean" ? d.active : undefined;

        if (role !== undefined && !(VALID_ROLES as readonly string[]).includes(role)) {
          return json({ error: "Rol inválido" }, 400);
        }

        // Protect last admin
        if (role !== undefined || active === false) {
          const { count: adminCount } = await supabase
            .from("profiles").select("id", { count: "exact", head: true })
            .eq("role", "admin").eq("active", true);
          if (adminCount === 1 && user_id === adminId) {
            return json({ error: "No se puede desactivar al único administrador activo" }, 400);
          }
        }

        // Block responsible role transitions
        if (role !== undefined) {
          const { data: targetProfile, error: targetError } = await supabase
            .from("profiles")
            .select("id, role")
            .eq("id", user_id)
            .single();

          if (targetError || !targetProfile) {
            return json({ error: "Perfil no encontrado" }, 400);
          }

          if (role !== targetProfile.role && (targetProfile.role === "responsible" || role === "responsible")) {
            return json({ error: "El rol Responsable se administra desde Responsables de edificios" }, 409);
          }
        }

        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (full_name !== undefined) updates.full_name = full_name;
        if (role !== undefined) updates.role = role;
        if (active !== undefined) updates.active = active;

        const { error } = await supabase.from("profiles").update(updates).eq("id", user_id);
        if (error) {
          log("UPDATE_USER_FAILED", adminId, user_id);
          return json({ error: "No se pudo actualizar el usuario" }, 400);
        }

        // Audit
        const { error: auditError } = await supabase.from("audit_logs").insert({
          user_id: adminId, action: "user_updated", entity_type: "profiles",
          entity_id: user_id, new_data: updates,
        });
        if (auditError) {
          log("AUDIT_INSERT_FAILED", adminId, user_id);
        }

        return json({ success: true });
      }

      case "reset_password": {
        const d = data as Record<string, unknown>;
        const user_id = typeof d?.user_id === "string" ? d.user_id : "";
        const new_password = typeof d?.new_password === "string" ? d.new_password : "";

        if (!user_id || !new_password) {
          return json({ error: "user_id y new_password son obligatorios" }, 400);
        }

        if (new_password.trim().length === 0 || new_password.length < 8 || new_password.length > 128) {
          return json({ error: "La contraseña debe tener entre 8 y 128 caracteres" }, 400);
        }

        // Fetch target profile
        const { data: targetProfile, error: targetError } = await supabase
          .from("profiles")
          .select("id, role, must_change_password, temporary_password_issued_at, password_changed_at")
          .eq("id", user_id)
          .single();

        if (targetError || !targetProfile) {
          return json({ error: "Perfil no encontrado" }, 400);
        }

        const isResponsible = targetProfile.role === "responsible";

        if (isResponsible) {
          // Mark profile before auth update
          const now = new Date().toISOString();
          const { data: markedProfile, error: markError } = await supabase
            .from("profiles")
            .update({
              must_change_password: true,
              temporary_password_issued_at: now,
              password_changed_at: null,
              updated_at: now,
            })
            .eq("id", user_id)
            .select("id")
            .single();

          if (markError || !markedProfile || markedProfile.id !== user_id) {
            log("RESET_PROFILE_MARK_FAILED", adminId, user_id);
            return json({ error: "No se pudo preparar el restablecimiento" }, 400);
          }

          // Update auth password
          const { error: authUpdateError } = await supabase.auth.admin.updateUserById(user_id, { password: new_password });

          if (authUpdateError) {
            // Rollback: restore previous profile values
            const { data: restoredProfile, error: rollbackError } = await supabase
              .from("profiles")
              .update({
                must_change_password: targetProfile.must_change_password,
                temporary_password_issued_at: targetProfile.temporary_password_issued_at,
                password_changed_at: targetProfile.password_changed_at,
                updated_at: new Date().toISOString(),
              })
              .eq("id", user_id)
              .select("id")
              .single();

            if (rollbackError || !restoredProfile || restoredProfile.id !== user_id) {
              log("RESET_PROFILE_ROLLBACK_FAILED", adminId, user_id);
            }

            log("RESET_AUTH_FAILED", adminId, user_id);
            return json({ error: "No se pudo restablecer la contraseña" }, 400);
          }

          // Audit
          const { error: auditError } = await supabase.from("audit_logs").insert({
            user_id: adminId, action: "password_reset_by_admin", entity_type: "auth",
            entity_id: user_id, new_data: { reset_by: "admin", must_change_password: true },
          });
          if (auditError) {
            log("AUDIT_INSERT_FAILED", adminId, user_id);
          }
        } else {
          // Non-responsible: simple password reset
          const { error: authUpdateError } = await supabase.auth.admin.updateUserById(user_id, { password: new_password });
          if (authUpdateError) {
            log("RESET_AUTH_FAILED", adminId, user_id);
            return json({ error: "No se pudo restablecer la contraseña" }, 400);
          }

          const { error: auditError } = await supabase.from("audit_logs").insert({
            user_id: adminId, action: "password_reset_by_admin", entity_type: "auth",
            entity_id: user_id, new_data: { reset_by: "admin", must_change_password: false },
          });
          if (auditError) {
            log("AUDIT_INSERT_FAILED", adminId, user_id);
          }
        }

        return json({ success: true });
      }

      case "send_recovery": {
        const d = data as Record<string, unknown>;
        const email = typeof d?.email === "string" ? d.email.trim().toLowerCase() : "";
        if (!email) {
          return json({ error: "email es obligatorio" }, 400);
        }

        const { error } = await supabase.auth.admin.inviteUserByEmail(email, {
          redirectTo: "https://sistema.sicompatagonia.com/actualizar-contrasena",
        });
        if (error) {
          // Try resetPasswordForEmail as fallback
          const { data: listData } = await supabase.auth.admin.listUsers();
          const targetUser = listData?.users.find((u) => u.email === email);
          if (targetUser) {
            const { error: resetError } = await supabase.auth.admin.updateUserById(targetUser.id, {});
            if (resetError) {
              return json({ error: "No se pudo enviar el correo de recuperación" }, 400);
            }
          } else {
            return json({ error: "No se pudo enviar el correo de recuperación" }, 400);
          }
        }

        const { error: auditError } = await supabase.from("audit_logs").insert({
          user_id: adminId, action: "recovery_email_sent", entity_type: "auth",
          new_data: { target_email: email },
        });
        if (auditError) {
          log("AUDIT_INSERT_FAILED", adminId);
        }

        return json({ success: true, message: "Correo de recuperación enviado" });
      }

      case "create_responsible": {
        const d = data as Record<string, unknown>;

        // --- Input normalization ---
        const email = typeof d?.email === "string" ? d.email.trim().toLowerCase() : "";
        const full_name = typeof d?.full_name === "string" ? d.full_name.trim() : "";
        const password = typeof d?.password === "string" ? d.password : "";
        const rawIds = Array.isArray(d?.elevator_ids) ? (d.elevator_ids as unknown[]) : [];

        // --- Validation ---
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return json({ error: "Ingresá un email válido" }, 400);
        }
        if (!full_name) {
          return json({ error: "El nombre es obligatorio" }, 400);
        }
        if (password.trim().length === 0 || password.length < 8 || password.length > 128) {
          return json({ error: "La contraseña debe tener entre 8 y 128 caracteres" }, 400);
        }
        if (!Array.isArray(d?.elevator_ids) || rawIds.length < 1) {
          return json({ error: "Debe seleccionar al menos un ascensor" }, 400);
        }
        if (rawIds.length > 100) {
          return json({ error: "La selección de ascensores es inválida" }, 400);
        }
        const elevatorIds: string[] = [];
        for (const id of rawIds) {
          if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
            return json({ error: "La selección de ascensores es inválida" }, 400);
          }
          if (elevatorIds.includes(id)) {
            return json({ error: "No se permiten ascensores duplicados" }, 400);
          }
          elevatorIds.push(id);
        }

        // --- Verify elevators ---
        const { data: elevators, error: elevError } = await supabase
          .from("elevators")
          .select("id, building_id, active, responsible_user_id")
          .in("id", elevatorIds);

        if (elevError) {
          log("CREATE_RESPONSIBLE_ELEVATORS_FAILED", adminId);
          return json({ error: "Error al verificar ascensores" }, 400);
        }

        if (!elevators || elevators.length !== elevatorIds.length) {
          return json({ error: "Uno o más ascensores no están disponibles" }, 409);
        }

        for (const e of elevators) {
          if (e.active !== true) {
            return json({ error: "Uno o más ascensores no están disponibles" }, 409);
          }
          if (e.responsible_user_id !== null) {
            return json({ error: "Uno o más ascensores ya tienen un responsable asignado" }, 409);
          }
        }

        const buildingIds = [...new Set(elevators.map((e) => e.building_id))];

        // --- Create Auth user ---
        const { data: authUser, error: createError } = await supabase.auth.admin.createUser({
          email, password, email_confirm: true,
          user_metadata: { full_name, role: "responsible" },
        });

        if (createError) {
          log("CREATE_RESPONSIBLE_AUTH_FAILED", adminId);
          return json({ error: "No se pudo crear el responsable" }, 400);
        }

        const newUserId = authUser.user.id;

        // --- Create profile ---
        const now = new Date().toISOString();
        const { error: profileError } = await supabase
          .from("profiles")
          .upsert(
            {
              id: newUserId,
              email,
              full_name,
              role: "responsible",
              active: true,
              must_change_password: true,
              temporary_password_issued_at: now,
              password_changed_at: null,
            },
            { onConflict: "id" },
          );

        if (profileError) {
          const { error: rollbackError } = await supabase.auth.admin.deleteUser(newUserId);
          if (rollbackError) log("CREATE_RESPONSIBLE_ROLLBACK_FAILED", adminId, newUserId);
          log("CREATE_RESPONSIBLE_PROFILE_FAILED", adminId, newUserId);
          return json({ error: "No se pudo completar la creación del responsable" }, 500);
        }

        // --- Assign elevators ---
        const { data: assigned, error: assignError } = await supabase
          .from("elevators")
          .update({ responsible_user_id: newUserId, updated_at: now })
          .in("id", elevatorIds)
          .eq("active", true)
          .is("responsible_user_id", null)
          .select("id");

        if (assignError || !assigned || assigned.length !== elevatorIds.length) {
          // Rollback: release elevators that may have been assigned
          await supabase
            .from("elevators")
            .update({ responsible_user_id: null, updated_at: new Date().toISOString() })
            .in("id", elevatorIds)
            .eq("responsible_user_id", newUserId);
          // Rollback: delete auth user
          const { error: delError } = await supabase.auth.admin.deleteUser(newUserId);
          if (delError) log("CREATE_RESPONSIBLE_ROLLBACK_FAILED", adminId, newUserId);
          log("CREATE_RESPONSIBLE_ASSIGN_FAILED", adminId, newUserId);
          return json({ error: "No se pudo completar la creación y asignación del responsable" }, 500);
        }

        const assignedIds = assigned.map((e) => e.id);

        // --- Audit ---
        const { error: auditError } = await supabase.from("audit_logs").insert({
          user_id: adminId, action: "responsible_created_and_assigned", entity_type: "profiles",
          entity_id: newUserId,
          new_data: { role: "responsible", active: true, must_change_password: true, elevator_ids: assignedIds, building_ids: buildingIds },
        });
        if (auditError) {
          log("AUDIT_INSERT_FAILED", adminId, newUserId);
        }

        return json({
          user: {
            id: newUserId,
            email,
            full_name,
            role: "responsible",
            active: true,
            created_at: now,
            last_sign_in_at: null,
            must_change_password: true,
            temporary_password_issued_at: now,
            password_changed_at: null,
          },
          assigned_elevator_ids: assignedIds,
        });
      }
    }
  } catch (_err: unknown) {
    log("UNEXPECTED_ERROR", authenticatedAdminId);
    return json({ error: "Error interno del servidor" }, 500);
  }
});
