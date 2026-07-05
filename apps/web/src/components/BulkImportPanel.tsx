"use client";

import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase-browser";
import { Upload, FileSpreadsheet, CheckCircle2, XCircle } from "lucide-react";

type ImportRow = {
  full_name: string;
  email: string;
  status: "pending" | "success" | "error";
  message?: string;
  tempPassword?: string;
};

export default function BulkImportPanel({ branches }: { branches: { id: string; name: string }[] }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParseError(null);
    setRows([]);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data: any[] = XLSX.utils.sheet_to_json(sheet);

      const parsed: ImportRow[] = data
        .map((r) => ({
          full_name: (r["Ad Soyad"] ?? r["ad soyad"] ?? "").toString().trim(),
          email: (r["E-posta"] ?? r["e-posta"] ?? r["Email"] ?? "").toString().trim(),
          status: "pending" as const,
        }))
        .filter((r) => r.full_name && r.email);

      if (parsed.length === 0) {
        setParseError("Dosyada 'Ad Soyad' ve 'E-posta' sütunlarını bulamadım. Lütfen sütun başlıklarını kontrol edin.");
        return;
      }
      setRows(parsed);
    } catch (err: any) {
      setParseError("Dosya okunamadı: " + err.message);
    }
  }

  async function startImport() {
    setImporting(true);
    const supabase = createClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-employee`, {
          method: "POST",
          headers: {
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: row.email,
            full_name: row.full_name,
            branch_id: branchId,
            role_code: "employee",
          }),
        });
        const data = await res.json();
        setRows((prev) => {
          const next = [...prev];
          next[i] = data.success
            ? { ...row, status: "success", tempPassword: data.temp_password }
            : { ...row, status: "error", message: data.error };
          return next;
        });
      } catch (err: any) {
        setRows((prev) => {
          const next = [...prev];
          next[i] = { ...row, status: "error", message: err.message };
          return next;
        });
      }
    }
    setImporting(false);
  }

  const doneCount = rows.filter((r) => r.status !== "pending").length;

  return (
    <div>
      <label style={labelStyle}>
        Şube (hepsi bu şubeye atanacak)
        <select value={branchId} onChange={(e) => setBranchId(e.target.value)} style={inputStyle}>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </label>

      <div style={{ marginTop: 12 }}>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={handleFileChange} />
        <button type="button" onClick={() => fileInputRef.current?.click()} style={pickButtonStyle}>
          <FileSpreadsheet size={14} strokeWidth={2} />
          {fileName ?? "Excel Dosyası Seç"}
        </button>
      </div>

      {parseError && <p style={{ color: "#D64545", fontSize: 12.5, marginTop: 10 }}>{parseError}</p>}

      {rows.length > 0 && (
        <>
          <p style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 14 }}>
            {rows.length} personel bulundu. {importing || doneCount > 0 ? `${doneCount}/${rows.length} tamamlandı.` : ""}
          </p>

          {!importing && doneCount === 0 && (
            <button type="button" onClick={startImport} style={saveButtonStyle}>
              <Upload size={14} strokeWidth={2} />
              İçe Aktarmayı Başlat
            </button>
          )}

          <div style={{ maxHeight: 320, overflowY: "auto", marginTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
            {rows.map((r, i) => (
              <div key={i} style={rowStyle}>
                <div>
                  <strong style={{ fontSize: 12.5 }}>{r.full_name}</strong>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>{r.email}</div>
                  {r.status === "success" && r.tempPassword && (
                    <div style={{ fontSize: 10.5, color: "var(--success)", fontFamily: "var(--font-mono)", marginTop: 2 }}>
                      Geçici şifre: {r.tempPassword}
                    </div>
                  )}
                  {r.status === "error" && (
                    <div style={{ fontSize: 10.5, color: "#D64545", marginTop: 2 }}>{r.message}</div>
                  )}
                </div>
                {r.status === "success" && <CheckCircle2 size={16} color="var(--success)" strokeWidth={2} />}
                {r.status === "error" && <XCircle size={16} color="#D64545" strokeWidth={2} />}
                {r.status === "pending" && <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>Bekliyor</span>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = { fontSize: 12.5, color: "var(--text-secondary)", display: "block" };
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
const pickButtonStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "9px 16px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg-elevated)",
  color: "var(--text)",
  fontSize: 12.5,
  cursor: "pointer",
};
const saveButtonStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "9px 20px",
  borderRadius: 8,
  border: "none",
  background: "var(--accent)",
  color: "var(--accent-contrast)",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
  marginTop: 12,
};
const rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "8px 12px",
  border: "1px solid var(--border)",
  borderRadius: 8,
  background: "var(--bg)",
};