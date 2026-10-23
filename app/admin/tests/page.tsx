"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ImagePlus, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type QuestionType = "single_correct" | "multiple_correct" | "match_columns";
type QuestionDraft = { prompt: string; questionType: QuestionType; options: string[]; correctOption: number; correctOptions: number[]; matchLeft: string[]; correctMatches: number[]; image: File | null };
type TestRow = { id: string; title: string; description: string; published: boolean; created_at: string; duration_minutes: number };
const newQuestion = (): QuestionDraft => ({ prompt: "", questionType: "single_correct", options: ["", "", "", ""], correctOption: 0, correctOptions: [], matchLeft: ["", "", "", ""], correctMatches: [-1, -1, -1, -1], image: null });

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

  function addOption(questionIndex: number) {
    setQuestions((current) => current.map((question, i) => i === questionIndex && question.options.length < 6
      ? { ...question, options: [...question.options, ""], matchLeft: [...question.matchLeft, ""], correctMatches: [...question.correctMatches, -1] }
      : question));
  }

  function removeOption(questionIndex: number, optionIndex: number) {
    setQuestions((current) => current.map((question, i) => {
      if (i !== questionIndex || question.options.length <= 2) return question;
      const options = question.options.filter((_, j) => j !== optionIndex);
      const matchLeft = question.matchLeft.filter((_, j) => j !== optionIndex);
      const correctMatches = question.correctMatches.filter((_, j) => j !== optionIndex).map((match) => match > optionIndex ? match - 1 : match);
      return { ...question, options, matchLeft, correctMatches, correctOption: question.correctOption === optionIndex ? 0 : question.correctOption > optionIndex ? question.correctOption - 1 : question.correctOption, correctOptions: question.correctOptions.filter((item) => item !== optionIndex).map((item) => item > optionIndex ? item - 1 : item) };
    }));
  }

  function updateMatchLeft(questionIndex: number, itemIndex: number, value: string) {
    setQuestions((current) => current.map((question, i) => i === questionIndex
      ? { ...question, matchLeft: question.matchLeft.map((item, j) => j === itemIndex ? value : item) }
      : question));
  }

  function updateMatchTarget(questionIndex: number, itemIndex: number, targetIndex: number) {
    setQuestions((current) => current.map((question, i) => i === questionIndex
      ? { ...question, correctMatches: question.correctMatches.map((item, j) => j === itemIndex ? targetIndex : item) }
      : question));
  }

  async function createTest(event: FormEvent) {
    event.preventDefault();
    const allowedImageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    const invalidQuestion = (q: QuestionDraft) => {
      if (!q.prompt.trim() || q.options.length < 2 || q.options.length > 6 || q.options.some((option) => !option.trim())) return true;
      if (q.questionType === "multiple_correct") return q.correctOptions.length === 0;
      if (q.questionType === "match_columns") return q.matchLeft.length !== q.options.length || q.matchLeft.some((item) => !item.trim()) || q.correctMatches.some((match) => match < 0) || new Set(q.correctMatches).size !== q.correctMatches.length;
      return false;
    };
    if (questions.length === 0 || questions.some((q) => invalidQuestion(q) || (q.image && (!allowedImageTypes.includes(q.image.type) || q.image.size > 5 * 1024 * 1024)))) {
      setMessage("Complete every question. Choose at least one correct answer, or fill and match both columns. Images must be JPG, PNG, WebP or GIF under 5 MB.");
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
          test_id: test.id, prompt: draft.prompt.trim(), question_type: draft.questionType, options: draft.options.map((option) => option.trim()), match_left: draft.questionType === "match_columns" ? draft.matchLeft.map((item) => item.trim()) : null, image_path: imagePath, position,
        }).select("id").single();
        if (questionError) throw questionError;
        const correctAnswer = draft.questionType === "single_correct"
          ? draft.correctOption
          : draft.questionType === "multiple_correct"
            ? [...draft.correctOptions].sort((a, b) => a - b)
            : Object.fromEntries(draft.correctMatches.map((match, index) => [String(index), match]));
        const { error: answerError } = await supabase.from("test_answers").insert({
          question_id: question.id, correct_option: draft.questionType === "single_correct" ? draft.correctOption : null, correct_answer: correctAnswer,
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
            <label className="label" htmlFor={`question-type-${questionIndex}`}>Question type</label>
            <select className="input" id={`question-type-${questionIndex}`} value={question.questionType} onChange={(e) => updateQuestion(questionIndex, { questionType: e.target.value as QuestionType })}>
              <option value="single_correct">Single correct</option><option value="multiple_correct">Multiple correct</option><option value="match_columns">Match the columns</option>
            </select>
            {question.questionType === "match_columns" && <div className="panel stack" style={{ padding: 14 }}>
              <h4 style={{ margin: 0 }}>Match each Column I item with one Column II choice</h4>
              <div className="exam-match-admin-head"><b>Column I</b><b>Column II choices</b><b>Correct match</b></div>
              {question.matchLeft.map((item, itemIndex) => <div className="exam-match-admin-row" key={itemIndex}>
                <span className="muted">{String.fromCharCode(65 + itemIndex)}.</span><input className="input" aria-label={`Column I item ${itemIndex + 1}`} value={item} onChange={(e) => updateMatchLeft(questionIndex, itemIndex, e.target.value)} placeholder={`Item ${itemIndex + 1}`} required />
                <select className="input" aria-label={`Correct match for item ${itemIndex + 1}`} value={question.correctMatches[itemIndex]} onChange={(e) => updateMatchTarget(questionIndex, itemIndex, Number(e.target.value))} required>
                  <option value={-1} disabled>Select a match</option>{question.options.map((_, optionIndex) => <option key={optionIndex} value={optionIndex}>{String.fromCharCode(65 + optionIndex)}</option>)}
                </select>
              </div>)}
              <p className="muted" style={{ margin: 0 }}>Column II is entered below. Every left item must map to a different choice.</p>
            </div>}
            {question.options.map((option, optionIndex) => <div key={optionIndex}>
              <label className="label" htmlFor={`option-${questionIndex}-${optionIndex}`}>{question.questionType === "match_columns" ? `Column II · ${String.fromCharCode(65 + optionIndex)}` : `Choice ${String.fromCharCode(65 + optionIndex)}`}{question.questionType === "single_correct" && question.correctOption === optionIndex ? " · correct answer" : question.questionType === "multiple_correct" && question.correctOptions.includes(optionIndex) ? " · correct answer" : ""}</label>
              <div className="row">{question.questionType === "single_correct" && <input aria-label={`Mark choice ${String.fromCharCode(65 + optionIndex)} correct`} type="radio" name={`correct-${questionIndex}`} checked={question.correctOption === optionIndex} onChange={() => updateQuestion(questionIndex, { correctOption: optionIndex })} />}{question.questionType === "multiple_correct" && <input aria-label={`Mark choice ${String.fromCharCode(65 + optionIndex)} correct`} type="checkbox" checked={question.correctOptions.includes(optionIndex)} onChange={(e) => updateQuestion(questionIndex, { correctOptions: e.target.checked ? [...question.correctOptions, optionIndex] : question.correctOptions.filter((item) => item !== optionIndex) })} />}<input className="input" id={`option-${questionIndex}-${optionIndex}`} value={option} onChange={(e) => updateOption(questionIndex, optionIndex, e.target.value)} maxLength={500} required />{question.options.length > 2 && <button className="btn small" type="button" onClick={() => removeOption(questionIndex, optionIndex)} aria-label={`Remove choice ${optionIndex + 1}`}><Trash2 size={14}/></button>}</div>
            </div>)}
            {question.options.length < 6 && <button className="btn small" type="button" onClick={() => addOption(questionIndex)}><Plus size={14}/> Add {question.questionType === "match_columns" ? "row and Column II choice" : "choice"}</button>}
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

