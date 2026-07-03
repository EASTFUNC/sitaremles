"use client";

import { useState, type ReactNode } from "react";
import { Info, X } from "lucide-react";

export default function InfoPopover({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button onClick={() => setOpen(!open)} style={buttonStyle}>
        <Info size={13} strokeWidth={2} />
      </button>

      {open && (
        <>
          <div style={overlayStyle} onClick={() => setOpen(false)} />
          <div style={popoverStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <strong style={{ fontSize: 13, fontFamily: "var(--font-display)" }}>{title}</strong>
              <button onClick={() => setOpen(false)} style={closeStyle}>
                <X size={14} strokeWidth={2} />
              </button>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.6 }}>{children}</div>
          </div>
        </>
      )}
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: "50%",
  border: "1px solid var(--border)",
  background: "var(--bg-elevated)",
  color: "var(--text-secondary)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 40,
};
const popoverStyle: React.CSSProperties = {
  position: "absolute",
  top: 32,
  left: 0,
  width: 280,
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: 16,
  boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
  zIndex: 50,
};
const closeStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--text-secondary)",
  cursor: "pointer",
  padding: 2,
};