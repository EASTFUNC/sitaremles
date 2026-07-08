import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import Link from "next/link";
import { ArrowLeft, Clock } from "lucide-react";

function calculateTenure(hireDate: string | null, terminationDate: string | null): string {
  if (!hireDate) return "—";
  const start = new Date(hireDate);
  const end = terminationDate ? new Date(terminationDate) : new Date();
  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  if (end.getDate() < start.getDate()) months--;
  if (months < 0) {
    years--;
    months += 12;
  }
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} yıl`);
  if (months > 0) parts.push(`${months} ay`);
  return parts.length > 0 ? parts.join(" ") : "1 aydan az";
}

export default async function PersonnelReportDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id, branch_id")
    .eq("id", user.id)
    .single();

  const companyId = profile?.company_id;

  const { data: rolesData } = await supabase
    .from("user_roles")
    .select("roles(code)")
    .eq("user_id", user.id)
    .eq("company_id", companyId);
  const roleCodes = (rolesData ?? []).map((r: any) => r.roles?.code);
  const isCompanyWideView = roleCodes.includes("company_admin") || roleCodes.includes("regional_manager");
  const isBranchManager = roleCodes.includes("store_manager") && !isCompanyWideView;
  const isManager = isCompanyWideView || isBranchManager;

  if (!isManager) {
    return (
      <div style={{ maxWidth: 600, margin: "0 auto", fontFamily: "var(--font-body)" }}>
        <h1>Erişim Reddedildi</h1>
        <p style={{ color: "var(--text-secondary)" }}>Bu sayfa sadece yöneticilere açıktır.</p>
      </div>
    );
  }

  const { data: employee } = await supabase
    .from("profiles")
    .select("id, full_name, hire_date, termination_date, branch_id, branches(name)")
    .eq("id", id)
    .eq("company_id", companyId)
    .single();

  if (!employee) notFound();
  if (isBranchManager && employee.branch_id !== profile?.branch_id) {
    return (
      <div style={{ maxWidth: 600, margin: "0 auto", fontFamily: "var(--font-body)" }}>
        <h1>Erişim Reddedildi</h1>
        <p style={{ color: "var(--text-secondary)" }}>Bu personel sizin şubenize ait değil.</p>
      </div>
    );
  }

  const params2 = await searchParams;
  const period = params2.period ?? new Date().toISOString().slice(0, 7);
  const periodStart = `${period}-01`;
  const periodEndDate = new Date(periodStart);
  periodEndDate.setMonth(periodEndDate.getMonth() + 1);
  const periodEnd = periodEndDate.toISOString().slice(0, 10);

  const { data: logs } = await supabase
    .from("attendance_logs")
    .select("event_type, event_time")
    .eq("user_id", id)
    .gte("event_time", periodStart)
    .lt("event_time", periodEnd)
    .order("event_time", { ascending: true });

  const logsByDate: Record<string, { checkIn: string | null; checkOut: string | null }> = {};
  (logs ?? []).forEach((log) => {
    const dateKey = log.event_time.slice(0, 10);
    if (!logsByDate[dateKey]) logsByDate[dateKey] = { checkIn: null, checkOut: null };
    if (log.event_type === "check_in") {
      if (!logsByDate[dateKey].checkIn || log.event_time < logsByDate[dateKey].checkIn!) {
        logsByDate[dateKey].checkIn = log.event_time;
      }
    } else if (log.event_type === "check_out") {
      if (!logsByDate[dateKey].checkOut || log.event_time > logsByDate[dateKey].checkOut!) {
        logsByDate[dateKey].checkOut = log.event_time;
      }
    }
  });

  const dateRows = Object.entries(logsByDate)
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, times]) => {
      let durationLabel = "—";
      if (times.checkIn && times.checkOut) {
        const diffMs = new Date(times.checkOut).getTime() - new Date(times.checkIn).getTime();
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.round((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        durationLabel = `${hours}s ${minutes}dk`;
      }
      return {
        date,
        checkIn: times.checkIn ? new Date(times.checkIn).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : "—",
        checkOut: times.checkOut ? new Date(times.checkOut).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : "—",
        duration: durationLabel,
      };
    });

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", fontFamily: "var(--font-body)" }}>
      <Link href="/dashboard/personnel-reports" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--text-secondary)", fontSize: 12.5, textDecoration: "none", marginBottom: 16 }}>
        <ArrowLeft size={13} strokeWidth={1.75} />
        Personel Raporlarına Dön
      </Link>

      <h1 style={{ marginBottom: 4 }}>{employee.full_name}</h1>
      <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 0, marginBottom: 20 }}>
        {(employee.branches as any)?.name ?? "—"} · İşe giriş: {employee.hire_date ?? "—"}
        {employee.termination_date && ` · Ayrılış: ${employee.termination_date}`}
        {" · Kıdem: "}
        <strong style={{ color: "var(--text)" }}>{calculateTenure(employee.hire_date, employee.termination_date)}</strong>
      </p>

      <form method="get" style={{ marginBottom: 20 }}>
        <input type="month" name="period" defaultValue={period} style={inputStyle} />
        <button type="submit" style={smallButtonStyle}>Göster</button>
      </form>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={cellStyle}>Tarih</th>
            <th style={cellStyle}>Giriş</th>
            <th style={cellStyle}>Çıkış</th>
            <th style={cellStyle}>Süre</th>
          </tr>
        </thead>
        <tbody>
          {dateRows.map((row) => (
            <tr key={row.date}>
              <td style={cellStyle}>{row.date}</td>
              <td style={{ ...cellStyle, fontFamily: "var(--font-mono)" }}>{row.checkIn}</td>
              <td style={{ ...cellStyle, fontFamily: "var(--font-mono)" }}>{row.checkOut}</td>
              <td style={{ ...cellStyle, fontFamily: "var(--font-mono)" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <Clock size={11} strokeWidth={1.75} />
                  {row.duration}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {dateRows.length === 0 && <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>Bu dönem için kayıt yok.</p>}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg-elevated)",
  color: "var(--text)",
  fontSize: 13,
  marginRight: 8,
};
const smallButtonStyle: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: 8,
  border: "none",
  background: "var(--accent)",
  color: "var(--accent-contrast)",
  fontSize: 12.5,
  fontWeight: 500,
  cursor: "pointer",
};
const cellStyle: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid var(--border)",
  padding: "10px 6px",
  fontSize: 13,
};