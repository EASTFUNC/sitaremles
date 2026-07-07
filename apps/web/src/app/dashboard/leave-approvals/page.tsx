import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import { CalendarClock, Check, X, Search } from "lucide-react";

export default async function LeaveApprovalsPage({
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

  let branchEmployeeIds: string[] | null = null;
  if (isBranchManager && profile?.branch_id) {
    const { data: branchEmployees } = await supabase
      .from("profiles")
      .select("id")
      .eq("company_id", companyId)
      .eq("branch_id", profile.branch_id);
    branchEmployeeIds = (branchEmployees ?? []).map((e) => e.id);
  }

  let requestsQuery = supabase
    .from("leave_requests")
    .select("id, start_date, end_date, status, created_at, profiles!leave_requests_user_id_fkey(full_name), leave_types(name)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (branchEmployeeIds) {
    requestsQuery = requestsQuery.in("user_id", branchEmployeeIds.length > 0 ? branchEmployeeIds : ["00000000-0000-0000-0000-000000000000"]);
  }

  const { data: rawRequests } = await requestsQuery;
  const { q } = await searchParams;
  const requests = q && q.trim()
    ? (rawRequests ?? []).filter((r: any) =>
        r.profiles?.full_name?.toLocaleLowerCase("tr").includes(q.trim().toLocaleLowerCase("tr"))
      )
    : rawRequests;

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
    <div style={{ maxWidth: 800, margin: "0 auto", fontFamily: "var(--font-body)" }}>
      <h1 style={{ marginBottom: 4 }}>İzin Onay Kuyruğu</h1>
      <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 0, marginBottom: 16 }}>
        {isCompanyWideView ? "Tüm şirketin izin talepleri." : "Şubenizin izin talepleri."}
      </p>

      <form method="get" style={{ marginBottom: 20, position: "relative", maxWidth: 320 }}>
        <Search size={14} color="var(--text-secondary)" style={{ position: "absolute", left: 10, top: 10 }} />
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="İsim veya soyisim ara..."
          style={{ ...searchInputStyle, paddingLeft: 32 }}
        />
      </form>

      <h3 style={{ fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
        <CalendarClock size={15} strokeWidth={1.75} color="var(--accent)" />
        Bekleyen Talepler ({pending.length})
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28 }}>
        {pending.length === 0 && <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>Bekleyen talep yok.</p>}
        {pending.map((r: any) => (
          <div key={r.id} style={pendingCardStyle}>
            <div>
              <strong style={{ fontSize: 13 }}>{r.profiles?.full_name}</strong>
              <span style={{ fontSize: 12, color: "var(--text-secondary)", marginLeft: 8 }}>
                {r.leave_types?.name} · {r.start_date} → {r.end_date}
              </span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <form action={updateStatus}>
                <input type="hidden" name="request_id" value={r.id} />
                <input type="hidden" name="new_status" value="approved" />
                <button type="submit" style={iconActionStyle("success")}><Check size={14} strokeWidth={2} /></button>
              </form>
              <form action={updateStatus}>
                <input type="hidden" name="request_id" value={r.id} />
                <input type="hidden" name="new_status" value="rejected" />
                <button type="submit" style={iconActionStyle("danger")}><X size={14} strokeWidth={2} /></button>
              </form>
            </div>
          </div>
        ))}
      </div>

      <h3 style={{ fontSize: 14 }}>Geçmiş</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {processed.map((r: any) => (
          <div key={r.id} style={historyRowStyle}>
            <span style={{ fontSize: 13 }}>
              {r.profiles?.full_name} — {r.leave_types?.name} — {r.start_date} → {r.end_date}
            </span>
            <span style={statusBadgeStyle(r.status === "approved")}>
              {r.status === "approved" ? "Onaylandı" : "Reddedildi"}
            </span>
          </div>
        ))}
        {processed.length === 0 && <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>Henüz geçmiş kayıt yok.</p>}
      </div>
    </div>
  );
}

function statusBadgeStyle(approved: boolean): React.CSSProperties {
  const color = approved ? "var(--success)" : "#D64545";
  return {
    fontSize: 11,
    padding: "3px 10px",
    borderRadius: 20,
    fontFamily: "var(--font-mono)",
    background: `color-mix(in srgb, ${color} 15%, transparent)`,
    color,
  };
}

const pendingCardStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "12px 16px",
  border: "1px solid var(--accent)",
  borderRadius: 12,
  background: "var(--bg-elevated)",
};
const historyRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "10px 14px",
  border: "1px solid var(--border)",
  borderRadius: 10,
  background: "var(--bg-elevated)",
  opacity: 0.85,
};
function iconActionStyle(variant: "success" | "danger"): React.CSSProperties {
  const color = variant === "success" ? "var(--success)" : "#D64545";
  return {
    width: 28,
    height: 28,
    borderRadius: 7,
    border: `1px solid ${color}`,
    background: "transparent",
    color,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
}
const searchInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg-elevated)",
  color: "var(--text)",
  fontSize: 13,
};