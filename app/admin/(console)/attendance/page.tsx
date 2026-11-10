"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/AdminShell";
import { api, one } from "@/components/admin/api";

type Student = { id: string; student_code: string; class_name: string | null; batch: string | null; profiles: { full_name: string | null } | { full_name: string | null }[] };
type Mark = { student_id: string; status: string; remarks: string | null };
const STATUSES = ["present", "absent", "late", "excused"] as const;
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

export default function AttendanceAdminPage() {
  const [date, setDate] = useState(today());
  const [session, setSession] = useState("General");
  const [students, setStudents] = useState<Student[]>([]);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [batch, setBatch] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setMsg("");
    const r = await api<{ students: Student[]; marks: Mark[] }>(`/api/admin/attendance?date=${date}&session=${encodeURIComponent(session)}`);
    if (!r.ok) { setMsg(r.error); return; }
    setStudents(r.students);
    setMarks(Object.fromEntries(r.marks.map((m) => [m.student_id, m.status])));
  }, [date, session]);
  useEffect(() => { void load(); }, [load]);

  const batches = useMemo(() => [...new Set(students.map((s) => s.batch).filter(Boolean))] as string[], [students]);
  const shown = students.filter((s) => !batch || s.batch === batch);

  async function save() {
    setBusy(true);
    const records = shown.filter((s) => marks[s.id]).map((s) => ({ student_id: s.id, status: marks[s.id] }));
    const r = await api<{ saved: number }>("/api/admin/attendance", "POST", { date, session, records });
    setBusy(false);
    setMsg(r.ok ? `Saved attendance for ${r.saved} students.` : r.error);
  }

  return (
    <AdminShell title="Attendance" subtitle="Mark attendance by date. Parents see their child's record in the parent portal.">
      <div className="ad-card ad-form">
        <div><label htmlFor="d">Date</label><input id="d" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} /></div>
        <div><label htmlFor="s">Session</label><input id="s" value={session} onChange={(e) => setSession(e.target.value || "General")} /></div>
        <div><label htmlFor="b">Batch</label><select id="b" value={batch} onChange={(e) => setBatch(e.target.value)}><option value="">All batches</option>{batches.map((b) => <option key={b}>{b}</option>)}</select></div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
          <button className="ad-ghost" type="button" onClick={() => setMarks((m) => ({ ...m, ...Object.fromEntries(shown.map((s) => [s.id, "present"])) }))}>Mark all present</button>
        </div>
      </div>
      {msg && <p className="ad-msg" role="status">{msg}</p>}
      <div className="ad-card ad-scroll">
        <table className="ad-table">
          <thead><tr><th>Student</th><th>ID</th><th>Batch</th><th>Status</th></tr></thead>
          <tbody>
            {shown.map((s) => (
              <tr key={s.id}>
                <td>{one(s.profiles)?.full_name || "—"}</td>
                <td>{s.student_code}</td>
                <td className="ad-meta">{s.batch || s.class_name || "—"}</td>
                <td>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }} role="radiogroup" aria-label={`Attendance for ${one(s.profiles)?.full_name ?? s.student_code}`}>
                    {STATUSES.map((st) => (
                      <button key={st} type="button" role="radio" aria-checked={marks[s.id] === st}
                        className="ad-ghost" onClick={() => setMarks((m) => ({ ...m, [s.id]: st }))}
                        style={marks[s.id] === st ? { background: st === "present" ? "#1f6f4a" : st === "absent" ? "#7a2433" : "#5a4a1c", color: "#fff", borderColor: "transparent" } : undefined}>
                        {st[0].toUpperCase() + st.slice(1)}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={4} className="ad-meta">No active students.</td></tr>}
          </tbody>
        </table>
      </div>
      <div><button className="ad-btn" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save attendance"}</button></div>
    </AdminShell>
  );
}
