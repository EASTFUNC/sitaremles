import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import { Download, FileCheck2 } from "lucide-react";

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
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
  const ownBranchId = profile?.branch_id;

  const params = await searchParams;
  const period = params.period ?? new Date().toISOString().slice(0, 7);

  const { data: rawSummary } = await supabase.rpc("get_payroll_summary", {
    p_company_id: companyId,
    p_period: period,
  });

  let summary = rawSummary ?? [];

  if (isBranchManager && ownBranchId) {
    const { data: branchEmployees } = await supabase
      .from("profiles")
      .select("id")
      .eq("company_id", companyId)
      .eq("branch_id", ownBranchId);
    const branchIds = new Set((branchEmployees ?? []).map((e) => e.id));
    summary = summary.filter((s: any) => branchIds.has(s.user_id));
  }

  const { data: storeDisplayRows } = await supabase.rpc("get_store_display_user_ids", { p_company_id: companyId });
  const storeDisplayIds = new Set((storeDisplayRows ?? []).map((r: any) => r.user_id));
  summary = summary.filter((s: any) => !storeDisplayIds.has(s.user_id));

  const { data: approvals } = await supabase
    .from("payroll_approvals")
    .select("user_id, status")
    .eq("company_id", companyId)
    .eq("period", period);

  const approvalMap: Record<string, string> = {};
  approvals?.forEach((a) => (approvalMap[a.user_id] = a.status));

  async function createApprovalRecords(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const period = formData.get("period") as string;
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id, branch_id")
      .eq("id", user.id)
      .single();

    const { data: rolesData } = await supabase
      .from("user_roles")
      .select("roles(code)")
      .eq("user_id", user.id)
      .eq("company_id", profile?.company_id);
    const roleCodes = (rolesData ?? []).map((r: any) => r.roles?.code);
    const isCompanyWideView = roleCodes.includes("company_admin") || roleCodes.includes("regional_manager");
    const isBranchManager = roleCodes.includes("store_manager") && !isCompanyWideView;

    const { data: storeDisplayRows } = await supabase.rpc("get_store_display_user_ids", { p_company_id: profile?.company_id });
    const storeDisplayIds = new Set((storeDisplayRows ?? []).map((r: any) => r.user_id));

    let employeesQuery = supabase.from("profiles").select("id").eq("company_id", profile?.company_id);
    if (isBranchManager && profile?.branch_id) {
      employeesQuery = employeesQuery.eq("branch_id", profile.branch_id);
    }
    const { data: employees } = await employeesQuery;

    for (const emp of employees ?? []) {
      if (storeDisplayIds.has(emp.id)) continue;
      await supabase
        .from("payroll_approvals")
        .upsert(
          { company_id: profile?.company_id, user_id: emp.id, period },
          { onConflict: "user_id,period", ignoreDuplicates: true }
        );
    }

    revalidatePath(`/dashboard/payroll?period=${period}`);
  }

  const csvRows =
    summary?.map((s: any) => `${s.full_name},${s.worked_days},${s.leave_days},${approvalMap[s.user_id] ?? "pending"}`) ?? [];
  const csvContent = `Personel,Calisilan Gun,Izinli Gun,Onay Durumu\n${csvRows.join("\n")}`;
  const csvDataUri = `data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}`;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", fontFamily: "var(--font-body)" }}>
      <h1 style={{ marginBottom: 4 }}>Bordro Ön Hazırlık — Puantaj Özeti</h1>
      <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 0, marginBottom: 20 }}>
        {isCompanyWideView ? "Tüm şirketin puantaj özeti." : "Şubenizin puantaj özeti."}
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <form method="get" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="month" name="period" defaultValue={period} style={inputStyle} />
          <button type="submit" style={smallButtonStyle}>Göster</button>
        </form>

        <form action={createApprovalRecords}>
          <input type="hidden" name="period" value={period} />
          <button type="submit" style={outlineButtonStyle}>
            <FileCheck2 size={13} strokeWidth={2} style={{ verticalAlign: -2, marginRight: 6 }} />
            Bu Dönem İçin Onay Kayıtları Oluştur
          </button>
        </form>

        <a href={csvDataUri} download={`puantaj_${period}.csv`} style={outlineButtonStyle}>
          <Download size={13} strokeWidth={2} style={{ verticalAlign: -2, marginRight: 6 }} />
          CSV Olarak İndir
        </a>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={cellStyle}>Personel</th>
            <th style={cellStyle}>Çalışılan Gün</th>
            <th style={cellStyle}>İzinli Gün</th>
            <th style={cellStyle}>Onay Durumu</th>
          </tr>
        </thead>
        <tbody>
          {summary?.map((s: any) => (
            <tr key={s.user_id}>
              <td style={cellStyle}>{s.full_name}</td>
              <td style={{ ...cellStyle, fontFamily: "var(--font-mono)" }}>{s.worked_days}</td>
              <td style={{ ...cellStyle, fontFamily: "var(--font-mono)" }}>{s.leave_days}</td>
              <td style={cellStyle}>
                <span style={badgeStyle(approvalMap[s.user_id])}>
                  {approvalMap[s.user_id] === "approved" ? "Onaylandı" : approvalMap[s.user_id] === "pending" ? "Beklemede" : "—"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {(!summary || summary.length === 0) && <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>Bu dönem için kayıt yok.</p>}
    </div>
  );
}

function badgeStyle(status?: string): React.CSSProperties {
  const color = status === "approved" ? "var(--success)" : status === "pending" ? "var(--accent)" : "var(--text-secondary)";
  return {
    fontSize: 11,
    padding: "3px 10px",
    borderRadius: 20,
    fontFamily: "var(--font-mono)",
    background: `color-mix(in srgb, ${color} 15%, transparent)`,
    color,
  };
}

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg-elevated)",
  color: "var(--text)",
  fontSize: 13,
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
const outlineButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "8px 16px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg-elevated)",
  color: "var(--text)",
  fontSize: 12.5,
  cursor: "pointer",
  textDecoration: "none",
};
const cellStyle: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid var(--border)",
  padding: "10px 6px",
  fontSize: 13,
};