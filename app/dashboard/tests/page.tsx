"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, ClipboardList, Clock3 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type TestRow = { id: string; title: string; description: string; created_at: string; duration_minutes: number };
type Attempt = { id: string; test_id: string; score: number; total: number; completed_at: string };

export default function PracticeTestsPage() {
  const [tests, setTests] = useState<TestRow[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [message, setMessage] = useState("Loading practice tests…");
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/auth"); return; }
      const [{ data: testRows, error: testError }, { data: attemptRows, error: attemptError }] = await Promise.all([
        supabase.from("tests").select("id,title,description,created_at,duration_minutes").eq("published", true).order("created_at", { ascending: false }),
        supabase.from("test_attempts").select("id,test_id,score,total,completed_at").order("completed_at", { ascending: false }),
      ]);
      if (testError) throw testError;
      if (attemptError) throw attemptError;
      setTests((testRows || []) as TestRow[]);
      setAttempts((attemptRows || []) as Attempt[]);
      setMessage("");
    }
    void load().catch((error) => setMessage(error instanceof Error ? error.message : "Could not load practice tests."));
  }, [router]);

  const latestAttempt = (testId: string) => attempts.find((attempt) => attempt.test_id === testId);

  return <main className="wrap" style={{ paddingTop: 24, paddingBottom: 60 }}>
    <header className="nav" style={{ height: 64 }}><Link className="brand" href="/dashboard"><span className="logo">✦</span> StudAstra</Link><Link className="btn small" href="/dashboard"><ArrowLeft size={14}/> Dashboard</Link></header>
    <section><span className="pill"><ClipboardList size={14}/> PRACTICE TESTS</span><h1 style={{ fontSize: 38, marginBottom: 4 }}>Test your understanding</h1><p className="muted">Choose a practice test and get your score as soon as you submit.</p>{message && <p className="muted" role="status">{message}</p>}
      {!message && tests.length === 0 && <div className="panel empty">No tests are published yet. Check back soon.</div>}
      <div className="features">{tests.map((test) => {
        const attempt = latestAttempt(test.id);
        return <article className="feature" key={test.id}><div className="emoji"><ClipboardList size={22}/></div><h3>{test.title}</h3><p>{test.description || "A multiple-choice practice test."}</p><p className="muted"><Clock3 size={14}/> {test.duration_minutes} minutes · CBT format</p>
          {attempt && <p className="muted"><CheckCircle2 size={15}/> Latest score: {attempt.score}/{attempt.total}</p>}
          <Link className="btn primary" href={`/dashboard/tests/${test.id}`}>{attempt ? "Try again" : "Start test"}</Link>
        </article>;
      })}</div>
    </section>
  </main>;
}

