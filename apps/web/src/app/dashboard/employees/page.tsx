import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import Link from "next/link";
import { Users, ArrowRight } from "lucide-react";

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

  const statusStyle: Record<string, string> = {
    application: "var(--accent)",
    onboarding: "#E0A030",
    active: "var(--success)",
    on_leave: "var(--accent)",
    terminated: "var(--text-secondary)",
    blacklisted: "#D64545",
  };
  const statusLabels: Record<string, string> = {
    application: "Başvuru",
    onboarding: "İşe Alım Süreci",
    active: "Çalışıyor",
    on_leave: "İzinli",
    terminated: "Ayrıldı",
    blacklisted: "Kara Liste",
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", fontFamily: "var(--font-body)" }}>
      <h1 style={{ marginBottom: 4 }}>Personel Listesi</h1>
      <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 0, marginBottom: 24 }}>
        {employees?.length ?? 0} personel · Detaylar ve özlük dosyası için bir satıra tıklayın.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {employees?.map((e: any) => (
          <Link
            key={e.id}
            href={`/dashboard/employees/${e.id}`}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <div style={rowCardStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={avatarStyle}>
                  <Users size={15} color="var(--accent)" strokeWidth={1.75} />
                </div>
                <div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 14 }}>{e.full_name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                    {e.branches?.name ?? "—"}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span
                  style={{
                    fontSize: 11,
                    padding: "3px 10px",
                    borderRadius: 20,
                    fontFamily: "var(--font-mono)",
                    background: `color-mix(in srgb, ${statusStyle[e.status] ?? "var(--text-secondary)"} 15%, transparent)`,
                    color: statusStyle[e.status] ?? "var(--text-secondary)",
                  }}
                >
                  {statusLabels[e.status] ?? e.status}
                </span>
                <ArrowRight size={14} color="var(--text-secondary)" strokeWidth={1.75} />
              </div>
            </div>
          </Link>
        ))}
        {(!employees || employees.length === 0) && <p style={{ color: "var(--text-secondary)" }}>Henüz personel yok.</p>}
      </div>
    </div>
  );
}

const rowCardStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "12px 16px",
  border: "1px solid var(--border)",
  borderRadius: 12,
  background: "var(--bg-elevated)",
};
const avatarStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 10,
  background: "color-mix(in srgb, var(--accent) 15%, transparent)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};