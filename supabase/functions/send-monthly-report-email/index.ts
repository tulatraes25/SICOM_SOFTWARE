import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? "sistema@sicompatagonia.com";
    const replyTo = Deno.env.get("RESEND_REPLY_TO") ?? "adriana@sicompatagonia.com";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Unauthorized");

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (!profile || !["admin", "supervisor"].includes(profile.role)) throw new Error("Insufficient permissions");

    const { monthly_report_id, recipients, subject, body } = await req.json();
    if (!monthly_report_id) throw new Error("monthly_report_id is required");
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) throw new Error("recipients required");

    // Get report
    const { data: report, error: reportError } = await supabase
      .from("monthly_reports").select("*")
      .eq("id", monthly_report_id).single();
    if (reportError || !report) throw new Error("Informe no encontrado");
    if (report.status !== "approved") throw new Error("Solo informes aprobados pueden enviarse");
    if (!report.pdf_url) throw new Error("No existe PDF vigente");

    // Download PDF
    const { data: pdfData, error: pdfError } = await supabase.storage
      .from("service-order-reports").download(report.pdf_url);
    if (pdfError || !pdfData) throw new Error("Error al descargar el PDF");

    const pdfArrayBuffer = await pdfData.arrayBuffer();
    const pdfUint8 = new Uint8Array(pdfArrayBuffer);
    const pdfBase64 = btoa(pdfUint8.reduce((d, b) => d + String.fromCharCode(b), ""));

    const header = String.fromCharCode(...pdfUint8.slice(0, 5));
    if (header !== "%PDF-") throw new Error("El archivo no es un PDF válido");

    const filename = `informe-mensual-${report.report_year}-${String(report.report_month).padStart(2, '0')}-v${report.pdf_version || 1}.pdf`;
    const isMock = !resendApiKey;
    const results: Array<{ email: string; status: string; error?: string }> = [];
    let successCount = 0;
    let failedCount = 0;
    let mockCount = 0;

    for (const r of recipients) {
      const email = r.email?.trim().toLowerCase();
      if (!email || !email.includes("@")) {
        results.push({ email: r.email || "invalid", status: "failed", error: "Email inválido" });
        failedCount++;
        continue;
      }

      if (isMock) {
        results.push({ email, status: "mock" });
        mockCount++;
        continue;
      }

      try {
        const html = body || `<p>Adjuntamos el informe mensual correspondiente.</p>`;
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: `SICOM Patagonia <${fromEmail}>`,
            to: [email], reply_to: replyTo, subject, html,
            attachments: [{ filename, content: pdfBase64 }],
          }),
        });

        const emailData = await emailResponse.json();
        if (!emailResponse.ok) throw new Error(emailData.message || "Error al enviar");

        await supabase.from("monthly_report_email_deliveries").insert({
          monthly_report_id, pdf_version: report.pdf_version || 1,
          recipients: [{ email, name: r.name }], subject,
          sent_by: user.id, status: "sent", sent_at: new Date().toISOString(),
          provider_message_id: emailData.id,
        });

        results.push({ email, status: "sent" });
        successCount++;
      } catch (error) {
        try {
          await supabase.from("monthly_report_email_deliveries").insert({
            monthly_report_id, pdf_version: report.pdf_version || 1,
            recipients: [{ email, name: r.name }], subject,
            sent_by: user.id, status: "failed", error_message: error.message,
          });
        } catch {}
        results.push({ email, status: "failed", error: error.message });
        failedCount++;
      }
    }

    // Only transition to sent if ALL recipients were sent successfully
    const allSent = successCount > 0 && failedCount === 0 && results.every(r => r.status === "sent");
    let reportStatus: string = allSent ? "sent" : "approved";
    let statusUpdateFailed = false;

    if (allSent) {
      const { data: updatedRow, error: updateError } = await supabase
        .from("monthly_reports").update({
          status: "sent", sent_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }).eq("id", monthly_report_id).eq("status", "approved")
        .select("id, status, sent_at, pdf_version")
        .maybeSingle();

      if (updateError) {
        statusUpdateFailed = true;
      } else if (!updatedRow) {
        statusUpdateFailed = true;
      } else {
        reportStatus = updatedRow.status as string;
      }
    }

    return new Response(JSON.stringify({
      success: successCount, failed: failedCount,
      mock: mockCount,
      results,
      report_status: reportStatus,
      status_update_failed: statusUpdateFailed,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
