import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const { company_id } = await req.json();
    const authHeader = req.headers.get("Authorization")!;
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: flaggedCount, error: rpcError } = await supabase.rpc(
      "flag_suspicious_attendance",
      { p_company_id: company_id }
    );
    if (rpcError) throw rpcError;

    const { data: suspiciousLogs, error: fetchError } = await supabase
      .from("attendance_logs")
      .select("event_time, event_type, distance_from_branch_m, is_within_geofence, profiles!attendance_logs_user_id_fkey(full_name), branches(name)")
      .eq("company_id", company_id)
      .eq("is_suspicious", true)
      .order("event_time", { ascending: false })
      .limit(20);
    if (fetchError) throw fetchError;

    if (!suspiciousLogs || suspiciousLogs.length === 0) {
      return new Response(
        JSON.stringify({ success: true, flagged_count: flaggedCount, summary: "Şüpheli hareket tespit edilmedi." }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const logsText = suspiciousLogs
      .map((l: any) => `${l.profiles?.full_name} - ${l.branches?.name} - ${l.event_time} - mesafe: ${Math.round(l.distance_from_branch_m ?? 0)}m`)
      .join("\n");

    const prompt = `Aşağıda bir İK sisteminde şüpheli olarak işaretlenmiş giriş-çıkış kayıtları var. Bunları yöneticiye 3-4 cümlelik, sade Türkçe bir özet olarak anlat. Kayıtları yeniden değerlendirme veya suçlama yapma, sadece gözlemlenen paterni özetle:\n\n${logsText}`;

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );
    const geminiData = await geminiResponse.json();
    const summary = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? "Özet oluşturulamadı.";
await supabase.from("ai_agent_runs").insert({
      company_id,
      agent_name: "audit_agent",
      status: "success",
      summary: `${flaggedCount} yeni kayıt işaretlendi`,
    });
    return new Response(
      JSON.stringify({ success: true, flagged_count: flaggedCount, summary, records: suspiciousLogs }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Audit agent error:", e);
    const errorMessage = e instanceof Error ? e.message : JSON.stringify(e);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});