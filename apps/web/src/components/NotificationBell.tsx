"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  async function load() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { data } = await supabase
      .from("notifications")
      .select("id, title, body, is_read, created_at")
      .eq("user_id", userData.user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setNotifications(data ?? []);
  }

  async function markAsRead(id: string) {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    load();
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: "transparent",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "6px 10px",
          color: "var(--text)",
          fontSize: 14,
          position: "relative",
          cursor: "pointer",
        }}
      >
        🔔
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              background: "#D64545",
              color: "white",
              borderRadius: 10,
              fontSize: 10,
              padding: "1px 5px",
              fontFamily: "var(--font-mono)",
            }}
          >
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 40,
            width: 320,
            maxHeight: 400,
            overflowY: "auto",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            zIndex: 50,
            boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
          }}
        >
          {notifications.length === 0 && (
            <p style={{ padding: 16, fontSize: 13, color: "var(--text-secondary)" }}>Bildirim yok.</p>
          )}
          {notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => !n.is_read && markAsRead(n.id)}
              style={{
                padding: 12,
                borderBottom: "1px solid var(--border)",
                background: n.is_read ? "transparent" : "color-mix(in srgb, var(--accent) 8%, transparent)",
                cursor: n.is_read ? "default" : "pointer",
              }}
            >
              <strong style={{ fontSize: 13 }}>{n.title}</strong>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "4px 0 0" }}>{n.body}</p>
              <span style={{ fontSize: 10, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                {new Date(n.created_at).toLocaleString("tr-TR")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}