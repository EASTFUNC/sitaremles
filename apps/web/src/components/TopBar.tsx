"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import ThemeToggle from "./ThemeToggle";
import { createClient } from "@/lib/supabase-browser";
import NotificationBell from "./NotificationBell";
import { ShieldCheck } from "lucide-react";

export default function TopBar({ userName, isSuperAdmin }: { userName: string; isSuperAdmin?: boolean }) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header
      style={{
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "center",
        gap: 16,
        padding: "16px 32px",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {isSuperAdmin && (
        <Link
          href="/super-admin"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            borderRadius: 8,
            border: "1px solid var(--accent)",
            color: "var(--accent)",
            fontSize: 12.5,
            textDecoration: "none",
          }}
        >
          <ShieldCheck size={13} strokeWidth={1.75} />
          EASTFUNC Kontrol Merkezi
        </Link>
      )}
      <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>{userName}</span>
      <NotificationBell />
      <button
        onClick={handleSignOut}
        style={{
          background: "transparent",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "6px 14px",
          color: "var(--text)",
          fontSize: 14,
        }}
      >
        Çıkış Yap
      </button>
    </header>
  );
}