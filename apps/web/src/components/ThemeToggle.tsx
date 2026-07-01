"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme") as "light" | "dark";
    setTheme(current ?? "light");
  }, []);

  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("sitaremles-theme", next);
  }

  return (
    <button
      onClick={toggleTheme}
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "6px 12px",
        color: "var(--text)",
        fontSize: 14,
      }}
    >
      {theme === "light" ? "🌙 Koyu" : "☀️ Açık"}
    </button>
  );
}