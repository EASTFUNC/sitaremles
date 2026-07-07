import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import FormModal from "@/components/FormModal";
import { ClipboardCheck, Search } from "lucide-react";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id, branch_id")
    .eq("id", user.id)
    .single();

  const companyId = profile?.company_id;

  const { data: rolesData } = await supabase
    .from("user_roles")
    .select("roles(code)")
    .eq("user_id", user.id)
    .eq("company_id", companyId);
  const roleCodes = (rolesData ?? []).map((r: any) => r.roles?.code);
  const isCompanyWideView = roleCodes.includes("company_admin") || roleCodes.includes("regional_manager");
  const isBranchManager = roleCodes.includes("store_manager") && !isCompanyWideView;
  const ownBranchId = profile?.branch_id;

  const { data: templates } = await supabase
    .from("checklist_templates")
    .select("id, title")
    .eq("company_id", companyId);

  const { data: storeDisplayRows } = await supabase.rpc("get_store_display_user_ids", { p_company_id: companyId });
  const storeDisplayIds = new Set((storeDisplayRows ?? []).map((r: any) => r.user_id));

  const { data: allEmployees } = await supabase
    .from("profiles")
    .select("id, full_name, branch_id")
    .eq("company_id", companyId);
  let employees = (allEmployees ?? []).filter((e) => !storeDisplayIds.has(e.id));
  if (isBranchManager) {
    employees = employees.filter((e) => e.branch_id === ownBranchId);
  }

  const { data: allBranches } = await supabase
    .from("branches")
    .select("id, name")
    .eq("company_id", companyId);
  const branches = isBranchManager
    ? (allBranches ?? []).filter((b) => b.id === ownBranchId)
    : (allBranches ?? []);

  let assignmentsQuery = supabase
    .from("task_assignments")
    .select("id, due_date, status, checklist_templates(title), profiles!task_assignments_assigned_to_fkey(full_name), branches(name)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (isBranchManager && ownBranchId) {
    assignmentsQuery = assignmentsQuery.eq("branch_id", ownBranchId);
  }

  const { data: rawAssignments } = await assignmentsQuery;
  const { q } = await searchParams;
  const assignments = q && q.trim()
    ? (rawAssignments ?? []).filter((a: any) =>
        a.profiles?.full_name?.toLocaleLowerCase("tr").includes(q.trim().toLocaleLowerCase("tr"))
      )
    : rawAssignments;

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

  const statusStyle: Record<string, string> = {
    pending: "var(--accent)",
    in_progress: "#E0A030",
    completed: "var(--success)",
  };
  const statusLabels: Record<string, string> = {
    pending: "Beklemede",
    in_progress: "Devam Ediyor",
    completed: "Tamamlandı",
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", fontFamily: "var(--font-body)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Görev / Denetim</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: 0 }}>
            {isCompanyWideView ? "Tüm şirketin" : "Şubenizin"} checklist tabanlı denetimleri ve görev takibi.
          </p>
        </div>

        <FormModal triggerLabel="Görev Ata" icon={<ClipboardCheck size={14} strokeWidth={2} />} title="Yeni Görev Ata">
          <form action={assignTask} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 4 }}>
            <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>
              Checklist
              <select name="checklist_template_id" required style={inputStyle}>
                {templates?.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </label>
            {isBranchManager && ownBranchId ? (
              <input type="hidden" name="branch_id" value={ownBranchId} />
            ) : (
              <label style={labelStyle}>
                Şube
                <select name="branch_id" required style={inputStyle}>
                  {branches?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </label>
            )}
            <label style={labelStyle}>
              Atanan Personel
              <select name="assigned_to" required style={inputStyle}>
                {employees?.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
              </select>
            </label>
            <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>
              Son Tarih
              <input type="date" name="due_date" required style={inputStyle} />
            </label>
            <div style={{ gridColumn: "1 / -1", marginTop: 6 }}>
              <button type="submit" style={saveButtonStyle}>Görevi Ata</button>
            </div>
          </form>
        </FormModal>
      </div>

      <form method="get" style={{ marginBottom: 16, position: "relative", maxWidth: 320 }}>
        <Search size={14} color="var(--text-secondary)" style={{ position: "absolute", left: 10, top: 10 }} />
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Atanan personel ara..."
          style={{ ...searchInputStyle, paddingLeft: 32 }}
        />
      </form>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {assignments?.map((a: any) => (
          <div key={a.id} style={rowCardStyle}>
            <div>
              <strong style={{ fontSize: 13.5 }}>{a.checklist_templates?.title}</strong>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                {a.profiles?.full_name} · {a.branches?.name} · Son tarih: {a.due_date}
              </div>
            </div>
            <span
              style={{
                fontSize: 11,
                padding: "3px 10px",
                borderRadius: 20,
                fontFamily: "var(--font-mono)",
                background: `color-mix(in srgb, ${statusStyle[a.status]} 15%, transparent)`,
                color: statusStyle[a.status],
              }}
            >
              {statusLabels[a.status]}
            </span>
          </div>
        ))}
        {(!assignments || assignments.length === 0) && <p style={{ color: "var(--text-secondary)" }}>Henüz görev atanmadı.</p>}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = { fontSize: 12.5, color: "var(--text-secondary)" };
const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: 8,
  marginTop: 4,
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg)",
  color: "var(--text)",
  fontSize: 13,
};
const saveButtonStyle: React.CSSProperties = {
  padding: "9px 22px",
  background: "var(--accent)",
  color: "var(--accent-contrast)",
  border: "none",
  borderRadius: 8,
  fontWeight: 500,
  fontSize: 13,
  cursor: "pointer",
};
const rowCardStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "12px 16px",
  border: "1px solid var(--border)",
  borderRadius: 12,
  background: "var(--bg-elevated)",
};
const searchInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg-elevated)",
  color: "var(--text)",
  fontSize: 13,
};