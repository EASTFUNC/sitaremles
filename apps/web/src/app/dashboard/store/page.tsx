import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { Users, CheckCircle2, XCircle, CalendarClock, Store } from "lucide-react";
import RotatingQrCode from "@/components/RotatingQrCode";
import StoreEmployeeRow from "@/components/StoreEmployeeRow";
import FormModal from "@/components/FormModal";
import StoreAccountPanel from "@/components/StoreAccountPanel";
import BranchSelector from "@/components/BranchSelector";
import ManagerAccountPanel from "@/components/ManagerAccountPanel";
import { UserCog } from "lucide-react";

export default async function StorePanelPage({
  searchParams,
}: {
  searchParams: Promise<{ branch_id?: string }>;
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

  const { data: isAdmin } = await supabase.rpc("has_any_role", {
    p_company_id: companyId,
    p_role_codes: ["company_admin"],
  });

  const { data: branches } = await supabase
    .from("branches")
    .select("id, name")
    .eq("company_id", companyId);

  const { branch_id: requestedBranchId } = await searchParams;
  const branchId = requestedBranchId ?? (isAdmin ? branches?.[0]?.id : profile?.branch_id) ?? branches?.[0]?.id;
  const currentBranchName = branches?.find((b) => b.id === branchId)?.name ?? "";

  // "store_display" (magaza ekrani) hesaplarini gercek personel sayimlarindan haric tutalim
  const { data: storeDisplayRows } = await supabase.rpc("get_store_display_user_ids", { p_company_id: companyId });
  const storeDisplayIds = new Set((storeDisplayRows ?? []).map((r: any) => r.user_id));

  const { data: rawEmployees } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("company_id", companyId)
    .eq("branch_id", branchId)
    .order("full_name");

  const employees = (rawEmployees ?? []).filter((e) => !storeDisplayIds.has(e.id));

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStartIso = todayStart.toISOString();

  const employeeIds = employees.map((e) => e.id);

  const { data: todayLogs } = employeeIds.length
    ? await supabase
        .from("attendance_logs")
        .select("user_id, event_type, event_time")
        .in("user_id", employeeIds)
        .gte("event_time", todayStartIso)
        .order("event_time", { ascending: true })
    : { data: [] };

  const { data: todayLeaves } = employeeIds.length
    ? await supabase
        .from("leave_requests")
        .select("user_id")
        .in("user_id", employeeIds)
        .eq("status", "approved")
        .lte("start_date", todayStartIso.slice(0, 10))
        .gte("end_date", todayStartIso.slice(0, 10))
    : { data: [] };

  const onLeaveIds = new Set((todayLeaves ?? []).map((l) => l.user_id));

  const logsByUser: Record<string, { event_type: string; event_time: string }[]> = {};
  (todayLogs ?? []).forEach((log) => {
    if (!logsByUser[log.user_id]) logsByUser[log.user_id] = [];
    logsByUser[log.user_id].push({ event_type: log.event_type, event_time: log.event_time });
  });

  let activeCount = 0;
  let absentCount = 0;
  let leaveCount = 0;

  const employeeRows = employees.map((emp) => {
    const logs = logsByUser[emp.id] ?? [];
    const lastLog = logs[logs.length - 1];
    const isOnLeave = onLeaveIds.has(emp.id);
    const isWorking = lastLog?.event_type === "check_in";
    const hasArrivedToday = logs.some((l) => l.event_type === "check_in");

    let status: "working" | "absent" | "leave" | "left" = "absent";
    if (isOnLeave) status = "leave";
    else if (isWorking) status = "working";
    else if (hasArrivedToday) status = "left";

    if (status === "working") activeCount++;
    else if (status === "leave") leaveCount++;
    else if (status === "absent") absentCount++;

    return { id: emp.id, full_name: emp.full_name, status, logs };
  });

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", fontFamily: "var(--font-body)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, marginBottom: 4 }}>Mağaza Paneli</h1>
          {currentBranchName && (
            <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: 0 }}>{currentBranchName}</p>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {isAdmin && branches && branches.length > 1 && branchId && (
            <BranchSelector branches={branches} currentBranchId={branchId} />
          )}
          {isAdmin && branchId && (
            <FormModal
              triggerLabel="Müdür Ata"
              icon={<UserCog size={14} strokeWidth={2} />}
              title="Bu Şubeye Müdür Ata"
              description="Bu şubenin yönetimini üstlenecek bir müdür hesabı oluşturur. Müdür, sadece bu şubenin verilerine erişebilir."
            >
              <ManagerAccountPanel branchId={branchId} />
            </FormModal>
          )}
          {isAdmin && branchId && (
            <FormModal
              triggerLabel="Mağaza Hesabı Oluştur"
              icon={<Store size={14} strokeWidth={2} />}
              title="Mağaza Ekranı Hesabı Oluştur"
              description="Bu hesap, fiziksel ekranda giriş yapıp sadece bu paneli görüntülemek için kullanılır. Gerçek bir personel değildir, sayımlara dahil edilmez."
            >
              <StoreAccountPanel branchId={branchId} branchName={currentBranchName} />
            </FormModal>
          )}
        </div>
      </div>

      <div style={statGridStyle}>
        <StatCard icon={Users} label="Personel Sayısı" value={employees.length} />
        <StatCard icon={CheckCircle2} label="Aktif Çalışan" value={activeCount} accent="success" />
        <StatCard icon={XCircle} label="Gelmeyen" value={absentCount} accent="warning" />
        <StatCard icon={CalendarClock} label="İzinli" value={leaveCount} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 20, marginTop: 24, alignItems: "start" }}>
        <div>
          <h3 style={{ fontSize: 14, marginBottom: 12 }}>Personel Durumları</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {employeeRows.map((row) => (
              <StoreEmployeeRow key={row.id} name={row.full_name} status={row.status} logs={row.logs} />
            ))}
            {employeeRows.length === 0 && <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>Bu şubede personel yok.</p>}
          </div>
        </div>

        <div style={qrCardStyle}>
          <strong style={{ fontSize: 13 }}>QR Kodu Okutabilirsiniz</strong>
          {branchId && (
            <div style={{ marginTop: 14 }}>
              <RotatingQrCode branchId={branchId} branchName="" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: number; accent?: "success" | "warning" }) {
  const color = accent === "success" ? "var(--success)" : accent === "warning" ? "#E0A030" : "var(--accent)";
  return (
    <div style={cardStyle}>
      <div style={{ width: 34, height: 34, borderRadius: 10, background: `color-mix(in srgb, ${color} 15%, transparent)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={16} color={color} strokeWidth={1.75} />
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 24, marginTop: 10 }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>{label}</div>
    </div>
  );
}

const statGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 14,
};
const cardStyle: React.CSSProperties = {
  padding: 16,
  border: "1px solid var(--border)",
  borderRadius: 14,
  background: "var(--bg-elevated)",
};
const selectStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg-elevated)",
  color: "var(--text)",
  fontSize: 13,
};
const qrCardStyle: React.CSSProperties = {
  padding: 20,
  border: "1px solid var(--border)",
  borderRadius: 16,
  background: "var(--bg-elevated)",
  textAlign: "center",
};