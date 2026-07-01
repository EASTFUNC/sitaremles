import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import VerificationCard from "@/components/VerificationCard";

export default function LandingPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <nav
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "24px 48px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20 }}>
          SITAREMLES
        </span>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <ThemeToggle />
          <Link
            href="/login"
            style={{
              background: "var(--accent)",
              color: "var(--accent-contrast)",
              padding: "8px 20px",
              borderRadius: 8,
              textDecoration: "none",
              fontWeight: 500,
              fontSize: 14,
            }}
          >
            Panele Giriş Yap
          </Link>
        </div>
      </nav>

      <main style={{ flex: 1, maxWidth: 1000, margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
        <h1
          style={{
            fontSize: 48,
            lineHeight: 1.15,
            marginBottom: 20,
            maxWidth: 700,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          Şubeleriniz her an doğrulanmış çalışsın.
        </h1>
        <p
          style={{
            fontSize: 18,
            color: "var(--text-secondary)",
            maxWidth: 560,
            margin: "0 auto 56px",
            lineHeight: 1.6,
          }}
        >
          Vardiya, PDKS, izin ve yapay zeka destekli operasyon yönetimi — tek panelde.
          Her giriş, her onay, konumla ve zaman damgasıyla kanıtlanır.
        </p>

        <div style={{ display: "flex", justifyContent: "center", marginBottom: 64 }}>
          <VerificationCard />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 16,
            textAlign: "left",
          }}
        >
          <FeatureCard icon="📍" title="QR + GPS ile PDKS" desc="Donanım gerektirmeden, sahtecilik tespitli giriş-çıkış." />
          <FeatureCard icon="🤖" title="AI Vardiya Planlama" desc="Kısıtlara ve tercihlere göre otomatik taslak plan." />
          <FeatureCard icon="🔍" title="Denetim Ajanı" desc="Şüpheli hareketleri otomatik tespit edip özetler." />
          <FeatureCard icon="🧠" title="Doğal Dil Raporlama" desc="'Hangi şube en verimli?' diye sorup cevap al." />
        </div>
      </main>

      <footer
        style={{
          borderTop: "1px solid var(--border)",
          padding: "24px 48px",
          textAlign: "center",
          fontSize: 13,
          color: "var(--text-secondary)",
        }}
      >
        SITAREMLES — EASTFUNC tarafından geliştirilmiştir.
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div
      style={{
        padding: 20,
        border: "1px solid var(--border)",
        borderRadius: 12,
        background: "var(--bg-elevated)",
      }}
    >
      <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
      <strong style={{ fontFamily: "var(--font-display)", fontSize: 15 }}>{title}</strong>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6, lineHeight: 1.5 }}>{desc}</p>
    </div>
  );
}