"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const managerRoles = ["company_admin", "store_manager", "regional_manager"];

const navItems = [
  { href: "/dashboard", label: "Genel Bakış", icon: "🏠", roles: null },
  { href: "/dashboard/employees", label: "Personel Listesi", icon: "👤", roles: managerRoles },
  { href: "/dashboard/shifts", label: "Vardiya Planlama", icon: "📅", roles: managerRoles },
  { href: "/dashboard/attendance", label: "Giriş-Çıkış Raporu", icon: "📍", roles: managerRoles },
  { href: "/dashboard/branches/qr", label: "Şube QR Kodları", icon: "🔗", roles: managerRoles },
  { href: "/dashboard/leave-approvals", label: "İzin Onayları", icon: "🗓️", roles: managerRoles },
  { href: "/dashboard/performance", label: "Prim / Performans", icon: "🎯", roles: managerRoles },
  { href: "/dashboard/tasks", label: "Görev / Denetim", icon: "✅", roles: managerRoles },
  { href: "/dashboard/payroll", label: "Bordro / Puantaj", icon: "🧾", roles: managerRoles },
  { href: "/dashboard/ai-usage", label: "AI Kullanım", icon: "🤖", roles: ["company_admin"] },
  { href: "/dashboard/settings", label: "Şirket Ayarları", icon: "⚙️", roles: ["company_admin"] },
  { href: "/dashboard/super-admin", label: "Süper Admin", icon: "🛡️", roles: "super_admin_only" },
];

export default function Sidebar({ roles, isSuperAdmin }: { roles: string[]; isSuperAdmin: boolean }) {
  const pathname = usePathname();

  const visibleItems = navItems.filter((item) => {
    if (item.roles === null) return true;
    if (item.roles === "super_admin_only") return isSuperAdmin;
    return item.roles.some((r) => roles.includes(r));
  });

  return (
    <aside
      style={{
        width: 240,
        flexShrink: 0,
        borderRight: "1px solid var(--border)",
        padding: "24px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div style={{ padding: "0 12px 20px", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18 }}>
        SITAREMLES
      </div>
      {visibleItems.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "9px 12px",
              borderRadius: 8,
              textDecoration: "none",
              fontSize: 14,
              color: active ? "var(--accent-contrast)" : "var(--text)",
              background: active ? "var(--accent)" : "transparent",
              fontWeight: active ? 500 : 400,
            }}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </aside>
  );
}