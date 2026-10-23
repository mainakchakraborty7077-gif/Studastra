"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowLeftRight, ImagePlus, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type QuestionType = "single_correct" | "multiple_correct" | "match_columns";
type QuestionDraft = { prompt: string; questionType: QuestionType; options: string[]; correctOption: number; correctOptions: number[]; matchLeft: string[]; correctMatches: number[]; image: File | null };
type TestRow = { id: string; title: string; description: string; published: boolean; created_at: string; duration_minutes: number };
const newQuestion = (): QuestionDraft => ({ prompt: "", questionType: "single_correct", options: ["", "", "", ""], correctOption: -1, correctOptions: [], matchLeft: ["", "", "", ""], correctMatches: [-1, -1, -1, -1], image: null });

export default function AdminTestsPage() {
  const [authorized, setAuthorized] = useState(false);
  const [tests, setTests] = useState<TestRow[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(180);
  const [questions, setQuestions] = useState<QuestionDraft[]>([newQuestion()]);
  const [message, setMessage] = useState("Checking administrator access…");
  const [busy, setBusy] = useState(false);
  const [deletingTestId, setDeletingTestId] = useState<string | null>(null);
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
      const correctMatches = question.correctMatches.filter((_, j) => j !== optionIndex).map((match) => match === optionIndex ? -1 : match > optionIndex ? match - 1 : match);
      return { ...question, options, matchLeft, correctMatches, correctOption: question.correctOption === optionIndex ? -1 : question.correctOption > optionIndex ? question.correctOption - 1 : question.correctOption, correctOptions: question.correctOptions.filter((item) => item !== optionIndex).map((item) => item > optionIndex ? item - 1 : item) };
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

  async function deleteTest(test: TestRow) {
    if (deletingTestId || busy) return;
    const confirmed = window.confirm(`Delete “${test.title}”?\n\nThis permanently removes the test, its questions and answer keys, attached question images, and saved student attempts and scores. This cannot be undone.`);
    if (!confirmed) return;

    setDeletingTestId(test.id);
    setMessage("");
    const supabase = createClient();
    try {
      const { data: questionRows, error: questionError } = await supabase.from("test_questions").select("image_path").eq("test_id", test.id);
      if (questionError) throw questionError;
      const imagePaths = (questionRows || []).map((question) => question.image_path).filter((path): path is string => typeof path === "string" && path.length > 0);
      if (imagePaths.length) {
        const { error: imageError } = await supabase.storage.from("test-question-images").remove(imagePaths);
        if (imageError) throw imageError;
      }

      const { data: deletedRows, error: deleteError } = await supabase.from("tests").delete().eq("id", test.id).select("id");
      if (deleteError) throw deleteError;
      if (!deletedRows?.length) throw new Error("The test was not deleted. Please check administrator access and try again.");
      setTests((current) => current.filter((item) => item.id !== test.id));
      setMessage(`Deleted “${test.title}” and its related questions, answer keys, images, and student results.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete this test.");
    } finally {
      setDeletingTestId(null);
    }
  }

  async function createTest(event: FormEvent) {
    event.preventDefault();
    const allowedImageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    const invalidQuestion = (q: QuestionDraft) => {
      if ((!q.prompt.trim() && !q.image) || q.prompt.length > 2000 || q.options.length < 2 || q.options.length > 6 || q.options.some((option) => !option.trim())) return true;
      if (q.questionType === "single_correct") return q.correctOption < 0 || q.correctOption >= q.options.length;
      if (q.questionType === "multiple_correct") return q.correctOptions.length === 0 || q.correctOptions.some((answer) => answer < 0 || answer >= q.options.length);
      if (q.questionType === "match_columns") return q.matchLeft.length !== q.options.length || q.matchLeft.some((item) => !item.trim()) || q.correctMatches.some((match) => match < 0 || match >= q.options.length) || new Set(q.correctMatches).size !== q.correctMatches.length;
      return false;
    };
    if (questions.length === 0 || questions.some((q) => invalidQuestion(q) || (q.image && (!allowedImageTypes.includes(q.image.type) || q.image.size > 5 * 1024 * 1024)))) {
      setMessage("Each question needs text or an image. Fill all choices and select the correct answer or matches. Images must be JPG, PNG, WebP or GIF under 5 MB.");
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
            <label className="label" htmlFor={`prompt-${questionIndex}`}>Question text (optional when an image is selected)</label><textarea className="input textarea" id={`prompt-${questionIndex}`} value={question.prompt} onChange={(e) => updateQuestion(questionIndex, { prompt: e.target.value })} maxLength={2000} required={!question.image} />
            <label className="label" htmlFor={`image-${questionIndex}`}><ImagePlus size={14} style={{ display: "inline", verticalAlign: "middle" }}/> Question image (JPG/JPEG, PNG, WebP or GIF; up to 5 MB)</label><input className="input" id={`image-${questionIndex}`} type="file" accept="image/jpeg,.jpg,.jpeg,image/png,.png,image/webp,.webp,image/gif,.gif" required={!question.prompt.trim()} onChange={(e) => updateQuestion(questionIndex, { image: e.target.files?.[0] || null })} />{question.image && <span className="muted">Selected: {question.image.name}</span>}
            <label className="label" htmlFor={`question-type-${questionIndex}`}>Question type</label>
            <select className="input" id={`question-type-${questionIndex}`} value={question.questionType} onChange={(e) => updateQuestion(questionIndex, { questionType: e.target.value as QuestionType })}>
              <option value="single_correct">Single correct</option><option value="multiple_correct">Multiple correct</option><option value="match_columns">Match the columns</option>
            </select>
            {question.questionType === "match_columns" ? <div className="match-editor">
              <div className="match-editor-heading">
                <div><span className="match-editor-eyebrow">MATCHING QUESTION</span><h4>Build the two columns</h4><p>Enter each side separately, then choose the correct Column II match for every Column I item.</p></div>
                <span className="match-editor-count">{question.options.length} pairs</span>
              </div>
              <div className="match-editor-columns">
                <section className="match-editor-column" aria-labelledby={`column-one-${questionIndex}`}>
                  <header className="match-editor-column-head"><span className="match-editor-letter">I</span><div><h5 id={`column-one-${questionIndex}`}>Column I</h5><small>Items to match</small></div></header>
                  <div className="match-editor-list">
                    {question.matchLeft.map((item, itemIndex) => <div className="match-editor-item" key={itemIndex}>
                      <span className="match-editor-index">{String.fromCharCode(65 + itemIndex)}</span>
                      <input className="input" aria-label={`Column I item ${itemIndex + 1}`} value={item} onChange={(e) => updateMatchLeft(questionIndex, itemIndex, e.target.value)} placeholder={`Enter item ${itemIndex + 1}`} maxLength={500} required />
                      {question.options.length > 2 && <button className="match-editor-remove" type="button" onClick={() => removeOption(questionIndex, itemIndex)} aria-label={`Remove pair ${itemIndex + 1}`} title="Remove this pair"><Trash2 size={15}/></button>}
                    </div>)}
                  </div>
                </section>
                <div className="match-editor-connector" aria-hidden="true"><ArrowLeftRight size={19}/></div>
                <section className="match-editor-column" aria-labelledby={`column-two-${questionIndex}`}>
                  <header className="match-editor-column-head"><span className="match-editor-letter">II</span><div><h5 id={`column-two-${questionIndex}`}>Column II</h5><small>Available matches</small></div></header>
                  <div className="match-editor-list">
                    {question.options.map((option, optionIndex) => <div className="match-editor-item match-editor-choice" key={optionIndex}>
                      <span className="match-editor-index">{String.fromCharCode(65 + optionIndex)}</span>
                      <input className="input" id={`option-${questionIndex}-${optionIndex}`} aria-label={`Column II choice ${optionIndex + 1}`} value={option} onChange={(e) => updateOption(questionIndex, optionIndex, e.target.value)} placeholder={`Enter choice ${String.fromCharCode(65 + optionIndex)}`} maxLength={500} required />
                    </div>)}
                  </div>
                </section>
              </div>
              <section className="match-editor-answer-key" aria-label="Correct matches answer key">
                <header><div><h5>Correct matches</h5><small>Pair each Column I item with a different Column II choice.</small></div><span>ANSWER KEY</span></header>
                <div className="match-editor-answer-list">
                  {question.matchLeft.map((item, itemIndex) => <div className="match-editor-answer-row" key={itemIndex}>
                    <span className="match-editor-pair-item"><b>{String.fromCharCode(65 + itemIndex)}</b><span>{item.trim() || `Column I item ${itemIndex + 1}`}</span></span>
                    <ArrowLeftRight className="match-editor-answer-arrow" size={17} aria-hidden="true"/>
                    <select className="input" aria-label={`Correct Column II match for item ${itemIndex + 1}`} value={question.correctMatches[itemIndex]} onChange={(e) => updateMatchTarget(questionIndex, itemIndex, Number(e.target.value))} required>
                      <option value={-1} disabled>Select a match</option>{question.options.map((option, optionIndex) => {
                        const usedByAnotherItem = question.correctMatches.some((match, index) => index !== itemIndex && match === optionIndex);
                        return !usedByAnotherItem || question.correctMatches[itemIndex] === optionIndex ? <option key={optionIndex} value={optionIndex}>{String.fromCharCode(65 + optionIndex)}{option.trim() ? ` · ${option.slice(0, 28)}` : ""}</option> : null;
                      })}
                    </select>
                  </div>)}
                </div>
              </section>
              <div className="match-editor-footer"><span>Each Column I item must use a different Column II choice.</span>{question.options.length < 6 && <button className="btn small" type="button" onClick={() => addOption(questionIndex)}><Plus size={14}/> Add pair</button>}</div>
            </div> : <>
              <div className="answer-editor-heading"><h4>Answer choices</h4><p>{question.questionType === "single_correct" ? "Select the correct answer. It is saved privately for scoring." : "Select every correct answer. The key is saved privately for scoring."}</p></div>
              {question.options.map((option, optionIndex) => <div key={optionIndex}>
                <label className="label" htmlFor={`option-${questionIndex}-${optionIndex}`}>Choice {String.fromCharCode(65 + optionIndex)}{question.questionType === "single_correct" && question.correctOption === optionIndex ? " · correct answer" : question.questionType === "multiple_correct" && question.correctOptions.includes(optionIndex) ? " · correct answer" : ""}</label>
                <div className="row">{question.questionType === "single_correct" && <input aria-label={`Mark choice ${String.fromCharCode(65 + optionIndex)} correct`} type="radio" name={`correct-${questionIndex}`} checked={question.correctOption === optionIndex} onChange={() => updateQuestion(questionIndex, { correctOption: optionIndex })} required />}{question.questionType === "multiple_correct" && <input aria-label={`Mark choice ${String.fromCharCode(65 + optionIndex)} correct`} type="checkbox" checked={question.correctOptions.includes(optionIndex)} onChange={(e) => updateQuestion(questionIndex, { correctOptions: e.target.checked ? [...question.correctOptions, optionIndex] : question.correctOptions.filter((item) => item !== optionIndex) })} />}<input className="input" id={`option-${questionIndex}-${optionIndex}`} value={option} onChange={(e) => updateOption(questionIndex, optionIndex, e.target.value)} maxLength={500} required />{question.options.length > 2 && <button className="btn small" type="button" onClick={() => removeOption(questionIndex, optionIndex)} aria-label={`Remove choice ${optionIndex + 1}`}><Trash2 size={14}/></button>}</div>
              </div>)}
              {question.options.length < 6 && <button className="btn small" type="button" onClick={() => addOption(questionIndex)}><Plus size={14}/> Add choice</button>}
            </>}
            {questions.length > 1 && <button className="btn small" type="button" onClick={() => setQuestions((current) => current.filter((_, i) => i !== questionIndex))}><Trash2 size={14}/> Remove question</button>}
          </fieldset>)}
          {questions.length < 20 && <button className="btn" type="button" onClick={() => setQuestions((current) => [...current, newQuestion()])}><Plus size={15}/> Add question</button>}
          <button className="btn primary" disabled={busy || !title.trim()}>{busy ? "Publishing…" : "Publish test"}</button>
        </form>
        <div className="panel"><h3>Your tests</h3>{tests.length === 0 ? <div className="empty">No tests yet. Create one to get started.</div> : tests.map((test) => <article className="resource" key={test.id}>
          <div className="test-row-heading"><b>{test.title}</b><span className="pill">{test.published ? "Published" : "Draft"}</span></div>
          <p>{test.duration_minutes} minute exam · {new Date(test.created_at).toLocaleDateString()}</p>
          {test.description && <p>{test.description}</p>}
          <button className="test-delete-button" type="button" disabled={busy || deletingTestId !== null} onClick={() => void deleteTest(test)} aria-label={`Delete ${test.title}`}><Trash2 size={14}/>{deletingTestId === test.id ? "Deleting…" : "Delete test"}</button>
        </article>)}</div>
      </div>}
    </section>
  </main>;
}

