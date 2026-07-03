"use client";

import { useState, type ReactNode } from "react";
import { X, Plus } from "lucide-react";

type Props = {
  triggerLabel: string;
  icon?: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
};

export default function FormModal({ triggerLabel, icon, title, description, children }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)} style={triggerButtonStyle}>
        {icon ?? <Plus size={14} strokeWidth={2} />}
        {triggerLabel}
      </button>

      {open && (
        <div style={overlayStyle} onClick={() => setOpen(false)}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()} onSubmit={() => setOpen(false)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontFamily: "var(--font-display)", fontSize: 15 }}>{title}</strong>
              <button onClick={() => setOpen(false)} style={closeButtonStyle}>
                <X size={16} strokeWidth={2} />
              </button>
            </div>
            {description && (
              <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, marginBottom: 14 }}>{description}</p>
            )}
            {children}
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
  maxHeight: "85vh",
  overflowY: "auto",
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