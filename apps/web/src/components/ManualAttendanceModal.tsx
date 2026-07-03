"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

type Props = {
  employees: { id: string; full_name: string }[];
  branches: { id: string; name: string }[];
  action: (formData: FormData) => void;
};

export default function ManualAttendanceModal({ employees, branches, action }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)} style={triggerButtonStyle}>
        <Plus size={14} strokeWidth={2} />
        Manuel Ekle
      </button>

      {open && (
        <div style={overlayStyle} onClick={() => setOpen(false)}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <strong style={{ fontFamily: "var(--font-display)", fontSize: 15 }}>Manuel Giriş-Çıkış Ekle</strong>
              <button onClick={() => setOpen(false)} style={closeButtonStyle}>
                <X size={16} strokeWidth={2} />
              </button>
            </div>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, marginBottom: 14 }}>
              QR okutulamadığında kullanın. Kayıt şeffaflık için otomatik işaretlenir.
            </p>
            <form
              action={(formData) => {
                action(formData);
                setOpen(false);
              }}
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
            >
              <label style={labelStyle}>
                Personel
                <select name="user_id" required style={inputStyle}>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                </select>
              </label>
              <label style={labelStyle}>
                Şube
                <select name="branch_id" required style={inputStyle}>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </label>
              <label style={labelStyle}>
                Tür
                <select name="event_type" required style={inputStyle}>
                  <option value="check_in">Giriş</option>
                  <option value="check_out">Çıkış</option>
                </select>
              </label>
              <label style={labelStyle}>
                Tarih
                <input type="date" name="date" required style={inputStyle} />
              </label>
              <label style={labelStyle}>
                Saat
                <input type="time" name="time" required style={inputStyle} />
              </label>
              <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>
                Not (opsiyonel)
                <input type="text" name="note" placeholder="Örn. telefon şarjı bitti" style={inputStyle} />
              </label>
              <div style={{ gridColumn: "1 / -1", marginTop: 6 }}>
                <button type="submit" style={saveButtonStyle}>Kaydı Ekle</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

const triggerButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "7px 14px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg-elevated)",
  color: "var(--text)",
  fontSize: 12.5,
  cursor: "pointer",
};
const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 100,
};
const modalStyle: React.CSSProperties = {
  width: 460,
  maxWidth: "90vw",
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  borderRadius: 16,
  padding: 22,
  boxShadow: "0 12px 32px rgba(0,0,0,0.3)",
};
const closeButtonStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--text-secondary)",
  cursor: "pointer",
  padding: 4,
};
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
const saveButtonStyle: React.CSSProperties = {
  padding: "9px 22px",
  background: "var(--accent)",
  color: "var(--accent-contrast)",
  border: "none",
  borderRadius: 8,
  fontWeight: 500,
  fontSize: 13,
  cursor: "pointer",
};