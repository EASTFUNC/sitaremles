import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

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

  const { data: employees } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("company_id", companyId);

  const { data: branches } = await supabase
    .from("branches")
    .select("id, name")
    .eq("company_id", companyId);

  const { data: templates } = await supabase
    .from("shift_templates")
    .select("id, name, start_time, end_time")
    .eq("company_id", companyId);

  const { data: assignments } = await supabase
    .from("shift_assignments")
    .select("id, work_date, profiles(full_name), branches(name), shift_templates(name)")
    .eq("company_id", companyId)
    .order("work_date", { ascending: true });

  async function createAssignment(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    await supabase.from("shift_assignments").insert({
      company_id: profile?.company_id,
      user_id: formData.get("user_id") as string,
      branch_id: formData.get("branch_id") as string,
      shift_template_id: formData.get("shift_template_id") as string,
      work_date: formData.get("work_date") as string,
      source: "manual",
    });

    revalidatePath("/dashboard/shifts");
  }

  return (
    <div style={{ maxWidth: 700, margin: "60px auto", fontFamily: "sans-serif" }}>
      <h1>Vardiya Planlama</h1>

      <form action={createAssignment} style={{ marginBottom: 32, padding: 16, border: "1px solid #333" }}>
        <h3>Yeni Vardiya Ata</h3>

        <label>Personel:</label>
        <select name="user_id" required style={{ display: "block", width: "100%", marginBottom: 8, padding: 6 }}>
          {employees?.map((e) => (
            <option key={e.id} value={e.id}>{e.full_name}</option>
          ))}
        </select>

        <label>Şube:</label>
        <select name="branch_id" required style={{ display: "block", width: "100%", marginBottom: 8, padding: 6 }}>
          {branches?.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>

        <label>Vardiya Şablonu:</label>
        <select name="shift_template_id" required style={{ display: "block", width: "100%", marginBottom: 8, padding: 6 }}>
          {templates?.map((t) => (
            <option key={t.id} value={t.id}>{t.name} ({t.start_time}-{t.end_time})</option>
          ))}
        </select>

        <label>Tarih:</label>
        <input type="date" name="work_date" required style={{ display: "block", width: "100%", marginBottom: 12, padding: 6 }} />

        <button type="submit" style={{ padding: "8px 16px" }}>Vardiya Ata</button>
      </form>

      <h3>Atanan Vardiyalar</h3>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", borderBottom: "1px solid #333" }}>Tarih</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #333" }}>Personel</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #333" }}>Şube</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #333" }}>Şablon</th>
          </tr>
        </thead>
        <tbody>
          {assignments?.map((a: any) => (
            <tr key={a.id}>
              <td>{a.work_date}</td>
              <td>{a.profiles?.full_name}</td>
              <td>{a.branches?.name}</td>
              <td>{a.shift_templates?.name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}