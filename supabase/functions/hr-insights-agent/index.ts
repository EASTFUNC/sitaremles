import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { company_id, question } = await req.json();
    const authHeader = req.headers.get("Authorization")!;
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const tools = [
      {
        function_declarations: [
          {
            name: "get_branch_efficiency",
            description: "Şube bazlı giriş-çıkış, şüpheli hareket ve çalışan sayısı istatistiklerini getirir.",
          },
          {
            name: "get_employee_leave_summary",
            description: "Personel bazlı bekleyen, onaylanan ve reddedilen izin taleplerinin sayısını getirir.",
          },
        ],
      },
    ];

    const planResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: question }] }],
          tools,
        }),
      }
    );
    const planData = await planResponse.json();
    const functionCall = planData.candidates?.[0]?.content?.parts?.[0]?.functionCall;

    if (!functionCall) {
      return new Response(
        JSON.stringify({ success: true, answer: "Bu soruyu şu an yanıtlayamıyorum. Şube verimliliği veya izin durumu hakkında sorabilirsin." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let toolResult;
    if (functionCall.name === "get_branch_efficiency") {
      const { data, error } = await supabase.rpc("get_branch_efficiency", { p_company_id: company_id });
      if (error) throw error;
      toolResult = data;
    } else if (functionCall.name === "get_employee_leave_summary") {
      const { data, error } = await supabase.rpc("get_employee_leave_summary", { p_company_id: company_id });
      if (error) throw error;
      toolResult = data;
    }

    const summaryPrompt = `Kullanıcı şunu sordu: "${question}"\n\nVeritabanından gelen gerçek veri:\n${JSON.stringify(toolResult)}\n\nBu veriye dayanarak, sadece verilen sayılara dayanan, kısa ve net bir Türkçe cevap ver. Veride olmayan hiçbir şey uydurma.`;

    const finalResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: summaryPrompt }] }] }),
      }
    );
    const finalData = await finalResponse.json();
    const answer = finalData.candidates?.[0]?.content?.parts?.[0]?.text ?? "Cevap oluşturulamadı.";

    await supabase.from("ai_agent_runs").insert({
      company_id,
      agent_name: "hr_insights_agent",
      status: "success",
      summary: question,
    });

    return new Response(
      JSON.stringify({ success: true, answer, raw_data: toolResult }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("HR insights agent error:", e);
    const errorMessage = e instanceof Error ? e.message : JSON.stringify(e);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});