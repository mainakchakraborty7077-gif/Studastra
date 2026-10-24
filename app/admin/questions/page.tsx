"use client";

import { useEffect, useState, type FormEvent } from "react";
import AdminShell from "@/components/AdminShell";
import { createClient } from "@/lib/supabase/client";
import { SYLLABUS } from "@/lib/syllabus";

type Question = { id: string; subject: string; chapter: string; difficulty: string; question: string; options: string[]; correct: number; explanation: string | null };
const SUBJECTS = Object.keys(SYLLABUS);
const LETTERS = ["A", "B", "C", "D"];

export default function QuestionBankPage() {
  const [items, setItems] = useState<Question[]>([]);
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [chapter, setChapter] = useState(SYLLABUS[SUBJECTS[0]][0]);
  const [difficulty, setDifficulty] = useState("medium");
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correct, setCorrect] = useState(0);
  const [explanation, setExplanation] = useState("");
  const [filter, setFilter] = useState("All");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      const s = createClient();
      const { data, error } = await s.from("questions").select("id,subject,chapter,difficulty,question,options,correct,explanation").order("created_at", { ascending: false }).limit(300);
      if (error) { setMessage(error.message); return; }
      setItems((data || []) as Question[]);
    }
    void load();
  }, []);

  function pickSubject(sub: string) { setSubject(sub); setChapter(SYLLABUS[sub][0]); }

  async function add(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMessage("");
    try {
      const s = createClient();
      const { data, error } = await s.from("questions").insert({
        subject, chapter, difficulty, question: question.trim(), options: options.map((o) => o.trim()), correct, explanation: explanation.trim() || null,
      }).select("id,subject,chapter,difficulty,question,options,correct,explanation").single();
      if (error) throw error;
      setItems((old) => [data as Question, ...old]);
      setQuestion(""); setOptions(["", "", "", ""]); setExplanation(""); setCorrect(0);
      setMessage("Question added.");
    } catch (err) { setMessage((err as { message?: string })?.message || "Could not add the question."); } finally { setBusy(false); }
  }

  async function remove(id: string) {
    const s = createClient();
    const { error } = await s.from("questions").delete().eq("id", id);
    if (error) { setMessage(error.message); return; }
    setItems((old) => old.filter((x) => x.id !== id));
  }

  const shown = items.filter((x) => filter === "All" || x.subject === filter);

  return (
    <AdminShell title="Question bank" subtitle="Add multiple-choice questions. Quizzes and DPP sets will draw from these.">
      <form onSubmit={add} className="ad-card ad-form">
        <div><label htmlFor="sub">Subject</label><select id="sub" value={subject} onChange={(e) => pickSubject(e.target.value)}>{SUBJECTS.map((x) => <option key={x}>{x}</option>)}</select></div>
        <div><label htmlFor="ch">Chapter</label><select id="ch" value={chapter} onChange={(e) => setChapter(e.target.value)}>{SYLLABUS[subject].map((x) => <option key={x}>{x}</option>)}</select></div>
        <div><label htmlFor="df">Difficulty</label><select id="df" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></div>
        <div><label htmlFor="co">Correct option</label><select id="co" value={correct} onChange={(e) => setCorrect(Number(e.target.value))}>{LETTERS.map((l, n) => <option key={l} value={n}>{l}</option>)}</select></div>
        <div className="full"><label htmlFor="qt">Question</label><textarea id="qt" rows={3} required value={question} onChange={(e) => setQuestion(e.target.value)} /></div>
        {LETTERS.map((l, n) => (
          <div key={l}><label htmlFor={`o${n}`}>Option {l}</label><input id={`o${n}`} required value={options[n]} onChange={(e) => setOptions((old) => old.map((v, i) => (i === n ? e.target.value : v)))} /></div>
        ))}
        <div className="full"><label htmlFor="ex">Explanation (optional)</label><textarea id="ex" rows={2} value={explanation} onChange={(e) => setExplanation(e.target.value)} /></div>
        <div className="full"><button className="ad-btn" disabled={busy}>{busy ? "Saving..." : "Add question"}</button></div>
        {message && <p className="ad-msg full" role="status">{message}</p>}
      </form>

      <section className="ad-card">
        <div className="ad-form" style={{ gridTemplateColumns: "1fr auto", alignItems: "end" }}>
          <b>{shown.length} question{shown.length === 1 ? "" : "s"}</b>
          <select aria-label="Filter by subject" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: "auto" }}><option>All</option>{SUBJECTS.map((x) => <option key={x}>{x}</option>)}</select>
        </div>
        {shown.length === 0 ? <p className="ad-sub" style={{ marginTop: 12 }}>No questions yet.</p> : shown.map((x) => (
          <article key={x.id} className="ad-q">
            <p>{x.question}</p>
            <ol type="A">{x.options.map((o, n) => <li key={n} className={n === x.correct ? "ok" : ""}>{o}</li>)}</ol>
            {x.explanation && <p className="ad-meta" style={{ marginTop: 8 }}>Explanation: {x.explanation}</p>}
            <p className="ad-meta" style={{ marginTop: 8 }}>{x.subject} • {x.chapter} • {x.difficulty} <button className="ad-ghost" style={{ marginLeft: 8 }} onClick={() => void remove(x.id)}>Delete</button></p>
          </article>
        ))}
      </section>
    </AdminShell>
  );
}

