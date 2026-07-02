"use client";

import { useRouter } from "next/navigation";
import ThemeToggle from "./ThemeToggle";
import { createClient } from "@/lib/supabase-browser";
import NotificationBell from "./NotificationBell";

export default function TopBar({ userName }: { userName: string }) {
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