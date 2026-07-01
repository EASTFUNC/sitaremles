import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

export default async function AttendancePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();

  const { data: logs } = await supabase
    .from("attendance_logs")
    .select("id, event_type, event_time, distance_from_branch_m, is_within_geofence, is_suspicious, profiles(full_name), branches(name)")
    .eq("company_id", profile?.company_id)
    .order("event_time", { ascending: false });

  return (
    <div style={{ maxWidth: 900, margin: "60px auto", fontFamily: "sans-serif" }}>
      <h1>Giriş-Çıkış Raporu</h1>
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
          {logs?.map((log: any) => (
            <tr key={log.id}>
              <td style={cellStyle}>{new Date(log.event_time).toLocaleString("tr-TR")}</td>
              <td style={cellStyle}>{log.profiles?.full_name}</td>
              <td style={cellStyle}>{log.branches?.name}</td>
              <td style={cellStyle}>{log.event_type === "check_in" ? "Giriş" : "Çıkış"}</td>
              <td style={cellStyle}>{Math.round(log.distance_from_branch_m ?? 0)}</td>
              <td style={{ ...cellStyle, color: log.is_within_geofence ? "lightgreen" : "orange" }}>
                {log.is_within_geofence ? "Şube İçi ✓" : "Şube Dışı ⚠"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {(!logs || logs.length === 0) && <p>Henüz kayıt yok.</p>}
    </div>
  );
}

const cellStyle: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid #333",
  padding: "8px 6px",
};