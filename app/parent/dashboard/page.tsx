import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { attendanceRate, getAttempts, getAttendance, getChildren, getStudyStats, isoDaysAgo, pct } from "@/lib/parent/data";

export const dynamic = "force-dynamic";

export default async function ParentDashboard() {
  const viewer = await requireRole(["parent"]);
  const kids = await getChildren(viewer.userId);
  const ids = kids.map((k) => k.id);
  const [attempts, attendance, stats] = await Promise.all([getAttempts(ids), getAttendance(ids, isoDaysAgo(30)), getStudyStats(ids)]);
  const first = (viewer.profile.full_name || "").split(" ")[0];

  return (
    <>
      <h1 className="pp-h1">Hello{first ? `, ${first}` : ""} ✦</h1>
      <p className="pp-sub">Here&apos;s how your {kids.length === 1 ? "child is" : "children are"} doing.</p>
      {kids.length === 0 ? (
        <div className="pp-empty">No students are linked to your account yet. Please contact your institute to link your child&apos;s Student ID.</div>
      ) : (
        <div className="pp-grid">
          {kids.map((k) => {
            const mine = attempts.filter((a) => a.user_id === k.id);
            const avg = mine.length ? Math.round(mine.reduce((s, a) => s + pct(a), 0) / mine.length) : null;
            const att = attendanceRate(attendance.filter((r) => r.student_id === k.id));
            const st = stats[k.id];
            return (
              <article key={k.id} className="pp-card">
                <h2>{k.full_name}</h2>
                <p className="pp-meta" style={{ margin: "4px 0 0" }}>ID {k.student_code}{k.class_name ? ` · ${k.class_name}` : ""}{k.batch ? ` · ${k.batch}` : ""}</p>
                <div className="pp-stats">
                  <div className="pp-stat"><b>{att === null ? "—" : `${att}%`}</b><span>Attendance (30 days)</span></div>
                  <div className="pp-stat"><b>{avg === null ? "—" : `${avg}%`}</b><span>Average test score</span></div>
                  <div className="pp-stat"><b>{mine.length}</b><span>Tests taken</span></div>
                  <div className="pp-stat"><b>{Math.round((st?.minutes7d ?? 0) / 6) / 10}h</b><span>Study time (7 days)</span></div>
                </div>
                {mine[0] && <p className="pp-meta" style={{ margin: "14px 0 0" }}>Latest: <b style={{ color: "#fff" }}>{mine[0].title}</b> — {mine[0].score}/{mine[0].total} ({pct(mine[0])}%) on {new Date(mine[0].completed_at).toLocaleDateString("en-IN")}</p>}
                <div className="pp-links">
                  <Link href={`/parent/performance?student=${k.id}`}>View performance →</Link>
                  <Link href={`/parent/attendance?student=${k.id}`}>View attendance →</Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
