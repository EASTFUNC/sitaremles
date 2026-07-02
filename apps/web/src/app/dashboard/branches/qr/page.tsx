import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import RotatingQrCode from "@/components/RotatingQrCode";

export default async function BranchesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();

  const { data: branches } = await supabase
    .from("branches")
    .select("id, name, latitude, longitude, geofence_radius_meters, is_active")
    .eq("company_id", profile?.company_id);

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

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", fontFamily: "var(--font-body)" }}>
      <h1>Şube Yönetimi ve QR Kodları</h1>

      <div
        style={{
          padding: 20,
          border: "1px solid var(--border)",
          borderRadius: 12,
          background: "var(--bg-elevated)",
          marginBottom: 24,
        }}
      >
        <h3 style={{ marginTop: 0 }}>Yeni Şube Ekle</h3>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: -8 }}>
          Koordinatları bulmak için: Google Maps&apos;te şubenin konumuna sağ tıkla, üstte çıkan
          enlem/boylam sayılarına (örn. 41.0151, 28.9795) tıkla — otomatik kopyalanır. Enlem
          (latitude) ve boylam (longitude) kutularına ayrı ayrı yapıştır.
        </p>
        <form action={createBranch} style={{ display: "grid", gap: 10, maxWidth: 400 }}>
          <label>
            Şube Adı
            <input name="name" required style={inputStyle} />
          </label>
          <label>
            Enlem (Latitude)
            <input name="latitude" type="number" step="any" required style={inputStyle} placeholder="41.0151" />
          </label>
          <label>
            Boylam (Longitude)
            <input name="longitude" type="number" step="any" required style={inputStyle} placeholder="28.9795" />
          </label>
          <label>
            Geofence Yarıçapı (metre)
            <input name="radius" type="number" defaultValue={100} required style={inputStyle} />
          </label>
          <button
            type="submit"
            style={{
              padding: "10px 20px",
              background: "var(--accent)",
              color: "var(--accent-contrast)",
              border: "none",
              borderRadius: 8,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Şube Oluştur
          </button>
        </form>
      </div>

      <h3>Mevcut Şubeler</h3>
      <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
        Bu QR kodları şube girişine asılabilir/ekranda gösterilebilir. Personel telefonuyla okutarak
        giriş-çıkış yapar. Her 5 saniyede bir otomatik yenilenir.
      </p>
      {branches?.map((b) => (
        <div
          key={b.id}
          style={{
            display: "flex",
            gap: 20,
            alignItems: "center",
            padding: 16,
            border: "1px solid var(--border)",
            borderRadius: 12,
            background: "var(--bg-elevated)",
            marginBottom: 12,
          }}
        >
          <RotatingQrCode branchId={b.id} branchName={b.name} />
          <div>
            <strong style={{ fontFamily: "var(--font-display)" }}>{b.name}</strong>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "4px 0" }}>
              {b.latitude}, {b.longitude} · Yarıçap: {b.geofence_radius_meters}m
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: 8,
  marginTop: 4,
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "var(--bg)",
  color: "var(--text)",
};