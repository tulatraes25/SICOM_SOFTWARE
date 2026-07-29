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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidUUID(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function isValidStoragePath(path: string): boolean {
  if (!path || path.length === 0) return false;
  if (path.startsWith("/")) return false;
  if (path.endsWith(" ")) return false;
  if (path.startsWith(" ")) return false;
  if (path.includes("..")) return false;
  if (path.includes("://")) return false;
  if (/[\x00-\x1f\x7f]/.test(path)) return false;
  return true;
}

function interpretPeriod(period: string | null | undefined): { year: number; month: number } | null {
  if (!period) return null;
  const match = period.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  if (year <= 0 || month < 1 || month > 12) return null;
  return { year, month };
}

function buildFilename(code: string, year: number | null, month: number | null, period: string, version: number): string {
  const safeCode = code.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "ascensor";
  const safeVersion = Number.isInteger(version) && version >= 1 ? version : 1;

  let ym = "";
  const validYear = Number.isInteger(year) && year !== null && year > 0;
  const validMonth = Number.isInteger(month) && month !== null && month >= 1 && month <= 12;

  if (validYear && validMonth) {
    ym = `${year}-${String(month).padStart(2, "0")}`;
  } else {
    const parsed = interpretPeriod(period);
    if (parsed) ym = `${parsed.year}-${String(parsed.month).padStart(2, "0")}`;
    else ym = "informe";
  }

  return `informe-mensual-${safeCode}-${ym}-v${safeVersion}.pdf`;
}

function logControlled(code: string, userId?: string, monthlyReportId?: string): void {
  console.error("[get-responsible-monthly-report-url]", { code, user_id: userId ?? null, monthly_report_id: monthlyReportId ?? null });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return jsonResponse(200, { ok: true });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method Not Allowed" });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !supabaseServiceKey) {
      logControlled("SERVER_CONFIG_MISSING");
      return jsonResponse(500, { error: "Error interno del servidor" });
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const parsedBody: unknown = await req.json().catch(() => null);
    if (!isRecord(parsedBody)) {
      return jsonResponse(400, { error: "monthly_report_id inválido" });
    }
    const monthlyReportId = parsedBody["monthly_report_id"];
    if (typeof monthlyReportId !== "string" || monthlyReportId.trim() === "" || !isValidUUID(monthlyReportId)) {
      return jsonResponse(400, { error: "monthly_report_id inválido" });
    }

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

    const { data: profile, error: profileError } = await supabase
      .from("profiles").select("id, role, active")
      .eq("id", userId).single();

    if (profileError || !profile || profile.role !== "responsible" || profile.active !== true) {
      return jsonResponse(403, { error: "Acceso no autorizado" });
    }

    const { data: report, error: reportError } = await supabase
      .from("monthly_reports").select("id, elevator_id, status, pdf_url, pdf_version, report_year, report_month, period, pdf_generated_at")
      .eq("id", monthlyReportId).single();

    if (reportError || !report) {
      return jsonResponse(404, { error: "Informe no disponible" });
    }
    if (!["approved", "sent"].includes(report.status)) {
      return jsonResponse(404, { error: "Informe no disponible" });
    }
    if (!report.pdf_url || !report.pdf_generated_at) {
      return jsonResponse(404, { error: "Informe no disponible" });
    }

    if (!isValidStoragePath(report.pdf_url)) {
      return jsonResponse(404, { error: "Informe no disponible" });
    }

    const { data: elevator, error: elevatorError } = await supabase
      .from("elevators").select("id, code, responsible_user_id, active")
      .eq("id", report.elevator_id).single();

    if (elevatorError || !elevator) {
      return jsonResponse(404, { error: "Informe no disponible" });
    }
    if (elevator.responsible_user_id !== userId || !elevator.active) {
      return jsonResponse(404, { error: "Informe no disponible" });
    }

    const filename = buildFilename(
      elevator.code,
      report.report_year,
      report.report_month,
      report.period,
      report.pdf_version ?? 1,
    );

    const { data: signedData, error: signedError } = await supabase.storage
      .from("service-order-reports")
      .createSignedUrl(report.pdf_url, 60, { download: filename });

    if (signedError || !signedData?.signedUrl) {
      logControlled("SIGNED_URL_FAILED", userId, monthlyReportId);
      return jsonResponse(500, { error: "No se pudo generar la descarga" });
    }

    return jsonResponse(200, {
      signed_url: signedData.signedUrl,
      expires_in: 60,
      filename,
    });

  } catch (_error: unknown) {
    logControlled("UNEXPECTED_ERROR");
    return jsonResponse(500, { error: "Error interno del servidor" });
  }
});
