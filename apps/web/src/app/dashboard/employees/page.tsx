import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import Link from "next/link";

export default async function EmployeesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();

  const { data: employees } = await supabase
    .from("profiles")
    .select("id, full_name, status, branches(name)")
    .eq("company_id", profile?.company_id)
    .order("full_name");

  const statusLabels: Record<string, string> = {
    active: "Çalışıyor",
    on_leave: "İzinli",
    terminated: "Ayrıldı",
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", fontFamily: "var(--font-body)" }}>
      <h1>Personel Listesi</h1>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={cellStyle}>Ad Soyad</th>
            <th style={cellStyle}>Şube</th>
            <th style={cellStyle}>Durum</th>
            <th style={cellStyle}></th>
          </tr>
        </thead>
        <tbody>
          {employees?.map((e: any) => (
            <tr key={e.id}>
              <td style={cellStyle}>{e.full_name}</td>
              <td style={cellStyle}>{e.branches?.name ?? "—"}</td>
              <td style={cellStyle}>{statusLabels[e.status] ?? e.status}</td>
              <td style={cellStyle}>
                <Link href={`/dashboard/employees/${e.id}`} style={{ color: "var(--accent)" }}>
                  Özlük Dosyasını Aç →
                </Link>
              </td>
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