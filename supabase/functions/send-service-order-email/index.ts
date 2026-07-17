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

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Unauthorized");

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (!profile || !["admin", "supervisor"].includes(profile.role)) throw new Error("Insufficient permissions");

    const { service_order_id, recipients, subject, body } = await req.json();
    if (!service_order_id) throw new Error("service_order_id is required");
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) throw new Error("recipients array is required");

    // Get order
    const { data: order, error: orderError } = await supabase
      .from("service_orders").select("*, service_case:service_cases(case_number, numbering_mode), elevator:elevators(code), building:buildings(name)")
      .eq("id", service_order_id).single();
    if (orderError || !order) throw new Error("Orden no encontrada");
    if (order.status !== "approved") throw new Error("Solo órdenes aprobadas pueden enviarse");
    if (!order.final_pdf_path) throw new Error("Primero generá el PDF final de la orden");

    // Download PDF from storage
    const { data: pdfData, error: pdfError } = await supabase.storage
      .from("service-order-reports").download(order.final_pdf_path);
    if (pdfError || !pdfData) throw new Error("Error al descargar el PDF");

    const pdfArrayBuffer = await pdfData.arrayBuffer();
    const pdfUint8 = new Uint8Array(pdfArrayBuffer);
    const pdfBase64 = btoa(pdfUint8.reduce((d, b) => d + String.fromCharCode(b), ""));

    // Validate PDF
    const header = String.fromCharCode(...pdfUint8.slice(0, 5));
    if (header !== "%PDF-") throw new Error("El archivo no es un PDF válido");

    const caseNum = (order.service_case as any)?.case_number || "N/D";
    const caseMode = (order.service_case as any)?.numbering_mode;
    const numberLabel = caseMode === "test" ? `PRUEBA N.º ${caseNum}` : `N.º ${caseNum}`;
    const elevCode = (order.elevator as any)?.code || "N/D";
    const buildName = (order.building as any)?.name || "N/D";
    const filename = `orden-${caseNum}-v${order.final_pdf_version || 1}.pdf`;

    const finalSubject = subject || `SICOM Patagonia — Orden de Servicio ${numberLabel}`;

    const isMock = !resendApiKey;
    const results: Array<{ email: string; status: string; error?: string }> = [];
    let successCount = 0;
    let failedCount = 0;

    for (const r of recipients) {
      const email = r.email?.trim().toLowerCase();
      if (!email || !email.includes("@")) {
        results.push({ email: r.email || "invalid", status: "failed", error: "Email inválido" });
        failedCount++;
        continue;
      }

      try {
        if (isMock) {
          await supabase.from("service_order_email_deliveries").insert({
            service_order_id, service_case_id: order.service_case_id,
            pdf_version: order.final_pdf_version || 1,
            recipients: [{ email, name: r.name }],
            subject: finalSubject, sent_by: user.id, status: "sent",
            sent_at: new Date().toISOString(), provider_message_id: `mock-${Date.now()}`,
          });
          results.push({ email, status: "mock" });
          successCount++;
          continue;
        }

        const html = body || `<p>Adjuntamos la Orden de Servicio ${numberLabel} correspondiente al ascensor ${elevCode} del edificio ${buildName}.</p><p>Estado: Aprobado</p><hr><p style="font-size:12px;color:#666"><strong>SICOM Patagonia SRL</strong><br>+54 297 421-4430<br>sicompatagonia.com</p>`;

        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: `SICOM Patagonia <${fromEmail}>`,
            to: [email], reply_to: replyTo, subject: finalSubject, html,
            attachments: [{ filename, content: pdfBase64 }],
          }),
        });

        const emailData = await emailResponse.json();
        if (!emailResponse.ok) throw new Error(emailData.message || "Error al enviar");

        await supabase.from("service_order_email_deliveries").insert({
          service_order_id, service_case_id: order.service_case_id,
          pdf_version: order.final_pdf_version || 1,
          recipients: [{ email, name: r.name }],
          subject: finalSubject, sent_by: user.id, status: "sent",
          sent_at: new Date().toISOString(), provider_message_id: emailData.id,
        });

        results.push({ email, status: "sent" });
        successCount++;
      } catch (error) {
        try {
          await supabase.from("service_order_email_deliveries").insert({
            service_order_id, service_case_id: order.service_case_id,
            pdf_version: order.final_pdf_version || 1,
            recipients: [{ email, name: r.name }],
            subject: finalSubject, sent_by: user.id, status: "failed",
            error_message: error.message,
          });
        } catch {}
        results.push({ email, status: "failed", error: error.message });
        failedCount++;
      }
    }

    // Log event
    await supabase.from("service_order_events").insert({
      service_order_id, event_type: "email_sent", performed_by: user.id,
      details: { success: successCount, failed: failedCount, recipients: results.length },
    });

    return new Response(JSON.stringify({ success: successCount, failed: failedCount, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
