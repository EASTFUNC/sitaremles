import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import FormModal from "@/components/FormModal";
import { Target, Search } from "lucide-react";

export default async function PerformancePage({
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
  const employeeIds = new Set(employees.map((e) => e.id));

  const { data: rawScores } = await supabase
    .from("performance_scores")
    .select("id, period, score, bonus_amount, notes, user_id, profiles!performance_scores_user_id_fkey(full_name)")
    .eq("company_id", companyId)
    .order("period", { ascending: false });

  let scores = isBranchManager
    ? (rawScores ?? []).filter((s: any) => employeeIds.has(s.user_id))
    : (rawScores ?? []);

  const { q } = await searchParams;
  if (q && q.trim()) {
    const query = q.trim().toLocaleLowerCase("tr");
    scores = scores.filter((s: any) => s.profiles?.full_name?.toLocaleLowerCase("tr").includes(query));
  }

  async function addScore(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    await supabase.from("performance_scores").insert({
      company_id: profile?.company_id,
      user_id: formData.get("user_id") as string,
      period: formData.get("period") as string,
      score: Number(formData.get("score")),
      bonus_amount: Number(formData.get("bonus_amount")),
      notes: formData.get("notes") as string,
      created_by: user.id,
    });

    revalidatePath("/dashboard/performance");
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", fontFamily: "var(--font-body)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Prim / Performans</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: 0 }}>
            {isCompanyWideView ? "Tüm şirketin" : "Şubenizin"} dönemsel değerlendirme ve prim kayıtları.
          </p>
        </div>

        <FormModal triggerLabel="Değerlendirme Ekle" icon={<Target size={14} strokeWidth={2} />} title="Yeni Değerlendirme Ekle">
          <form action={addScore} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 4 }}>
            <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>
              Personel
              <select name="user_id" required style={inputStyle}>
                {employees?.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
              </select>
            </label>
            <label style={labelStyle}>
              Dönem (YYYY-AA)
              <input type="text" name="period" placeholder="2026-07" required style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Performans Puanı
              <input type="number" name="score" min="0" max="100" required style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Prim Tutarı (₺)
              <input type="number" name="bonus_amount" min="0" step="0.01" required style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Not
              <input type="text" name="notes" style={inputStyle} />
            </label>
            <div style={{ gridColumn: "1 / -1", marginTop: 6 }}>
              <button type="submit" style={saveButtonStyle}>Kaydet</button>
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
          placeholder="İsim veya soyisim ara..."
          style={{ ...searchInputStyle, paddingLeft: 32 }}
        />
      </form>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={cellStyle}>Dönem</th>
            <th style={cellStyle}>Personel</th>
            <th style={cellStyle}>Puan</th>
            <th style={cellStyle}>Prim</th>
            <th style={cellStyle}>Not</th>
          </tr>
        </thead>
        <tbody>
          {scores?.map((s: any) => (
            <tr key={s.id}>
              <td style={cellStyle}>{s.period}</td>
              <td style={cellStyle}>{s.profiles?.full_name}</td>
              <td style={{ ...cellStyle, fontFamily: "var(--font-mono)" }}>{s.score}</td>
              <td style={{ ...cellStyle, fontFamily: "var(--font-mono)" }}>{s.bonus_amount} ₺</td>
              <td style={cellStyle}>{s.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {(!scores || scores.length === 0) && <p style={{ color: "var(--text-secondary)" }}>Henüz kayıt yok.</p>}
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
const cellStyle: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid var(--border)",
  padding: "10px 6px",
  fontSize: 13,
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