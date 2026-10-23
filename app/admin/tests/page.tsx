"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ImagePlus, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type QuestionDraft = { prompt: string; options: string[]; correctOption: number; image: File | null };
type TestRow = { id: string; title: string; description: string; published: boolean; created_at: string; duration_minutes: number };
const newQuestion = (): QuestionDraft => ({ prompt: "", options: ["", "", "", ""], correctOption: 0, image: null });

export default function AdminTestsPage() {
  const [authorized, setAuthorized] = useState(false);
  const [tests, setTests] = useState<TestRow[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(180);
  const [questions, setQuestions] = useState<QuestionDraft[]>([newQuestion()]);
  const [message, setMessage] = useState("Checking administrator access…");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function load() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/admin/login"); return; }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") { router.replace("/admin/login"); return; }
    setAuthorized(true);
    const { data, error } = await supabase.from("tests").select("id,title,description,published,created_at,duration_minutes").order("created_at", { ascending: false });
    if (error) throw error;
    setTests((data || []) as TestRow[]);
    setMessage("");
  }

  useEffect(() => { void load().catch((error) => setMessage(error instanceof Error ? error.message : "Could not load tests.")); }, [router]);

  function updateQuestion(index: number, changes: Partial<QuestionDraft>) {
    setQuestions((current) => current.map((question, i) => i === index ? { ...question, ...changes } : question));
  }

  function updateOption(questionIndex: number, optionIndex: number, value: string) {
    setQuestions((current) => current.map((question, i) => i === questionIndex
      ? { ...question, options: question.options.map((option, j) => j === optionIndex ? value : option) }
      : question));
  }

  async function createTest(event: FormEvent) {
    event.preventDefault();
    const allowedImageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (questions.length === 0 || questions.some((q) => !q.prompt.trim() || q.options.some((option) => !option.trim()) || (q.image && (!allowedImageTypes.includes(q.image.type) || q.image.size > 5 * 1024 * 1024)))) {
      setMessage("Complete each question and its choices. Images must be JPG, PNG, WebP or GIF under 5 MB.");
      return;
    }
    setBusy(true); setMessage("");
    const supabase = createClient();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Please sign in again.");
      const { data: test, error: testError } = await supabase.from("tests").insert({
        created_by: user.id, title: title.trim(), description: description.trim(), published: false, duration_minutes: durationMinutes,
      }).select("id").single();
      if (testError) throw testError;

      for (const [position, draft] of questions.entries()) {
        let imagePath: string | null = null;
        if (draft.image) {
          const extension = draft.image.name.split(".").pop()?.toLowerCase() || "img";
          imagePath = `${test.id}/${position}-${crypto.randomUUID()}.${extension}`;
          const { error: uploadError } = await supabase.storage.from("test-question-images").upload(imagePath, draft.image, { contentType: draft.image.type, upsert: false });
          if (uploadError) throw uploadError;
        }
        const { data: question, error: questionError } = await supabase.from("test_questions").insert({
          test_id: test.id, prompt: draft.prompt.trim(), options: draft.options.map((option) => option.trim()), image_path: imagePath, position,
        }).select("id").single();
        if (questionError) throw questionError;
        const { error: answerError } = await supabase.from("test_answers").insert({
          question_id: question.id, correct_option: draft.correctOption,
        });
        if (answerError) throw answerError;
      }

      const { error: publishError } = await supabase.from("tests").update({ published: true }).eq("id", test.id);
      if (publishError) throw publishError;
      setTitle(""); setDescription(""); setDurationMinutes(180); setQuestions([newQuestion()]);
      await load();
      setMessage("Test published. Students can now find it in Practice tests.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not publish this test.");
    } finally { setBusy(false); }
  }

  return <main className="wrap" style={{ paddingTop: 24, paddingBottom: 60 }}>
    <header className="nav" style={{ height: 64 }}><Link className="brand" href="/admin"><span className="logo">✦</span> StudAstra Admin</Link><Link className="btn small" href="/admin"><ArrowLeft size={14}/> Overview</Link></header>
    <section><span className="pill">TEST BUILDER</span><h1 style={{ fontSize: 38, marginBottom: 4 }}>Create a practice test</h1><p className="muted">Add multiple-choice questions and publish them for students.</p>
      {message && <p className="muted" role="status">{message}</p>}
      {authorized && <div className="demo" style={{ alignItems: "start" }}>
        <form className="panel stack" onSubmit={createTest}>
          <h3>Test details</h3>
          <label className="label" htmlFor="test-title">Title</label><input className="input" id="test-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} placeholder="e.g. Cell biology basics" required />
          <label className="label" htmlFor="test-description">Description</label><textarea className="input textarea" id="test-description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} placeholder="What should students know before starting?" />
          <label className="label" htmlFor="test-duration">Exam duration (minutes)</label><input className="input" id="test-duration" type="number" min={1} max={300} step={1} value={durationMinutes} onChange={(e) => setDurationMinutes(Math.min(300, Math.max(1, Number(e.target.value) || 1)))} required />
          {questions.map((question, questionIndex) => <fieldset className="panel stack" key={questionIndex} style={{ padding: 16 }}>
            <legend className="label">Question {questionIndex + 1}</legend>
            <label className="label" htmlFor={`prompt-${questionIndex}`}>Question</label><textarea className="input textarea" id={`prompt-${questionIndex}`} value={question.prompt} onChange={(e) => updateQuestion(questionIndex, { prompt: e.target.value })} maxLength={2000} required />
            <label className="label" htmlFor={`image-${questionIndex}`}><ImagePlus size={14} style={{ display: "inline", verticalAlign: "middle" }}/> Question image (optional, JPG/PNG/WebP/GIF, up to 5 MB)</label><input className="input" id={`image-${questionIndex}`} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => updateQuestion(questionIndex, { image: e.target.files?.[0] || null })} />{question.image && <span className="muted">Selected: {question.image.name}</span>}
            {question.options.map((option, optionIndex) => <div key={optionIndex}>
              <label className="label" htmlFor={`option-${questionIndex}-${optionIndex}`}>Choice {String.fromCharCode(65 + optionIndex)} {question.correctOption === optionIndex ? "· correct answer" : ""}</label>
              <div className="row"><input aria-label={`Mark choice ${String.fromCharCode(65 + optionIndex)} correct`} type="radio" name={`correct-${questionIndex}`} checked={question.correctOption === optionIndex} onChange={() => updateQuestion(questionIndex, { correctOption: optionIndex })} /><input className="input" id={`option-${questionIndex}-${optionIndex}`} value={option} onChange={(e) => updateOption(questionIndex, optionIndex, e.target.value)} maxLength={500} required /></div>
            </div>)}
            {questions.length > 1 && <button className="btn small" type="button" onClick={() => setQuestions((current) => current.filter((_, i) => i !== questionIndex))}><Trash2 size={14}/> Remove question</button>}
          </fieldset>)}
          {questions.length < 20 && <button className="btn" type="button" onClick={() => setQuestions((current) => [...current, newQuestion()])}><Plus size={15}/> Add question</button>}
          <button className="btn primary" disabled={busy || !title.trim()}>{busy ? "Publishing…" : "Publish test"}</button>
        </form>
        <div className="panel"><h3>Published tests</h3>{tests.length === 0 ? <div className="empty">No tests yet. Create one to get started.</div> : tests.map((test) => <article className="resource" key={test.id}>
          <div className="row between"><b>{test.title}</b><span className="pill">{test.published ? "Published" : "Draft"}</span></div>
          <p>{test.duration_minutes} minute exam · {new Date(test.created_at).toLocaleDateString()}</p>
          <p>{test.published ? "Published" : "Draft"}</p>{test.description && <p>{test.description}</p>}
        </article>)}</div>
      </div>}
    </section>
  </main>;
}

