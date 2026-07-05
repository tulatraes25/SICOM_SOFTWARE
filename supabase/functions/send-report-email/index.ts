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

    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) throw new Error("Unauthorized");

    // Validate role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (!profile || !["supervisor", "admin"].includes(profile.role)) {
      throw new Error("Insufficient permissions");
    }

    // Get report_id
    const { report_id } = await req.json();
    if (!report_id) throw new Error("report_id is required");

    // Get report
    const { data: report, error: reportError } = await supabase
      .from("monthly_reports")
      .select(`
        *,
        elevator:elevators(
          code, building:buildings(name, client:clients(name))
        )
      `)
      .eq("id", report_id)
      .single();

    if (reportError || !report) throw new Error("Report not found");

    // Validate status
    if (!["approved", "reviewed", "sent"].includes(report.status)) {
      throw new Error("Report must be approved or reviewed before sending");
    }

    // Validate PDF exists
    if (!report.pdf_url) {
      throw new Error("PDF must be generated before sending");
    }

    // Get active recipients
    const { data: recipients, error: recipientsError } = await supabase
      .from("report_recipients")
      .select("*")
      .eq("elevator_id", report.elevator_id)
      .eq("active", true);

    if (recipientsError) throw recipientsError;
    if (!recipients || recipients.length === 0) {
      throw new Error("No active recipients found");
    }

    // Download PDF and convert to base64
    let pdfBase64 = "";
    try {
      const pdfResponse = await fetch(report.pdf_url);
      if (!pdfResponse.ok) throw new Error("Failed to download PDF");
      const pdfBlob = await pdfResponse.arrayBuffer();
      pdfBase64 = btoa(
        new Uint8Array(pdfBlob).reduce((data, byte) => data + String.fromCharCode(byte), "")
      );
    } catch (e) {
      console.error("Error downloading PDF:", e);
      // Continue without attachment if download fails
    }

    const results: Array<{ email: string; status: string; error?: string }> = [];
    let successCount = 0;
    let failedCount = 0;

    const isMock = !resendApiKey;

    for (const recipient of recipients) {
      try {
        if (isMock) {
          // Mock mode
          console.log(`[MOCK] Email to ${recipient.email}: Informe ${report.period} - ${report.elevator?.code}`);
          
          await supabase.from("report_sends").insert({
            monthly_report_id: report_id,
            recipient_id: recipient.id,
            recipient_name: recipient.name,
            recipient_email: recipient.email,
            status: "sent",
            sent_at: new Date().toISOString(),
            resend_id: "mock-" + Date.now(),
          });

          results.push({ email: recipient.email, status: "mock" });
          successCount++;
          continue;
        }

        // Real send with Resend
        const emailBody: Record<string, unknown> = {
          from: `${fromName} <${fromEmail}>`,
          to: [recipient.email],
          subject: `Informe mensual ascensor ${report.elevator?.code || ""} - ${report.period}`,
          html: generateEmailHTML(report, recipient),
        };

        // Add PDF attachment if available
        if (pdfBase64) {
          emailBody.attachments = [{
            filename: `informe-${report.elevator?.code || "ascensor"}-${report.period}.pdf`,
            content: pdfBase64,
          }];
        }

        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(emailBody),
        });

        const emailData = await emailResponse.json();
        if (!emailResponse.ok) throw new Error(emailData.message || "Email failed");

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

    // Update report status
    if (failedCount === 0 && recipients.length > 0) {
      await supabase
        .from("monthly_reports")
        .update({ status: "sent", sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", report_id);
    }

    // Audit log
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
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: #06172E; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
      <h1 style="margin: 0; font-size: 24px; font-weight: bold;">SICOM</h1>
      <p style="margin: 2px 0 0 0; font-size: 16px;">PATAGONIA ASCENSORES</p>
      <div style="background: #8DB600; height: 3px; margin: 10px auto; width: 80%;"></div>
    </div>
    <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb;">
      <p>Estimado/a <strong>${recipient.name}</strong>,</p>
      <p>Le informamos que se ha generado el informe mensual de mantenimiento del ascensor:</p>
      <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #8DB600;">
        <p style="margin: 0;"><strong>Ascensor:</strong> ${elevator?.code || "No informado"}</p>
        <p style="margin: 5px 0 0 0;"><strong>Edificio:</strong> ${elevator?.building?.name || "No informado"}</p>
        <p style="margin: 5px 0 0 0;"><strong>Período:</strong> ${report.period}</p>
      </div>
      <p>El informe detallado se encuentra adjunto a este correo electrónico.</p>
      <p>Si tiene alguna consulta, no dude en contactarnos.</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
      <p style="font-size: 12px; color: #666; text-align: center;">
        <strong>SICOM Patagonia Ascensores</strong><br>
        Mantenimiento, reparación, modernización y asistencia técnica de ascensores.<br>
        <a href="https://sicompatagonia.com/" style="color: #8DB600;">https://sicompatagonia.com/</a><br>
        Comodoro Rivadavia, Chubut, Argentina
      </p>
    </div>
  </div>
</body>
</html>`;
}
