import { User } from "lucide-react";

type LogEntry = { event_type: string; event_time: string };

const START_HOUR = 7;
const END_HOUR = 23;

export default function StoreEmployeeRow({
  name,
  status,
  logs,
}: {
  name: string;
  status: "working" | "absent" | "leave" | "left";
  logs: LogEntry[];
}) {
  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

  const checkIn = logs.find((l) => l.event_type === "check_in");
  const checkOut = [...logs].reverse().find((l) => l.event_type === "check_out");
  const checkInHour = checkIn ? new Date(checkIn.event_time).getHours() : null;
  const checkOutHour = checkOut ? new Date(checkOut.event_time).getHours() : null;
  const nowHour = new Date().getHours();

  function hourColor(hour: number): string {
    if (checkInHour === null) return "var(--border)";
    if (hour < checkInHour) return "var(--border)";
    const effectiveEnd = checkOutHour ?? nowHour;
    if (hour <= effectiveEnd) return "var(--success)";
    return "var(--border)";
  }

  const statusBadge: Record<string, { label: string; color: string }> = {
    working: { label: "Çalışıyor", color: "var(--success)" },
    absent: { label: "Gelmedi", color: "#D64545" },
    leave: { label: "İzinli", color: "var(--accent)" },
    left: { label: "Çıkış Yaptı", color: "var(--text-secondary)" },
  };
  const badge = statusBadge[status];

  return (
    <div style={rowStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 180 }}>
        <div style={avatarStyle}>
          <User size={13} color="var(--accent)" strokeWidth={1.75} />
        </div>
        <span style={{ fontSize: 13, fontFamily: "var(--font-display)" }}>{name}</span>
      </div>

      <div style={{ display: "flex", gap: 2, flex: 1, overflowX: "auto" }}>
        {hours.map((h) => (
          <div key={h} style={{ ...hourBlockStyle, background: hourColor(h) }} title={`${h}:00`} />
        ))}
      </div>

      <span style={{ ...badgeStyle, background: `color-mix(in srgb, ${badge.color} 15%, transparent)`, color: badge.color }}>
        {badge.label}
      </span>
    </div>
  );
}

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  padding: "10px 14px",
  border: "1px solid var(--border)",
  borderRadius: 10,
  background: "var(--bg-elevated)",
};
const avatarStyle: React.CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 8,
  background: "color-mix(in srgb, var(--accent) 15%, transparent)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};
const hourBlockStyle: React.CSSProperties = {
  width: 14,
  height: 20,
  borderRadius: 3,
  flexShrink: 0,
};
const badgeStyle: React.CSSProperties = {
  fontSize: 11,
  padding: "3px 10px",
  borderRadius: 20,
  fontFamily: "var(--font-mono)",
  whiteSpace: "nowrap",
};