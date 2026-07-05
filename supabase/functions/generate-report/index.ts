import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const aiProvider = Deno.env.get("AI_PROVIDER") ?? "mock";
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
    const xaiApiKey = Deno.env.get("XAI_API_KEY") ?? "";
    const aiModel = Deno.env.get("AI_MODEL") ?? "";
    const aiBaseUrl = Deno.env.get("AI_BASE_URL") ?? "";

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Unauthorized");

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (!profile || !["supervisor", "admin"].includes(profile.role)) throw new Error("Insufficient permissions");

    // Get service record
    const { service_record_id } = await req.json();
    if (!service_record_id) throw new Error("service_record_id is required");

    const { data: serviceRecord, error: serviceError } = await supabase
      .from("service_records")
      .select("*, elevator:elevators(code, manufacturer, model, elevator_type, building:buildings(name, address, locality, province, client:clients(name))), technician:profiles(full_name, email)")
      .eq("id", service_record_id).single();
    if (serviceError || !serviceRecord) throw new Error("Service record not found");

    // Get checklist
    const { data: checklist } = await supabase
      .from("service_checklist_items")
      .select("*")
      .eq("service_record_id", service_record_id);

    const prompt = buildReportPrompt(serviceRecord, checklist || []);

    // Generate report based on provider
    let report: string;

    switch (aiProvider.toLowerCase()) {
      case "openai":
        if (!openaiApiKey) throw new Error("OPENAI_API_KEY no configurada");
        report = await callAI({
          provider: "openai",
          apiKey: openaiApiKey,
          baseUrl: aiBaseUrl || "https://api.openai.com/v1/chat/completions",
          model: aiModel || "gpt-4o-mini",
          prompt,
        });
        break;

      case "xai":
        if (!xaiApiKey) throw new Error("XAI_API_KEY no configurada");
        report = await callAI({
          provider: "xai",
          apiKey: xaiApiKey,
          baseUrl: aiBaseUrl || "https://api.x.ai/v1/chat/completions",
          model: aiModel || "grok-4.3",
          prompt,
        });
        break;

      case "mock":
      default:
        report = generateMockReport(serviceRecord, checklist || []);
        break;
    }

    return new Response(
      JSON.stringify({ report, provider: aiProvider }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function callAI(config: {
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  prompt: string;
}): Promise<string> {
  const response = await fetch(config.baseUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: "Eres un experto en mantenimiento de ascensores que genera informes técnicos formales." },
        { role: "user", content: config.prompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Error en ${config.provider}: ${errorData.error?.message || response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

function buildReportPrompt(serviceRecord: any, checklist: any[]): string {
  const elevator = serviceRecord.elevator;
  const building = elevator?.building;
  const client = building?.client;

  const checklistText = checklist
    .map((item) => {
      const statusMap: Record<string, string> = { ok: "OK", needs_attention: "Observado", failed: "Requiere intervención", na: "No aplica" };
      return `- ${item.item_name}: ${statusMap[item.status] || item.status}${item.notes ? ` (${item.notes})` : ""}`;
    })
    .join("\n");

  return `Genera un informe técnico formal de mantenimiento de ascensor con estos datos:

ASCENSOR: ${elevator?.code || "N/A"} - ${elevator?.manufacturer || ""} ${elevator?.model || ""}
UBICACIÓN: ${building?.name || "N/A"}, ${building?.address || "N/A"}, ${building?.locality || "N/A"}
CLIENTE: ${client?.name || "N/A"}
FECHA: ${serviceRecord.service_date}
TÉCNICO: ${serviceRecord.technician?.full_name || "N/A"}
ESTADO OPERATIVO: ${serviceRecord.operational_status_at_service || "N/A"}
ESTADO CONSERVACIÓN: ${serviceRecord.conservation_status_at_service || "N/A"}

CHECKLIST:
${checklistText || "No completado"}

TRABAJOS: ${serviceRecord.description || serviceRecord.technical_report || "No informado"}
OBSERVACIONES: ${serviceRecord.observations || "Ninguna"}

Formato:
1. TÍTULO
2. DATOS GENERALES
3. TRABAJOS REALIZADOS
4. RESULTADO CHECKLIST
5. OBSERVACIONES
6. ESTADO INFORMADO
7. RECOMENDACIONES
8. CIERRE

IMPORTANTE: No inventes datos. Si falta info, indica "No informado".`;
}

function generateMockReport(serviceRecord: any, checklist: any[]): string {
  const elevator = serviceRecord.elevator;
  const building = elevator?.building;
  const client = building?.client;

  const checklistSummary = checklist
    .map((item) => {
      const statusMap: Record<string, string> = { ok: "Conforme", needs_attention: "Observado", failed: "Requiere intervención", na: "No aplica" };
      return `- ${item.item_name}: ${statusMap[item.status] || item.status}`;
    })
    .join("\n");

  return `INFORME TÉCNICO DE MANTENIMIENTO DE ASCENSOR
================================================

1. DATOS GENERALES
Empresa: SICOM Patagonia Ascensores
Cliente: ${client?.name || "No informado"}
Edificio: ${building?.name || "No informado"}
Ascensor: ${elevator?.code || "No informado"} - ${elevator?.manufacturer || ""} ${elevator?.model || ""}

2. FECHA DE INTERVENCIÓN
${serviceRecord.service_date}

3. TÉCNICO INTERVINIENTE
${serviceRecord.technician?.full_name || "No informado"}

4. TRABAJOS REALIZADOS
${serviceRecord.description || serviceRecord.technical_report || "No informado"}

5. RESULTADO DEL CHECKLIST
${checklistSummary || "No completado"}

6. ESTADO INFORMADO
Operativo: ${serviceRecord.operational_status_at_service || "No informado"}
Conservación: ${serviceRecord.conservation_status_at_service || "No informado"}

7. RECOMENDACIONES
${serviceRecord.observations || "No se registraron recomendaciones adicionales."}

8. CIERRE
El presente informe certifica la realización del mantenimiento indicado.

SICOM Patagonia Ascensores`;
}
