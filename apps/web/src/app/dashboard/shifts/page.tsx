import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import ShiftMatrix from "@/components/ShiftMatrix";
import { Sparkles, Hourglass, Check, X } from "lucide-react";
import FormModal from "@/components/FormModal";

export default async function ShiftsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();

  const companyId = profile?.company_id;

  const { data: branches } = await supabase
    .from("branches")
    .select("id, name")
    .eq("company_id", companyId);

  const { data: assignments } = await supabase
    .from("shift_assignments")
    .select("id, work_date, source, is_locked, is_published, profiles(full_name), branches(name), shift_templates(name)")
    .eq("company_id", companyId)
    .order("work_date", { ascending: false })
    .limit(50);

  async function runShiftAgent(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token;

    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/shift-agent`, {
      method: "POST",
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        company_id: profile?.company_id,
        branch_id: formData.get("branch_id") as string,
        week_start: formData.get("week_start") as string,
      }),
    });

    revalidatePath("/dashboard/shifts");
  }

  async function lockShift(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");
    const id = formData.get("assignment_id") as string;
    await supabase.from("shift_assignments").update({ is_locked: true, is_published: true }).eq("id", id);
    revalidatePath("/dashboard/shifts");
  }

  async function rejectShift(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");
    const id = formData.get("assignment_id") as string;
    await supabase.from("shift_assignments").delete().eq("id", id);
    revalidatePath("/dashboard/shifts");
  }

  const draftAssignments = assignments?.filter((a: any) => a.source === "ai_agent" && !a.is_locked) ?? [];
  const otherAssignments = assignments?.filter((a: any) => !(a.source === "ai_agent" && !a.is_locked)) ?? [];

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", fontFamily: "var(--font-body)" }}>
      <h1>Vardiya Planlama</h1>
      <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: -8, marginBottom: 24 }}>
        Hücrelere tıklayarak manuel vardiya atayın veya AI ajanını kullanarak taslak plan oluşturun.
      </p>

      <ShiftMatrix />

      <div style={{ marginTop: 28 }}>
        <FormModal triggerLabel="Akıllı Plan Oluştur" icon={<Sparkles size={14} strokeWidth={2} />} title="Akıllı Plan Oluştur">
          <form action={runShiftAgent} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 4 }}>
            <label style={labelStyle}>
              Şube
              <select name="branch_id" required style={inputStyle}>
                {branches?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
            <label style={labelStyle}>
              Haftanın Başlangıcı (Pazartesi)
              <input type="date" name="week_start" required style={inputStyle} />
            </label>
            <div style={{ gridColumn: "1 / -1" }}>
              <button type="submit" style={saveButtonStyle}>Taslak Plan Oluştur</button>
            </div>
          </form>
        </FormModal>
      </div>

      {draftAssignments.length > 0 && (
        <>
          <h3 style={{ marginTop: 32, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
            <Hourglass size={16} strokeWidth={1.75} color="var(--accent)" />
            Onay Bekleyen AI Taslakları ({draftAssignments.length})
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {draftAssignments.map((a: any) => (
              <div key={a.id} style={draftCardStyle}>
                <span style={{ fontSize: 13 }}>
                  {a.work_date} — {a.profiles?.full_name} — {a.branches?.name} — {a.shift_templates?.name}
                </span>
                <div style={{ display: "flex", gap: 6 }}>
                  <form action={lockShift}>
                    <input type="hidden" name="assignment_id" value={a.id} />
                    <button type="submit" style={iconActionStyle("success")}><Check size={14} strokeWidth={2} /></button>
                  </form>
                  <form action={rejectShift}>
                    <input type="hidden" name="assignment_id" value={a.id} />
                    <button type="submit" style={iconActionStyle("danger")}><X size={14} strokeWidth={2} /></button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <h3 style={{ marginTop: 32, fontSize: 15 }}>Son Kayıtlar</h3>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={cellStyle}>Tarih</th>
            <th style={cellStyle}>Personel</th>
            <th style={cellStyle}>Şube</th>
            <th style={cellStyle}>Şablon</th>
            <th style={cellStyle}>Kaynak</th>
            <th style={cellStyle}>Durum</th>
          </tr>
        </thead>
        <tbody>
          {otherAssignments.map((a: any) => (
            <tr key={a.id}>
              <td style={cellStyle}>{a.work_date}</td>
              <td style={cellStyle}>{a.profiles?.full_name}</td>
              <td style={cellStyle}>{a.branches?.name}</td>
              <td style={cellStyle}>{a.shift_templates?.name}</td>
              <td style={cellStyle}>{a.source === "ai_agent" ? "AI" : "Manuel"}</td>
              <td style={cellStyle}>
                <span
                  style={{
                    fontSize: 11,
                    padding: "3px 10px",
                    borderRadius: 20,
                    fontFamily: "var(--font-mono)",
                    background: a.is_published ? "color-mix(in srgb, var(--success) 15%, transparent)" : "color-mix(in srgb, var(--accent) 12%, transparent)",
                    color: a.is_published ? "var(--success)" : "var(--accent)",
                  }}
                >
                  {a.is_published ? "Yayınlandı" : "Taslak"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const aiFormStyle: React.CSSProperties = {
  marginTop: 28,
  padding: 18,
  border: "1px solid var(--border)",
  borderRadius: 14,
  background: "var(--bg-elevated)",
};
const aiSummaryStyle: React.CSSProperties = { cursor: "pointer", fontWeight: 500, fontSize: 13.5 };
const labelStyle: React.CSSProperties = { fontSize: 12.5, color: "var(--text-secondary)" };
const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: 9,
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
const draftCardStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "10px 14px",
  border: "1px solid var(--accent)",
  borderRadius: 10,
  background: "var(--bg-elevated)",
};
function iconActionStyle(variant: "success" | "danger"): React.CSSProperties {
  const color = variant === "success" ? "var(--success)" : "#D64545";
  return {
    width: 28,
    height: 28,
    borderRadius: 7,
    border: `1px solid ${color}`,
    background: "transparent",
    color,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
}
const cellStyle: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid var(--border)",
  padding: "8px 6px",
};