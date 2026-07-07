"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { UserPlus, CheckCircle2 } from "lucide-react";

export default function AddEmployeePanel({
  branches,
  lockedBranchId,
  lockedBranchName,
  companyId,
}: {
  branches: { id: string; name: string }[];
  lockedBranchId?: string;
  lockedBranchName?: string;
  companyId: string;
}) {
  const [adName, setAdName] = useState("");
  const [soyad, setSoyad] = useState("");
  const [email, setEmail] = useState("");
  const [tcKimlik, setTcKimlik] = useState("");
  const [dogumTarihi, setDogumTarihi] = useState("");
  const [cinsiyet, setCinsiyet] = useState("");
  const [telefon, setTelefon] = useState("");
  const [adres, setAdres] = useState("");
  const [iseBaslama, setIseBaslama] = useState("");
  const [branchId, setBranchId] = useState(lockedBranchId ?? branches[0]?.id ?? "");
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{ email: string; password: string } | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function createAccount() {
    if (!email.trim() || !adName.trim() || !soyad.trim() || !branchId) return;
    setCreating(true);
    setError(null);
    setWarning(null);
    const supabase = createClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    const fullName = `${adName.trim()} ${soyad.trim()}`;

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
          role_code: "employee",
        }),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error ?? "Bilinmeyen hata");
        setCreating(false);
        return;
      }

      const newUserId = data.user_id;

      if (telefon || iseBaslama) {
        await supabase
          .from("profiles")
          .update({
            phone: telefon || null,
            hire_date: iseBaslama || null,
          })
          .eq("id", newUserId);
      }

      if (tcKimlik) {
        const { error: legalError } = await supabase.from("employee_legal_details").insert({
          user_id: newUserId,
          company_id: companyId,
          tc_kimlik_no: tcKimlik,
          birth_date: dogumTarihi || null,
          address: adres || null,
          gender: cinsiyet || null,
        });
        if (legalError) {
          setWarning(
            `Hesap oluşturuldu ama özlük bilgileri kaydedilemedi (${legalError.message}). Özlük Dosyası sayfasından tekrar girebilirsiniz.`
          );
        }
      }

      setResult({ email, password: data.temp_password });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label style={labelStyle}>
          Ad
          <input type="text" value={adName} onChange={(e) => setAdName(e.target.value)} style={inputStyle} />
        </label>
        <label style={labelStyle}>
          Soyad
          <input type="text" value={soyad} onChange={(e) => setSoyad(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>
          E-posta
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="mehmet@sirketiniz.com" style={inputStyle} />
        </label>
        <label style={labelStyle}>
          T.C. Kimlik No
          <input type="text" value={tcKimlik} onChange={(e) => setTcKimlik(e.target.value)} maxLength={11} style={inputStyle} />
        </label>
        <label style={labelStyle}>
          Doğum Tarihi
          <input type="date" value={dogumTarihi} onChange={(e) => setDogumTarihi(e.target.value)} style={inputStyle} />
        </label>
        <label style={labelStyle}>
          Cinsiyet
          <select value={cinsiyet} onChange={(e) => setCinsiyet(e.target.value)} style={inputStyle}>
            <option value="">Belirtilmedi</option>
            <option value="kadin">Kadın</option>
            <option value="erkek">Erkek</option>
          </select>
        </label>
        <label style={labelStyle}>
          Telefon Numarası
          <input type="tel" value={telefon} onChange={(e) => setTelefon(e.target.value)} placeholder="05XX XXX XX XX" style={inputStyle} />
        </label>
        <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>
          Adres
          <input type="text" value={adres} onChange={(e) => setAdres(e.target.value)} style={inputStyle} />
        </label>
        <label style={labelStyle}>
          İşe Başlama Tarihi
          <input type="date" value={iseBaslama} onChange={(e) => setIseBaslama(e.target.value)} style={inputStyle} />
        </label>

        {lockedBranchId ? (
          <label style={labelStyle}>
            Şube
            <div style={{ ...inputStyle, display: "flex", alignItems: "center", color: "var(--text)" }}>{lockedBranchName}</div>
          </label>
        ) : (
          <label style={labelStyle}>
            Şube
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)} style={inputStyle}>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      <button
        onClick={createAccount}
        disabled={creating || !email.trim() || !adName.trim() || !soyad.trim()}
        style={{ ...buttonStyle, opacity: creating ? 0.6 : 1 }}
      >
        <UserPlus size={14} strokeWidth={2} />
        {creating ? "Ekleniyor..." : "Personel Ekle"}
      </button>

      {error && <p style={{ color: "#D64545", fontSize: 12.5, marginTop: 10 }}>{error}</p>}
      {warning && <p style={{ color: "#E0A030", fontSize: 12.5, marginTop: 10 }}>{warning}</p>}

      {result && (
        <div style={resultBoxStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <CheckCircle2 size={14} color="var(--success)" strokeWidth={2} />
            <strong style={{ fontSize: 13 }}>Personel eklendi</strong>
          </div>
          <p style={{ fontSize: 12.5, margin: "4px 0" }}>
            E-posta: <span style={{ fontFamily: "var(--font-mono)" }}>{result.email}</span>
          </p>
          <p style={{ fontSize: 12.5, margin: "4px 0" }}>
            Şifre: <span style={{ fontFamily: "var(--font-mono)" }}>{result.password}</span>
          </p>
          <p style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 8 }}>
            Bu bilgileri personele iletin. Listeyi yenileyerek görebilirsiniz.
          </p>
        </div>
      )}
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
  marginTop: 14,
};
const resultBoxStyle: React.CSSProperties = {
  marginTop: 16,
  padding: 14,
  border: "1px solid var(--success)",
  borderRadius: 10,
  background: "var(--bg-elevated)",
};