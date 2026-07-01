import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

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
    .select("company_id")
    .eq("id", user.id)
    .single();

  const companyId = profile?.company_id;
  const params = await searchParams;
  const period = params.period ?? new Date().toISOString().slice(0, 7);

  const { data: summary } = await supabase.rpc("get_payroll_summary", {
    p_company_id: companyId,
    p_period: period,
  });

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
      .select("company_id")
      .eq("id", user.id)
      .single();

    const { data: employees } = await supabase
      .from("profiles")
      .select("id")
      .eq("company_id", profile?.company_id);

    for (const emp of employees ?? []) {
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
    <div style={{ maxWidth: 800, margin: "60px auto", fontFamily: "sans-serif" }}>
      <h1>Bordro Ön Hazırlık — Puantaj Özeti</h1>

      <form method="get" style={{ marginBottom: 16 }}>
        <label>Dönem: </label>
        <input type="month" name="period" defaultValue={period} style={{ padding: 6 }} />
        <button type="submit" style={{ padding: "6px 12px", marginLeft: 8 }}>Göster</button>
      </form>

      <form action={createApprovalRecords} style={{ marginBottom: 24 }}>
        <input type="hidden" name="period" value={period} />
        <button type="submit" style={{ padding: "8px 16px" }}>Bu Dönem İçin Onay Kayıtları Oluştur</button>
      </form>

      <a href={csvDataUri} download={`puantaj_${period}.csv`} style={{ display: "inline-block", marginBottom: 24 }}>
        📥 CSV Olarak İndir
      </a>

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
              <td style={cellStyle}>{s.worked_days}</td>
              <td style={cellStyle}>{s.leave_days}</td>
              <td style={cellStyle}>
                {approvalMap[s.user_id] === "approved" ? "✓ Onaylandı" : approvalMap[s.user_id] === "pending" ? "Beklemede" : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const cellStyle: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid #333",
  padding: "8px 6px",
};