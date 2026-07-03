import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import { MapPin, PenLine } from "lucide-react";
import ManualAttendanceModal from "@/components/ManualAttendanceModal";

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

    await supabase.rpc("record_manual_attendance", {
      p_target_user_id: formData.get("user_id") as string,
      p_branch_id: formData.get("branch_id") as string,
      p_event_type: formData.get("event_type") as string,
      p_event_time: eventTime,
      p_note: (formData.get("note") as string) || null,
    });

    revalidatePath("/dashboard/attendance");
  }

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", fontFamily: "var(--font-body)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Giriş-Çıkış Raporu</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: 0 }}>
            QR ve GPS ile doğrulanmış giriş-çıkış kayıtları.
          </p>
        </div>
        <ManualAttendanceModal employees={employees ?? []} branches={branches ?? []} action={addManualEntry} />
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={cellStyle}>Tarih/Saat</th>
            <th style={cellStyle}>Personel</th>
            <th style={cellStyle}>Şube</th>
            <th style={cellStyle}>Tür</th>
            <th style={cellStyle}>Mesafe</th>
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
                <td style={{ ...cellStyle, fontFamily: "var(--font-mono)" }}>
                  {isManual ? "—" : `${Math.round(log.distance_from_branch_m ?? 0)}m`}
                </td>
                <td style={cellStyle}>
                  {isManual ? (
                    <span style={badgeStyle("var(--accent)")}>
                      <PenLine size={11} strokeWidth={2} /> Manuel
                    </span>
                  ) : log.is_within_geofence ? (
                    <span style={badgeStyle("var(--success)")}>
                      <MapPin size={11} strokeWidth={2} /> Şube İçi
                    </span>
                  ) : (
                    <span style={badgeStyle("#E0A030")}>
                      <MapPin size={11} strokeWidth={2} /> Şube Dışı
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {(!logs || logs.length === 0) && <p style={{ color: "var(--text-secondary)" }}>Henüz kayıt yok.</p>}
    </div>
  );
}

function badgeStyle(color: string): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    fontSize: 11.5,
    padding: "3px 10px",
    borderRadius: 20,
    background: `color-mix(in srgb, ${color} 15%, transparent)`,
    color,
    fontFamily: "var(--font-mono)",
  };
}

const cellStyle: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid var(--border)",
  padding: "10px 6px",
  fontSize: 13,
};