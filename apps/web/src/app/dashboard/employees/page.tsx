import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import Link from "next/link";
import { Users, ArrowRight, FileSpreadsheet } from "lucide-react";
import FormModal from "@/components/FormModal";
import BulkImportPanel from "@/components/BulkImportPanel";
import AddEmployeePanel from "@/components/AddEmployeePanel";
import { UserPlus } from "lucide-react";

export default async function EmployeesPage() {
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
  const isAdmin = roleCodes.includes("company_admin");
  const isCompanyWideView = isAdmin || roleCodes.includes("regional_manager");
  const isBranchManager = roleCodes.includes("store_manager") && !isCompanyWideView;
  const ownBranchId = profile?.branch_id;

  // "store_display" (magaza ekrani) hesaplarini personel listesinden haric tut
  const { data: storeDisplayRows } = await supabase.rpc("get_store_display_user_ids", { p_company_id: companyId });
  const storeDisplayIds = new Set((storeDisplayRows ?? []).map((r: any) => r.user_id));

  const { data: allEmployees } = await supabase
    .from("profiles")
    .select("id, full_name, status, branch_id, branches(name)")
    .eq("company_id", companyId)
    .order("full_name");

  let employees = (allEmployees ?? []).filter((e) => !storeDisplayIds.has(e.id));
  if (isBranchManager) {
    employees = employees.filter((e) => e.branch_id === ownBranchId);
  }

  const { data: branches } = await supabase
    .from("branches")
    .select("id, name")
    .eq("company_id", companyId);

  const statusStyle: Record<string, string> = {
    application: "var(--accent)",
    onboarding: "#E0A030",
    active: "var(--success)",
    on_leave: "var(--accent)",
    terminated: "var(--text-secondary)",
    blacklisted: "#D64545",
  };
  const statusLabels: Record<string, string> = {
    application: "Başvuru",
    onboarding: "İşe Alım Süreci",
    active: "Çalışıyor",
    on_leave: "İzinli",
    terminated: "Ayrıldı",
    blacklisted: "Kara Liste",
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", fontFamily: "var(--font-body)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Personel Listesi</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: 0 }}>
            {employees.length} personel · {isCompanyWideView ? "Tüm şirket." : "Şubeniz."} Detaylar ve özlük dosyası için bir satıra tıklayın.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          {(isAdmin || isBranchManager) && branches && branches.length > 0 && (
            <FormModal triggerLabel="Personel Ekle" icon={<UserPlus size={14} strokeWidth={2} />} title="Yeni Personel Ekle">
              <AddEmployeePanel
                branches={isBranchManager ? branches.filter((b) => b.id === ownBranchId) : branches}
                lockedBranchId={isBranchManager ? ownBranchId ?? undefined : undefined}
                lockedBranchName={isBranchManager ? branches.find((b) => b.id === ownBranchId)?.name : undefined}
                companyId={companyId!}
              />
            </FormModal>
          )}
          {isAdmin && branches && branches.length > 0 && (
            <FormModal
              triggerLabel="Excel ile Toplu Ekle"
              icon={<FileSpreadsheet size={14} strokeWidth={2} />}
              title="Excel ile Toplu Personel Ekle"
              description="Dosyada 'Ad Soyad' ve 'E-posta' başlıklı iki sütun olmalı. Hepsi seçtiğiniz şubeye 'employee' rolüyle eklenir."
            >
              <BulkImportPanel branches={branches} />
            </FormModal>
          )}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {employees.map((e: any) => (
          <Link key={e.id} href={`/dashboard/employees/${e.id}`} style={{ textDecoration: "none", color: "inherit" }}>
            <div style={rowCardStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={avatarStyle}>
                  <Users size={15} color="var(--accent)" strokeWidth={1.75} />
                </div>
                <div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 14 }}>{e.full_name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                    {e.branches?.name ?? "—"}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span
                  style={{
                    fontSize: 11,
                    padding: "3px 10px",
                    borderRadius: 20,
                    fontFamily: "var(--font-mono)",
                    background: `color-mix(in srgb, ${statusStyle[e.status] ?? "var(--text-secondary)"} 15%, transparent)`,
                    color: statusStyle[e.status] ?? "var(--text-secondary)",
                  }}
                >
                  {statusLabels[e.status] ?? e.status}
                </span>
                <ArrowRight size={14} color="var(--text-secondary)" strokeWidth={1.75} />
              </div>
            </div>
          </Link>
        ))}
        {employees.length === 0 && <p style={{ color: "var(--text-secondary)" }}>Henüz personel yok.</p>}
      </div>
    </div>
  );
}

const rowCardStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "12px 16px",
  border: "1px solid var(--border)",
  borderRadius: 12,
  background: "var(--bg-elevated)",
};
const avatarStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 10,
  background: "color-mix(in srgb, var(--accent) 15%, transparent)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};