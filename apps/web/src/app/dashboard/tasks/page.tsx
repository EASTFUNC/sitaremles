import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export default async function TasksPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();

  const companyId = profile?.company_id;

  const { data: templates } = await supabase
    .from("checklist_templates")
    .select("id, title")
    .eq("company_id", companyId);

  const { data: employees } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("company_id", companyId);

  const { data: branches } = await supabase
    .from("branches")
    .select("id, name")
    .eq("company_id", companyId);

  const { data: assignments } = await supabase
    .from("task_assignments")
    .select("id, due_date, status, checklist_templates(title), profiles!task_assignments_assigned_to_fkey(full_name), branches(name)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  async function assignTask(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    await supabase.from("task_assignments").insert({
      company_id: profile?.company_id,
      checklist_template_id: formData.get("checklist_template_id") as string,
      branch_id: formData.get("branch_id") as string,
      assigned_to: formData.get("assigned_to") as string,
      due_date: formData.get("due_date") as string,
    });

    revalidatePath("/dashboard/tasks");
  }

  const statusLabels: Record<string, string> = {
    pending: "Beklemede",
    in_progress: "Devam Ediyor",
    completed: "Tamamlandı",
  };

  return (
    <div style={{ maxWidth: 800, margin: "60px auto", fontFamily: "sans-serif" }}>
      <h1>Görev / Denetim Atama</h1>

      <form action={assignTask} style={{ marginBottom: 32, padding: 16, border: "1px solid #333" }}>
        <h3>Yeni Görev Ata</h3>
        <label>Checklist:</label>
        <select name="checklist_template_id" required style={{ display: "block", width: "100%", marginBottom: 8, padding: 6 }}>
          {templates?.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
        </select>
        <label>Şube:</label>
        <select name="branch_id" required style={{ display: "block", width: "100%", marginBottom: 8, padding: 6 }}>
          {branches?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <label>Atanan Personel:</label>
        <select name="assigned_to" required style={{ display: "block", width: "100%", marginBottom: 8, padding: 6 }}>
          {employees?.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
        </select>
        <label>Son Tarih:</label>
        <input type="date" name="due_date" required style={{ display: "block", width: "100%", marginBottom: 12, padding: 6 }} />
        <button type="submit" style={{ padding: "8px 16px" }}>Görevi Ata</button>
      </form>

      <h3>Atanan Görevler</h3>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={cellStyle}>Checklist</th>
            <th style={cellStyle}>Personel</th>
            <th style={cellStyle}>Şube</th>
            <th style={cellStyle}>Son Tarih</th>
            <th style={cellStyle}>Durum</th>
          </tr>
        </thead>
        <tbody>
          {assignments?.map((a: any) => (
            <tr key={a.id}>
              <td style={cellStyle}>{a.checklist_templates?.title}</td>
              <td style={cellStyle}>{a.profiles?.full_name}</td>
              <td style={cellStyle}>{a.branches?.name}</td>
              <td style={cellStyle}>{a.due_date}</td>
              <td style={cellStyle}>{statusLabels[a.status]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const cellStyle: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid #333",
  padding: "8px 6px",
};