import { requireRole } from "@/lib/auth/guard";
import { getAttempts, getChildren, getStudyStats, pct, pickChild } from "@/lib/parent/data";
import ChildTabs from "../ChildTabs";

export const dynamic = "force-dynamic";

export default async function ParentPerformance({ searchParams }: { searchParams: Promise<{ student?: string }> }) {
  const viewer = await requireRole(["parent"]);
  const { student } = await searchParams;
  const kids = await getChildren(viewer.userId);
  const child = pickChild(kids, student);
  if (!child) return <><h1 className="pp-h1">Performance</h1><div className="pp-empty">No linked students yet.</div></>;

  const [attempts, stats] = await Promise.all([getAttempts([child.id]), getStudyStats([child.id])]);
  const avg = attempts.length ? Math.round(attempts.reduce((s, a) => s + pct(a), 0) / attempts.length) : null;
  const best = attempts.reduce((m, a) => Math.max(m, pct(a)), 0);
  const recent = attempts.slice(0, 5);
  const recentAvg = recent.length ? Math.round(recent.reduce((s, a) => s + pct(a), 0) / recent.length) : null;

  return (
    <>
      <h1 className="pp-h1">Performance</h1>
      <p className="pp-sub">{child.full_name} · ID {child.student_code}</p>
      <ChildTabs items={kids} current={child.id} base="/parent/performance" />
      <div className="pp-grid" style={{ marginBottom: 16 }}>
        <div className="pp-card"><div className="pp-stats" style={{ marginTop: 0 }}>
          <div className="pp-stat"><b>{avg ?? "—"}{avg !== null && "%"}</b><span>Overall average</span></div>
          <div className="pp-stat"><b>{recentAvg ?? "—"}{recentAvg !== null && "%"}</b><span>Last 5 tests</span></div>
          <div className="pp-stat"><b>{attempts.length ? `${best}%` : "—"}</b><span>Best score</span></div>
          <div className="pp-stat"><b>{stats[child.id]?.chapters ?? 0}</b><span>Chapters studied</span></div>
        </div></div>
      </div>
      <div className="pp-card">
        <h3>Test history</h3>
        {attempts.length === 0 ? <div className="pp-empty">No practice tests taken yet.</div> : (
          <div className="pp-scroll">
            <table className="pp-table">
              <thead><tr><th>Date</th><th>Test</th><th>Score</th><th style={{ width: "30%" }}>Result</th></tr></thead>
              <tbody>
                {attempts.map((a) => (
                  <tr key={a.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{new Date(a.completed_at).toLocaleDateString("en-IN")}</td>
                    <td>{a.title}</td>
                    <td>{a.score}/{a.total}</td>
                    <td><div style={{ display: "flex", alignItems: "center", gap: 8 }}><div className="pp-bar" style={{ flex: 1 }}><i style={{ width: `${pct(a)}%` }} /></div><span className="pp-meta">{pct(a)}%</span></div></td>
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
