import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export default async function SuperAdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: isSuperAdmin } = await supabase.rpc("is_super_admin");

  if (!isSuperAdmin) {
    return (
      <div style={{ maxWidth: 600, margin: "60px auto", fontFamily: "sans-serif" }}>
        <h1>Erişim Reddedildi</h1>
        <p>Bu sayfayı görüntülemek için süper admin yetkisine sahip olmalısınız.</p>
      </div>
    );
  }

  const { data: companies, error } = await supabase.rpc("get_all_companies_overview");

  async function createCompany(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const name = formData.get("name") as string;
    const plan = formData.get("plan") as string;
    await supabase.rpc("create_new_company", { p_name: name, p_plan: plan });
    revalidatePath("/dashboard/super-admin");
  }

  async function changePlan(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const companyId = formData.get("company_id") as string;
    const plan = formData.get("plan") as string;
    await supabase.rpc("update_company_plan", { p_company_id: companyId, p_plan: plan });
    revalidatePath("/dashboard/super-admin");
  }

  return (
    <div style={{ maxWidth: 900, margin: "60px auto", fontFamily: "sans-serif" }}>
      <h1>🛡️ SITAREMLES Süper Admin Paneli</h1>

      <form action={createCompany} style={{ marginBottom: 32, padding: 16, border: "1px solid #333" }}>
        <h3>Yeni Şirket (Kiracı) Oluştur</h3>
        <label>Şirket Adı:</label>
        <input type="text" name="name" required style={{ display: "block", width: "100%", marginBottom: 8, padding: 6 }} />
        <label>Plan:</label>
        <select name="plan" style={{ display: "block", width: "100%", marginBottom: 12, padding: 6 }}>
          <option value="trial">Trial</option>
          <option value="starter">Starter</option>
          <option value="pro">Pro</option>
          <option value="enterprise">Enterprise</option>
        </select>
        <button type="submit" style={{ padding: "8px 16px" }}>Şirket Oluştur</button>
      </form>

      <h3>Tüm Kiracılar ({companies?.length ?? 0})</h3>
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
                <form action={changePlan} style={{ display: "flex", gap: 4 }}>
                  <input type="hidden" name="company_id" value={c.company_id} />
                  <select name="plan" defaultValue={c.plan} style={{ padding: 4 }}>
                    <option value="trial">Trial</option>
                    <option value="starter">Starter</option>
                    <option value="pro">Pro</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                  <button type="submit" style={{ padding: "4px 8px" }}>Kaydet</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {error && <p style={{ color: "orange" }}>Hata: {error.message}</p>}
    </div>
  );
}

const cellStyle: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid #333",
  padding: "8px 6px",
};