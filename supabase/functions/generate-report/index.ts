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
    // Crear cliente Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY") ?? "";

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Obtener usuario autenticado
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    // Verificar que sea supervisor o admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || !["supervisor", "admin"].includes(profile.role)) {
      throw new Error("Insufficient permissions");
    }

    // Obtener service_record_id del body
    const { service_record_id } = await req.json();

    if (!service_record_id) {
      throw new Error("service_record_id is required");
    }

    // Obtener datos del servicio
    const { data: serviceRecord, error: serviceError } = await supabase
      .from("service_records")
      .select(`
        *,
        elevator:elevators(
          code, manufacturer, model, elevator_type,
          building:buildings(name, address, locality, province, client:clients(name, contact_name))
        ),
        technician:profiles(full_name, email)
      `)
      .eq("id", serviceRecord_id)
      .single();

    if (serviceError || !serviceRecord) {
      throw new Error("Service record not found");
    }

    // Obtener checklist
    const { data: checklist } = await supabase
      .from("service_checklist_items")
      .select("*")
      .eq("service_record_id", service_record_id);

    // Construir prompt
    const prompt = buildReportPrompt(serviceRecord, checklist || []);

    // Llamar a OpenAI o usar mock
    let report: string;

    if (openaiApiKey) {
      report = await callOpenAI(prompt, openaiApiKey);
    } else {
      report = generateMockReport(serviceRecord, checklist || []);
    }

    return new Response(
      JSON.stringify({ report }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function buildReportPrompt(serviceRecord: any, checklist: any[]): string {
  const elevator = serviceRecord.elevator;
  const building = elevator?.building;
  const client = building?.client;

  const checklistText = checklist
    .map((item) => {
      const statusMap: Record<string, string> = {
        ok: "OK",
        needs_attention: "Observado",
        failed: "Requiere intervención",
        na: "No aplica",
      };
      return `- ${item.item_name}: ${statusMap[item.status] || item.status}${item.notes ? ` (${item.notes})` : ""}`;
    })
    .join("\n");

  return `Eres un experto en mantenimiento de ascensores. Genera un informe técnico formal basado en los siguientes datos:

DATOS DEL ASCENSOR:
- Código: ${elevator?.code || "No informado"}
- Fabricante: ${elevator?.manufacturer || "No informado"}
- Modelo: ${elevator?.model || "No informado"}
- Tipo: ${elevator?.elevator_type || "No informado"}

UBICACIÓN:
- Cliente: ${client?.name || "No informado"}
- Edificio: ${building?.name || "No informado"}
- Dirección: ${building?.address || "No informado"}
- Localidad: ${building?.locality || "No informado"}

DATOS DEL SERVICIO:
- Fecha: ${serviceRecord.service_date}
- Tipo de servicio: ${serviceRecord.service_type}
- Técnico: ${serviceRecord.technician?.full_name || "No informado"}

ESTADOS RESULTANTES:
- Estado operativo: ${serviceRecord.operational_status_at_service || "No informado"}
- Estado de conservación: ${serviceRecord.conservation_status_at_service || "No informado"}

CHECKLIST DE MANTENIMIENTO:
${checklistText || "No se completó checklist"}

DESCRIPCIÓN DEL TRABAJO REALIZADO:
${serviceRecord.description || "No informado"}

OBSERVACIONES:
${serviceRecord.observations || "No informado"}

MINI INFORME TÉCNICO:
${serviceRecord.technical_report || "No informado"}

---

Genera un informe técnico formal con esta estructura:

1. TÍTULO: Informe Técnico de Mantenimiento de Ascensor

2. DATOS GENERALES
   - Empresa: SICOM Patagonia SRL
   - Cliente
   - Edificio
   - Ascensor (código, fabricante, modelo)

3. FECHA DE INTERVENCIÓN

4. TÉCNICO INTERVINIENTE

5. TRABAJOS REALIZADOS
   (Describir detalladamente los trabajos basándote en la descripción y el mini informe)

6. RESULTADO DEL CHECKLIST
   (Resumir el estado de cada ítem verificado)

7. OBSERVACIONES

8. ESTADO INFORMADO
   - Estado operativo
   - Estado de conservación

9. RECOMENDACIONES
   (Basándote en el checklist y las observaciones, sugerir acciones)

10. CIERRE
    (Párrafo de cierre formal)

IMPORTANTE:
- Usa tono técnico y formal
- No inventes datos no proporcionados
- Si falta información, indica "No informado"
- No agregues certificaciones oficiales no registradas
- El informe debe ser apto para el cliente final`;
}

async function callOpenAI(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: Deno.env.get("AI_MODEL") || "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Eres un experto en mantenimiento de ascensores que genera informes técnicos formales para empresas de servicios técnicos.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    throw new Error("Error calling AI API");
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

function generateMockReport(serviceRecord: any, checklist: any[]): string {
  const elevator = serviceRecord.elevator;
  const building = elevator?.building;
  const client = building?.client;

  const checklistSummary = checklist
    .map((item) => {
      const statusMap: Record<string, string> = {
        ok: "Conforme",
        needs_attention: "Observado",
        failed: "Requiere intervención",
        na: "No aplica",
      };
      return `- ${item.item_name}: ${statusMap[item.status] || item.status}`;
    })
    .join("\n");

  return `INFORME TÉCNICO DE MANTENIMIENTO DE ASCENSOR
================================================

1. DATOS GENERALES
------------------
Empresa: SICOM Patagonia SRL
Cliente: ${client?.name || "No informado"}
Edificio: ${building?.name || "No informado"}
Dirección: ${building?.address || "No informado"}, ${building?.locality || "No informado"}
Ascensor: ${elevator?.code || "No informado"} - ${elevator?.manufacturer || ""} ${elevator?.model || ""}

2. FECHA DE INTERVENCIÓN
------------------------
${serviceRecord.service_date}

3. TÉCNICO INTERVINIENTE
------------------------
${serviceRecord.technician?.full_name || "No informado"}

4. TRABAJOS REALIZADOS
----------------------
${serviceRecord.description || serviceRecord.technical_report || "No informado"}

${serviceRecord.observations ? `5. OBSERVACIONES\n${serviceRecord.observations}\n` : ""}
6. RESULTADO DEL CHECKLIST
--------------------------
${checklistSummary || "No se completó checklist"}

7. ESTADO INFORMADO
-------------------
Estado operativo: ${serviceRecord.operational_status_at_service || "No informado"}
Estado de conservación: ${serviceRecord.conservation_status_at_service || "No informado"}

8. RECOMENDACIONES
------------------
${serviceRecord.observations ? "Ver observaciones detalladas en el punto 5." : "No se registraron recomendaciones adicionales."}

9. CIERRE
---------
El presente informe certifica la realización del mantenimiento indicado en la fecha mencionada.

SICOM Patagonia SRL
Servicios Técnicos de Ascensores`;
}
