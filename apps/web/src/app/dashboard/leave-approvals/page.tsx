import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export default async function LeaveApprovalsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();

  const { data: requests } = await supabase
    .from("leave_requests")
    .select("id, start_date, end_date, status, created_at, profiles!leave_requests_user_id_fkey(full_name), leave_types(name)")
    .eq("company_id", profile?.company_id)
    .order("created_at", { ascending: false });

  async function updateStatus(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const requestId = formData.get("request_id") as string;
    const newStatus = formData.get("new_status") as string;

    await supabase
      .from("leave_requests")
      .update({ status: newStatus, approved_by: user.id })
      .eq("id", requestId);

    revalidatePath("/dashboard/leave-approvals");
  }

  const pending = requests?.filter((r) => r.status === "pending") ?? [];
  const processed = requests?.filter((r) => r.status !== "pending") ?? [];

  return (
    <div style={{ maxWidth: 800, margin: "60px auto", fontFamily: "sans-serif" }}>
      <h1>İzin Onay Kuyruğu</h1>

      <h2>Bekleyen Talepler ({pending.length})</h2>
      {pending.length === 0 && <p>Bekleyen talep yok.</p>}
      {pending.map((r: any) => (
        <div key={r.id} style={{ padding: 12, border: "1px solid #444", marginBottom: 10 }}>
          <strong>{r.profiles?.full_name}</strong> — {r.leave_types?.name}
          <br />
          {r.start_date} → {r.end_date}
          <div style={{ marginTop: 8 }}>
            <form action={updateStatus} style={{ display: "inline" }}>
              <input type="hidden" name="request_id" value={r.id} />
              <input type="hidden" name="new_status" value="approved" />
              <button type="submit" style={{ marginRight: 8, padding: "4px 12px" }}>Onayla</button>
            </form>
            <form action={updateStatus} style={{ display: "inline" }}>
              <input type="hidden" name="request_id" value={r.id} />
              <input type="hidden" name="new_status" value="rejected" />
              <button type="submit" style={{ padding: "4px 12px" }}>Reddet</button>
            </form>
          </div>
        </div>
      ))}

      <h2 style={{ marginTop: 32 }}>Geçmiş</h2>
      {processed.map((r: any) => (
        <div key={r.id} style={{ padding: 8, opacity: 0.7 }}>
          {r.profiles?.full_name} — {r.leave_types?.name} — {r.start_date} → {r.end_date} —{" "}
          <strong>{r.status === "approved" ? "Onaylandı" : "Reddedildi"}</strong>
        </div>
      ))}
    </div>
  );
}