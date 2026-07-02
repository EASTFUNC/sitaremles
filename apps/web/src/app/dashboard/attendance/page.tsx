import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export default async function AttendancePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();

  const companyId = profile?.company_id;

  const { data: employees } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("company_id", companyId);

  const { data: branches } = await supabase
    .from("branches")
    .select("id, name")
    .eq("company_id", companyId);

  const { data: logs } = await supabase
    .from("attendance_logs")
    .select("id, event_type, event_time, distance_from_branch_m, is_within_geofence, is_suspicious, qr_payload, profiles!attendance_logs_user_id_fkey(full_name), branches(name)")
    .eq("company_id", companyId)
    .order("event_time", { ascending: false })
    .limit(100);

  async function addManualEntry(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const dateStr = formData.get("date") as string;
    const timeStr = formData.get("time") as string;
    const eventTime = new Date(`${dateStr}T${timeStr}:00`).toISOString();

    const { error } = await supabase.rpc("record_manual_attendance", {
      p_target_user_id: formData.get("user_id") as string,
      p_branch_id: formData.get("branch_id") as string,
      p_event_type: formData.get("event_type") as string,
      p_event_time: eventTime,
      p_note: (formData.get("note") as string) || null,
    });

    if (error) {
      console.error("Manuel giriş hatası:", error.message);
    }

    revalidatePath("/dashboard/attendance");
  }

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", fontFamily: "var(--font-body)" }}>
      <h1>Giriş-Çıkış Raporu</h1>

      <details style={{ marginBottom: 24, padding: 16, border: "1px solid var(--border)", borderRadius: 12, background: "var(--bg-elevated)" }}>
        <summary style={{ cursor: "pointer", fontWeight: 500 }}>➕ Manuel Giriş-Çıkış Ekle (QR okutulamadığında)</summary>
        <form action={addManualEntry} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
          <label style={labelStyle}>
            Personel
            <select name="user_id" required style={inputStyle}>
              {employees?.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
            </select>
          </label>
          <label style={labelStyle}>
            Şube
            <select name="branch_id" required style={inputStyle}>
              {branches?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <label style={labelStyle}>
            Tür
            <select name="event_type" required style={inputStyle}>
              <option value="check_in">Giriş</option>
              <option value="check_out">Çıkış</option>
            </select>
          </label>
          <label style={labelStyle}>
            Tarih
            <input type="date" name="date" required style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Saat
            <input type="time" name="time" required style={inputStyle} />
          </label>
          <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>
            Not (opsiyonel — örn. &quot;telefon şarjı bitti&quot;)
            <input type="text" name="note" style={inputStyle} />
          </label>
          <div style={{ gridColumn: "1 / -1" }}>
            <button type="submit" style={saveButtonStyle}>Kaydı Ekle</button>
          </div>
        </form>
      </details>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={cellStyle}>Tarih/Saat</th>
            <th style={cellStyle}>Personel</th>
            <th style={cellStyle}>Şube</th>
            <th style={cellStyle}>Tür</th>
            <th style={cellStyle}>Mesafe (m)</th>
            <th style={cellStyle}>Durum</th>
          </tr>
        </thead>
        <tbody>
          {logs?.map((log: any) => {
            const isManual = log.qr_payload?.includes('"manual_entry":true');
            return (
              <tr key={log.id}>
                <td style={cellStyle}>{new Date(log.event_time).toLocaleString("tr-TR")}</td>
                <td style={cellStyle}>{log.profiles?.full_name}</td>
                <td style={cellStyle}>{log.branches?.name}</td>
                <td style={cellStyle}>{log.event_type === "check_in" ? "Giriş" : "Çıkış"}</td>
                <td style={cellStyle}>{isManual ? "—" : Math.round(log.distance_from_branch_m ?? 0)}</td>
                <td style={{ ...cellStyle, color: isManual ? "var(--accent)" : log.is_within_geofence ? "var(--success)" : "orange" }}>
                  {isManual ? "✍️ Manuel Giriş" : log.is_within_geofence ? "Şube İçi ✓" : "Şube Dışı ⚠"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {(!logs || logs.length === 0) && <p>Henüz kayıt yok.</p>}
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