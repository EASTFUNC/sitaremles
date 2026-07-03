"use client";

import { useRef, useState } from "react";
import { Upload, Check, FileUp, Eye, Trash2 } from "lucide-react";

type Props = {
  documentTypeId: string;
  name: string;
  isRequired: boolean;
  uploadedAt: string | null;
  viewUrl: string | null;
  docId: string | null;
  filePath: string | null;
  isAdmin: boolean;
  action: (formData: FormData) => void;
  onDelete: (formData: FormData) => void;
};

export default function DocumentUploadRow({
  documentTypeId,
  name,
  isRequired,
  uploadedAt,
  viewUrl,
  docId,
  filePath,
  isAdmin,
  action,
  onDelete,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <div style={rowStyle}>
      <div>
        <strong style={{ fontSize: 13 }}>{name}</strong>
        {isRequired && <span style={{ fontSize: 10.5, color: "#D64545", marginLeft: 6, fontFamily: "var(--font-mono)" }}>ZORUNLU</span>}
        <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
          {uploadedAt ? (
            <>
              <Check size={11} color="var(--success)" strokeWidth={2} />
              Yüklendi: {new Date(uploadedAt).toLocaleDateString("tr-TR")}
            </>
          ) : (
            "Henüz yüklenmedi"
          )}
        </div>
      </div>

      {isAdmin && (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {viewUrl && (
            <a href={viewUrl} target="_blank" rel="noopener noreferrer" style={iconLinkStyle}>
              <Eye size={13} strokeWidth={2} />
            </a>
          )}

          {docId && filePath && (
            <form
              action={onDelete}
              onSubmit={(e) => {
                if (!confirm(`"${name}" belgesini silmek istediğinize emin misiniz?`)) {
                  e.preventDefault();
                }
              }}
            >
              <input type="hidden" name="doc_id" value={docId} />
              <input type="hidden" name="file_path" value={filePath} />
              <button type="submit" style={deleteButtonStyle}>
                <Trash2 size={13} strokeWidth={2} />
              </button>
            </form>
          )}

          <form
            action={(formData) => {
              action(formData);
              setFileName(null);
            }}
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            <input type="hidden" name="document_type_id" value={documentTypeId} />
            <input
              ref={inputRef}
              type="file"
              name="file"
              style={{ display: "none" }}
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            />
            <button type="button" onClick={() => inputRef.current?.click()} style={pickButtonStyle}>
              <FileUp size={12} strokeWidth={2} />
              {fileName ? fileName.slice(0, 14) + (fileName.length > 14 ? "…" : "") : uploadedAt ? "Değiştir" : "Dosya Seç"}
            </button>
            <button type="submit" disabled={!fileName} style={{ ...uploadButtonStyle, opacity: fileName ? 1 : 0.4 }}>
              <Upload size={13} strokeWidth={2} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

const rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "12px 16px",
  border: "1px solid var(--border)",
  borderRadius: 12,
  background: "var(--bg-elevated)",
};
const pickButtonStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 12px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg)",
  color: "var(--text-secondary)",
  fontSize: 11.5,
  cursor: "pointer",
  whiteSpace: "nowrap",
};
const uploadButtonStyle: React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 8,
  border: "1px solid var(--accent)",
  background: "transparent",
  color: "var(--accent)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};
const iconLinkStyle: React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 8,
  border: "1px solid var(--border)",
  color: "var(--text)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  textDecoration: "none",
};
const deleteButtonStyle: React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 8,
  border: "1px solid #D64545",
  background: "transparent",
  color: "#D64545",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};