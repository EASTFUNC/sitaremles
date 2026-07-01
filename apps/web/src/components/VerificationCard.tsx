"use client";

export default function VerificationCard() {
  return (
    <div
      style={{
        position: "relative",
        width: 320,
        padding: 24,
        borderRadius: 16,
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        textAlign: "left",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes pulse-ring {
          0% { transform: scale(0.8); opacity: 0.6; }
          100% { transform: scale(2.2); opacity: 0; }
        }
      `}</style>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ position: "relative", width: 14, height: 14 }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              background: "var(--success)",
              animation: "pulse-ring 2s ease-out infinite",
            }}
          />
          <div
            style={{
              position: "relative",
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: "var(--success)",
            }}
          />
        </div>
        <strong style={{ fontFamily: "var(--font-display)", fontSize: 15 }}>Merkez Şube</strong>
      </div>

      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: "color-mix(in srgb, var(--success) 15%, transparent)",
          color: "var(--success)",
          padding: "4px 10px",
          borderRadius: 20,
          fontSize: 12,
          fontFamily: "var(--font-mono)",
          marginBottom: 12,
        }}
      >
        ✓ Doğrulandı
      </div>

      <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
        12 personel · konum eşleşti · şu an aktif
      </p>
    </div>
  );
}