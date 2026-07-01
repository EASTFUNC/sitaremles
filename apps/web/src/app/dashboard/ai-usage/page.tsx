import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

export default async function AiUsagePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();

  const { data: runs } = await supabase
    .from("ai_agent_runs")
    .select("id, agent_name, status, summary, created_at")
    .eq("company_id", profile?.company_id)
    .order("created_at", { ascending: false })
    .limit(50);

  const today = new Date().toISOString().slice(0, 10);
  const todayRuns = runs?.filter((r) => r.created_at.startsWith(today)) ?? [];

  const agentLabels: Record<string, string> = {
    hr_insights_agent: "🧠 HR Insights Agent",
    audit_agent: "🔍 Audit Agent",
    shift_agent: "🤖 Shift Agent",
  };

  return (
    <div style={{ maxWidth: 800, margin: "60px auto", fontFamily: "sans-serif" }}>
      <h1>AI Kullanım Paneli</h1>

      <div style={{ padding: 16, border: "1px solid #4a90e2", marginBottom: 24 }}>
        <strong>Bugünkü toplam çağrı: {todayRuns.length}</strong>
        <p style={{ fontSize: 13, color: "#999" }}>
          Ücretsiz Gemini katmanında günlük limit modele göre değişir (yaklaşık 250-1500 istek).
          Bu sayı limite yaklaşırsa Google Cloud faturalandırmasını açmayı düşünmelisin.
        </p>
      </div>

      <h3>Son 50 Çağrı</h3>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={cellStyle}>Zaman</th>
            <th style={cellStyle}>Ajan</th>
            <th style={cellStyle}>Durum</th>
            <th style={cellStyle}>Özet</th>
          </tr>
        </thead>
        <tbody>
          {runs?.map((r) => (
            <tr key={r.id}>
              <td style={cellStyle}>{new Date(r.created_at).toLocaleString("tr-TR")}</td>
              <td style={cellStyle}>{agentLabels[r.agent_name] ?? r.agent_name}</td>
              <td style={cellStyle}>{r.status === "success" ? "✓" : "✗"}</td>
              <td style={cellStyle}>{r.summary}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {(!runs || runs.length === 0) && <p>Henüz AI çağrısı yapılmadı.</p>}
    </div>
  );
}

const cellStyle: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid #333",
  padding: "8px 6px",
};