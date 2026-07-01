import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

export default async function BranchQrPage() {
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
    .select("id, name")
    .eq("company_id", profile?.company_id);

  return (
    <div style={{ maxWidth: 700, margin: "60px auto", fontFamily: "sans-serif" }}>
      <h1>Şube Giriş-Çıkış QR Kodları</h1>
      <p>Bu QR kodları şube girişine asılabilir/ekranda gösterilebilir. Personel telefonuyla okutarak giriş-çıkış yapar.</p>
      {branches?.map((b) => {
        const payload = JSON.stringify({ branch_id: b.id });
        const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(payload)}`;
        return (
          <div key={b.id} style={{ marginBottom: 32, padding: 16, border: "1px solid #333" }}>
            <h3>{b.name}</h3>
            <img src={qrImageUrl} alt={`${b.name} QR kodu`} width={250} height={250} />
          </div>
        );
      })}
    </div>
  );
}