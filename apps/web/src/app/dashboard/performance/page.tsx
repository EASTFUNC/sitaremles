import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export default async function PerformancePage() {
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
    .select("id, full_name")
    .eq("company_id", profile?.company_id);

  const { data: scores } = await supabase
    .from("performance_scores")
    .select("id, period, score, bonus_amount, notes, profiles!performance_scores_user_id_fkey(full_name)")
    .eq("company_id", profile?.company_id)
    .order("period", { ascending: false });

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
    <div style={{ maxWidth: 800, margin: "60px auto", fontFamily: "sans-serif" }}>
      <h1>Prim / Performans Girişi</h1>

      <form action={addScore} style={{ marginBottom: 32, padding: 16, border: "1px solid #333" }}>
        <h3>Yeni Değerlendirme Ekle</h3>

        <label>Personel:</label>
        <select name="user_id" required style={{ display: "block", width: "100%", marginBottom: 8, padding: 6 }}>
          {employees?.map((e) => (
            <option key={e.id} value={e.id}>{e.full_name}</option>
          ))}
        </select>

        <label>Dönem (YYYY-AA):</label>
        <input type="text" name="period" placeholder="2026-07" required style={{ display: "block", width: "100%", marginBottom: 8, padding: 6 }} />

        <label>Performans Puanı (0-100):</label>
        <input type="number" name="score" min="0" max="100" required style={{ display: "block", width: "100%", marginBottom: 8, padding: 6 }} />

        <label>Prim Tutarı (₺):</label>
        <input type="number" name="bonus_amount" min="0" step="0.01" required style={{ display: "block", width: "100%", marginBottom: 8, padding: 6 }} />

        <label>Not:</label>
        <textarea name="notes" style={{ display: "block", width: "100%", marginBottom: 12, padding: 6 }} />

        <button type="submit" style={{ padding: "8px 16px" }}>Kaydet</button>
      </form>

      <h3>Geçmiş Değerlendirmeler</h3>
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
              <td style={cellStyle}>{s.score}</td>
              <td style={cellStyle}>{s.bonus_amount} ₺</td>
              <td style={cellStyle}>{s.notes}</td>
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