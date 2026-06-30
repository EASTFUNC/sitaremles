import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, company_id")
    .eq("id", user.id)
    .single();

  const { data: companies } = await supabase
    .from("companies")
    .select("id, name");

  return (
    <div style={{ maxWidth: 600, margin: "60px auto", fontFamily: "sans-serif" }}>
      <h1>Hoş geldin, {profile?.full_name ?? user.email}</h1>
      <p>Şirket ID: {profile?.company_id}</p>
      <h2>Görebildiğin Şirketler (RLS testi)</h2>
      <ul>
        {companies?.map((c) => (
          <li key={c.id}>{c.name}</li>
        ))}
      </ul>
    </div>
  );
}