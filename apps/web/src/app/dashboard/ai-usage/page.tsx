import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import Link from "next/link";
import { Sparkles, ShieldAlert, MessageSquare, ArrowRight } from "lucide-react";

export default async function AiUsagePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();

  const companyId = profile?.company_id;

  const today = new Date().toISOString().slice(0, 10);
  const { data: todayRuns } = await supabase
    .from("ai_agent_runs")
    .select("agent_name")
    .eq("company_id", companyId)
    .gte("created_at", today);

  const counts: Record<string, number> = { shift_agent: 0, audit_agent: 0, hr_insights_agent: 0 };
  todayRuns?.forEach((r) => {
    if (counts[r.agent_name] !== undefined) counts[r.agent_name]++;
  });

  const agents = [
    {
      href: "/dashboard/ai-usage/shift-agent",
      icon: Sparkles,
      name: "Shift Agent",
      desc: "Kısıtlara ve tercihlere göre otomatik vardiya taslağı üretir.",
      count: counts.shift_agent,
    },
    {
      href: "/dashboard/ai-usage/audit-agent",
      icon: ShieldAlert,
      name: "Audit Agent",
      desc: "Şüpheli giriş-çıkış hareketlerini tespit edip özetler.",
      count: counts.audit_agent,
    },
    {
      href: "/dashboard/ai-usage/hr-insights-agent",
      icon: MessageSquare,
      name: "HR Insights Agent",
      desc: "Doğal dilde sorular sorup analitik cevaplar alın.",
      count: counts.hr_insights_agent,
    },
  ];

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", fontFamily: "var(--font-body)" }}>
      <h1 style={{ marginBottom: 4 }}>AI Ajanları</h1>
      <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 0, marginBottom: 24 }}>
        Bugün toplam {(todayRuns ?? []).length} çağrı yapıldı.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
        {agents.map((a) => (
          <Link key={a.href} href={a.href} style={{ textDecoration: "none", color: "inherit" }}>
            <div style={cardStyle}>
              <div style={iconBadgeStyle}>
                <a.icon size={18} color="var(--accent)" strokeWidth={1.75} />
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
                <strong style={{ fontFamily: "var(--font-display)", fontSize: 15 }}>{a.name}</strong>
                <ArrowRight size={14} color="var(--text-secondary)" strokeWidth={1.75} />
              </div>
              <p style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 6, lineHeight: 1.5 }}>{a.desc}</p>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "var(--font-mono)", marginTop: 10 }}>
                Bugün {a.count} çağrı
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  padding: 20,
  border: "1px solid var(--border)",
  borderRadius: 16,
  background: "var(--bg-elevated)",
};
const iconBadgeStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 10,
  background: "color-mix(in srgb, var(--accent) 15%, transparent)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};