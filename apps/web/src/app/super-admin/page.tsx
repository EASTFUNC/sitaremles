import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { ShieldCheck, ArrowLeft } from "lucide-react";

export default async function SuperAdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: companies, error } = await supabase.rpc("get_all_companies_overview");

  async function createCompany(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const name = formData.get("name") as string;
    const plan = formData.get("plan") as string;
    await supabase.rpc("create_new_company", { p_name: name, p_plan: plan });
    revalidatePath("/super-admin");
  }

  async function changePlan(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const companyId = formData.get("company_id") as string;
    const plan = formData.get("plan") as string;
    await supabase.rpc("update_company_plan", { p_company_id: companyId, p_plan: plan });
    revalidatePath("/super-admin");
  }

  return (
    <div style={{ fontFamily: "var(--font-body)" }}>
      <div style={topBarStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ShieldCheck size={18} color="var(--accent)" strokeWidth={1.75} />
          <strong style={{ fontFamily: "var(--font-display)", fontSize: 15 }}>EASTFUNC Kontrol Merkezi</strong>
        </div>
        <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-secondary)", fontSize: 12.5, textDecoration: "none" }}>
          <ArrowLeft size={13} strokeWidth={1.75} />
          Şirket Paneline Dön
        </Link>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
        <h1>Kiracı Yönetimi</h1>

        <div style={sectionCardStyle}>
          <h3 style={{ marginTop: 0, fontSize: 14 }}>Yeni Şirket (Kiracı) Oluştur</h3>
          <form action={createCompany} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>
              Şirket Adı
              <input type="text" name="name" required style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Plan
              <select name="plan" style={inputStyle}>
                <option value="trial">Trial</option>
                <option value="starter">Starter</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </label>
            <div style={{ gridColumn: "1 / -1" }}>
              <button type="submit" style={saveButtonStyle}>Şirket Oluştur</button>
            </div>
          </form>
        </div>

        <h3 style={{ marginTop: 28, fontSize: 14 }}>Tüm Kiracılar ({companies?.length ?? 0})</h3>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={cellStyle}>Şirket</th>
              <th style={cellStyle}>Plan</th>
              <th style={cellStyle}>Personel Sayısı</th>
              <th style={cellStyle}>Aktif mi</th>
              <th style={cellStyle}>Oluşturulma</th>
              <th style={cellStyle}>Plan Değiştir</th>
            </tr>
          </thead>
          <tbody>
            {companies?.map((c: any) => (
              <tr key={c.company_id}>
                <td style={cellStyle}>{c.name}</td>
                <td style={cellStyle}>{c.plan}</td>
                <td style={cellStyle}>{c.employee_count}</td>
                <td style={cellStyle}>{c.is_active ? "✓" : "✗"}</td>
                <td style={cellStyle}>{new Date(c.created_at).toLocaleDateString("tr-TR")}</td>
                <td style={cellStyle}>
                  <form action={changePlan} style={{ display: "flex", gap: 6 }}>
                    <input type="hidden" name="company_id" value={c.company_id} />
                    <select name="plan" defaultValue={c.plan} style={{ ...inputStyle, padding: 6, width: "auto" }}>
                      <option value="trial">Trial</option>
                      <option value="starter">Starter</option>
                      <option value="pro">Pro</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                    <button type="submit" style={smallButtonStyle}>Kaydet</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {error && <p style={{ color: "#E0A030" }}>Hata: {error.message}</p>}
      </div>
    </div>
  );
}

const topBarStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "16px 24px",
  borderBottom: "1px solid var(--border)",
  background: "var(--bg-elevated)",
};
const sectionCardStyle: React.CSSProperties = {
  padding: 20,
  border: "1px solid var(--border)",
  borderRadius: 14,
  background: "var(--bg-elevated)",
  marginTop: 20,
};
const labelStyle: React.CSSProperties = { fontSize: 12.5, color: "var(--text-secondary)" };
const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: 8,
  marginTop: 4,
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg)",
  color: "var(--text)",
  fontSize: 13,
};
const saveButtonStyle: React.CSSProperties = {
  padding: "9px 22px",
  background: "var(--accent)",
  color: "var(--accent-contrast)",
  border: "none",
  borderRadius: 8,
  fontWeight: 500,
  fontSize: 13,
  cursor: "pointer",
};
const smallButtonStyle: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "var(--bg-elevated)",
  color: "var(--text)",
  fontSize: 12,
  cursor: "pointer",
};
const cellStyle: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid var(--border)",
  padding: "8px 6px",
  fontSize: 13,
};