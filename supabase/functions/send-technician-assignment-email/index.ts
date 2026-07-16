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

    const { claim_id } = await req.json();
    if (!claim_id) throw new Error("claim_id is required");

    // Get claim with technician
    const { data: claim, error: claimError } = await supabase
      .from("claims").select("*, client:clients(name), building:buildings(name), elevator:elevators(code), assigned_user:profiles!claims_assigned_to_fkey(full_name, email)")
      .eq("id", claim_id).single();
    if (claimError || !claim) throw new Error("Claim not found");

    if (!claim.assigned_user?.email) throw new Error("El reclamo no tiene técnico asignado con correo electrónico");

    const techEmail = claim.assigned_user.email;
    const techName = claim.assigned_user.full_name;
    const caseNum = claim.service_case?.case_number || claim.id;
    const caseMode = claim.service_case?.numbering_mode;
    const numberLabel = caseMode === "test" ? `PRUEBA N.º ${caseNum}` : `N.º ${caseNum}`;

    const priorityMap: Record<string, string> = { low: "Baja", normal: "Normal", high: "Alta", urgent: "Urgente" };
    const subject = `Nueva tarea SICOM — Reclamo ${numberLabel}`;

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family:Arial,sans-serif;line-height:1.6;color:#333"><div style="max-width:600px;margin:0 auto;padding:20px"><div style="background:#06172E;color:white;padding:20px;text-align:center;border-radius:8px 8px 0 0"><h1 style="margin:0;font-size:24px">SICOM</h1><p style="margin:2px 0 0;font-size:16px">PATAGONIA ASCENSORES</p><div style="background:#8DB600;height:3px;margin:10px auto;width:80%"></div></div><div style="background:#f9fafb;padding:20px;border:1px solid #e5e7eb"><p>Hola, <strong>${techName}</strong>:</p><p>Se te asignó un nuevo reclamo.</p><div style="background:white;padding:15px;border-radius:8px;margin:15px 0;border-left:4px solid #8DB600"><p style="margin:0"><strong>Número:</strong> ${numberLabel}</p><p style="margin:5px 0 0"><strong>Cliente:</strong> ${claim.client?.name || "N/D"}</p><p style="margin:5px 0 0"><strong>Edificio:</strong> ${claim.building?.name || "N/D"}</p><p style="margin:5px 0 0"><strong>Ascensor:</strong> ${claim.elevator?.code || "N/D"}</p><p style="margin:5px 0 0"><strong>Prioridad:</strong> ${priorityMap[claim.priority] || claim.priority}</p><p style="margin:5px 0 0"><strong>Motivo:</strong> ${claim.subject}</p><p style="margin:5px 0 0"><strong>Fecha:</strong> ${new Date(claim.claim_date).toLocaleDateString("es-AR")}</p></div><p>Ingresá al sistema para consultar los detalles y registrar la intervención.</p><hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0"><p style="font-size:12px;color:#666;text-align:center"><strong>SICOM Patagonia Ascensores</strong><br><a href="https://sicompatagonia.com/" style="color:#8DB600">sicompatagonia.com</a></p></div></div></body></html>`;

    let status = "failed";
    let providerMessageId = "";
    let errorMsg = "";

    if (!resendApiKey) {
      status = "sent";
      providerMessageId = `mock-${Date.now()}`;
    } else {
      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: `SICOM Patagonia SRL <${fromEmail}>`, to: [techEmail], reply_to: replyTo, subject, html }),
      });
      const emailData = await emailResponse.json();
      if (!emailResponse.ok) throw new Error(emailData.message || "Error al enviar");
      providerMessageId = emailData.id;
      status = "sent";
    }

    // Record notification
    await supabase.from("technician_notification_sends").insert({
      claim_id, service_case_id: claim.service_case_id, technician_id: claim.assigned_to,
      recipient_email: techEmail, subject, status, provider_message_id: providerMessageId || null,
      error_message: errorMsg || null, sent_by: user.id, sent_at: new Date().toISOString(),
    });

    // Log event
    await supabase.from("claim_events").insert({
      claim_id, event_type: "technician_notified", performed_by: user.id,
      details: { email: techEmail, status },
    });

    return new Response(JSON.stringify({ success: true, status, email: techEmail }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
