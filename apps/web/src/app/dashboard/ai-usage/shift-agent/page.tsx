import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";
import InfoPopover from "@/components/InfoPopover";

export default async function ShiftAgentPage() {
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
    .select("id, status, summary, created_at")
    .eq("company_id", profile?.company_id)
    .eq("agent_name", "shift_agent")
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", fontFamily: "var(--font-body)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <div style={iconBadgeStyle}>
          <Sparkles size={18} color="var(--accent)" strokeWidth={1.75} />
        </div>
        <h1 style={{ margin: 0 }}>Shift Agent</h1>
        <InfoPopover title="Shift Agent Nasıl Çalışır?">
          Seçtiğiniz şube ve hafta için personel uygunluğunu, onaylı izinleri ve mevcut vardiyaları
          toplar. Gemini bu bilgiyle bir taslak plan önerir. Öneri, sunucu tarafında aynı gün çift
          vardiya ve 11 saat dinlenme kuralına karşı otomatik doğrulanır — kurallara uymayan öneriler
          reddedilir. Sonuç her zaman <strong>taslak</strong> olarak eklenir, siz onaylayana kadar
          personel göremez.
        </InfoPopover>
      </div>
      <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 8, marginBottom: 20 }}>
        Otomatik vardiya taslağı üretir.
      </p>

      <Link href="/dashboard/shifts" style={{ textDecoration: "none" }}>
        <div style={ctaCardStyle}>
          <div>
            <strong style={{ fontSize: 14 }}>Vardiya Planlama&apos;da Kullan</strong>
            <p style={{ fontSize: 12.5, color: "var(--text-secondary)", margin: "4px 0 0" }}>
              Bu ajan, Vardiya Planlama sayfasındaki &quot;Akıllı Plan Oluştur&quot; butonundan tetiklenir.
            </p>
          </div>
          <ArrowRight size={16} color="var(--accent)" strokeWidth={1.75} />
        </div>
      </Link>

      <h3 style={{ marginTop: 28, fontSize: 14 }}>Son Çalıştırmalar</h3>
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
        {(!runs || runs.length === 0) && <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>Henüz çalıştırma yok.</p>}
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
const ctaCardStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: 16,
  border: "1px solid var(--accent)",
  borderRadius: 12,
  background: "var(--bg-elevated)",
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