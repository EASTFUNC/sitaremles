"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { ShieldAlert, Loader2 } from "lucide-react";

export default function AuditAgentTrigger({ companyId }: { companyId: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ flagged_count: number; summary: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function runCheck() {
    setLoading(true);
    setError(null);
    setResult(null);

    const supabase = createClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/audit-agent`, {
        method: "POST",
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ company_id: companyId }),
      });
      const data = await res.json();
      if (data.success) {
        setResult({ flagged_count: data.flagged_count, summary: data.summary });
        router.refresh();
      } else {
        setError(data.error ?? "Bilinmeyen hata");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button onClick={runCheck} disabled={loading} style={{ ...buttonStyle, opacity: loading ? 0.6 : 1 }}>
        {loading ? <Loader2 size={15} strokeWidth={2} className="spin" /> : <ShieldAlert size={15} strokeWidth={2} />}
        {loading ? "Kontrol Ediliyor..." : "Şimdi Kontrol Et"}
      </button>

      {result && (
        <div style={resultBoxStyle}>
          <strong style={{ fontSize: 13 }}>{result.flagged_count} yeni kayıt işaretlendi</strong>
          <p style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 6, lineHeight: 1.5 }}>{result.summary}</p>
        </div>
      )}

      {error && (
        <div style={{ ...resultBoxStyle, borderColor: "#D64545" }}>
          <span style={{ fontSize: 12.5, color: "#D64545" }}>Hata: {error}</span>
        </div>
      )}
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 20px",
  borderRadius: 10,
  border: "1px solid var(--accent)",
  background: "var(--accent)",
  color: "var(--accent-contrast)",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
};
const resultBoxStyle: React.CSSProperties = {
  marginTop: 14,
  padding: 16,
  border: "1px solid var(--border)",
  borderRadius: 12,
  background: "var(--bg-elevated)",
};