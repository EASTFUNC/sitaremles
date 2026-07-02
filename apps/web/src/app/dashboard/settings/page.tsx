import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();

  const { data: isAdmin } = await supabase.rpc("has_any_role", {
    p_company_id: profile?.company_id,
    p_role_codes: ["company_admin"],
  });

  if (!isAdmin) {
    return (
      <div style={{ maxWidth: 600, margin: "0 auto", fontFamily: "var(--font-body)" }}>
        <h1>Erişim Reddedildi</h1>
        <p>Bu sayfa sadece şirket adminine açıktır.</p>
      </div>
    );
  }

  const { data: settings } = await supabase
    .from("company_settings")
    .select("*")
    .eq("company_id", profile?.company_id)
    .single();

  async function updateSettings(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    await supabase.from("company_settings").upsert({
      company_id: profile?.company_id,
      max_weekly_hours: Number(formData.get("max_weekly_hours")),
      max_daily_hours: Number(formData.get("max_daily_hours")),
      min_rest_hours: Number(formData.get("min_rest_hours")),
      break_tolerance_minutes: Number(formData.get("break_tolerance_minutes")),
      late_tolerance_minutes: Number(formData.get("late_tolerance_minutes")),
      early_leave_tolerance_minutes: Number(formData.get("early_leave_tolerance_minutes")),
      geofence_default_radius_m: Number(formData.get("geofence_default_radius_m")),
      updated_at: new Date().toISOString(),
    });

    revalidatePath("/dashboard/settings");
  }

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", fontFamily: "var(--font-body)" }}>
      <h1>Şirket Ayarları</h1>
      <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
        Bu değerler, vardiya çakışma kontrolü, mesai hesaplamaları ve geç kalma tespitinde kullanılır.
      </p>

      <form
        action={updateSettings}
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          padding: 20,
          border: "1px solid var(--border)",
          borderRadius: 12,
          background: "var(--bg-elevated)",
          marginTop: 16,
        }}
      >
        <SettingField label="Haftalık Max Çalışma (saat)" name="max_weekly_hours" defaultValue={settings?.max_weekly_hours ?? 45} />
        <SettingField label="Günlük Max Çalışma (saat)" name="max_daily_hours" defaultValue={settings?.max_daily_hours ?? 11} />
        <SettingField label="Vardiyalar Arası Min Dinlenme (saat)" name="min_rest_hours" defaultValue={settings?.min_rest_hours ?? 11} />
        <SettingField label="Mola Geç Kalma Toleransı (dk)" name="break_tolerance_minutes" defaultValue={settings?.break_tolerance_minutes ?? 5} />
        <SettingField label="İşe Geç Kalma Toleransı (dk)" name="late_tolerance_minutes" defaultValue={settings?.late_tolerance_minutes ?? 15} />
        <SettingField label="Erken Çıkış Toleransı (dk)" name="early_leave_tolerance_minutes" defaultValue={settings?.early_leave_tolerance_minutes ?? 15} />
        <SettingField label="Varsayılan Geofence Yarıçapı (m)" name="geofence_default_radius_m" defaultValue={settings?.geofence_default_radius_m ?? 100} />

        <div style={{ gridColumn: "1 / -1", marginTop: 8 }}>
          <button
            type="submit"
            style={{
              padding: "10px 24px",
              background: "var(--accent)",
              color: "var(--accent-contrast)",
              border: "none",
              borderRadius: 8,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Kaydet
          </button>
        </div>
      </form>
    </div>
  );
}

function SettingField({ label, name, defaultValue }: { label: string; name: string; defaultValue: number }) {
  return (
    <label style={{ fontSize: 13, color: "var(--text-secondary)" }}>
      {label}
      <input
        type="number"
        step="any"
        name={name}
        defaultValue={defaultValue}
        style={{
          display: "block",
          width: "100%",
          padding: 8,
          marginTop: 4,
          borderRadius: 6,
          border: "1px solid var(--border)",
          background: "var(--bg)",
          color: "var(--text)",
        }}
      />
    </label>
  );
}