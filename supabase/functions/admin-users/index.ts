import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Unauthorized");

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (!profile || profile.role !== "admin") throw new Error("Solo administradores pueden gestionar usuarios");

    const { action, data } = await req.json();
    if (!action) throw new Error("action is required");

    switch (action) {
      case "list_users": {
        const { data: users, error } = await supabase.auth.admin.listUsers();
        if (error) throw error;

        const userIds = users.users.map(u => u.id);
        const { data: profiles } = await supabase
          .from("profiles").select("id, full_name, role, active, created_at, must_change_password, temporary_password_issued_at, password_changed_at")
          .in("id", userIds);

        const profileMap = new Map((profiles || []).map(p => [p.id, p]));
        const result = users.users.map(u => ({
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
        const { user_id } = data;
        if (!user_id) throw new Error("user_id is required");

        const { data: u, error } = await supabase.auth.admin.getUserById(user_id);
        if (error) throw error;

        const { data: p } = await supabase
          .from("profiles")
          .select("id, full_name, role, active, created_at, must_change_password, temporary_password_issued_at, password_changed_at")
          .eq("id", user_id)
          .single();

        return json({
          id: u.user.id,
          email: u.user.email,
          full_name: p?.full_name || "",
          role: p?.role || "technician",
          active: p?.active ?? true,
          created_at: p?.created_at || u.user.created_at,
          last_sign_in_at: u.user.last_sign_in_at,
          must_change_password: p?.must_change_password ?? false,
          temporary_password_issued_at: p?.temporary_password_issued_at ?? null,
          password_changed_at: p?.password_changed_at ?? null,
        });
      }

      case "create_user": {
        const { email, password, full_name, role, active = true } = data;
        if (!email || !password || !full_name || !role) throw new Error("email, password, full_name y role son obligatorios");
        if (!["admin", "supervisor", "technician", "responsible"].includes(role)) throw new Error("Rol inválido");
        if (password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres");

        const requiresPasswordChange = role === "responsible";
        const issuedAt = requiresPasswordChange ? new Date().toISOString() : null;

        // Create in Auth
        const { data: authUser, error: createError } = await supabase.auth.admin.createUser({
          email, password, email_confirm: true,
          user_metadata: { full_name, role },
        });
        if (createError) throw new Error(createError.message);

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
          await supabase.auth.admin.deleteUser(authUser.user.id);
          throw new Error("Error al crear perfil: " + profileError.message);
        }

        // Audit
        await supabase.from("audit_logs").insert({
          user_id: user.id, action: "user_created", entity_type: "profiles",
          entity_id: authUser.user.id,
          new_data: { email, full_name, role, active, must_change_password: requiresPasswordChange },
        });

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
        const { user_id, full_name, role, active } = data;
        if (!user_id) throw new Error("user_id is required");

        // Protect last admin
        if (role !== undefined || active === false) {
          const { data: adminCount } = await supabase
            .from("profiles").select("id", { count: "exact", head: true })
            .eq("role", "admin").eq("active", true);
          if (adminCount === 1 && user_id === user.id) {
            throw new Error("No se puede desactivar al único administrador activo");
          }
        }

        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (full_name !== undefined) updates.full_name = full_name;
        if (role !== undefined) updates.role = role;
        if (active !== undefined) updates.active = active;

        const { error } = await supabase.from("profiles").update(updates).eq("id", user_id);
        if (error) throw error;

        // Audit
        await supabase.from("audit_logs").insert({
          user_id: user.id, action: "user_updated", entity_type: "profiles",
          entity_id: user_id, new_data: updates,
        });

        return json({ success: true });
      }

      case "reset_password": {
        const { user_id, new_password } = data;
        if (!user_id || !new_password) throw new Error("user_id y new_password son obligatorios");
        if (new_password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres");

        // Fetch target profile
        const { data: targetProfile, error: targetError } = await supabase
          .from("profiles")
          .select("id, role, must_change_password, temporary_password_issued_at, password_changed_at")
          .eq("id", user_id)
          .single();

        if (targetError || !targetProfile) {
          throw new Error("Perfil no encontrado");
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
            throw new Error("No se pudo preparar el restablecimiento");
          }

          // Update auth password
          const { error: authUpdateError } = await supabase.auth.admin.updateUserById(user_id, { password: new_password });

          if (authUpdateError) {
            // Rollback: restore previous profile values
            await supabase
              .from("profiles")
              .update({
                must_change_password: targetProfile.must_change_password,
                temporary_password_issued_at: targetProfile.temporary_password_issued_at,
                password_changed_at: targetProfile.password_changed_at,
                updated_at: new Date().toISOString(),
              })
              .eq("id", user_id);

            throw new Error("No se pudo restablecer la contraseña");
          }

          // Audit
          await supabase.from("audit_logs").insert({
            user_id: user.id, action: "password_reset_by_admin", entity_type: "auth",
            entity_id: user_id, new_data: { reset_by: user.email, must_change_password: true },
          });
        } else {
          // Non-responsible: simple password reset
          const { error: authUpdateError } = await supabase.auth.admin.updateUserById(user_id, { password: new_password });
          if (authUpdateError) throw new Error("No se pudo restablecer la contraseña");

          await supabase.from("audit_logs").insert({
            user_id: user.id, action: "password_reset_by_admin", entity_type: "auth",
            entity_id: user_id, new_data: { reset_by: user.email, must_change_password: false },
          });
        }

        return json({ success: true });
      }

      case "send_recovery": {
        const { email } = data;
        if (!email) throw new Error("email es obligatorio");

        const { error } = await supabase.auth.admin.inviteUserByEmail(email, {
          redirectTo: "https://sistema.sicompatagonia.com/actualizar-contrasena",
        });
        if (error) {
          // Try resetPasswordForEmail as fallback
          const { error: resetError } = await supabase.auth.admin.updateUserById(
            (await supabase.auth.admin.listUsers()).data.users.find(u => u.email === email)?.id || "",
            {}
          );
          if (resetError) throw new Error("No se pudo enviar el correo de recuperación");
        }

        await supabase.from("audit_logs").insert({
          user_id: user.id, action: "recovery_email_sent", entity_type: "auth",
          new_data: { target_email: email },
        });

        return json({ success: true, message: "Correo de recuperación enviado" });
      }

      default:
        throw new Error("Acción no válida: " + action);
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function json(data: Record<string, unknown>) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
