import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { Users, CheckCircle2, CalendarClock, ClipboardList, AlertTriangle, type LucideIcon } from "lucide-react";

export default async function DashboardHomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, company_id")
    .eq("id", user.id)
    .single();

  const companyId = profile?.company_id;

  const { data: rolesData } = await supabase
    .from("user_roles")
    .select("roles(code)")
    .eq("user_id", user.id)
    .eq("company_id", companyId);
  const roleCodes = (rolesData ?? []).map((r: any) => r.roles?.code);
  const isManager = roleCodes.some((r: string) => ["company_admin", "store_manager", "regional_manager"].includes(r));

  const { count: employeeCount } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId);

  const todayStart = new Date().toISOString().slice(0, 10);
  const { data: todayCheckins } = await supabase
    .from("attendance_logs")
    .select("user_id")
    .eq("company_id", companyId)
    .eq("event_type", "check_in")
    .gte("event_time", todayStart);
  const activeToday = new Set((todayCheckins ?? []).map((c: any) => c.user_id)).size;

  const { count: pendingLeave } = await supabase
    .from("leave_requests")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("status", "pending");

  const { count: pendingTasks } = await supabase
    .from("task_assignments")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .neq("status", "completed");

  const { count: suspiciousToday } = await supabase
    .from("attendance_logs")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("is_suspicious", true)
    .gte("event_time", todayStart);

  const { data: recentLeaves } = await supabase
    .from("leave_requests")
    .select("id, start_date, end_date, status, profiles!leave_requests_user_id_fkey(full_name), leave_types(name)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", fontFamily: "var(--font-body)" }}>
      <p style={{ color: "var(--text-secondary)", marginBottom: 2, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "var(--font-mono)" }}>
        Hoş geldin
      </p>
      <h1 style={{ marginTop: 0 }}>{profile?.full_name}</h1>

      {isManager ? (
        <div style={gridStyle}>
          <StatCard icon={Users} label="Toplam Personel" value={employeeCount ?? 0} />
          <StatCard icon={CheckCircle2} label="Bugün Aktif" value={activeToday} accent="success" />
          <StatCard icon={CalendarClock} label="Bekleyen İzin Talebi" value={pendingLeave ?? 0} />
          <StatCard icon={ClipboardList} label="Bekleyen Görev" value={pendingTasks ?? 0} />
          <StatCard icon={AlertTriangle} label="Bugün Şüpheli Hareket" value={suspiciousToday ?? 0} accent={suspiciousToday ? "warning" : undefined} />
        </div>
      ) : (
        <p style={{ color: "var(--text-secondary)" }}>Kişisel özetiniz için mobil uygulamayı kullanabilirsiniz.</p>
      )}

      {isManager && (
        <>
          <h3 style={{ marginTop: 40, fontSize: 15 }}>Son İzin Talepleri</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {recentLeaves?.map((l: any) => (
              <div key={l.id} style={rowCardStyle}>
                <div>
                  <strong style={{ fontSize: 13 }}>{l.profiles?.full_name}</strong>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)", marginLeft: 8 }}>
                    {l.leave_types?.name} · {l.start_date} → {l.end_date}
                  </span>
                </div>
                <StatusBadge status={l.status} />
              </div>
            ))}
            {(!recentLeaves || recentLeaves.length === 0) && (
              <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>Henüz izin talebi yok.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: { icon: LucideIcon; label: string; value: number; accent?: "success" | "warning" }) {
  const color = accent === "success" ? "var(--success)" : accent === "warning" ? "#E0A030" : "var(--accent)";
  return (
    <div style={cardStyle}>
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: `color-mix(in srgb, ${color} 15%, transparent)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 14,
        }}
      >
        <Icon size={18} color={color} strokeWidth={1.75} />
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 26, color: "var(--text)", fontWeight: 500 }}>{value}</div>
      <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.03em" }}>{label}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    pending: { label: "Beklemede", color: "var(--accent)" },
    approved: { label: "Onaylandı", color: "var(--success)" },
    rejected: { label: "Reddedildi", color: "#D64545" },
  };
  const s = map[status] ?? map.pending;
  return (
    <span
      style={{
        fontSize: 11,
        padding: "3px 10px",
        borderRadius: 20,
        background: `color-mix(in srgb, ${s.color} 15%, transparent)`,
        color: s.color,
        fontFamily: "var(--font-mono)",
        letterSpacing: "0.02em",
      }}
    >
      {s.label}
    </span>
  );
}

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 16,
  marginTop: 28,
};

const cardStyle: React.CSSProperties = {
  padding: 20,
  border: "1px solid var(--border)",
  borderRadius: 14,
  background: "var(--bg-elevated)",
};

const rowCardStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "10px 14px",
  border: "1px solid var(--border)",
  borderRadius: 10,
  background: "var(--bg-elevated)",
};