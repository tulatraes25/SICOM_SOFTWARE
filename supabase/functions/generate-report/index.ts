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
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
    const aiModel = Deno.env.get("AI_MODEL") ?? "gpt-4.1-mini-2025-04-14";

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Unauthorized");

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (!profile || !["admin", "supervisor"].includes(profile.role)) throw new Error("Insufficient permissions");

    // Get service record
    const { service_record_id } = await req.json();
    if (!service_record_id) throw new Error("service_record_id is required");

    const { data: serviceRecord, error: serviceError } = await supabase
      .from("service_records")
      .select(`
        *,
        elevator:elevators(
          code, manufacturer, model, elevator_type,
          building:buildings(name, address, locality, province, client:clients(name))
        ),
        technician:profiles!service_records_technician_id_fkey(full_name, email)
      `)
      .eq("id", service_record_id)
      .single();

    if (serviceError || !serviceRecord) {
      console.error("Service record query error:", serviceError);
      throw new Error(`Service record not found or query failed: ${serviceError?.message || "No data"}`);
    }

    // Get checklist
    const { data: checklist } = await supabase
      .from("service_checklist_items")
      .select("*")
      .eq("service_record_id", service_record_id);

    const prompt = buildReportPrompt(serviceRecord, checklist || []);

    // Generate report
    let report: string;

    if (openaiApiKey) {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: aiModel,
          messages: [
            {
              role: "system",
              content: "Sos un experto en mantenimiento de ascensores en Argentina. Redactás informes técnicos formales en español argentino para empresas de servicios técnicos de ascensores. No inventás datos. No agregás fallas no informadas. No afirmás cumplimiento normativo si no está explícito. No mencionás que fue generado por IA. Usás tono técnico, claro, formal y breve."
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Error OpenAI: ${errorData.error?.message || response.status}`);
      }

      const data = await response.json();
      report = data.choices[0].message.content;
    } else {
      // Mock mode
      report = generateMockReport(serviceRecord, checklist || []);
    }

    return new Response(
      JSON.stringify({ report }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildReportPrompt(serviceRecord: any, checklist: any[]): string {
  const elevator = serviceRecord.elevator;
  const building = elevator?.building;
  const client = building?.client;

  const checklistText = checklist
    .map((item: any) => {
      const statusMap: Record<string, string> = {
        ok: "Conforme",
        needs_attention: "Observado",
        failed: "Requiere intervención",
        na: "No aplica",
      };
      return `- ${item.item_name}: ${statusMap[item.status] || item.status}${item.notes ? ` (${item.notes})` : ""}`;
    })
    .join("\n");

  return `Generá un informe técnico formal de mantenimiento de ascensor con estos datos:

DATOS DEL ASCENSOR:
- Código: ${elevator?.code || "No informado"}
- Fabricante: ${elevator?.manufacturer || "No informado"}
- Modelo: ${elevator?.model || "No informado"}
- Tipo: ${elevator?.elevator_type || "No informado"}

UBICACIÓN:
- Edificio: ${building?.name || "No informado"}
- Dirección: ${building?.address || "No informado"}, ${building?.locality || "No informado"}
- Cliente: ${client?.name || "No informado"}

DATOS DEL SERVICIO:
- Fecha: ${serviceRecord.service_date}
- Tipo de servicio: ${serviceRecord.service_type}
- Técnico: ${serviceRecord.technician?.full_name || "No informado"}

IMPORTANTE: Usa EXACTAMENTE la fecha indicada arriba (formato: AAAA-MM-DD) en todo el informe. No uses la fecha actual ni inventes otra fecha.

ESTADOS RESULTANTES:
- Estado operativo: ${serviceRecord.operational_status_at_service || "No informado"}
- Estado de conservación: ${serviceRecord.conservation_status_at_service || "No informado"}

CHECKLIST DE MANTENIMIENTO:
${checklistText || "No se completó checklist"}

DESCRIPCIÓN DEL TRABAJO REALIZADO:
${serviceRecord.description || "No informado"}

OBSERVACIONES:
${serviceRecord.observations || "Ninguna"}

MINI INFORME TÉCNICO DEL TÉCNICO:
${serviceRecord.technical_report || "No informado"}

---

Redactá el informe con esta estructura:
1. INFORME TÉCNICO DE MANTENIMIENTO
2. TAREAS REALIZADAS
3. VERIFICACIONES EFECTUADAS (checklist)
4. OBSERVACIONES
5. CONCLUSIÓN TÉCNICA

Reglas:
- Español argentino
- Tono técnico, claro, formal, breve
- No inventar datos
- No agregar fallas no informadas
- No afirmar cumplimiento normativo
- No mencionar IA
- No lenguaje exagerado`;
}

function generateMockReport(serviceRecord: any, checklist: any[]): string {
  const elevator = serviceRecord.elevator;
  const building = elevator?.building;
  const client = building?.client;

  const checklistSummary = checklist
    .map((item: any) => {
      const statusMap: Record<string, string> = { ok: "Conforme", needs_attention: "Observado", failed: "Requiere intervención", na: "No aplica" };
      return `- ${item.item_name}: ${statusMap[item.status] || item.status}`;
    })
    .join("\n");

  return `INFORME TÉCNICO DE MANTENIMIENTO
================================

1. DATOS GENERALES
Ascensor: ${elevator?.code || "N/D"} - ${elevator?.manufacturer || ""} ${elevator?.model || ""}
Ubicación: ${building?.name || "N/D"}, ${building?.address || "N/D"}, ${building?.locality || "N/D"}
Cliente: ${client?.name || "N/D"}
Fecha de intervención: ${serviceRecord.service_date}
Técnico interviniente: ${serviceRecord.technician?.full_name || "N/D"}

2. TAREAS REALIZADAS
${serviceRecord.description || serviceRecord.technical_report || "No informado"}

3. VERIFICACIONES EFECTUADAS
${checklistSummary || "No completado"}

4. OBSERVACIONES
${serviceRecord.observations || "Sin observaciones adicionales."}

5. CONCLUSIÓN TÉCNICA
El servicio de ${serviceRecord.service_type} fue realizado satisfactoriamente.
Estado operativo informado: ${serviceRecord.operational_status_at_service || "N/D"}
Estado de conservación informado: ${serviceRecord.conservation_status_at_service || "N/D"}

SICOM Patagonia SRL`;
}
