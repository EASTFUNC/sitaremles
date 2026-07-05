import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import FormModal from "@/components/FormModal";
import { Palette, Clock, X } from "lucide-react";

export default async function ShiftTemplatesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();

  const companyId = profile?.company_id;

  const { data: isAdmin } = await supabase.rpc("has_any_role", {
    p_company_id: companyId,
    p_role_codes: ["company_admin"],
  });

  if (!isAdmin) {
    return (
      <div style={{ maxWidth: 600, margin: "0 auto", fontFamily: "var(--font-body)" }}>
        <h1>Erişim Reddedildi</h1>
        <p style={{ color: "var(--text-secondary)" }}>Bu sayfa sadece şirket adminine açıktır.</p>
      </div>
    );
  }

  const { data: branches } = await supabase
    .from("branches")
    .select("id, name")
    .eq("company_id", companyId)
    .order("name");

  const { data: templates } = await supabase
    .from("shift_templates")
    .select("id, name, start_time, end_time, break_minutes, color, branch_id, branches(name)")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("start_time");

  async function createShiftTemplate(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    const branchIdValue = formData.get("branch_id") as string;

    await supabase.from("shift_templates").insert({
      company_id: profile?.company_id,
      branch_id: branchIdValue || null,
      name: formData.get("name") as string,
      start_time: formData.get("start_time") as string,
      end_time: formData.get("end_time") as string,
      break_minutes: Number(formData.get("break_minutes")),
      color: formData.get("color") as string,
    });

    revalidatePath("/dashboard/shift-templates");
  }

  async function deleteShiftTemplate(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const templateId = formData.get("template_id") as string;

    const { error } = await supabase.from("shift_templates").delete().eq("id", templateId);
    if (error) {
      // Gecmiste kullanilmis (FK kisiti var) - tamamen silmek yerine pasife al
      await supabase.from("shift_templates").update({ is_active: false }).eq("id", templateId);
    }

    revalidatePath("/dashboard/shift-templates");
  }

  const grouped: Record<string, { label: string; items: any[] }> = {};
  grouped["all"] = { label: "Tüm Şubeler İçin Ortak", items: [] };
  branches?.forEach((b) => {
    grouped[b.id] = { label: b.name, items: [] };
  });
  templates?.forEach((t: any) => {
    const key = t.branch_id ?? "all";
    if (grouped[key]) grouped[key].items.push(t);
  });

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", fontFamily: "var(--font-body)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Vardiya Türleri</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: 0 }}>
            Her şube kendi vardiya saatlerini kullanabilir. Ortak bir tür (örn. OFF) tüm şubelerde geçerli olur.
          </p>
        </div>
        <FormModal triggerLabel="Yeni Vardiya Türü" icon={<Clock size={14} strokeWidth={2} />} title="Yeni Vardiya Türü Ekle">
          <form action={createShiftTemplate} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 4 }}>
            <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>
              Vardiya Adı
              <input name="name" required placeholder="Örn. AVM Sabah" style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Başlangıç Saati
              <input name="start_time" type="time" required style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Bitiş Saati
              <input name="end_time" type="time" required style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Mola Süresi (dk)
              <input name="break_minutes" type="number" defaultValue={60} required style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Renk
              <input name="color" type="color" defaultValue="#4A90E2" style={{ ...inputStyle, height: 38, padding: 4 }} />
            </label>
            <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>
              Şube
              <select name="branch_id" style={inputStyle}>
                <option value="">Tüm Şubeler İçin Ortak (örn. OFF)</option>
                {branches?.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </label>
            <div style={{ gridColumn: "1 / -1", marginTop: 6 }}>
              <button type="submit" style={saveButtonStyle}>Vardiya Türü Ekle</button>
            </div>
          </form>
        </FormModal>
      </div>

      {Object.entries(grouped).map(([key, group]) => (
        <div key={key} style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 13, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <Palette size={13} strokeWidth={1.75} />
            {group.label}
          </h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {group.items.map((t: any) => (
              <div key={t.id} style={{ ...chipStyle, borderColor: t.color }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: t.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12.5 }}>{t.name}</span>
                <span style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                  {t.start_time?.slice(0, 5)}-{t.end_time?.slice(0, 5)}
                </span>
                <form action={deleteShiftTemplate}>
                  <input type="hidden" name="template_id" value={t.id} />
                  <button type="submit" style={deleteIconStyle}>
                    <X size={11} strokeWidth={2} />
                  </button>
                </form>
              </div>
            ))}
            {group.items.length === 0 && (
              <p style={{ color: "var(--text-secondary)", fontSize: 12.5 }}>Henüz vardiya türü yok.</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
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
const chipStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 14px",
  borderRadius: 20,
  border: "1.5px solid",
  background: "var(--bg-elevated)",
};
const deleteIconStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--text-secondary)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  padding: 0,
  marginLeft: 2,
};