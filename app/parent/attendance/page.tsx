import { requireRole } from "@/lib/auth/guard";
import { attendanceRate, getAttendance, getChildren, isoDaysAgo, pickChild } from "@/lib/parent/data";
import ChildTabs from "../ChildTabs";

export const dynamic = "force-dynamic";

export default async function ParentAttendance({ searchParams }: { searchParams: Promise<{ student?: string }> }) {
  const viewer = await requireRole(["parent"]);
  const { student } = await searchParams;
  const kids = await getChildren(viewer.userId);
  const child = pickChild(kids, student);
  if (!child) return <><h1 className="pp-h1">Attendance</h1><div className="pp-empty">No linked students yet.</div></>;

  const rows = await getAttendance([child.id], isoDaysAgo(90));
  const last30 = rows.filter((r) => r.attendance_date >= isoDaysAgo(30));
  const counts = (list: typeof rows) => ({
    present: list.filter((r) => r.status === "present").length,
    absent: list.filter((r) => r.status === "absent").length,
    late: list.filter((r) => r.status === "late").length,
    excused: list.filter((r) => r.status === "excused").length,
  });
  const c30 = counts(last30);
  const byDate = new Map<string, string>();
  rows.forEach((r) => { if (!byDate.has(r.attendance_date) || r.status === "absent") byDate.set(r.attendance_date, r.status); });
  const days = Array.from({ length: 28 }, (_, i) => isoDaysAgo(27 - i));

  return (
    <>
      <h1 className="pp-h1">Attendance</h1>
      <p className="pp-sub">{child.full_name} · ID {child.student_code}</p>
      <ChildTabs items={kids} current={child.id} base="/parent/attendance" />
      <div className="pp-grid" style={{ marginBottom: 16 }}>
        <div className="pp-card">
          <h3>Last 30 days</h3>
          <div className="pp-stats" style={{ marginTop: 0 }}>
            <div className="pp-stat"><b>{attendanceRate(last30) ?? "—"}{last30.length ? "%" : ""}</b><span>Attendance rate</span></div>
            <div className="pp-stat"><b>{c30.present}</b><span>Present</span></div>
            <div className="pp-stat"><b>{c30.absent}</b><span>Absent</span></div>
            <div className="pp-stat"><b>{c30.late}</b><span>Late</span></div>
          </div>
        </div>
        <div className="pp-card">
          <h3>Last 4 weeks</h3>
          <div className="pp-cal">
            {days.map((d) => (
              <div key={d} className={`pp-day ${byDate.get(d) ?? ""}`} title={`${d}: ${byDate.get(d) ?? "no record"}`}>{Number(d.slice(8))}</div>
            ))}
          </div>
        </div>
      </div>
      <div className="pp-card">
        <h3>Records (90 days)</h3>
        {rows.length === 0 ? <div className="pp-empty">No attendance has been recorded yet.</div> : (
          <div className="pp-scroll">
            <table className="pp-table">
              <thead><tr><th>Date</th><th>Session</th><th>Status</th><th>Remarks</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.attendance_date}-${r.session_label}`}>
                    <td>{new Date(`${r.attendance_date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</td>
                    <td>{r.session_label}</td>
                    <td><span className={`pp-chip ${r.status}`}>{r.status}</span></td>
                    <td className="pp-meta">{r.remarks || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
