"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Award, BarChart3, CheckCircle2, ClipboardList, Clock3, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type TestRow = { id: string; title: string; description: string; created_at: string; duration_minutes: number };
type Attempt = {
  id: string;
  test_id: string;
  score: number;
  total: number;
  completed_at: string;
  attempted?: number | null;
  time_taken_seconds?: number | null;
};
type LeaderRow = {
  rank: number;
  display_name: string;
  tests_taken: number;
  attempts: number;
  score: number;
  total: number;
  percent: number | string | null;
  best_time_seconds: number | null;
  is_me: boolean;
};

const styles = `
.rc-section{margin-top:42px}
.rc-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.rc-head h2{margin:8px 0 4px;font-size:28px}
.rc-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin:18px 0}
.rc-stat{background:var(--panel,#11152b);border:1px solid var(--line,#ffffff16);border-radius:14px;padding:14px 16px}
.rc-stat b{display:block;font-size:24px;margin-top:4px}
.rc-stat span{color:var(--muted,#a5a9c7);font-size:13px}
.rc-table-wrap{overflow-x:auto;background:var(--panel,#11152b);border:1px solid var(--line,#ffffff16);border-radius:14px}
.rc-table{width:100%;border-collapse:collapse;font-size:14px;min-width:720px}
.rc-table th,.rc-table td{padding:11px 14px;text-align:left;border-bottom:1px solid var(--line,#ffffff16);white-space:nowrap}
.rc-table th{color:var(--muted,#a5a9c7);font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.5px}
.rc-table tr:last-child td{border-bottom:0}
.rc-good{color:var(--green,#91e8c0)}
.rc-bad{color:#ff9a9a}
.rc-group td{background:#ffffff08;font-weight:700}
.rc-me td{background:#9c83ff2b}
.rc-me td:first-child{box-shadow:inset 3px 0 0 var(--purple,#9c83ff)}
.rc-select{background:var(--panel2,#171b35);color:var(--text,#f5f5ff);border:1px solid var(--line,#ffffff16);border-radius:10px;padding:8px 12px;font:inherit}
.rc-note{color:var(--muted,#a5a9c7);font-size:13px;margin-top:10px}
`;

function formatTime(seconds?: number | null) {
  if (seconds === null || seconds === undefined) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m ? `${m}m ${String(s).padStart(2, "0")}s` : `${s}s`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function pct(score: number, total: number) {
  return total > 0 ? Math.round((score / total) * 1000) / 10 : 0;
}

export default function PracticeTestsPage() {
  const [tests, setTests] = useState<TestRow[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [message, setMessage] = useState("Loading practice tests…");
  const [attemptNote, setAttemptNote] = useState("");
  const [boardTest, setBoardTest] = useState<string>("overall");
  const [board, setBoard] = useState<LeaderRow[]>([]);
  const [boardMessage, setBoardMessage] = useState("Loading leaderboard…");
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/auth"); return; }
      const { data: testRows, error: testError } = await supabase
        .from("tests").select("id,title,description,created_at,duration_minutes")
        .eq("published", true).order("created_at", { ascending: false });
      if (testError) throw testError;

      // Every attempt is a row in test_attempts. Newer databases also store
      // how many questions were answered and the time taken; fall back to the
      // basic columns when that migration has not been applied yet.
      let attemptRows: Attempt[] = [];
      const detailed = await supabase.from("test_attempts")
        .select("id,test_id,score,total,completed_at,attempted,time_taken_seconds")
        .eq("user_id", user.id)
        .order("completed_at", { ascending: false });
      if (detailed.error) {
        const basic = await supabase.from("test_attempts")
          .select("id,test_id,score,total,completed_at")
          .eq("user_id", user.id)
          .order("completed_at", { ascending: false });
        if (basic.error) {
          setAttemptNote(`Could not load your past attempts: ${basic.error.message}`);
        } else {
          attemptRows = (basic.data || []) as Attempt[];
        }
      } else {
        attemptRows = (detailed.data || []) as Attempt[];
      }
      setTests((testRows || []) as TestRow[]);
      setAttempts(attemptRows);
      setMessage("");
    }
    void load().catch((error) => setMessage(error instanceof Error ? error.message : "Could not load practice tests."));
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    async function loadBoard() {
      setBoardMessage("Loading leaderboard…");
      const supabase = createClient();
      const { data, error } = await supabase.rpc("test_leaderboard", {
        p_test_id: boardTest === "overall" ? null : boardTest,
        p_limit: 20,
      });
      if (cancelled) return;
      if (error) {
        setBoard([]);
        setBoardMessage(error.code === "PGRST202" || /could not find the function/i.test(error.message)
          ? "The leaderboard is being set up and will appear here soon."
          : `Could not load the leaderboard: ${error.message}`);
        return;
      }
      setBoard((data || []) as LeaderRow[]);
      setBoardMessage("");
    }
    void loadBoard();
    return () => { cancelled = true; };
  }, [boardTest]);

  const testTitle = useMemo(() => new Map(tests.map((test) => [test.id, test.title])), [tests]);

  const byTest = useMemo(() => {
    const map = new Map<string, Attempt[]>();
    for (const attempt of attempts) {
      const list = map.get(attempt.test_id) || [];
      list.push(attempt);
      map.set(attempt.test_id, list);
    }
    return map;
  }, [attempts]);

  const summary = useMemo(() => {
    if (!attempts.length) return null;
    const percents = attempts.map((a) => pct(a.score, a.total));
    const best = attempts.reduce((top, a) => (pct(a.score, a.total) > pct(top.score, top.total) ? a : top), attempts[0]);
    const withDetail = attempts.filter((a) => typeof a.attempted === "number");
    const answered = withDetail.reduce((sum, a) => sum + (a.attempted || 0), 0);
    const correctInDetail = withDetail.reduce((sum, a) => sum + a.score, 0);
    return {
      attempts: attempts.length,
      testsTaken: byTest.size,
      average: Math.round((percents.reduce((s, p) => s + p, 0) / percents.length) * 10) / 10,
      best,
      accuracy: answered > 0 ? Math.round((correctInDetail / answered) * 1000) / 10 : null,
    };
  }, [attempts, byTest]);

  const orderedTestIds = useMemo(() => {
    const ids = [...byTest.keys()];
    return ids.sort((a, b) => (byTest.get(b)![0].completed_at.localeCompare(byTest.get(a)![0].completed_at)));
  }, [byTest]);

  return <main className="wrap" style={{ paddingTop: 24, paddingBottom: 60 }}>
    <style>{styles}</style>
    <header className="nav" style={{ height: 64 }}><Link className="brand" href="/dashboard"><span className="logo">✦</span> StudAstra</Link><Link className="btn small" href="/dashboard"><ArrowLeft size={14}/> Dashboard</Link></header>
    <section><span className="pill"><ClipboardList size={14}/> PRACTICE TESTS</span><h1 style={{ fontSize: 38, marginBottom: 4 }}>Test your understanding</h1><p className="muted">Choose a practice test and get your score as soon as you submit. Every attempt is saved to your report card below.</p>{message && <p className="muted" role="status">{message}</p>}
      {!message && tests.length === 0 && <div className="panel empty">No tests are published yet. Check back soon.</div>}
      <div className="features">{tests.map((test) => {
        const list = byTest.get(test.id) || [];
        const latest = list[0];
        const best = list.reduce<Attempt | undefined>((top, a) => (!top || a.score / a.total > top.score / top.total ? a : top), undefined);
        return <article className="feature" key={test.id}><div className="emoji"><ClipboardList size={22}/></div><h3>{test.title}</h3><p>{test.description || "A multiple-choice practice test."}</p><p className="muted"><Clock3 size={14}/> {test.duration_minutes} minutes · CBT format</p>
          {latest && <p className="muted"><CheckCircle2 size={15}/> Latest: {latest.score}/{latest.total} · Best: {best!.score}/{best!.total} · {list.length} attempt{list.length === 1 ? "" : "s"}</p>}
          <Link className="btn primary" href={`/dashboard/tests/${test.id}`}>{latest ? "Try again" : "Start test"}</Link>
        </article>;
      })}</div>
    </section>

    <section className="rc-section" id="report-card">
      <div className="rc-head"><div><span className="pill"><BarChart3 size={14}/> REPORT CARD</span><h2>Your test history</h2><p className="muted">Every attempt you have submitted, newest first.</p></div></div>
      {attemptNote && <p className="muted" role="status">{attemptNote}</p>}
      {!message && !attempts.length && !attemptNote && <div className="panel empty">You have not submitted a test yet. Your scores will appear here after your first attempt.</div>}
      {summary && <div className="rc-stats">
        <div className="rc-stat"><span>Tests taken</span><b>{summary.testsTaken}</b></div>
        <div className="rc-stat"><span>Total attempts</span><b>{summary.attempts}</b></div>
        <div className="rc-stat"><span>Average score</span><b>{summary.average}%</b></div>
        <div className="rc-stat"><span>Best score</span><b>{summary.best.score}/{summary.best.total}</b><span>{testTitle.get(summary.best.test_id) || "Practice test"}</span></div>
        <div className="rc-stat"><span>Accuracy</span><b>{summary.accuracy === null ? "—" : `${summary.accuracy}%`}</b><span>correct of answered</span></div>
      </div>}
      {attempts.length > 0 && <div className="rc-table-wrap"><table className="rc-table">
        <thead><tr><th>Attempt</th><th>Score</th><th>Correct</th><th>Wrong</th><th>Unattempted</th><th>Accuracy</th><th>Time</th><th>Date</th></tr></thead>
        <tbody>{orderedTestIds.flatMap((testId) => {
          const list = byTest.get(testId)!;
          const rows = [<tr className="rc-group" key={`${testId}-head`}><td colSpan={8}>{testTitle.get(testId) || "Practice test (no longer published)"} · {list.length} attempt{list.length === 1 ? "" : "s"}</td></tr>];
          list.forEach((a, index) => {
            const known = typeof a.attempted === "number";
            const wrong = known ? Math.max(0, (a.attempted as number) - a.score) : null;
            const unattempted = known ? Math.max(0, a.total - (a.attempted as number)) : null;
            const accuracy = known && (a.attempted as number) > 0 ? `${pct(a.score, a.attempted as number)}%` : known ? "—" : "—";
            rows.push(<tr key={a.id}>
              <td>#{list.length - index}</td>
              <td><b>{a.score}/{a.total}</b> <span className="muted">({pct(a.score, a.total)}%)</span></td>
              <td className="rc-good">{a.score}</td>
              <td className="rc-bad">{wrong ?? "—"}</td>
              <td>{unattempted ?? "—"}</td>
              <td>{accuracy}</td>
              <td>{formatTime(a.time_taken_seconds)}</td>
              <td>{formatDate(a.completed_at)}</td>
            </tr>);
          });
          return rows;
        })}</tbody>
      </table></div>}
      {attempts.some((a) => typeof a.attempted !== "number") && <p className="rc-note">“—” means that detail was not recorded for that attempt.</p>}
    </section>

    <section className="rc-section" id="leaderboard">
      <div className="rc-head"><div><span className="pill"><Trophy size={14}/> LEADERBOARD</span><h2>How you rank</h2><p className="muted">{boardTest === "overall" ? "Overall: each student's best score on every test, added up." : "Each student's best attempt on this test."}</p></div>
        <select className="rc-select" aria-label="Leaderboard test" value={boardTest} onChange={(event) => setBoardTest(event.target.value)}>
          <option value="overall">Overall</option>
          {tests.map((test) => <option key={test.id} value={test.id}>{test.title}</option>)}
        </select>
      </div>
      {boardMessage && <p className="muted" role="status">{boardMessage}</p>}
      {!boardMessage && !board.length && <div className="panel empty">No scores yet. Be the first on the board.</div>}
      {board.length > 0 && <div className="rc-table-wrap" style={{ marginTop: 16 }}><table className="rc-table">
        <thead><tr><th>Rank</th><th>Student</th><th>Score</th><th>Percent</th>{boardTest === "overall" ? <th>Tests</th> : <th>Time</th>}<th>Attempts</th></tr></thead>
        <tbody>{board.map((row) => <tr key={`${row.rank}-${row.display_name}-${row.is_me}`} className={row.is_me ? "rc-me" : undefined}>
          <td>{row.rank <= 3 ? <Award size={15} style={{ verticalAlign: "-2px", marginRight: 4 }}/> : null}#{row.rank}</td>
          <td>{row.display_name}{row.is_me && <b> (You)</b>}</td>
          <td><b>{row.score}/{row.total}</b></td>
          <td>{row.percent === null ? "—" : `${Number(row.percent)}%`}</td>
          {boardTest === "overall" ? <td>{row.tests_taken}</td> : <td>{formatTime(row.best_time_seconds)}</td>}
          <td>{row.attempts}</td>
        </tr>)}</tbody>
      </table></div>}
    </section>
  </main>;
}
