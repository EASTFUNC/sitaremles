import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, company_id")
    .eq("id", user.id)
    .single();

  const { data: rolesData } = await supabase
    .from("user_roles")
    .select("roles(code)")
    .eq("user_id", user.id)
    .eq("company_id", profile?.company_id);

  const roleCodes = rolesData?.map((r: any) => r.roles?.code).filter(Boolean) ?? [];

  const { data: isSuperAdmin } = await supabase.rpc("is_super_admin");

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar roles={roleCodes} isSuperAdmin={!!isSuperAdmin} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <TopBar userName={profile?.full_name ?? user.email ?? ""} />
        <main style={{ flex: 1, padding: 24 }}>{children}</main>
      </div>
    </div>
  );
}