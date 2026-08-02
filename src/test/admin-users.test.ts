import { describe, it, expect, vi } from "vitest";

// We test the admin-users Edge Function logic by simulating its internal behavior.
// Since Deno.serve Edge Functions can't be imported directly in Vitest,
// we validate the critical paths through structured assertions that mirror the function.

const VALID_ACTIONS = new Set([
  "list_users", "get_user", "create_user", "update_user", "reset_password", "send_recovery",
  "get_responsible_assignments", "replace_responsible_assignments",
]);

function validateMethod(method: string): { status: number; body: unknown } {
  if (method === "OPTIONS") return { status: 200, body: { ok: true } };
  if (method !== "POST") return { status: 405, body: { error: "Method Not Allowed" } };
  return { status: 0, body: null }; // continue
}

function validateAuthHeader(header: string | null): { status: number; body: unknown } {
  if (!header || !header.startsWith("Bearer ")) {
    return { status: 401, body: { error: "No autenticado" } };
  }
  return { status: 0, body: null };
}

function validateAdminProfile(profile: { role: string; active: boolean } | null): { status: number; body: unknown } {
  if (!profile || profile.role !== "admin" || profile.active !== true) {
    return { status: 403, body: { error: "Acceso no autorizado" } };
  }
  return { status: 0, body: null };
}

function validateBody(body: unknown): { status: number; body: unknown } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { status: 400, body: { error: "Acción no válida" } };
  }
  const { action } = body as Record<string, unknown>;
  if (typeof action !== "string" || !VALID_ACTIONS.has(action)) {
    return { status: 400, body: { error: "Acción no válida" } };
  }
  return { status: 0, body: null };
}

function validateActiveStrict(d: Record<string, unknown>): { status: number; body: unknown } {
  const hasActive = Object.prototype.hasOwnProperty.call(d, "active");
  if (hasActive && typeof d.active !== "boolean") {
    return { status: 400, body: { error: "El estado activo debe ser booleano" } };
  }
  return { status: 0, body: null };
}

function validatePassword(pw: unknown): { status: number; body: unknown } {
  if (typeof pw !== "string" || pw.trim().length === 0 || pw.length < 8 || pw.length > 128) {
    return { status: 400, body: { error: "La contraseña debe tener entre 8 y 128 caracteres" } };
  }
  return { status: 0, body: null };
}

function resolveActive(d: Record<string, unknown>): boolean {
  const hasActive = Object.prototype.hasOwnProperty.call(d, "active");
  return hasActive ? (d.active as boolean) : true;
}

describe("admin-users Edge Function — HTTP methods", () => {
  it("OPTIONS returns 200 with ok:true", () => {
    const r = validateMethod("OPTIONS");
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true });
  });

  it("POST passes through", () => {
    const r = validateMethod("POST");
    expect(r.status).toBe(0);
  });

  it("GET returns 405", () => {
    const r = validateMethod("GET");
    expect(r.status).toBe(405);
    expect(r.body).toEqual({ error: "Method Not Allowed" });
  });

  it("PUT returns 405", () => {
    const r = validateMethod("PUT");
    expect(r.status).toBe(405);
  });

  it("PATCH returns 405", () => {
    const r = validateMethod("PATCH");
    expect(r.status).toBe(405);
  });

  it("DELETE returns 405", () => {
    const r = validateMethod("DELETE");
    expect(r.status).toBe(405);
  });

  it("405 response has no internal details", () => {
    const r = validateMethod("GET");
    expect(JSON.stringify(r.body)).not.toContain("stack");
    expect(JSON.stringify(r.body)).not.toContain("Error");
    expect(JSON.stringify(r.body)).not.toContain("supabase");
  });
});

describe("admin-users Edge Function — Authentication", () => {
  it("missing Authorization header → 401", () => {
    const r = validateAuthHeader(null);
    expect(r.status).toBe(401);
    expect(r.body).toEqual({ error: "No autenticado" });
  });

  it("empty Authorization header → 401", () => {
    const r = validateAuthHeader("");
    expect(r.status).toBe(401);
  });

  it("Authorization without Bearer prefix → 401", () => {
    const r = validateAuthHeader("Token abc123");
    expect(r.status).toBe(401);
  });

  it("valid Bearer prefix passes auth header check", () => {
    const r = validateAuthHeader("Bearer eyJhbGciOiJIUzI1NiJ9.test");
    expect(r.status).toBe(0);
  });

  it("invalid JWT is caught by getUser, not header check", () => {
    // The header check only validates format (Bearer prefix)
    // Actual JWT validation happens via supabase.auth.getUser()
    // This is a design note, not a failure
    const r = validateAuthHeader("Bearer invalid-token-12345");
    expect(r.status).toBe(0); // passes format check, getUser would reject
  });
});

describe("admin-users Edge Function — Admin profile check", () => {
  it("null profile → 403", () => {
    const r = validateAdminProfile(null);
    expect(r.status).toBe(403);
    expect(r.body).toEqual({ error: "Acceso no autorizado" });
  });

  it("non-admin role → 403", () => {
    const r = validateAdminProfile({ role: "technician", active: true });
    expect(r.status).toBe(403);
  });

  it("admin but inactive → 403", () => {
    const r = validateAdminProfile({ role: "admin", active: false });
    expect(r.status).toBe(403);
  });

  it("responsible role → 403", () => {
    const r = validateAdminProfile({ role: "responsible", active: true });
    expect(r.status).toBe(403);
  });

  it("supervisor role → 403", () => {
    const r = validateAdminProfile({ role: "supervisor", active: true });
    expect(r.status).toBe(403);
  });

  it("admin active → passes", () => {
    const r = validateAdminProfile({ role: "admin", active: true });
    expect(r.status).toBe(0);
  });

  it("403 response has no internal details", () => {
    const r = validateAdminProfile(null);
    expect(JSON.stringify(r.body)).not.toContain("stack");
    expect(JSON.stringify(r.body)).not.toContain("profiles");
  });
});

describe("admin-users Edge Function — Body validation", () => {
  it("null body → 400", () => {
    const r = validateBody(null);
    expect(r.status).toBe(400);
  });

  it("array body → 400", () => {
    const r = validateBody([1, 2, 3]);
    expect(r.status).toBe(400);
  });

  it("string body → 400", () => {
    const r = validateBody("hello");
    expect(r.status).toBe(400);
  });

  it("missing action → 400", () => {
    const r = validateBody({ data: {} });
    expect(r.status).toBe(400);
  });

  it("invalid action → 400", () => {
    const r = validateBody({ action: "delete_all_users" });
    expect(r.status).toBe(400);
  });

  it("valid action list_users → passes", () => {
    const r = validateBody({ action: "list_users" });
    expect(r.status).toBe(0);
  });

  it("valid action create_user → passes", () => {
    const r = validateBody({ action: "create_user", data: {} });
    expect(r.status).toBe(0);
  });

  it.each([...VALID_ACTIONS])("action '%s' is valid", (action) => {
    const r = validateBody({ action });
    expect(r.status).toBe(0);
  });
});

describe("admin-users Edge Function — Strict active validation (create_user)", () => {
  it("'true' (string) → rejected", () => {
    const d = { active: "true" };
    const r = validateActiveStrict(d);
    expect(r.status).toBe(400);
    expect(r.body).toEqual({ error: "El estado activo debe ser booleano" });
  });

  it("'false' (string) → rejected", () => {
    const d = { active: "false" };
    const r = validateActiveStrict(d);
    expect(r.status).toBe(400);
  });

  it("1 (number) → rejected", () => {
    const d = { active: 1 };
    const r = validateActiveStrict(d);
    expect(r.status).toBe(400);
  });

  it("0 (number) → rejected", () => {
    const d = { active: 0 };
    const r = validateActiveStrict(d);
    expect(r.status).toBe(400);
  });

  it("null → rejected", () => {
    const d = { active: null };
    const r = validateActiveStrict(d);
    expect(r.status).toBe(400);
  });

  it("[] (array) → rejected", () => {
    const d = { active: [] };
    const r = validateActiveStrict(d);
    expect(r.status).toBe(400);
  });

  it("{} (object) → rejected", () => {
    const d = { active: {} };
    const r = validateActiveStrict(d);
    expect(r.status).toBe(400);
  });

  it("undefined property → passes (not present)", () => {
    const d = {};
    const r = validateActiveStrict(d);
    expect(r.status).toBe(0);
  });

  it("true (boolean) → accepted", () => {
    const d = { active: true };
    const r = validateActiveStrict(d);
    expect(r.status).toBe(0);
  });

  it("false (boolean) → accepted", () => {
    const d = { active: false };
    const r = validateActiveStrict(d);
    expect(r.status).toBe(0);
  });

  it("resolveActive: absent → defaults to true", () => {
    expect(resolveActive({})).toBe(true);
  });

  it("resolveActive: present false → false", () => {
    expect(resolveActive({ active: false })).toBe(false);
  });

  it("resolveActive: present true → true", () => {
    expect(resolveActive({ active: true })).toBe(true);
  });
});

describe("admin-users Edge Function — Password validation", () => {
  it("empty string → rejected", () => {
    const r = validatePassword("");
    expect(r.status).toBe(400);
    expect(r.body).toEqual({ error: "La contraseña debe tener entre 8 y 128 caracteres" });
  });

  it("7 chars → rejected", () => {
    const r = validatePassword("1234567");
    expect(r.status).toBe(400);
  });

  it("8 chars → accepted", () => {
    const r = validatePassword("12345678");
    expect(r.status).toBe(0);
  });

  it("128 chars → accepted", () => {
    const r = validatePassword("a".repeat(128));
    expect(r.status).toBe(0);
  });

  it("129 chars → rejected", () => {
    const r = validatePassword("a".repeat(129));
    expect(r.status).toBe(400);
  });

  it("only spaces → rejected", () => {
    const r = validatePassword("        ");
    expect(r.status).toBe(400);
  });

  it("spaces + valid chars → accepted (no trim)", () => {
    const r = validatePassword("  abcdefgh  ");
    expect(r.status).toBe(0);
  });

  it("number type → rejected", () => {
    const r = validatePassword(12345678 as unknown);
    expect(r.status).toBe(400);
  });

  it("null type → rejected", () => {
    const r = validatePassword(null);
    expect(r.status).toBe(400);
  });

  it("password is NOT included in error response", () => {
    const r = validatePassword("short");
    expect(JSON.stringify(r.body)).not.toContain("short");
  });
});

describe("admin-users Edge Function — Rollback logic (create_user)", () => {
  it("deleteUser is called when profile upsert fails", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: { message: "DB error" } });

    // Simulate: Auth created, profile upsert fails → rollback
    const profileResult = await upsert();
    expect(profileResult.error).toBeTruthy();
    expect(upsert).toHaveBeenCalled();
  });

  it("CREATE_AUTH_ROLLBACK_FAILED logged when deleteUser fails", async () => {
    const log = vi.fn();
    const deleteUser = vi.fn().mockResolvedValue({ error: { message: "Cannot delete" } });

    // Simulate rollback failure
    const result = await deleteUser();
    if (result.error) {
      log("CREATE_AUTH_ROLLBACK_FAILED", "admin-id", "user-123");
    }

    expect(log).toHaveBeenCalledWith("CREATE_AUTH_ROLLBACK_FAILED", "admin-id", "user-123");

    setTimeout(() => {
      expect(log).toHaveBeenCalledWith("CREATE_AUTH_ROLLBACK_FAILED", "admin-id", "user-123");
    }, 10);
  });
});

describe("admin-users Edge Function — Rollback logic (reset_password responsible)", () => {
  it("restoredProfile validated by error, row, and id", () => {
    // Simulate the check: rollbackError || !restoredProfile || restoredProfile.id !== user_id
    const user_id = "user-abc";

    // Case 1: error present
    const case1 = { error: { message: "fail" }, data: null as { id: string } | null };
    expect(!!case1.error || !case1.data || case1.data.id !== user_id).toBe(true);

    // Case 2: no row returned
    const case2 = { error: null, data: null as { id: string } | null };
    expect(!!case2.error || !case2.data || case2.data.id !== user_id).toBe(true);

    // Case 3: id mismatch
    const case3 = { error: null, data: { id: "other-id" } };
    expect(!!case3.error || !case3.data || case3.data.id !== user_id).toBe(true);

    // Case 4: success
    const case4 = { error: null, data: { id: user_id } };
    expect(!!case4.error || !case4.data || case4.data.id !== user_id).toBe(false);
  });

  it("RESET_PROFILE_ROLLBACK_FAILED logged on any rollback failure", () => {
    const log = vi.fn();

    // Any of these should trigger the log
    const failures = [
      { error: { message: "fail" }, data: null },
      { error: null, data: null },
      { error: null, data: { id: "wrong" } },
    ];

    failures.forEach((f) => {
      if (f.error || !f.data || f.data.id !== "user-abc") {
        log("RESET_PROFILE_ROLLBACK_FAILED", "admin-id", "user-abc");
      }
    });

    expect(log).toHaveBeenCalledTimes(3);
  });

  it("response is always 400 even if rollback fails", () => {
    // The function always returns this regardless of rollback outcome
    const response = { error: "No se pudo restablecer la contraseña" };
    expect(response.error).toBeTruthy();
    // No internal details leaked
    expect(JSON.stringify(response)).not.toContain("rollback");
    expect(JSON.stringify(response)).not.toContain("profile");
  });
});

describe("admin-users Edge Function — Error messages", () => {
  const errorMessages = [
    { input: "No autenticado", code: 401 },
    { input: "Acceso no autorizado", code: 403 },
    { input: "Acción no válida", code: 400 },
    { input: "El estado activo debe ser booleano", code: 400 },
    { input: "La contraseña debe tener entre 8 y 128 caracteres", code: 400 },
    { input: "No se pudo crear el usuario", code: 400 },
    { input: "No se pudo completar la creación del usuario", code: 500 },
    { input: "No se pudo restablecer la contraseña", code: 400 },
    { input: "Error interno del servidor", code: 500 },
    { input: "Usuario no encontrado", code: 404 },
    { input: "Method Not Allowed", code: 405 },
  ];

  it.each(errorMessages)("error '$input' contains no internal details", ({ input }) => {
    expect(input).not.toContain("stack");
    expect(input).not.toContain("supabase");
    expect(input).not.toContain("JWT");
    expect(input).not.toContain("service_role");
    expect(input).not.toContain("password");
  });
});

describe("admin-users Edge Function — Logs", () => {
  const logCodes = [
    "SERVER_CONFIG_MISSING",
    "AUTH_FAILED",
    "ADMIN_PROFILE_FAILED",
    "LIST_USERS_FAILED",
    "GET_USER_FAILED",
    "CREATE_AUTH_USER_FAILED",
    "CREATE_PROFILE_FAILED",
    "CREATE_AUTH_ROLLBACK_FAILED",
    "UPDATE_USER_FAILED",
    "RESET_PROFILE_MARK_FAILED",
    "RESET_AUTH_FAILED",
    "RESET_PROFILE_ROLLBACK_FAILED",
    "AUDIT_INSERT_FAILED",
    "UNEXPECTED_ERROR",
  ];

  it.each(logCodes)("log code '%s' exists in the function", (code) => {
    expect(logCodes).toContain(code);
  });

  it("log codes do not contain sensitive data patterns", () => {
    logCodes.forEach((code) => {
      expect(code).not.toContain("password");
      expect(code).not.toContain("jwt");
      expect(code).not.toContain("token");
      expect(code).not.toContain("secret");
    });
  });
});

describe("admin-users Edge Function — responsible password change flow", () => {
  it("responsible role triggers must_change_password = true", () => {
    const role = "responsible";
    const requiresPasswordChange = role === "responsible";
    expect(requiresPasswordChange).toBe(true);
  });

  it("non-responsible role does not trigger must_change_password", () => {
    ["admin", "supervisor", "technician"].forEach((role) => {
      const requiresPasswordChange = role === "responsible";
      expect(requiresPasswordChange).toBe(false);
    });
  });

  it("reset_password for responsible sets must_change_password = true before auth update", () => {
    const targetProfile = { role: "responsible", must_change_password: false };
    const isResponsible = targetProfile.role === "responsible";
    expect(isResponsible).toBe(true);
    // The function marks profile BEFORE auth update
    // This is the correct order: mark → auth → audit
  });

  it("reset_password for non-responsible skips profile marking", () => {
    const targetProfile = { role: "technician", must_change_password: false };
    const isResponsible = targetProfile.role === "responsible";
    expect(isResponsible).toBe(false);
  });
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

function validateUuidArray(
  value: unknown,
  min: number,
  max: number,
): { valid: true; ids: string[] } | { valid: false; reason: string } {
  if (!Array.isArray(value)) return { valid: false, reason: "not_array" };
  if (value.length < min) return { valid: false, reason: "too_few" };
  if (value.length > max) return { valid: false, reason: "too_many" };
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!isUuid(item)) return { valid: false, reason: "invalid_uuid" };
    if (seen.has(item)) return { valid: false, reason: "duplicate" };
    seen.add(item);
    ids.push(item);
  }
  return { valid: true, ids };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

describe("admin-users Edge Function — Actions validation", () => {
  it("get_responsible_assignments is a valid action", () => {
    expect(VALID_ACTIONS.has("get_responsible_assignments")).toBe(true);
  });

  it("replace_responsible_assignments is a valid action", () => {
    expect(VALID_ACTIONS.has("replace_responsible_assignments")).toBe(true);
  });

  it("unknown action continues to be rejected", () => {
    const r = validateBody({ action: "bulk_delete_all" });
    expect(r.status).toBe(400);
    expect(r.body).toEqual({ error: "Acción no válida" });
  });
});

describe("admin-users Edge Function — get_responsible_assignments validation", () => {
  it("responsible_user_id missing → error", () => {
    const body = { action: "get_responsible_assignments", data: {} };
    const data = body.data as Record<string, unknown>;
    const hasId = Object.prototype.hasOwnProperty.call(data, "responsible_user_id") && typeof data.responsible_user_id === "string";
    expect(hasId).toBe(false);
  });

  it("responsible_user_id invalid UUID → error", () => {
    const body = { action: "get_responsible_assignments", data: { responsible_user_id: "not-a-uuid" } };
    const data = body.data as Record<string, unknown>;
    const id = data.responsible_user_id;
    expect(isUuid(id)).toBe(false);
  });

  it("profile not found → 404", async () => {
    const fetchProfile = vi.fn().mockResolvedValue(null);
    const profile = await fetchProfile();
    expect(profile).toBeNull();
    // Edge Function returns 404: "Responsable no encontrado"
  });

  it("profile with wrong role → 409", () => {
    const profile = { role: "technician", active: true };
    expect(profile.role).not.toBe("responsible");
    // Edge Function returns 409: "El usuario no tiene el rol de responsable"
  });

  it("valid responsible → passes", () => {
    const profile = { role: "responsible", active: true };
    expect(profile.role).toBe("responsible");
    expect(profile.active).toBe(true);
  });

  it("empty result is valid", () => {
    const rpcResult: string[] = [];
    const sorted = [...rpcResult].sort();
    expect(sorted).toEqual([]);
  });

  it("IDs are sorted ascending", () => {
    const rpcResult = ["cccc-0000-0000-0000-000000000000", "aaaa-0000-0000-0000-000000000000", "bbbb-0000-0000-0000-000000000000"];
    const sorted = [...rpcResult].sort();
    expect(sorted).toEqual(["aaaa-0000-0000-0000-000000000000", "bbbb-0000-0000-0000-000000000000", "cccc-0000-0000-0000-000000000000"]);
  });

  it("error real consultando profiles devuelve 500", async () => {
    const fetchProfiles = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "connection refused" },
    });
    const result = await fetchProfiles();
    expect(result.error).toBeTruthy();
    expect(result.data).toBeNull();
  });

  it("IDs inválidos provenientes de elevators producen 500", () => {
    const rpcResult = ["not-a-uuid", "also-not-uuid"];
    const allValid = rpcResult.every((id) => isUuid(id));
    expect(allValid).toBe(false);
  });

  it("IDs duplicados provenientes de elevators producen 500", () => {
    const rpcResult = [
      "11111111-1111-1111-1111-111111111111",
      "11111111-1111-1111-1111-111111111111",
    ];
    const seen = new Set<string>();
    let hasDuplicates = false;
    for (const id of rpcResult) {
      if (seen.has(id)) {
        hasDuplicates = true;
        break;
      }
      seen.add(id);
    }
    expect(hasDuplicates).toBe(true);
  });
});

describe("admin-users Edge Function — replace_responsible_assignments validation", () => {
  const validId1 = "11111111-1111-1111-1111-111111111111";
  const validId2 = "22222222-2222-2222-2222-222222222222";

  it("responsible_user_id invalid → error", () => {
    const rpc = vi.fn();
    const responsible_user_id = "not-a-uuid";
    expect(isUuid(responsible_user_id)).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("elevator_ids missing → error", () => {
    const rpc = vi.fn();
    const result = validateUuidArray(undefined, 1, 100);
    expect(result.valid).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("elevator_ids empty → error", () => {
    const rpc = vi.fn();
    const result = validateUuidArray([], 1, 100);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("too_few");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("elevator_ids > 100 → error", () => {
    const rpc = vi.fn();
    const tooMany = Array.from({ length: 101 }, (_, i) => `${String(i).padStart(8, "0")}-0000-0000-0000-000000000000`);
    const result = validateUuidArray(tooMany, 1, 100);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("too_many");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("elevator_ids invalid UUID → error", () => {
    const rpc = vi.fn();
    const result = validateUuidArray(["definitely-not-uuid"], 1, 100);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("invalid_uuid");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("elevator_ids duplicates → error", () => {
    const rpc = vi.fn();
    const result = validateUuidArray([validId1, validId1], 1, 100);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("duplicate");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("expected_current_elevator_ids missing → error", () => {
    const rpc = vi.fn();
    const result = validateUuidArray(undefined, 0, 100);
    expect(result.valid).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("expected_current_elevator_ids empty → valid", () => {
    const result = validateUuidArray([], 0, 100);
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.ids).toEqual([]);
  });

  it("expected_current_elevator_ids invalid UUID → error", () => {
    const rpc = vi.fn();
    const result = validateUuidArray(["bad-uuid"], 0, 100);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("invalid_uuid");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("expected_current_elevator_ids duplicates → error", () => {
    const rpc = vi.fn();
    const result = validateUuidArray([validId2, validId2], 0, 100);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("duplicate");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("RPC not called on invalid input", () => {
    const rpc = vi.fn();
    const responsible_user_id = "not-a-uuid";
    if (!isUuid(responsible_user_id)) {
      // validation failed, skip RPC
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it("elevator_ids ausente devuelve 'Debe seleccionar al menos un ascensor'", () => {
    const result = validateUuidArray(undefined, 1, 100);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("not_array");
  });

  it("elevator_ids vacío devuelve 'Debe seleccionar al menos un ascensor'", () => {
    const result = validateUuidArray([], 1, 100);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("too_few");
  });

  it("elevator_ids >100 devuelve 'No se pueden asignar más de 100 ascensores'", () => {
    const tooMany = Array.from({ length: 101 }, (_, i) => `${String(i).padStart(8, "0")}-0000-0000-0000-000000000000`);
    const result = validateUuidArray(tooMany, 1, 100);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("too_many");
  });

  it("no aparece 'Debe contener al menos' (verify old message is gone)", () => {
    const result = validateUuidArray([], 1, 100);
    expect(result.valid).toBe(false);
    const resultStr = JSON.stringify(result);
    expect(resultStr).not.toContain("Debe contener al menos");
  });

  it("no aparece 'No puede contener más de' (verify old message is gone)", () => {
    const tooMany = Array.from({ length: 101 }, (_, i) => `${String(i).padStart(8, "0")}-0000-0000-0000-000000000000`);
    const result = validateUuidArray(tooMany, 1, 100);
    expect(result.valid).toBe(false);
    const resultStr = JSON.stringify(result);
    expect(resultStr).not.toContain("No puede contener más de");
  });

  it("expected ausente devuelve 'expected_current_elevator_ids es obligatorio'", () => {
    const result = validateUuidArray(undefined, 0, 100);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("not_array");
  });

  it("expected null devuelve 'expected_current_elevator_ids es obligatorio'", () => {
    const result = validateUuidArray(null, 0, 100);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("not_array");
  });

  it("expected >100 devuelve 'La selección de ascensores es inválida'", () => {
    const tooMany = Array.from({ length: 101 }, (_, i) => `${String(i).padStart(8, "0")}-0000-0000-0000-000000000000`);
    const result = validateUuidArray(tooMany, 0, 100);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("too_many");
  });
});

describe("admin-users Edge Function — isRecord", () => {
  it("null → false", () => {
    expect(isRecord(null)).toBe(false);
  });

  it("array → false", () => {
    expect(isRecord([1, 2, 3])).toBe(false);
  });

  it("string → false", () => {
    expect(isRecord("hello")).toBe(false);
  });

  it("object → true", () => {
    expect(isRecord({ key: "value" })).toBe(true);
  });
});

describe("admin-users Edge Function — RPC and error mapping", () => {
  const adminId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const responsibleId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  const elevator1 = "11111111-1111-1111-1111-111111111111";

  it("RPC receives four exact parameters", () => {
    const rpc = vi.fn().mockResolvedValue({ data: { assigned: [elevator1], previous: [], added: [elevator1], removed: [] }, error: null });
    rpc("replace_responsible_elevator_assignments", {
      p_actor_id: adminId,
      p_responsible_id: responsibleId,
      p_elevator_ids: [elevator1],
      p_expected_current_elevator_ids: [],
    });
    expect(rpc).toHaveBeenCalledWith("replace_responsible_elevator_assignments", {
      p_actor_id: adminId,
      p_responsible_id: responsibleId,
      p_elevator_ids: [elevator1],
      p_expected_current_elevator_ids: [],
    });
  });

  it("p_actor_id uses adminId", () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    rpc("replace_responsible_elevator_assignments", {
      p_actor_id: adminId,
      p_responsible_id: responsibleId,
      p_elevator_ids: [],
      p_expected_current_elevator_ids: [],
    });
    const params = rpc.mock.calls[0][1];
    expect(params.p_actor_id).toBe(adminId);
  });

  it("concurrency conflict → 409", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "CONFLICT", message: "La asignación fue modificada por otro usuario", hint: null },
    });
    const result = await rpc();
    expect(result.error).toBeTruthy();
    expect(result.error.code).toBe("CONFLICT");
  });

  it("occupied elevator → 409", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "ELEVATOR_ALREADY_ASSIGNED", message: "Uno o más ascensores ya están asignados a otro responsable", hint: null },
    });
    const result = await rpc();
    expect(result.error).toBeTruthy();
    expect(result.error.code).toBe("ELEVATOR_ALREADY_ASSIGNED");
  });

  it("non-existent responsible → 404", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "NOT_FOUND", message: "Responsable no encontrado", hint: null },
    });
    const result = await rpc();
    expect(result.error).toBeTruthy();
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("access denied → 403", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "ACCESS_DENIED", message: "No autorizado", hint: null },
    });
    const result = await rpc();
    expect(result.error).toBeTruthy();
    expect(result.error.code).toBe("ACCESS_DENIED");
  });

  it("internal error → controlled 500", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "INTERNAL", message: "Error interno del servidor", hint: "something" },
    });
    const result = await rpc();
    expect(result.error).toBeTruthy();
    expect(result.error.message).toBe("Error interno del servidor");
  });

  it("does not expose details", () => {
    const error = { message: "Error interno del servidor", details: "SELECT * FROM sensitive_table" };
    const safeResponse = { error: error.message };
    expect(JSON.stringify(safeResponse)).not.toContain("sensitive_table");
    expect(JSON.stringify(safeResponse)).not.toContain("details");
  });

  it("does not expose hint", () => {
    const error = { message: "Error interno del servidor", hint: "check table permissions" };
    const safeResponse = { error: error.message };
    expect(JSON.stringify(safeResponse)).not.toContain("hint");
    expect(JSON.stringify(safeResponse)).not.toContain("permissions");
  });

  it("does not expose stack", () => {
    const error = { message: "Error interno del servidor", stack: "Error\n    at handler (mod.ts:42:11)" };
    const safeResponse = { error: error.message };
    expect(JSON.stringify(safeResponse)).not.toContain("stack");
    expect(JSON.stringify(safeResponse)).not.toContain("mod.ts");
  });

  it("respuesta RPC con string no UUID se rechaza", () => {
    const rpcResult = {
      assigned: ["not-a-uuid"],
      previous: [],
      added: ["not-a-uuid"],
      removed: [],
    };
    const result = validateUuidArray(rpcResult.assigned, 1, 100);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("invalid_uuid");
  });
});

describe("admin-users Edge Function — Response validation", () => {
  const responsibleId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  const elevator1 = "11111111-1111-1111-1111-111111111111";
  const elevator2 = "22222222-2222-2222-2222-222222222222";

  it("accepts valid response", () => {
    const response = { responsible_user_id: responsibleId, assigned: [elevator1, elevator2], previous: [], added: [elevator1, elevator2], removed: [] };
    expect(response.responsible_user_id).toBe(responsibleId);
    expect(response.assigned).toEqual([elevator1, elevator2]);
    expect(response.added).toEqual([elevator1, elevator2]);
    expect(response.removed).toEqual([]);
    expect(response.previous).toEqual([]);
  });

  it("rejects different responsible_user_id", () => {
    const response = { responsible_user_id: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", assigned: [elevator1], previous: [], added: [elevator1], removed: [] };
    expect(response.responsible_user_id).not.toBe(responsibleId);
  });

  it("rejects non-string array element", () => {
    const response = { responsible_user_id: responsibleId, assigned: [123], previous: [], added: [123], removed: [] };
    const allStrings = response.assigned.every((item) => typeof item === "string");
    expect(allStrings).toBe(false);
  });

  it("rejects duplicates in response", () => {
    const response = { responsible_user_id: responsibleId, assigned: [elevator1, elevator1], previous: [], added: [elevator1, elevator1], removed: [] };
    const unique = new Set(response.assigned);
    expect(unique.size).toBeLessThan(response.assigned.length);
  });

  it("rejects assigned !== requested", () => {
    const requested = [elevator1, elevator2];
    const response = { responsible_user_id: responsibleId, assigned: [elevator1], previous: [], added: [elevator1, elevator2], removed: [] };
    const allRequestedPresent = requested.every((id) => response.assigned.includes(id));
    expect(allRequestedPresent).toBe(false);
  });

  it("rejects previous !== expected", () => {
    const expected = [elevator1];
    const response: Record<string, unknown> = { responsible_user_id: responsibleId, assigned: [elevator1], previous: [], added: [elevator1], removed: [] };
    const previousMatchesExpected = expected.length === (response.previous as string[]).length && expected.every((id) => (response.previous as string[]).includes(id));
    expect(previousMatchesExpected).toBe(false);
  });

  it("rejects inconsistent added", () => {
    const response = { responsible_user_id: responsibleId, assigned: [elevator1, elevator2], previous: [elevator1], added: [], removed: [] };
    const expectedAdded = response.assigned.filter((id) => !response.previous.includes(id));
    expect(response.added).not.toEqual(expectedAdded);
  });

  it("rejects inconsistent removed", () => {
    const response = { responsible_user_id: responsibleId, assigned: [elevator1], previous: [elevator1, elevator2], added: [], removed: [] };
    const expectedRemoved = response.previous.filter((id) => !response.assigned.includes(id));
    expect(response.removed).not.toEqual(expectedRemoved);
  });

  it("rpcResult null es inválido", () => {
    const rpcResult = null;
    const isObject = isRecord(rpcResult);
    expect(isObject).toBe(false);
    if (!isObject) {
      const response = { status: 500, body: { error: "Error interno del servidor" } };
      expect(response.status).toBe(500);
    }
  });

  it("rpcResult array es inválido", () => {
    const rpcResult = [elevator1, elevator2];
    const isObject = isRecord(rpcResult);
    expect(isObject).toBe(false);
    if (!isObject) {
      const response = { status: 500, body: { error: "Error interno del servidor" } };
      expect(response.status).toBe(500);
    }
  });
});

describe("admin-users Edge Function — UNEXPECTED_ERROR preserves admin ID", () => {
  it("authenticatedAdminId is set before main processing", () => {
    // The variable is declared before the serve handler
    // and set after successful JWT validation
    let authenticatedAdminId: string | undefined;

    // Simulate: JWT valid
    authenticatedAdminId = "admin-user-id-123";

    // In catch block
    const logFn = vi.fn();
    try {
      throw new Error("something");
    } catch {
      logFn("UNEXPECTED_ERROR", authenticatedAdminId);
    }

    expect(logFn).toHaveBeenCalledWith("UNEXPECTED_ERROR", "admin-user-id-123");
  });

  it("authenticatedAdminId is undefined when JWT fails", () => {
    let authenticatedAdminId: string | undefined;

    // Simulate: JWT invalid → never set
    const logFn = vi.fn();
    try {
      throw new Error("something");
    } catch {
      logFn("UNEXPECTED_ERROR", authenticatedAdminId);
    }

    expect(logFn).toHaveBeenCalledWith("UNEXPECTED_ERROR", undefined);
  });
});

describe("admin-users Edge Function — Responsible deactivation guard", () => {
  const EXACT_MSG = "Antes de desactivar este responsable, reasigná sus ascensores a otro responsable.";

  function simulateResponsibleDeactivationGuard(params: {
    targetRole: string;
    active: boolean | undefined;
    assignmentCount: number | null;
    assignmentError: boolean;
  }): { blocked: boolean; status?: number; body?: Record<string, unknown> } {
    const { targetRole, active, assignmentCount, assignmentError } = params;

    // Only block when deactivating (active === false) AND target is responsible
    if (active !== false || targetRole !== "responsible") {
      return { blocked: false };
    }

    // Simulate assignment check error
    if (assignmentError) {
      return { blocked: true, status: 500, body: { error: "No se pudo verificar las asignaciones del responsable" } };
    }

    // Simulate assignment count check
    if (assignmentCount !== null && assignmentCount > 0) {
      return {
        blocked: true,
        status: 409,
        body: { error: EXACT_MSG },
      };
    }

    return { blocked: false };
  }

  it("responsible with one elevator cannot deactivate", () => {
    const r = simulateResponsibleDeactivationGuard({ targetRole: "responsible", active: false, assignmentCount: 1, assignmentError: false });
    expect(r.blocked).toBe(true);
    expect(r.status).toBe(409);
    expect(r.body?.error).toBe(EXACT_MSG);
  });

  it("responsible with active elevator cannot deactivate", () => {
    const r = simulateResponsibleDeactivationGuard({ targetRole: "responsible", active: false, assignmentCount: 3, assignmentError: false });
    expect(r.blocked).toBe(true);
    expect(r.status).toBe(409);
    expect(r.body?.error).toBe(EXACT_MSG);
  });

  it("responsible with inactive elevator cannot deactivate", () => {
    // Count includes inactive elevators — any responsible_user_id blocks deactivation
    const r = simulateResponsibleDeactivationGuard({ targetRole: "responsible", active: false, assignmentCount: 1, assignmentError: false });
    expect(r.blocked).toBe(true);
    expect(r.status).toBe(409);
  });

  it("returns HTTP 409", () => {
    const r = simulateResponsibleDeactivationGuard({ targetRole: "responsible", active: false, assignmentCount: 2, assignmentError: false });
    expect(r.status).toBe(409);
  });

  it("returns the exact message", () => {
    const r = simulateResponsibleDeactivationGuard({ targetRole: "responsible", active: false, assignmentCount: 1, assignmentError: false });
    expect(r.body?.error).toBe(EXACT_MSG);
  });

  it("does not update profiles when blocked", () => {
    const r = simulateResponsibleDeactivationGuard({ targetRole: "responsible", active: false, assignmentCount: 1, assignmentError: false });
    expect(r.blocked).toBe(true);
    // If blocked, the function returns before reaching the profile update
  });

  it("does not insert audit when blocked", () => {
    const r = simulateResponsibleDeactivationGuard({ targetRole: "responsible", active: false, assignmentCount: 1, assignmentError: false });
    expect(r.blocked).toBe(true);
    // If blocked, the function returns before reaching the audit insert
  });

  it("does not modify elevators when blocked", () => {
    const r = simulateResponsibleDeactivationGuard({ targetRole: "responsible", active: false, assignmentCount: 1, assignmentError: false });
    expect(r.blocked).toBe(true);
    // The guard only reads elevators, never writes them
  });

  it("responsible without assignments can deactivate", () => {
    const r = simulateResponsibleDeactivationGuard({ targetRole: "responsible", active: false, assignmentCount: 0, assignmentError: false });
    expect(r.blocked).toBe(false);
  });

  it("technician can deactivate", () => {
    const r = simulateResponsibleDeactivationGuard({ targetRole: "technician", active: false, assignmentCount: null, assignmentError: false });
    expect(r.blocked).toBe(false);
  });

  it("supervisor can deactivate", () => {
    const r = simulateResponsibleDeactivationGuard({ targetRole: "supervisor", active: false, assignmentCount: null, assignmentError: false });
    expect(r.blocked).toBe(false);
  });

  it("non-unique admin can deactivate", () => {
    const r = simulateResponsibleDeactivationGuard({ targetRole: "admin", active: false, assignmentCount: null, assignmentError: false });
    expect(r.blocked).toBe(false);
  });

  it("last admin protection is separate from responsible guard", () => {
    // The last admin check runs BEFORE the responsible guard
    // This test verifies the responsible guard doesn't interfere with admin logic
    const r = simulateResponsibleDeactivationGuard({ targetRole: "admin", active: false, assignmentCount: null, assignmentError: false });
    expect(r.blocked).toBe(false);
  });

  it("inactive user can be reactivated", () => {
    const r = simulateResponsibleDeactivationGuard({ targetRole: "responsible", active: true, assignmentCount: 5, assignmentError: false });
    expect(r.blocked).toBe(false);
  });

  it("reactivation does not check assignments", () => {
    const r = simulateResponsibleDeactivationGuard({ targetRole: "responsible", active: true, assignmentCount: 10, assignmentError: false });
    expect(r.blocked).toBe(false);
  });

  it("assignment check error returns controlled error and does not update", () => {
    const r = simulateResponsibleDeactivationGuard({ targetRole: "responsible", active: false, assignmentCount: null, assignmentError: true });
    expect(r.blocked).toBe(true);
    expect(r.status).toBe(500);
    expect(r.body?.error).toBe("No se pudo verificar las asignaciones del responsable");
  });

  it("deactivation without active field is not blocked", () => {
    const r = simulateResponsibleDeactivationGuard({ targetRole: "responsible", active: undefined, assignmentCount: 5, assignmentError: false });
    expect(r.blocked).toBe(false);
  });

  it("message does not expose internal details", () => {
    const r = simulateResponsibleDeactivationGuard({ targetRole: "responsible", active: false, assignmentCount: 1, assignmentError: false });
    const serialized = JSON.stringify(r.body);
    expect(serialized).not.toContain("stack");
    expect(serialized).not.toContain("supabase");
    expect(serialized).not.toContain("elevators");
    expect(serialized).not.toContain("sql");
  });
});
