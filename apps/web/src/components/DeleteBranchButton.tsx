"use client";

import { Archive, Trash2 } from "lucide-react";

export default function DeleteBranchButton({
  branchId,
  branchName,
  hasEmployees,
  action,
}: {
  branchId: string;
  branchName: string;
  hasEmployees: boolean;
  action: (formData: FormData) => void;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        const message = hasEmployees
          ? `"${branchName}" şubesinde personel var. Şube pasife alınacak (kalıcı olarak silinmeyecek). Devam edilsin mi?`
          : `"${branchName}" şubesini kalıcı olarak silmek istediğinize emin misiniz?`;
        if (!confirm(message)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="branch_id" value={branchId} />
      <button type="submit" style={dangerButtonStyle}>
        {hasEmployees ? (
          <Archive size={13} strokeWidth={2} style={{ verticalAlign: -2, marginRight: 5 }} />
        ) : (
          <Trash2 size={13} strokeWidth={2} style={{ verticalAlign: -2, marginRight: 5 }} />
        )}
        {hasEmployees ? "Pasife Al" : "Şubeyi Sil"}
      </button>
    </form>
  );
}

const dangerButtonStyle: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 8,
  border: "1px solid #D64545",
  background: "transparent",
  color: "#D64545",
  fontSize: 12,
  cursor: "pointer",
};