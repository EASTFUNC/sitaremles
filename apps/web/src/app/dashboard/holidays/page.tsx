import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import FormModal from "@/components/FormModal";
import { CalendarHeart, Check } from "lucide-react";

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
    <div style={{ maxWidth: 900, margin: "0 auto", fontFamily: "var(--font-body)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Resmi Tatiller ve Özel Günler</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: 0 }}>
            İzin bakiyesi hesaplamasına otomatik entegre edilir.
          </p>
        </div>

        {isAdmin && (
          <FormModal
            triggerLabel="Yeni Tatil"
            icon={<CalendarHeart size={14} strokeWidth={2} />}
            title="Yeni Tatil Ekle"
          >
            <form action={createHoliday} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 4 }}>
              <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>
                Tatil Adı
                <input name="name" required style={inputStyle} />
              </label>
              <label style={labelStyle}>
                Başlangıç Tarihi
                <input type="date" name="start_date" required style={inputStyle} />
              </label>
              <label style={labelStyle}>
                Bitiş Tarihi
                <input type="date" name="end_date" required style={inputStyle} />
              </label>
              <label style={{ ...labelStyle, gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                <input type="checkbox" name="counts_as_annual_leave" />
                Yıllık izinden düşülsün
              </label>
              <div style={{ gridColumn: "1 / -1", marginTop: 6 }}>
                <button type="submit" style={saveButtonStyle}>Tatil Ekle</button>
              </div>
            </form>
          </FormModal>
        )}
      </div>

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
              <td style={cellStyle}>
                <span style={badgeStyle(h.counts_as_annual_leave ? "#E0A030" : "var(--text-secondary)")}>
                  {h.counts_as_annual_leave ? "Evet" : "Hayır"}
                </span>
              </td>
              <td style={cellStyle}>
                {isAdmin ? (
                  <form action={toggleActive}>
                    <input type="hidden" name="id" value={h.id} />
                    <input type="hidden" name="is_active" value={String(h.is_active)} />
                    <button type="submit" style={toggleButtonStyle(h.is_active)}>
                      {h.is_active && <Check size={11} strokeWidth={2} />}
                      {h.is_active ? "Aktif" : "Pasif"}
                    </button>
                  </form>
                ) : h.is_active ? (
                  <Check size={14} color="var(--success)" strokeWidth={2} />
                ) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function badgeStyle(color: string): React.CSSProperties {
  return {
    fontSize: 11,
    padding: "3px 10px",
    borderRadius: 20,
    background: `color-mix(in srgb, ${color} 15%, transparent)`,
    color,
    fontFamily: "var(--font-mono)",
  };
}
function toggleButtonStyle(active: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontSize: 11.5,
    padding: "4px 10px",
    borderRadius: 20,
    border: `1px solid ${active ? "var(--success)" : "var(--border)"}`,
    background: active ? "color-mix(in srgb, var(--success) 12%, transparent)" : "transparent",
    color: active ? "var(--success)" : "var(--text-secondary)",
    cursor: "pointer",
  };
}
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
const cellStyle: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid var(--border)",
  padding: "10px 6px",
  fontSize: 13,
};