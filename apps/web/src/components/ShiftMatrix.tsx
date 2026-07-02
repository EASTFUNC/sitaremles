"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";

function formatDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function getMonday(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

const dayNames = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

export default function ShiftMatrix() {
  const supabase = createClient();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [branchId, setBranchId] = useState<string>("");
  const [weekStart, setWeekStart] = useState<Date>(getMonday(new Date()));
  const [employees, setEmployees] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCell, setSelectedCell] = useState<{ userId: string; date: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  useEffect(() => {
    init();
  }, []);

  useEffect(() => {
    if (branchId) loadGrid();
  }, [branchId, weekStart]);

  async function init() {
    const { data: userData } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", userData.user?.id)
      .single();
    setCompanyId(profile?.company_id);

    const { data: branchesData } = await supabase
      .from("branches")
      .select("id, name")
      .eq("company_id", profile?.company_id);
    setBranches(branchesData ?? []);
    if (branchesData && branchesData.length > 0) setBranchId(branchesData[0].id);

    const { data: templatesData } = await supabase
      .from("shift_templates")
      .select("id, name, start_time, end_time")
      .eq("company_id", profile?.company_id)
      .order("start_time");
    setTemplates(templatesData ?? []);
  }

  async function loadGrid() {
    setLoading(true);
    const { data: employeesData } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("branch_id", branchId)
      .order("full_name");
    setEmployees(employeesData ?? []);

    const start = formatDate(weekDates[0]);
    const end = formatDate(weekDates[6]);
    const { data: assignmentsData } = await supabase
      .from("shift_assignments")
      .select("id, user_id, work_date, shift_template_id, is_published, shift_templates(name, start_time, end_time)")
      .eq("branch_id", branchId)
      .gte("work_date", start)
      .lte("work_date", end);
    setAssignments(assignmentsData ?? []);
    setLoading(false);
  }

  function getAssignment(userId: string, date: string) {
    return assignments.find((a) => a.user_id === userId && a.work_date === date);
  }

  async function assignShift(templateId: string) {
    if (!selectedCell || !companyId) return;
    setSaving(true);

    const { data: conflicts } = await supabase.rpc("check_shift_conflicts", {
      p_user_id: selectedCell.userId,
      p_work_date: selectedCell.date,
      p_shift_template_id: templateId,
    });

    const blocking = (conflicts ?? []).find((c: any) => c.severity === "blocking");
    if (blocking) {
      alert("Bu personel için bu tarihte zaten bir vardiya var. Önce mevcut vardiyayı kaldırın.");
      setSaving(false);
      return;
    }

    const warning = (conflicts ?? []).find((c: any) => c.severity === "warning");
    if (warning) {
      const ok = confirm(`Uyarı: dinlenme süresi ${warning.rest_hours?.toFixed(1)} saat, 11 saatten az. Yine de devam edilsin mi?`);
      if (!ok) {
        setSaving(false);
        return;
      }
    }

    const existing = getAssignment(selectedCell.userId, selectedCell.date);
    if (existing) {
      await supabase.from("shift_assignments").update({ shift_template_id: templateId }).eq("id", existing.id);
    } else {
      await supabase.from("shift_assignments").insert({
        company_id: companyId,
        branch_id: branchId,
        user_id: selectedCell.userId,
        work_date: selectedCell.date,
        shift_template_id: templateId,
        source: "manual",
        is_published: false,
      });
    }

    setSelectedCell(null);
    setSaving(false);
    loadGrid();
  }

  async function removeShift() {
    if (!selectedCell) return;
    const existing = getAssignment(selectedCell.userId, selectedCell.date);
    if (existing) {
      await supabase.from("shift_assignments").delete().eq("id", existing.id);
    }
    setSelectedCell(null);
    loadGrid();
  }

  async function publishWeek() {
    const start = formatDate(weekDates[0]);
    const end = formatDate(weekDates[6]);
    const ok = confirm("Bu haftanın tüm taslak vardiyaları yayınlanacak ve personel tarafından görülebilir olacak. Devam edilsin mi?");
    if (!ok) return;
    await supabase
      .from("shift_assignments")
      .update({ is_published: true })
      .eq("branch_id", branchId)
      .gte("work_date", start)
      .lte("work_date", end);
    loadGrid();
  }

  function changeWeek(offsetDays: number) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + offsetDays);
    setWeekStart(d);
  }

  const draftCount = assignments.filter((a) => !a.is_published).length;

  return (
    <div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <select value={branchId} onChange={(e) => setBranchId(e.target.value)} style={selectStyle}>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>

        <button onClick={() => changeWeek(-7)} style={navButtonStyle}>← Önceki Hafta</button>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>
          {formatDate(weekDates[0])} — {formatDate(weekDates[6])}
        </span>
        <button onClick={() => changeWeek(7)} style={navButtonStyle}>Sonraki Hafta →</button>

        {draftCount > 0 && (
          <button onClick={publishWeek} style={publishButtonStyle}>
            🚀 Yayınla ({draftCount} taslak)
          </button>
        )}
      </div>

      {loading ? (
        <p style={{ color: "var(--text-secondary)" }}>Yükleniyor...</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th style={headerCellStyle}>Personel</th>
                {weekDates.map((d) => (
                  <th key={formatDate(d)} style={headerCellStyle}>
                    {dayNames[d.getDay() === 0 ? 6 : d.getDay() - 1]}
                    <div style={{ fontSize: 11, fontWeight: 400, color: "var(--text-secondary)" }}>
                      {d.getDate()}.{d.getMonth() + 1}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id}>
                  <td style={{ ...cellStyle, fontWeight: 500, textAlign: "left" }}>{emp.full_name}</td>
                  {weekDates.map((d) => {
                    const dateStr = formatDate(d);
                    const assignment = getAssignment(emp.id, dateStr);
                    const isOff = assignment?.shift_templates?.name?.includes("OFF");
                    const isSelected = selectedCell?.userId === emp.id && selectedCell?.date === dateStr;
                    return (
                      <td
                        key={dateStr}
                        onClick={() => setSelectedCell({ userId: emp.id, date: dateStr })}
                        style={{
                          ...cellStyle,
                          cursor: "pointer",
                          background: isSelected
                            ? "color-mix(in srgb, var(--accent) 20%, transparent)"
                            : isOff
                            ? "color-mix(in srgb, var(--text-secondary) 15%, transparent)"
                            : assignment
                            ? assignment.is_published
                              ? "color-mix(in srgb, var(--success) 15%, transparent)"
                              : "color-mix(in srgb, var(--accent) 10%, transparent)"
                            : "transparent",
                        }}
                      >
                        {assignment ? (
                          isOff ? (
                            "OFF"
                          ) : (
                            <>
                              {assignment.shift_templates?.start_time?.slice(0, 5)}-{assignment.shift_templates?.end_time?.slice(0, 5)}
                              {!assignment.is_published && <div style={{ fontSize: 9, color: "var(--accent)" }}>taslak</div>}
                            </>
                          )
                        ) : (
                          <span style={{ color: "var(--text-secondary)" }}>+</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedCell && (
        <div style={{ marginTop: 16, padding: 16, border: "1px solid var(--accent)", borderRadius: 10, background: "var(--bg-elevated)" }}>
          <strong style={{ fontSize: 13 }}>
            {employees.find((e) => e.id === selectedCell.userId)?.full_name} — {selectedCell.date}
          </strong>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            {templates.map((t) => (
              <button key={t.id} disabled={saving} onClick={() => assignShift(t.id)} style={templateButtonStyle}>
                {t.name}
              </button>
            ))}
            <button onClick={removeShift} style={{ ...templateButtonStyle, borderColor: "#D64545", color: "#D64545" }}>
              Kaldır
            </button>
            <button onClick={() => setSelectedCell(null)} style={templateButtonStyle}>
              İptal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const selectStyle: React.CSSProperties = { padding: 8, borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" };
const navButtonStyle: React.CSSProperties = { padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text)", cursor: "pointer", fontSize: 12 };
const publishButtonStyle: React.CSSProperties = { padding: "8px 16px", borderRadius: 8, border: "none", background: "var(--success)", color: "white", cursor: "pointer", fontWeight: 500, fontSize: 13 };
const headerCellStyle: React.CSSProperties = { padding: 8, borderBottom: "2px solid var(--border)", fontSize: 12, textAlign: "center" };
const cellStyle: React.CSSProperties = { padding: 8, border: "1px solid var(--border)", fontSize: 11, textAlign: "center", minWidth: 70 };
const templateButtonStyle: React.CSSProperties = { padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", cursor: "pointer", fontSize: 12 };