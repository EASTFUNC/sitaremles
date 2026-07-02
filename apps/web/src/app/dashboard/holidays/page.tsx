import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export default async function HolidaysPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();

  const { data: isAdmin } = await supabase.rpc("has_any_role", {
    p_company_id: profile?.company_id,
    p_role_codes: ["company_admin"],
  });

  const { data: holidays } = await supabase
    .from("holidays")
    .select("id, name, start_date, end_date, counts_as_annual_leave, is_active")
    .eq("company_id", profile?.company_id)
    .order("start_date");

  async function createHoliday(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    await supabase.from("holidays").insert({
      company_id: profile?.company_id,
      name: formData.get("name") as string,
      start_date: formData.get("start_date") as string,
      end_date: formData.get("end_date") as string,
      counts_as_annual_leave: formData.get("counts_as_annual_leave") === "on",
    });

    revalidatePath("/dashboard/holidays");
  }

  async function toggleActive(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");
    const id = formData.get("id") as string;
    const currentlyActive = formData.get("is_active") === "true";
    await supabase.from("holidays").update({ is_active: !currentlyActive }).eq("id", id);
    revalidatePath("/dashboard/holidays");
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", fontFamily: "var(--font-body)" }}>
      <h1>Resmi Tatiller ve Özel Günler</h1>

      {isAdmin && (
        <form
          action={createHoliday}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            padding: 20,
            border: "1px solid var(--border)",
            borderRadius: 12,
            background: "var(--bg-elevated)",
            marginBottom: 24,
          }}
        >
          <h3 style={{ gridColumn: "1 / -1", marginTop: 0 }}>Yeni Tatil Ekle</h3>
          <label style={labelStyle}>
            Tatil Adı
            <input name="name" required style={inputStyle} />
          </label>
          <label style={labelStyle}>
            <span style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 20 }}>
              <input type="checkbox" name="counts_as_annual_leave" />
              Yıllık izinden düşülsün
            </span>
          </label>
          <label style={labelStyle}>
            Başlangıç Tarihi
            <input type="date" name="start_date" required style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Bitiş Tarihi
            <input type="date" name="end_date" required style={inputStyle} />
          </label>
          <div style={{ gridColumn: "1 / -1" }}>
            <button type="submit" style={saveButtonStyle}>Tatil Ekle</button>
          </div>
        </form>
      )}

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={cellStyle}>Adı</th>
            <th style={cellStyle}>Başlangıç</th>
            <th style={cellStyle}>Bitiş</th>
            <th style={cellStyle}>İzinden Düşer mi</th>
            <th style={cellStyle}>Aktif</th>
          </tr>
        </thead>
        <tbody>
          {holidays?.map((h) => (
            <tr key={h.id}>
              <td style={cellStyle}>{h.name}</td>
              <td style={cellStyle}>{h.start_date}</td>
              <td style={cellStyle}>{h.end_date}</td>
              <td style={cellStyle}>{h.counts_as_annual_leave ? "Evet" : "Hayır"}</td>
              <td style={cellStyle}>
                {isAdmin ? (
                  <form action={toggleActive}>
                    <input type="hidden" name="id" value={h.id} />
                    <input type="hidden" name="is_active" value={String(h.is_active)} />
                    <button type="submit" style={{ fontSize: 12, padding: "3px 10px", cursor: "pointer" }}>
                      {h.is_active ? "✓ Aktif" : "Pasif"}
                    </button>
                  </form>
                ) : h.is_active ? "✓" : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const labelStyle: React.CSSProperties = { fontSize: 13, color: "var(--text-secondary)" };
const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: 8,
  marginTop: 4,
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "var(--bg)",
  color: "var(--text)",
};
const saveButtonStyle: React.CSSProperties = {
  padding: "10px 24px",
  background: "var(--accent)",
  color: "var(--accent-contrast)",
  border: "none",
  borderRadius: 8,
  fontWeight: 500,
  cursor: "pointer",
};
const cellStyle: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid var(--border)",
  padding: "8px 6px",
};