import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import Link from "next/link";
import { Users, ArrowRight, Search } from "lucide-react";

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

export default async function PersonnelReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
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

  const { data: storeDisplayRows } = await supabase.rpc("get_store_display_user_ids", { p_company_id: companyId });
  const storeDisplayIds = new Set((storeDisplayRows ?? []).map((r: any) => r.user_id));

  const { data: allEmployees } = await supabase
    .from("profiles")
    .select("id, full_name, hire_date, termination_date, status, branch_id, branches(name)")
    .eq("company_id", companyId)
    .order("hire_date", { ascending: true });

  let employees = (allEmployees ?? []).filter((e) => !storeDisplayIds.has(e.id));
  if (isBranchManager) {
    employees = employees.filter((e) => e.branch_id === profile?.branch_id);
  }

  const { q } = await searchParams;
  if (q && q.trim()) {
    const query = q.trim().toLocaleLowerCase("tr");
    employees = employees.filter((e) => e.full_name?.toLocaleLowerCase("tr").includes(query));
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", fontFamily: "var(--font-body)" }}>
      <h1 style={{ marginBottom: 4 }}>Personel Raporları</h1>
      <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 0, marginBottom: 20 }}>
        {isCompanyWideView ? "Tüm şirket." : "Şubeniz."} Aktif ve ayrılmış tüm personel, işe giriş tarihine göre sıralı. Detaylı giriş-çıkış geçmişi için bir satıra tıklayın.
      </p>

      <form method="get" style={{ marginBottom: 20, position: "relative", maxWidth: 320 }}>
        <Search size={14} color="var(--text-secondary)" style={{ position: "absolute", left: 10, top: 10 }} />
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="İsim veya soyisim ara..."
          style={{ ...searchInputStyle, paddingLeft: 32 }}
        />
      </form>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {employees.map((e: any) => (
          <Link key={e.id} href={`/dashboard/personnel-reports/${e.id}`} style={{ textDecoration: "none", color: "inherit" }}>
            <div style={rowCardStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={avatarStyle}>
                  <Users size={15} color="var(--accent)" strokeWidth={1.75} />
                </div>
                <div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 14 }}>{e.full_name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                    {e.branches?.name ?? "—"} · İşe giriş: {e.hire_date ?? "—"}
                    {e.termination_date && ` · Ayrılış: ${e.termination_date}`}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={tenureBadgeStyle(e.status === "terminated")}>
                  {calculateTenure(e.hire_date, e.termination_date)}
                </span>
                <ArrowRight size={14} color="var(--text-secondary)" strokeWidth={1.75} />
              </div>
            </div>
          </Link>
        ))}
        {employees.length === 0 && <p style={{ color: "var(--text-secondary)" }}>Kayıt bulunamadı.</p>}
      </div>
    </div>
  );
}

function tenureBadgeStyle(isTerminated: boolean): React.CSSProperties {
  const color = isTerminated ? "var(--text-secondary)" : "var(--success)";
  return {
    fontSize: 11,
    padding: "3px 10px",
    borderRadius: 20,
    fontFamily: "var(--font-mono)",
    background: `color-mix(in srgb, ${color} 15%, transparent)`,
    color,
    whiteSpace: "nowrap",
  };
}

const rowCardStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "12px 16px",
  border: "1px solid var(--border)",
  borderRadius: 12,
  background: "var(--bg-elevated)",
};
const avatarStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 10,
  background: "color-mix(in srgb, var(--accent) 15%, transparent)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
const searchInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg-elevated)",
  color: "var(--text)",
  fontSize: 13,
};