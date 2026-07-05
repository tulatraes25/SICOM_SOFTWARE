import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Esta Edge Function está DEPRECATED para generación de PDF real.
// El PDF real se genera desde el frontend usando @react-pdf/renderer.
// Esta función se mantiene solo como referencia o para casos específicos.

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({
      error: "Esta función está deprecated",
      message: "El PDF real se genera desde el frontend usando @react-pdf/renderer. Use el botón 'Generar y Guardar PDF' en la interfaz.",
      alternative: "Frontend → usePDFGenerator() → generatePDFBlob() → uploadPDFToStorage()",
    }),
    {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});
