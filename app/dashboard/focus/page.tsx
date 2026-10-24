"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Session = { id: string; subject: string; minutes: number; created_at: string };

const SUBJECTS = ["Physics", "Chemistry", "Mathematics", "Biology", "Other"];
const PRESETS = [25, 45, 60];
const RING = 2 * Math.PI * 88;
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const fmt = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}h ${min % 60}m` : `${min}m`);

export default function FocusPage() {
  const router = useRouter();
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [duration, setDuration] = useState(25);
  const [remaining, setRemaining] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [message, setMessage] = useState("");
  const endRef = useRef(0);

  async function save(minutes: number, subj: string) {
    if (minutes < 1) return;
    try {
      const s = createClient();
      const { data: { user } } = await s.auth.getUser();
      if (!user) { router.replace("/auth"); return; }
      const { data, error } = await s.from("study_sessions").insert({ user_id: user.id, subject: subj, minutes }).select("id,subject,minutes,created_at").single();
      if (error) throw error;
      setSessions((old) => [data as Session, ...old]);
      setMessage(`Nice work. ${minutes} minutes of ${subj} saved.`);
    } catch (e) {
      setMessage((e as { message?: string })?.message || "Could not save this session.");
    }
  }

  useEffect(() => {
    async function load() {
      const s = createClient();
      const { data: { user } } = await s.auth.getUser();
      if (!user) { router.replace("/auth"); return; }
      const { data } = await s.from("study_sessions").select("id,subject,minutes,created_at").order("created_at", { ascending: false }).limit(60);
      setSessions((data || []) as Session[]);
    }
    void load();
  }, [router]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const left = Math.max(0, Math.round((endRef.current - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) {
        setRunning(false);
        void save(duration, subject);
        setRemaining(duration * 60);
      }
    }, 500);
    return () => clearInterval(id);
  }, [running, duration, subject]);

  function start() { setMessage(""); endRef.current = Date.now() + remaining * 1000; setRunning(true); }
  function pickDuration(m: number) { if (running) return; setDuration(m); setRemaining(m * 60); }
  function reset() { setRunning(false); setRemaining(duration * 60); }
  function finishEarly() {
    const minutes = Math.round((duration * 60 - remaining) / 60);
    setRunning(false); setRemaining(duration * 60);
    if (minutes < 1) { setMessage("Study at least a minute before saving."); return; }
    void save(minutes, subject);
  }

  const stats = useMemo(() => {
    const now = new Date();
    const today = sessions.filter((x) => dayKey(new Date(x.created_at)) === dayKey(now)).reduce((a, x) => a + x.minutes, 0);
    const week = sessions.filter((x) => now.getTime() - new Date(x.created_at).getTime() < 7 * 864e5).reduce((a, x) => a + x.minutes, 0);
    return { today, week };
  }, [sessions]);

  const progress = 1 - remaining / (duration * 60);
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const started = remaining !== duration * 60;

  return (
    <div className="fp-shell">
      <style>{css}</style>
      <div className="fp-wrap">
        <Link href="/dashboard" className="fp-back">← Back to dashboard</Link>
        <h1 className="fp-title">Focus timer</h1>
        <p className="fp-sub">Pick a subject, start the clock, and every finished session is saved to your account.</p>

        <section className="fp-card fp-center">
          <div className="fp-chips" role="group" aria-label="Subject">
            {SUBJECTS.map((s) => (
              <button key={s} disabled={running} className={subject === s ? "on" : ""} onClick={() => setSubject(s)}>{s}</button>
            ))}
          </div>

          <div className="fp-ring" role="timer" aria-label={`${mm} minutes ${ss} seconds left`}>
            <svg width="220" height="220" viewBox="0 0 220 220">
              <circle cx="110" cy="110" r="88" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="10" />
              <circle cx="110" cy="110" r="88" fill="none" stroke="#22d3ee" strokeWidth="10" strokeLinecap="round"
                strokeDasharray={RING} strokeDashoffset={RING * (1 - progress)} transform="rotate(-90 110 110)" />
            </svg>
            <div className="fp-time">{mm}:{ss}<small>{subject}</small></div>
          </div>

          <div className="fp-chips" role="group" aria-label="Session length">
            {PRESETS.map((m) => (
              <button key={m} disabled={running} className={duration === m ? "on" : ""} onClick={() => pickDuration(m)}>{m} min</button>
            ))}
          </div>

          <div className="fp-actions">
            {!running ? <button className="fp-go" onClick={start}>{started ? "Resume" : "Start focus"}</button>
              : <button className="fp-go" onClick={() => setRunning(false)}>Pause</button>}
            {started && <button className="fp-ghost" onClick={finishEarly}>Finish and save</button>}
            {started && <button className="fp-ghost" onClick={reset}>Reset</button>}
          </div>
          {message && <p className="fp-msg" role="status" aria-live="polite">{message}</p>}
        </section>

        <section className="fp-two">
          <div className="fp-card"><p className="fp-k">Studied today</p><p className="fp-big">{fmt(stats.today)}</p></div>
          <div className="fp-card"><p className="fp-k">Last 7 days</p><p className="fp-big">{fmt(stats.week)}</p></div>
        </section>

        <section className="fp-card">
          <h2 className="fp-h2">Recent sessions</h2>
          {sessions.length === 0 ? <p className="fp-k">No sessions yet. Your first one will appear here.</p> :
            sessions.slice(0, 8).map((x) => (
              <div key={x.id} className="fp-row"><span>{x.subject}</span><span className="fp-k">{new Date(x.created_at).toLocaleDateString()}</span><b>{fmt(x.minutes)}</b></div>
            ))}
        </section>
      </div>
    </div>
  );
}

const css = `
.fp-shell{min-height:100vh;padding:28px 18px 70px;background:radial-gradient(ellipse at 70% 0%,#0f2530 0%,#0a1016 55%);color:#e8f1f5;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.fp-wrap{max-width:640px;margin:0 auto;display:flex;flex-direction:column;gap:16px}
.fp-back{color:rgba(232,241,245,.65);text-decoration:none;font-size:14px}
.fp-title{margin:6px 0 0;font-size:32px}
.fp-sub{margin:0 0 6px;color:rgba(232,241,245,.65);font-size:15px;line-height:1.5}
.fp-card{box-sizing:border-box;padding:22px;border-radius:20px;background:rgba(18,28,37,.85);border:1px solid rgba(255,255,255,.08)}
.fp-center{display:flex;flex-direction:column;align-items:center;gap:20px;border-color:rgba(34,211,238,.25);box-shadow:0 0 50px rgba(34,211,238,.07)}
.fp-chips{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
.fp-chips button{padding:8px 16px;border-radius:99px;border:1px solid rgba(255,255,255,.12);background:none;color:rgba(232,241,245,.75);font-size:14px;cursor:pointer;font-family:inherit}
.fp-chips button.on{border-color:#22d3ee;background:rgba(34,211,238,.1);color:#fff}
.fp-chips button:disabled{opacity:.55;cursor:default}
.fp-ring{position:relative;width:220px;height:220px}
.fp-time{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:46px;font-weight:700;font-variant-numeric:tabular-nums}
.fp-time small{font-size:13px;font-weight:500;color:rgba(232,241,245,.6);margin-top:2px}
.fp-actions{display:flex;flex-wrap:wrap;gap:10px;justify-content:center}
.fp-go{padding:12px 28px;border:0;border-radius:12px;background:#22d3ee;color:#04222a;font-weight:600;font-size:16px;cursor:pointer;font-family:inherit}
.fp-ghost{padding:12px 20px;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:none;color:rgba(232,241,245,.85);font-size:15px;cursor:pointer;font-family:inherit}
.fp-msg{margin:0;padding:10px 14px;border-radius:12px;background:rgba(34,211,238,.1);border:1px solid rgba(34,211,238,.25);font-size:14px;text-align:center}
.fp-two{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.fp-k{margin:0;font-size:13px;color:rgba(232,241,245,.6)}
.fp-big{margin:6px 0 0;font-size:30px;font-weight:700}
.fp-h2{margin:0 0 10px;font-size:18px}
.fp-row{display:flex;align-items:center;gap:12px;padding:12px 0;border-top:1px solid rgba(255,255,255,.07)}
.fp-row span:first-child{flex:1}
.fp-go:focus-visible,.fp-ghost:focus-visible,.fp-chips button:focus-visible{outline:2px solid #22d3ee;outline-offset:2px}
`;
