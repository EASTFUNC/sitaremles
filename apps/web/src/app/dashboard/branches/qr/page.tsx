import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import RotatingQrCode from "@/components/RotatingQrCode";
import FormModal from "@/components/FormModal";
import StoreAccountPanel from "@/components/StoreAccountPanel";
import ManagerAccountPanel from "@/components/ManagerAccountPanel";
import { Store, MapPinned, Radius, UserCog, Pencil } from "lucide-react";
import DeleteBranchButton from "@/components/DeleteBranchButton";

export default async function BranchesPage() {
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
  const isAdmin = roleCodes.includes("company_admin");

  const { data: allBranches } = await supabase
    .from("branches")
    .select("id, name, latitude, longitude, geofence_radius_meters, is_active")
    .eq("company_id", companyId)
    .eq("is_active", true);

  const branches = isCompanyWideView
    ? (allBranches ?? [])
    : (allBranches ?? []).filter((b) => b.id === profile?.branch_id);

  const { data: allProfiles } = await supabase
    .from("profiles")
    .select("branch_id")
    .eq("company_id", companyId);
  const employeeCountByBranch: Record<string, number> = {};
  (allProfiles ?? []).forEach((p) => {
    if (p.branch_id) employeeCountByBranch[p.branch_id] = (employeeCountByBranch[p.branch_id] ?? 0) + 1;
  });

  async function createBranch(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    await supabase.from("branches").insert({
      company_id: profile?.company_id,
      name: formData.get("name") as string,
      latitude: Number(formData.get("latitude")),
      longitude: Number(formData.get("longitude")),
      geofence_radius_meters: Number(formData.get("radius")),
    });

    revalidatePath("/dashboard/branches/qr");
  }

  async function updateBranch(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const branchId = formData.get("branch_id") as string;

    await supabase
      .from("branches")
      .update({
        name: formData.get("name") as string,
        latitude: Number(formData.get("latitude")),
        longitude: Number(formData.get("longitude")),
        geofence_radius_meters: Number(formData.get("radius")),
      })
      .eq("id", branchId);

    revalidatePath("/dashboard/branches/qr");
  }

  async function deactivateBranch(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const branchId = formData.get("branch_id") as string;

    const { error } = await supabase.from("branches").delete().eq("id", branchId);
    if (error) {
      await supabase.from("branches").update({ is_active: false }).eq("id", branchId);
    }

    revalidatePath("/dashboard/branches/qr");
  }

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", fontFamily: "var(--font-body)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Şube Yönetimi</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: 0 }}>
            {isCompanyWideView ? "Şubelerinizi yönetin ve dönen QR kodlarını görüntüleyin." : "Şubenizin dönen QR kodunu görüntüleyin."}
          </p>
        </div>

        {isAdmin && (
          <FormModal
            triggerLabel="Yeni Şube"
            icon={<Store size={14} strokeWidth={2} />}
            title="Yeni Şube Ekle"
            description="Koordinatları bulmak için Google Maps'te şubenin konumuna sağ tıklayıp çıkan enlem/boylam değerlerini kopyalayabilirsiniz."
          >
            <form action={createBranch} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 4 }}>
              <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>
                Şube Adı
                <input name="name" required style={inputStyle} />
              </label>
              <label style={labelStyle}>
                Enlem (Latitude)
                <input name="latitude" type="number" step="any" required style={inputStyle} placeholder="41.0151" />
              </label>
              <label style={labelStyle}>
                Boylam (Longitude)
                <input name="longitude" type="number" step="any" required style={inputStyle} placeholder="28.9795" />
              </label>
              <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>
                Geofence Yarıçapı (metre)
                <input name="radius" type="number" defaultValue={100} required style={inputStyle} />
              </label>
              <div style={{ gridColumn: "1 / -1", marginTop: 6 }}>
                <button type="submit" style={saveButtonStyle}>Şube Oluştur</button>
              </div>
            </form>
          </FormModal>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
        {branches.map((b) => (
          <div key={b.id} style={branchCardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={iconBadgeStyle}>
                <Store size={16} color="var(--accent)" strokeWidth={1.75} />
              </div>
              <strong style={{ fontFamily: "var(--font-display)", fontSize: 15 }}>{b.name}</strong>
            </div>

            <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
              <RotatingQrCode branchId={b.id} branchName={b.name} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
              <div style={metaRowStyle}>
                <MapPinned size={13} strokeWidth={1.75} />
                <span>{b.latitude}, {b.longitude}</span>
              </div>
              <div style={metaRowStyle}>
                <Radius size={13} strokeWidth={1.75} />
                <span>{b.geofence_radius_meters}m yarıçap</span>
              </div>
            </div>

            {isAdmin && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <FormModal
                  triggerLabel="Müdür Ata"
                  icon={<UserCog size={13} strokeWidth={2} />}
                  title={`${b.name} — Müdür Ata`}
                  description="Bu şubenin yönetimini üstlenecek bir müdür hesabı oluşturur."
                >
                  <ManagerAccountPanel branchId={b.id} />
                </FormModal>
                <FormModal
                  triggerLabel="Ekran Hesabı"
                  icon={<Store size={13} strokeWidth={2} />}
                  title={`${b.name} — Mağaza Ekranı Hesabı Oluştur`}
                  description="Fiziksel ekranda giriş yapıp sadece Mağaza Paneli'ni gösterecek kilitli bir hesap oluşturur."
                >
                  <StoreAccountPanel branchId={b.id} branchName={b.name} />
                </FormModal>
                <FormModal
                  triggerLabel="Düzenle"
                  icon={<Pencil size={13} strokeWidth={2} />}
                  title={`${b.name} — Şube Bilgilerini Düzenle`}
                >
                  <form action={updateBranch} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <input type="hidden" name="branch_id" value={b.id} />
                    <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>
                      Şube Adı
                      <input name="name" defaultValue={b.name} required style={inputStyle} />
                    </label>
                    <label style={labelStyle}>
                      Enlem (Latitude)
                      <input name="latitude" type="number" step="any" defaultValue={b.latitude} required style={inputStyle} />
                    </label>
                    <label style={labelStyle}>
                      Boylam (Longitude)
                      <input name="longitude" type="number" step="any" defaultValue={b.longitude} required style={inputStyle} />
                    </label>
                    <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>
                      Geofence Yarıçapı (metre)
                      <input name="radius" type="number" defaultValue={b.geofence_radius_meters} required style={inputStyle} />
                    </label>
                    <div style={{ gridColumn: "1 / -1", marginTop: 6 }}>
                      <button type="submit" style={saveButtonStyle}>Kaydet</button>
                    </div>
                  </form>
                </FormModal>
                <DeleteBranchButton
                  branchId={b.id}
                  branchName={b.name}
                  hasEmployees={(employeeCountByBranch[b.id] ?? 0) > 0}
                  action={deactivateBranch}
                />
              </div>
            )}
          </div>
        ))}
        {branches.length === 0 && <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>Şube bulunamadı.</p>}
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
const branchCardStyle: React.CSSProperties = {
  padding: 18,
  border: "1px solid var(--border)",
  borderRadius: 16,
  background: "var(--bg-elevated)",
};
const iconBadgeStyle: React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 9,
  background: "color-mix(in srgb, var(--accent) 15%, transparent)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
const metaRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontSize: 12,
  color: "var(--text-secondary)",
  fontFamily: "var(--font-mono)",
};