import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function isValidUUID(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function isValidStoragePath(path: string): boolean {
  if (!path || path.length === 0) return false;
  if (path.startsWith("/")) return false;
  if (path.includes("..")) return false;
  if (path.includes("://")) return false;
  if (/[\x00-\x1f]/.test(path)) return false;
  return true;
}

function buildFilename(code: string, year: number | null, month: number | null, period: string, version: number): string {
  const safeCode = code.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  let ym = "";
  if (year && month && month >= 1 && month <= 12) {
    ym = `${year}-${String(month).padStart(2, "0")}`;
  } else {
    const match = period?.match(/^(\d{4})-(\d{2})$/);
    if (match) ym = `${match[1]}-${match[2]}`;
    else ym = "informe";
  }
  return `informe-mensual-${safeCode}-${ym}-v${Math.max(version || 1, 1)}.pdf`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method Not Allowed" });
  }

  try {
    // 1. Environment
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !supabaseServiceKey) {
      return jsonResponse(500, { error: "Configuración del servidor incompleta" });
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 2. Parse body
    const body = await req.json().catch(() => ({}));
    const { monthly_report_id } = body as { monthly_report_id?: string };

    if (!monthly_report_id || typeof monthly_report_id !== "string" || !isValidUUID(monthly_report_id)) {
      return jsonResponse(400, { error: "monthly_report_id inválido" });
    }

    // 3. Authenticate
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return jsonResponse(401, { error: "No autenticado" });
    }
    const jwt = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !authData?.user) {
      return jsonResponse(401, { error: "No autenticado" });
    }
    const userId = authData.user.id;

    // 4. Validate profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles").select("id, role, active")
      .eq("id", userId).single();

    if (profileError || !profile) {
      return jsonResponse(403, { error: "Acceso no autorizado" });
    }
    if (profile.role !== "responsible" || profile.active !== true) {
      return jsonResponse(403, { error: "Acceso no autorizado" });
    }

    // 5. Get report
    const { data: report, error: reportError } = await supabase
      .from("monthly_reports").select("id, elevator_id, status, pdf_url, pdf_version, report_year, report_month, period, pdf_generated_at")
      .eq("id", monthly_report_id).single();

    if (reportError || !report) {
      return jsonResponse(404, { error: "Informe no disponible" });
    }
    if (!["approved", "sent"].includes(report.status)) {
      return jsonResponse(404, { error: "Informe no disponible" });
    }
    if (!report.pdf_url || !report.pdf_generated_at) {
      return jsonResponse(404, { error: "Informe no disponible" });
    }

    // 6. Validate storage path
    if (!isValidStoragePath(report.pdf_url)) {
      return jsonResponse(404, { error: "Informe no disponible" });
    }

    // 7. Validate assignment
    const { data: elevator, error: elevatorError } = await supabase
      .from("elevators").select("id, code, responsible_user_id, active")
      .eq("id", report.elevator_id).single();

    if (elevatorError || !elevator) {
      return jsonResponse(404, { error: "Informe no disponible" });
    }
    if (elevator.responsible_user_id !== userId || !elevator.active) {
      return jsonResponse(404, { error: "Informe no disponible" });
    }

    // 8. Build filename
    const filename = buildFilename(
      elevator.code,
      report.report_year,
      report.report_month,
      report.period,
      report.pdf_version ?? 1,
    );

    // 9. Create signed URL
    const { data: signedData, error: signedError } = await supabase.storage
      .from("service-order-reports")
      .createSignedUrl(report.pdf_url, 60, { download: filename });

    if (signedError || !signedData?.signedUrl) {
      console.error("[get-responsible-monthly-report-url] Storage error:", signedError?.message);
      return jsonResponse(500, { error: "No se pudo generar la descarga" });
    }

    // 10. Response
    return jsonResponse(200, {
      signed_url: signedData.signedUrl,
      expires_in: 60,
      filename,
    });

  } catch (error: unknown) {
    console.error("[get-responsible-monthly-report-url] Error:", error instanceof Error ? error.message : "unknown");
    return jsonResponse(500, { error: "Error interno del servidor" });
  }
});
