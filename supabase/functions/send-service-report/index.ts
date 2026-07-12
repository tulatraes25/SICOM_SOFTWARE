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

  console.log("[send-service-report] started");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "sistema@sicompatagonia.com";
    const fromName = Deno.env.get("REPORT_FROM_NAME") || "SICOM Patagonia - Sistema automático";
    const replyTo = Deno.env.get("RESEND_REPLY_TO") || "adriana@sicompatagonia.com";

    console.log("[send-service-report] fromEmail:", fromEmail);
    console.log("[send-service-report] resendApiKey configured:", !!resendApiKey);

    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY no configurada en Supabase Secrets");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Unauthorized");

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (!profile || !["admin", "supervisor"].includes(profile.role)) throw new Error("Insufficient permissions");

    // Get request data
    const { service_record_id, pdf_base64, pdf_filename } = await req.json();
    if (!service_record_id) throw new Error("service_record_id is required");
    if (!pdf_base64) throw new Error("pdf_base64 is required");

    console.log("[send-service-report] service_record_id:", service_record_id);
    console.log("[send-service-report] pdf_base64 length:", pdf_base64?.length || 0);

    // Get service record
    const { data: record, error: recordError } = await supabase
      .from("service_records")
      .select("*, elevator:elevators(id, code, building_id, building:buildings(id, name))")
      .eq("id", service_record_id)
      .single();

    if (recordError || !record) throw new Error("Service record not found");

    const elevator = record.elevator as any;
    const buildingId = elevator?.building_id;

    if (!buildingId) throw new Error("No se encontró el edificio del ascensor");

    // Get recipients from building
    const { data: recipients, error: recipientsError } = await supabase
      .from("building_report_recipients")
      .select("*")
      .eq("building_id", buildingId)
      .eq("active", true);

    if (recipientsError) throw recipientsError;
    if (!recipients || recipients.length === 0) throw new Error("No hay destinatarios activos para el edificio de este ascensor");

    console.log("[send-service-report] recipients:", recipients.map(r => r.email));

    const results: Array<{ email: string; name: string; status: string; error?: string }> = [];
    let successCount = 0;
    let failedCount = 0;

    for (const recipient of recipients) {
      const subject = `Informe técnico de mantenimiento - ${elevator?.code || "Ascensor"} - ${fromName}`;
      const html = generateEmailHTML(record, elevator, recipient, fromName);

      console.log(`[send-service-report] Sending to: ${recipient.email}`);

      try {
        const emailBody = JSON.stringify({
          from: `${fromName} <${fromEmail}>`,
          to: [recipient.email],
          reply_to: replyTo,
          subject,
          html,
          attachments: [{
            filename: pdf_filename || `informe-${elevator?.code || "ascensor"}.pdf`,
            content: pdf_base64,
          }],
        });

        console.log(`[send-service-report] Email body length: ${emailBody.length}`);

        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: emailBody,
        });

        console.log(`[send-service-report] Response status: ${emailResponse.status}`);
        console.log(`[send-service-report] Response headers: ${JSON.stringify(Object.fromEntries(emailResponse.headers.entries()))}`);

        const responseText = await emailResponse.text();
        console.log(`[send-service-report] Response body: ${responseText}`);

        let emailData: any;
        try {
          emailData = JSON.parse(responseText);
        } catch (e) {
          emailData = { raw: responseText };
        }

        if (!emailResponse.ok) {
          const errorMsg = `HTTP ${emailResponse.status}: ${JSON.stringify(emailData)}`;
          console.error(`[send-service-report] FAILED for ${recipient.email}:`, errorMsg);

          await supabase.from("service_report_sends").insert({
            service_record_id,
            elevator_id: record.elevator_id,
            recipient_name: recipient.name,
            recipient_email: recipient.email,
            status: "failed",
            error_message: errorMsg,
            sent_by: user.id,
          });

          results.push({ email: recipient.email, name: recipient.name, status: "failed", error: errorMsg });
          failedCount++;
          continue;
        }

        console.log(`[send-service-report] SUCCESS for ${recipient.email}:`, JSON.stringify(emailData));

        // Success
        await supabase.from("service_report_sends").insert({
          service_record_id,
          elevator_id: record.elevator_id,
          recipient_name: recipient.name,
          recipient_email: recipient.email,
          status: "sent",
          sent_at: new Date().toISOString(),
          sent_by: user.id,
          resend_id: emailData.id,
        });

        console.log("[send-service-report] sent to:", recipient.email);
        results.push({ email: recipient.email, name: recipient.name, status: "sent" });
        successCount++;
      } catch (error: any) {
        console.error("[send-service-report] exception:", error.message);

        await supabase.from("service_report_sends").insert({
          service_record_id,
          elevator_id: record.elevator_id,
          recipient_name: recipient.name,
          recipient_email: recipient.email,
          status: "failed",
          error_message: error.message,
          sent_by: user.id,
        });

        results.push({ email: recipient.email, name: recipient.name, status: "failed", error: error.message });
        failedCount++;
      }
    }

    // Audit
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "send_service_report",
      entity_type: "service_record",
      entity_id: service_record_id,
      new_data: { success: successCount, failed: failedCount, results },
    });

    console.log("[send-service-report] done:", { success: successCount, failed: failedCount });

    return new Response(
      JSON.stringify({ success: successCount, failed: failedCount, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[send-service-report] fatal:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function generateEmailHTML(record: any, elevator: any, recipient: any, companyName: string): string {
  const building = elevator?.building;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family:Arial,sans-serif;line-height:1.6;color:#333">
  <div style="max-width:600px;margin:0 auto;padding:20px">
    <div style="background:#06172E;color:white;padding:20px;text-align:center;border-radius:8px 8px 0 0">
      <h1 style="margin:0;font-size:20px">${companyName}</h1>
      <p style="margin:5px 0 0;font-size:12px;opacity:0.8">Servicios Técnicos de Ascensores</p>
    </div>
    <div style="background:#f9fafb;padding:20px;border:1px solid #e5e7eb">
      <p>Estimado/a <strong>${recipient.name}</strong>,</p>
      <p>Se adjunta el informe técnico de mantenimiento correspondiente al ascensor <strong>${elevator?.code || "N/D"}</strong>, ubicado en ${building?.name || "N/D"}.</p>
      <div style="background:white;padding:15px;border-radius:8px;margin:15px 0;border-left:4px solid #8DB600">
        <p style="margin:0"><strong>Fecha del servicio:</strong> ${record.service_date}</p>
        <p style="margin:5px 0 0"><strong>Estado operativo:</strong> ${record.operational_status_at_service || "N/D"}</p>
        <p style="margin:5px 0 0"><strong>Estado de conservación:</strong> ${record.conservation_status_at_service || "N/D"}</p>
      </div>
      <p>Saludos cordiales.</p>
      <p><strong>${companyName}</strong></p>
    </div>
    <div style="background:#e5e7eb;padding:15px;text-align:center;border-radius:0 0 8px 8px;font-size:11px;color:#666">
      <p style="margin:0 0 5px 0"><strong>Este es un mensaje automático. Por favor, no responda a este correo.</strong></p>
      <p style="margin:0">Para consultas, comuníquese con <a href="mailto:adriana@sicompatagonia.com" style="color:#06172E">adriana@sicompatagonia.com</a> o <a href="mailto:lucas@sicompatagonia.com" style="color:#06172E">lucas@sicompatagonia.com</a></p>
    </div>
  </div>
</body>
</html>`;
}
