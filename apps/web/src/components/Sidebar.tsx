"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Store,
  Clock,
  CalendarDays,
  MapPin,
  QrCode,
  Users,
  CalendarClock,
  Target,
  ClipboardCheck,
  Receipt,
  Bot,
  Flag,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

const managerRoles = ["company_admin", "store_manager", "regional_manager"];

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: string[] | null | "super_admin_only";
};

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Genel Bakış", icon: LayoutDashboard, roles: null },
  { href: "/dashboard/store", label: "Mağaza Paneli", icon: Store, roles: managerRoles },
  { href: "/dashboard/shifts", label: "Vardiya Planlama", icon: CalendarDays, roles: managerRoles },
  { href: "/dashboard/attendance", label: "Giriş-Çıkış Raporu", icon: MapPin, roles: managerRoles },
  { href: "/dashboard/branches/qr", label: "Şube QR Kodları", icon: QrCode, roles: managerRoles },
  { href: "/dashboard/employees", label: "Personel Listesi", icon: Users, roles: managerRoles },
  { href: "/dashboard/leave-approvals", label: "İzin Onayları", icon: CalendarClock, roles: managerRoles },
  { href: "/dashboard/performance", label: "Prim / Performans", icon: Target, roles: managerRoles },
  { href: "/dashboard/tasks", label: "Görev / Denetim", icon: ClipboardCheck, roles: managerRoles },
  { href: "/dashboard/payroll", label: "Bordro / Puantaj", icon: Receipt, roles: managerRoles },
  { href: "/dashboard/ai-usage", label: "AI Kullanım", icon: Bot, roles: ["company_admin"] },
  { href: "/dashboard/holidays", label: "Resmi Tatiller", icon: Flag, roles: managerRoles },
  { href: "/dashboard/shift-templates", label: "Vardiya Türleri", icon: Clock, roles: ["company_admin"] },
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
      <div style={{ padding: "0 12px 20px", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, letterSpacing: "-0.02em" }}>
        SITAREMLES
      </div>
      <div style={{ flex: 1 }}>
        {visibleItems.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
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
                fontSize: 13.5,
                color: active ? "var(--accent-contrast)" : "var(--text)",
                background: active ? "var(--accent)" : "transparent",
                fontWeight: active ? 500 : 400,
                marginBottom: 2,
              }}
            >
              <Icon size={16} strokeWidth={1.75} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
      <div
        style={{
          padding: "12px 12px 4px",
          borderTop: "1px solid var(--border)",
          marginTop: 12,
          fontSize: 10.5,
          color: "var(--text-secondary)",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          fontFamily: "var(--font-mono)",
        }}
      >
        Powered by EASTFUNC
      </div>
    </aside>
  );
}