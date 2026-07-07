"use client";

import { useRouter } from "next/navigation";

export default function BranchSelector({
  branches,
  currentBranchId,
}: {
  branches: { id: string; name: string }[];
  currentBranchId: string;
}) {
  const router = useRouter();

  return (
    <select
      value={currentBranchId}
      onChange={(e) => router.push(`/dashboard/store?branch_id=${e.target.value}`)}
      style={selectStyle}
    >
      {branches.map((b) => (
        <option key={b.id} value={b.id}>{b.name}</option>
      ))}
    </select>
  );
}

const selectStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg-elevated)",
  color: "var(--text)",
  fontSize: 13,
};