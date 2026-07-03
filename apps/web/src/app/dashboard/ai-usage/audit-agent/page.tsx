import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { ShieldAlert, Search, MapPin } from "lucide-react";
import InfoPopover from "@/components/InfoPopover";
import AuditAgentTrigger from "@/components/AuditAgentTrigger";

export default async function AuditAgentPage({
  searchParams,
}: {
  searchParams: Promise<{ branch_id?: string; q?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();

  const companyId = profile?.company_id;
  const { branch_id: branchId, q } = await searchParams;

  const { data: branches } = await supabase
    .from("branches")
    .select("id, name")
    .eq("company_id", companyId);

  const { data: runs } = await supabase
    .from("ai_agent_runs")
    .select("id, status, summary, created_at")
    .eq("company_id", companyId)
    .eq("agent_name", "audit_agent")
    .order("created_at", { ascending: false })
    .limit(20);

  let matchingUserIds: string[] | null = null;
  if (q) {
    const { data: matchedProfiles } = await supabase
      .from("profiles")
      .select("id")
      .eq("company_id", companyId)
      .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`);
    matchingUserIds = (matchedProfiles ?? []).map((p) => p.id);
  }

  let suspiciousLogs: any[] = [];
  if (!(matchingUserIds !== null && matchingUserIds.length === 0)) {
    let logsQuery = supabase
      .from("attendance_logs")
      .select("id, event_type, event_time, distance_from_branch_m, profiles!attendance_logs_user_id_fkey(full_name, phone), branches(name)")
      .eq("company_id", companyId)
      .eq("is_suspicious", true)
      .order("event_time", { ascending: false })
      .limit(50);

    if (branchId) logsQuery = logsQuery.eq("branch_id", branchId);
    if (matchingUserIds) logsQuery = logsQuery.in("user_id", matchingUserIds);

    const { data } = await logsQuery;
    suspiciousLogs = data ?? [];
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", fontFamily: "var(--font-body)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <div style={iconBadgeStyle}>
          <ShieldAlert size={18} color="var(--accent)" strokeWidth={1.75} />
        </div>
        <h1 style={{ margin: 0 }}>Audit Agent</h1>
        <InfoPopover title="Audit Agent Nasıl Çalışır?">
          Önce kural tabanlı bir tarama yapar: şube dışından girişleri ve aynı QR kodunun kısa sürede
          tekrar kullanımını işaretler. Bu tespit tamamen deterministik koddur — LLM burada karar
          vermez. Gemini, sadece zaten tespit edilmiş kayıtları okuyup yöneticinin anlayacağı sade bir
          özet üretir.
        </InfoPopover>
      </div>
      <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 8, marginBottom: 20 }}>
        Şüpheli giriş-çıkış hareketlerini tespit edip özetler.
      </p>

      {companyId && <AuditAgentTrigger companyId={companyId} />}

      <h3 style={{ marginTop: 28, fontSize: 14 }}>Şüpheli Kayıtlar</h3>
      <form method="get" style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search size={14} color="var(--text-secondary)" style={{ position: "absolute", left: 10, top: 10 }} />
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="İsim veya telefon ara..."
            style={{ ...inputStyle, paddingLeft: 32 }}
          />
        </div>
        <select name="branch_id" defaultValue={branchId ?? ""} style={inputStyle}>
          <option value="">Tüm Şubeler</option>
          {branches?.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <button type="submit" style={filterButtonStyle}>Filtrele</button>
      </form>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28 }}>
        {suspiciousLogs.map((log: any) => (
          <div key={log.id} style={logRowStyle}>
            <div>
              <strong style={{ fontSize: 13 }}>{log.profiles?.full_name}</strong>
              <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                <MapPin size={11} strokeWidth={1.75} />
                {log.branches?.name} · {Math.round(log.distance_from_branch_m ?? 0)}m ·{" "}
                {new Date(log.event_time).toLocaleString("tr-TR")}
              </div>
            </div>
            <span style={typeBadgeStyle}>{log.event_type === "check_in" ? "Giriş" : "Çıkış"}</span>
          </div>
        ))}
        {suspiciousLogs.length === 0 && (
          <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>Kayıt bulunamadı.</p>
        )}
      </div>

      <h3 style={{ fontSize: 14 }}>Son Çalıştırmalar</h3>
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
const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg-elevated)",
  color: "var(--text)",
  fontSize: 13,
};
const filterButtonStyle: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg-elevated)",
  color: "var(--text)",
  fontSize: 12.5,
  cursor: "pointer",
};
const logRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "10px 14px",
  border: "1px solid #E0A030",
  borderRadius: 10,
  background: "var(--bg-elevated)",
};
const typeBadgeStyle: React.CSSProperties = {
  fontSize: 11,
  padding: "3px 10px",
  borderRadius: 20,
  fontFamily: "var(--font-mono)",
  background: "color-mix(in srgb, #E0A030 15%, transparent)",
  color: "#E0A030",
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