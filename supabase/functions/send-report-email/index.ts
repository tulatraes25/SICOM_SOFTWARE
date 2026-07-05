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
    const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
    const fromEmail = Deno.env.get("REPORT_FROM_EMAIL") ?? "informes@sicompatagonia.com";
    const fromName = Deno.env.get("REPORT_FROM_NAME") ?? "SICOM Patagonia Ascensores";

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Unauthorized");

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (!profile || !["supervisor", "admin"].includes(profile.role)) throw new Error("Insufficient permissions");

    // Get report
    const { report_id } = await req.json();
    if (!report_id) throw new Error("report_id is required");

    const { data: report, error: reportError } = await supabase
      .from("monthly_reports")
      .select("*, elevator:elevators(code, building:buildings(name, client:clients(name)))")
      .eq("id", report_id).single();
    if (reportError || !report) throw new Error("Report not found");

    // Validate status
    if (!["approved", "reviewed", "sent"].includes(report.status)) {
      throw new Error("El informe debe estar aprobado o revisado antes de enviar");
    }

    // Validate PDF exists
    if (!report.pdf_url) {
      throw new Error("Debe generar el PDF antes de enviar el informe");
    }

    // Download and validate PDF
    let pdfBase64 = "";
    try {
      const pdfResponse = await fetch(report.pdf_url);
      if (!pdfResponse.ok) throw new Error(`Error al descargar PDF: ${pdfResponse.status}`);
      
      const pdfBlob = await pdfResponse.arrayBuffer();
      const pdfArray = new Uint8Array(pdfBlob);
      
      // Validate magic number %PDF-
      const header = String.fromCharCode(...pdfArray.slice(0, 5));
      if (header !== "%PDF-") {
        throw new Error("El archivo descargado no es un PDF válido");
      }

      pdfBase64 = btoa(
        pdfArray.reduce((data, byte) => data + String.fromCharCode(byte), "")
      );
      
      if (!pdfBase64 || pdfBase64.length === 0) {
        throw new Error("Error al convertir PDF a base64");
      }
    } catch (e) {
      throw new Error(`Error al procesar PDF: ${e.message}`);
    }

    // Get recipients
    const { data: recipients, error: recipientsError } = await supabase
      .from("report_recipients")
      .select("*")
      .eq("elevator_id", report.elevator_id)
      .eq("active", true);
    if (recipientsError) throw recipientsError;
    if (!recipients || recipients.length === 0) throw new Error("No hay destinatarios activos");

    const isMock = !resendApiKey;
    const results: Array<{ email: string; status: string; error?: string }> = [];
    let successCount = 0;
    let failedCount = 0;

    for (const recipient of recipients) {
      try {
        if (isMock) {
          // Mock mode
          await supabase.from("report_sends").insert({
            monthly_report_id: report_id,
            recipient_id: recipient.id,
            recipient_name: recipient.name,
            recipient_email: recipient.email,
            status: "sent",
            sent_at: new Date().toISOString(),
            resend_id: `mock-${Date.now()}`,
            error_message: "MOCK - correo no enviado realmente (sin RESEND_API_KEY)",
          });
          results.push({ email: recipient.email, status: "mock" });
          successCount++;
          continue;
        }

        // Real send
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${fromName} <${fromEmail}>`,
            to: [recipient.email],
            subject: `Informe mensual ascensor ${report.elevator?.code || ""} - ${report.period}`,
            html: generateEmailHTML(report, recipient),
            attachments: [{
              filename: `informe-${report.elevator?.code || "ascensor"}-${report.period}.pdf`,
              content: pdfBase64,
            }],
          }),
        });

        const emailData = await emailResponse.json();
        if (!emailResponse.ok) throw new Error(emailData.message || "Error al enviar");

        await supabase.from("report_sends").insert({
          monthly_report_id: report_id,
          recipient_id: recipient.id,
          recipient_name: recipient.name,
          recipient_email: recipient.email,
          status: "sent",
          sent_at: new Date().toISOString(),
          resend_id: emailData.id,
        });

        results.push({ email: recipient.email, status: "sent" });
        successCount++;
      } catch (error) {
        await supabase.from("report_sends").insert({
          monthly_report_id: report_id,
          recipient_id: recipient.id,
          recipient_name: recipient.name,
          recipient_email: recipient.email,
          status: "failed",
          error_message: error.message,
        });
        results.push({ email: recipient.email, status: "failed", error: error.message });
        failedCount++;
      }
    }

    // Update report status if all sent
    if (failedCount === 0 && recipients.length > 0 && !isMock) {
      await supabase
        .from("monthly_reports")
        .update({ status: "sent", sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", report_id);
    }

    // Audit
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "send_report",
      entity_type: "monthly_report",
      entity_id: report_id,
      new_data: { success: successCount, failed: failedCount, mock: isMock },
    });

    return new Response(
      JSON.stringify({ success: successCount, failed: failedCount, mock: isMock, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function generateEmailHTML(report: any, recipient: any): string {
  const elevator = report.elevator;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family:Arial,sans-serif;line-height:1.6;color:#333"><div style="max-width:600px;margin:0 auto;padding:20px"><div style="background:#06172E;color:white;padding:20px;text-align:center;border-radius:8px 8px 0 0"><h1 style="margin:0;font-size:24px">SICOM</h1><p style="margin:2px 0 0;font-size:16px">PATAGONIA ASCENSORES</p><div style="background:#8DB600;height:3px;margin:10px auto;width:80%"></div></div><div style="background:#f9fafb;padding:20px;border:1px solid #e5e7eb"><p>Estimado/a <strong>${recipient.name}</strong>,</p><p>Informe mensual de mantenimiento del ascensor:</p><div style="background:white;padding:15px;border-radius:8px;margin:15px 0;border-left:4px solid #8DB600"><p style="margin:0"><strong>Ascensor:</strong> ${elevator?.code || "N/A"}</p><p style="margin:5px 0 0"><strong>Período:</strong> ${report.period}</p></div><p>El informe se adjunta a este correo.</p><hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0"><p style="font-size:12px;color:#666;text-align:center"><strong>SICOM Patagonia Ascensores</strong><br><a href="https://sicompatagonia.com/" style="color:#8DB600">sicompatagonia.com</a></p></div></div></body></html>`;
}
