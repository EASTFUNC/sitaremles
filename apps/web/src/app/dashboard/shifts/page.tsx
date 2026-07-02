import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import ShiftMatrix from "@/components/ShiftMatrix";

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

      <ShiftMatrix />

      <form
        action={runShiftAgent}
        style={{ marginTop: 32, marginBottom: 24, padding: 16, border: "1px solid var(--accent)", borderRadius: 12, background: "var(--bg-elevated)" }}
      >
        <h3 style={{ marginTop: 0 }}>🤖 Akıllı Plan Oluştur (Shift Agent)</h3>
        <label>Şube:</label>
        <select name="branch_id" required style={{ display: "block", width: "100%", marginBottom: 8, padding: 6 }}>
          {branches?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <label>Haftanın Başlangıç Tarihi (Pazartesi):</label>
        <input type="date" name="week_start" required style={{ display: "block", width: "100%", marginBottom: 12, padding: 6 }} />
        <button type="submit" style={{ padding: "8px 16px" }}>Taslak Plan Oluştur</button>
      </form>

      {draftAssignments.length > 0 && (
        <>
          <h3>⏳ Onay Bekleyen AI Taslakları ({draftAssignments.length})</h3>
          {draftAssignments.map((a: any) => (
            <div key={a.id} style={{ padding: 10, border: "1px solid var(--accent)", borderRadius: 8, marginBottom: 8 }}>
              {a.work_date} — {a.profiles?.full_name} — {a.branches?.name} — {a.shift_templates?.name}
              <div style={{ marginTop: 6 }}>
                <form action={lockShift} style={{ display: "inline" }}>
                  <input type="hidden" name="assignment_id" value={a.id} />
                  <button type="submit" style={{ marginRight: 8, padding: "4px 12px" }}>Onayla</button>
                </form>
                <form action={rejectShift} style={{ display: "inline" }}>
                  <input type="hidden" name="assignment_id" value={a.id} />
                  <button type="submit" style={{ padding: "4px 12px" }}>Reddet</button>
                </form>
              </div>
            </div>
          ))}
        </>
      )}

      <h3 style={{ marginTop: 24 }}>Son Kayıtlar</h3>
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
              <td style={cellStyle}>{a.source === "ai_agent" ? "🤖 AI" : "Manuel"}</td>
              <td style={cellStyle}>{a.is_published ? "Yayınlandı" : "Taslak"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const cellStyle: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid var(--border)",
  padding: "8px 6px",
};