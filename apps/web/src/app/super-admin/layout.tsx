import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: isSuperAdmin } = await supabase.rpc("is_super_admin");
  if (!isSuperAdmin) redirect("/dashboard");

  return <div style={{ minHeight: "100vh", background: "var(--bg)" }}>{children}</div>;
}
