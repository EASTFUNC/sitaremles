"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { UserCog, CheckCircle2 } from "lucide-react";

export default function ManagerAccountPanel({ branchId }: { branchId: string }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{ email: string; password: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function createAccount() {
    if (!email.trim() || !fullName.trim()) return;
    setCreating(true);
    setError(null);
    const supabase = createClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-employee`, {
        method: "POST",
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          full_name: fullName,
          branch_id: branchId,
          role_code: "store_manager",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setResult({ email, password: data.temp_password });
      } else {
        setError(data.error ?? "Bilinmeyen hata");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <label style={labelStyle}>
        Ad Soyad
        <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Örn. Ayşe Yılmaz" style={inputStyle} />
      </label>
      <label style={labelStyle}>
        E-posta
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ayse@sirketiniz.com" style={inputStyle} />
      </label>
      <button onClick={createAccount} disabled={creating || !email.trim() || !fullName.trim()} style={{ ...buttonStyle, opacity: creating ? 0.6 : 1 }}>
        <UserCog size={14} strokeWidth={2} />
        {creating ? "Oluşturuluyor..." : "Müdür Ata"}
      </button>

      {error && <p style={{ color: "#D64545", fontSize: 12.5, marginTop: 10 }}>{error}</p>}

      {result && (
        <div style={resultBoxStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <CheckCircle2 size={14} color="var(--success)" strokeWidth={2} />
            <strong style={{ fontSize: 13 }}>Müdür hesabı oluşturuldu</strong>
          </div>
          <p style={{ fontSize: 12.5, margin: "4px 0" }}>
            E-posta: <span style={{ fontFamily: "var(--font-mono)" }}>{result.email}</span>
          </p>
          <p style={{ fontSize: 12.5, margin: "4px 0" }}>
            Şifre: <span style={{ fontFamily: "var(--font-mono)" }}>{result.password}</span>
          </p>
          <p style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 8 }}>
            Bu bilgileri müdüre iletin.
          </p>
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = { fontSize: 12.5, color: "var(--text-secondary)", display: "block", marginBottom: 12 };
const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: 9,
  marginTop: 4,
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg)",
  color: "var(--text)",
  fontSize: 13,
};
const buttonStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "9px 18px",
  borderRadius: 8,
  border: "none",
  background: "var(--accent)",
  color: "var(--accent-contrast)",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
};
const resultBoxStyle: React.CSSProperties = {
  marginTop: 16,
  padding: 14,
  border: "1px solid var(--success)",
  borderRadius: 10,
  background: "var(--bg-elevated)",
};