import Link from "next/link";

export default function LandingPage() {
  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: 700, margin: "80px auto", textAlign: "center" }}>
      <h1 style={{ fontSize: 36 }}>SITAREMLES</h1>
      <p style={{ fontSize: 18, color: "#888" }}>
        Çok şubeli işletmeler için yeni nesil personel ve mağaza yönetim platformu.
        Vardiya, PDKS, izin, prim ve yapay zeka destekli operasyon yönetimi tek panelde.
      </p>

      <div style={{ display: "flex", justifyContent: "center", gap: 24, margin: "40px 0", flexWrap: "wrap" }}>
        <FeatureCard title="📍 QR + GPS ile PDKS" desc="Donanım gerektirmeden, sahtecilik tespitli giriş-çıkış." />
        <FeatureCard title="🤖 AI Vardiya Planlama" desc="Kısıtlara ve tercihlere göre otomatik taslak plan." />
        <FeatureCard title="🔍 Denetim Ajanı" desc="Şüpheli hareketleri otomatik tespit edip özetler." />
        <FeatureCard title="🧠 Doğal Dil Raporlama" desc="'Hangi şube en verimli?' diye sorup cevap al." />
      </div>

      <Link href="/login" style={{ display: "inline-block", padding: "12px 32px", background: "#4a90e2", color: "white", borderRadius: 6, textDecoration: "none", fontSize: 16 }}>
        Panele Giriş Yap
      </Link>
    </div>
  );
}

function FeatureCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div style={{ width: 200, padding: 16, border: "1px solid #333", borderRadius: 8, textAlign: "left" }}>
      <strong>{title}</strong>
      <p style={{ fontSize: 13, color: "#999" }}>{desc}</p>
    </div>
  );
}