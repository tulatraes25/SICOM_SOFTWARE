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
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? "sistema@sicompatagonia.com";
    const fromName = "SICOM Patagonia SRL";
    const replyTo = Deno.env.get("RESEND_REPLY_TO") ?? "adriana@sicompatagonia.com";

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Unauthorized");

    const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();
    if (!profile || !["admin", "supervisor"].includes(profile.role)) {
      throw new Error("Insufficient permissions");
    }

    // Parse body
    const body = await req.json();
    const { budget_id, recipients, subject, body: emailBody, pdf_base64, pdf_filename } = body;

    if (!budget_id) throw new Error("budget_id is required");
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      throw new Error("recipients array is required and must not be empty");
    }
    if (!subject) throw new Error("subject is required");
    if (!emailBody) throw new Error("body is required");

    // Get budget for logging
    const { data: budget } = await supabase
      .from("budgets")
      .select("id, subject, case_number:numerating_mode")
      .eq("id", budget_id)
      .single();

    // Validate PDF base64 if provided
    let validPdfBase64 = pdf_base64 || null;
    if (validPdfBase64) {
      // Remove data URI prefix if present
      if (validPdfBase64.startsWith("data:")) {
        validPdfBase64 = validPdfBase64.split(",")[1];
      }
      // Basic validation
      if (validPdfBase64.length < 100) {
        console.warn("[send-budget-email] PDF base64 too short, proceeding without attachment");
        validPdfBase64 = null;
      }
    }

    const isMock = !resendApiKey;
    const results: Array<{ email: string; name?: string; status: string; provider_message_id?: string; error?: string }> = [];
    let successCount = 0;
    let failedCount = 0;

    // Deduplicate recipients by email
    const uniqueRecipients = new Map<string, { email: string; name?: string }>();
    for (const r of recipients) {
      const normalizedEmail = r.email?.trim().toLowerCase();
      if (normalizedEmail && normalizedEmail.includes("@")) {
        if (!uniqueRecipients.has(normalizedEmail)) {
          uniqueRecipients.set(normalizedEmail, { email: normalizedEmail, name: r.name });
        }
      }
    }

    for (const [email, recipient] of uniqueRecipients) {
      try {
        if (isMock) {
          // Mock mode
          await supabase.from("budget_email_sends").insert({
            budget_id,
            recipient_email: email,
            recipient_name: recipient.name || null,
            subject,
            status: "sent",
            sent_by: user.id,
            provider_message_id: `mock-${Date.now()}`,
            error_message: "MOCK - correo no enviado (sin RESEND_API_KEY)",
          });
          results.push({ email, name: recipient.name, status: "mock" });
          successCount++;
          continue;
        }

        // Build email payload
        const emailPayload: Record<string, unknown> = {
          from: `${fromName} <${fromEmail}>`,
          to: [email],
          reply_to: replyTo,
          subject,
          html: emailBody.replace(/\n/g, "<br>"),
        };

        // Add attachment if PDF provided
        if (validPdfBase64) {
          emailPayload.attachments = [{
            filename: pdf_filename || "presupuesto.pdf",
            content: validPdfBase64,
          }];
        }

        // Send via Resend
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(emailPayload),
        });

        const emailData = await emailResponse.json();

        if (!emailResponse.ok) {
          const errorMsg = emailData.message || emailData.error || `HTTP ${emailResponse.status}`;
          throw new Error(errorMsg);
        }

        // Record success
        await supabase.from("budget_email_sends").insert({
          budget_id,
          recipient_email: email,
          recipient_name: recipient.name || null,
          subject,
          status: "sent",
          sent_by: user.id,
          provider_message_id: emailData.id,
        });

        results.push({ email, name: recipient.name, status: "sent", provider_message_id: emailData.id });
        successCount++;
      } catch (error) {
        console.error(`[send-budget-email] Failed to send to ${email}:`, error.message);

        // Record failure
        try {
          await supabase.from("budget_email_sends").insert({
            budget_id,
            recipient_email: email,
            recipient_name: recipient.name || null,
            subject,
            status: "failed",
            sent_by: user.id,
            error_message: error.message,
          });
        } catch (insertErr) {
          console.error("[send-budget-email] Failed to record error:", insertErr);
        }

        results.push({ email, name: recipient.name, status: "failed", error: error.message });
        failedCount++;
      }
    }

    // Audit
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "send_budget_email",
      entity_type: "budget",
      entity_id: budget_id,
      new_data: { success: successCount, failed: failedCount, mock: isMock, recipients: results.length },
    });

    return new Response(
      JSON.stringify({
        success: successCount,
        failed: failedCount,
        mock: isMock,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[send-budget-email] Error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
