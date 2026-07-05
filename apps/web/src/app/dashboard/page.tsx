import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import Link from "next/link";
import { Users, CheckCircle2, CalendarClock, ClipboardList, AlertTriangle, QrCode, ArrowRight, type LucideIcon } from "lucide-react";

export default async function DashboardHomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, company_id, branch_id")
    .eq("id", user.id)
    .single();

  const companyId = profile?.company_id;

  const { data: rolesData } = await supabase
    .from("user_roles")
    .select("roles(code)")
    .eq("user_id", user.id)
    .eq("company_id", companyId);
  const roleCodes = (rolesData ?? []).map((r: any) => r.roles?.code);

  if (roleCodes.includes("store_display")) {
    redirect("/dashboard/store");
  }

  const isCompanyWideView = roleCodes.includes("company_admin") || roleCodes.includes("regional_manager");
  const isBranchManager = roleCodes.includes("store_manager") && !isCompanyWideView;
  const isManager = isCompanyWideView || isBranchManager;

  // Sirket geneli mi, yoksa tek magazaya mi odaklanacagiz belirle
  const branchId = isBranchManager ? profile?.branch_id : null;

  let branchName = "";
  if (branchId) {
    const { data: branch } = await supabase.from("branches").select("name").eq("id", branchId).single();
    branchName = branch?.name ?? "";
  }

  // "store_display" hesaplarini gercek personel sayimlarindan haric tut
  const { data: storeDisplayRows } = await supabase.rpc("get_store_display_user_ids", { p_company_id: companyId });
  const storeDisplayIds = new Set((storeDisplayRows ?? []).map((r: any) => r.user_id));

  let branchEmployeeIds: string[] = [];
  if (isBranchManager && branchId) {
    const { data: branchEmployees } = await supabase
      .from("profiles")
      .select("id")
      .eq("company_id", companyId)
      .eq("branch_id", branchId);
    branchEmployeeIds = (branchEmployees ?? []).map((e) => e.id).filter((id) => !storeDisplayIds.has(id));
  }

  const todayStart = new Date().toISOString().slice(0, 10);

  let employeeCount = 0;
  let activeToday = 0;
  let pendingLeave = 0;
  let pendingTasks = 0;
  let suspiciousToday = 0;
  let recentLeaves: any[] = [];

  if (isCompanyWideView) {
    const { data: allEmployees } = await supabase
      .from("profiles")
      .select("id")
      .eq("company_id", companyId);
    employeeCount = (allEmployees ?? []).filter((e) => !storeDisplayIds.has(e.id)).length;

    const { data: todayCheckins } = await supabase
      .from("attendance_logs")
      .select("user_id")
      .eq("company_id", companyId)
      .eq("event_type", "check_in")
      .gte("event_time", todayStart);
    activeToday = new Set((todayCheckins ?? []).map((c: any) => c.user_id)).size;

    const { count: pendingLeaveCount } = await supabase
      .from("leave_requests")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("status", "pending");
    pendingLeave = pendingLeaveCount ?? 0;

    const { count: pendingTasksCount } = await supabase
      .from("task_assignments")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .neq("status", "completed");
    pendingTasks = pendingTasksCount ?? 0;

    const { count: suspiciousCount } = await supabase
      .from("attendance_logs")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("is_suspicious", true)
      .gte("event_time", todayStart);
    suspiciousToday = suspiciousCount ?? 0;

    const { data: recentLeaveRows } = await supabase
      .from("leave_requests")
      .select("id, start_date, end_date, status, profiles!leave_requests_user_id_fkey(full_name), leave_types(name)")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(5);
    recentLeaves = recentLeaveRows ?? [];
  } else if (isBranchManager) {
    employeeCount = branchEmployeeIds.length;

    const { data: todayCheckins } = branchId
      ? await supabase
          .from("attendance_logs")
          .select("user_id")
          .eq("branch_id", branchId)
          .eq("event_type", "check_in")
          .gte("event_time", todayStart)
      : { data: [] };
    activeToday = new Set((todayCheckins ?? []).map((c: any) => c.user_id)).size;

    const { count: pendingLeaveCount } = branchEmployeeIds.length
      ? await supabase
          .from("leave_requests")
          .select("id", { count: "exact", head: true })
          .in("user_id", branchEmployeeIds)
          .eq("status", "pending")
      : { count: 0 };
    pendingLeave = pendingLeaveCount ?? 0;

    const { count: pendingTasksCount } = branchId
      ? await supabase
          .from("task_assignments")
          .select("id", { count: "exact", head: true })
          .eq("branch_id", branchId)
          .neq("status", "completed")
      : { count: 0 };
    pendingTasks = pendingTasksCount ?? 0;

    const { count: suspiciousCount } = branchId
      ? await supabase
          .from("attendance_logs")
          .select("id", { count: "exact", head: true })
          .eq("branch_id", branchId)
          .eq("is_suspicious", true)
          .gte("event_time", todayStart)
      : { count: 0 };
    suspiciousToday = suspiciousCount ?? 0;

    const { data: recentLeaveRows } = branchEmployeeIds.length
      ? await supabase
          .from("leave_requests")
          .select("id, start_date, end_date, status, profiles!leave_requests_user_id_fkey(full_name), leave_types(name)")
          .in("user_id", branchEmployeeIds)
          .order("created_at", { ascending: false })
          .limit(5)
      : { data: [] };
    recentLeaves = recentLeaveRows ?? [];
  }

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", fontFamily: "var(--font-body)" }}>
      <p style={{ color: "var(--text-secondary)", marginBottom: 2, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "var(--font-mono)" }}>
        Hoş geldin
      </p>
      <h1 style={{ marginTop: 0 }}>{profile?.full_name}</h1>
      {isBranchManager && branchName && (
        <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: -6 }}>{branchName}</p>
      )}

      {isBranchManager && (
        <Link href="/dashboard/store" style={{ textDecoration: "none" }}>
          <div style={emergencyCardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={emergencyIconStyle}>
                <QrCode size={18} color="#E0A030" strokeWidth={1.75} />
              </div>
              <div>
                <strong style={{ fontSize: 14 }}>Acil Durum — Mağaza QR&apos;ını Aç</strong>
                <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "2px 0 0" }}>
                  İnternet veya PC sorunu yaşanıyorsa, personelin giriş yapabilmesi için buraya tıklayın.
                </p>
              </div>
            </div>
            <ArrowRight size={16} color="var(--text-secondary)" strokeWidth={1.75} />
          </div>
        </Link>
      )}

      {isManager ? (
        <div style={gridStyle}>
          <StatCard icon={Users} label="Toplam Personel" value={employeeCount} />
          <StatCard icon={CheckCircle2} label="Bugün Aktif" value={activeToday} accent="success" />
          <StatCard icon={CalendarClock} label="Bekleyen İzin Talebi" value={pendingLeave} />
          <StatCard icon={ClipboardList} label="Bekleyen Görev" value={pendingTasks} />
          <StatCard icon={AlertTriangle} label="Bugün Şüpheli Hareket" value={suspiciousToday} accent={suspiciousToday ? "warning" : undefined} />
        </div>
      ) : (
        <p style={{ color: "var(--text-secondary)" }}>Kişisel özetiniz için mobil uygulamayı kullanabilirsiniz.</p>
      )}

      {isManager && (
        <>
          <h3 style={{ marginTop: 40, fontSize: 15 }}>Son İzin Talepleri</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {recentLeaves.map((l: any) => (
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
            {recentLeaves.length === 0 && (
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

const emergencyCardStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: 16,
  border: "1px solid #E0A030",
  borderRadius: 14,
  background: "color-mix(in srgb, #E0A030 8%, var(--bg-elevated))",
  marginTop: 18,
};
const emergencyIconStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 10,
  background: "color-mix(in srgb, #E0A030 18%, transparent)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};