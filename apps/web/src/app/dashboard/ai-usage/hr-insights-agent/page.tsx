import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { MessageSquare } from "lucide-react";
import InfoPopover from "@/components/InfoPopover";
import HrInsightsChat from "@/components/HrInsightsChat";

export default async function HrInsightsAgentPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();

  const companyId = profile?.company_id;

  const { data: runs } = await supabase
    .from("ai_agent_runs")
    .select("id, status, summary, created_at")
    .eq("company_id", companyId)
    .eq("agent_name", "hr_insights_agent")
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", fontFamily: "var(--font-body)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <div style={iconBadgeStyle}>
          <MessageSquare size={18} color="var(--accent)" strokeWidth={1.75} />
        </div>
        <h1 style={{ margin: 0 }}>HR Insights Agent</h1>
        <InfoPopover title="HR Insights Agent Nasıl Çalışır?">
          Gemini&apos;ye serbest SQL yazdırılmaz. Sorunuzu önceden tanımlanmış, güvenli fonksiyonlardan
          (şube verimliliği, izin özeti gibi) hangisine karşılık geldiğini seçer. Şirket kimliği hiçbir
          zaman modelden gelmez, sunucu tarafında zorla eklenir — bu, şirketler arası veri sızıntısını
          imkansız kılar. Cevaplar her zaman gerçek veritabanı sonuçlarına dayanır.
        </InfoPopover>
      </div>
      <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 8, marginBottom: 20 }}>
        Doğal dilde sorular sorup analitik cevaplar alın.
      </p>

      {companyId && <HrInsightsChat companyId={companyId} />}

      <h3 style={{ marginTop: 28, fontSize: 14 }}>Son Sorular</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {runs?.map((r) => (
          <div key={r.id} style={runRowStyle}>
            <div>
              <span style={{ fontSize: 12.5 }}>{r.summary}</span>
              <div style={{ fontSize: 10.5, color: "var(--text-secondary)", fontFamily: "var(--font-mono)", marginTop: 2 }}>
                {new Date(r.created_at).toLocaleString("tr-TR")}
              </div>
            </div>
            <span style={statusBadgeStyle(r.status === "success")}>{r.status === "success" ? "Başarılı" : "Hata"}</span>
          </div>
        ))}
        {(!runs || runs.length === 0) && <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>Henüz soru sorulmadı.</p>}
      </div>
    </div>
  );
}

function statusBadgeStyle(success: boolean): React.CSSProperties {
  const color = success ? "var(--success)" : "#D64545";
  return {
    fontSize: 11,
    padding: "3px 10px",
    borderRadius: 20,
    fontFamily: "var(--font-mono)",
    background: `color-mix(in srgb, ${color} 15%, transparent)`,
    color,
  };
}

const iconBadgeStyle: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 10,
  background: "color-mix(in srgb, var(--accent) 15%, transparent)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
const runRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "10px 14px",
  border: "1px solid var(--border)",
  borderRadius: 10,
  background: "var(--bg-elevated)",
};