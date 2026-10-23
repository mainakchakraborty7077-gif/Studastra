"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, BookOpen, Check, ChevronLeft, ChevronRight, Clock3, Flag, Image as ImageIcon, Info, Send, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type TestInfo = { id: string; title: string; description: string; duration_minutes: number };
type QuestionType = "single_correct" | "multiple_correct" | "match_columns";
type QuestionAnswer = number | number[] | Record<string, number>;
type Question = { id: string; prompt: string; question_type: QuestionType; options: string[]; match_left: string[] | null; position: number; image_path: string | null; imageUrl?: string };
type Result = { score: number; total: number };
type SavedState = { answers: Record<string, QuestionAnswer>; marked: string[]; visited?: string[]; current: number; expiresAt: number };

const bucket = "test-question-images";

export default function TakeTestPage() {
  const params = useParams<{ id: string }>();
  const testId = params.id;
  const [test, setTest] = useState<TestInfo | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, QuestionAnswer>>({});
  const [marked, setMarked] = useState<string[]>([]);
  const [visited, setVisited] = useState<string[]>([]);
  const [current, setCurrent] = useState(0);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [storageKey, setStorageKey] = useState("");
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [message, setMessage] = useState("Loading exam…");
  const [busy, setBusy] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);
  const router = useRouter();
  const submissionLock = useRef(false);
  const timeoutHandled = useRef(false);
  const submitRef = useRef<(automatic?: boolean) => Promise<void>>(async () => {});

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/auth"); return; }
      const { data: testRow, error: testError } = await supabase.from("tests").select("id,title,description,duration_minutes").eq("id", testId).eq("published", true).single();
      if (testError) throw testError;
      const { data: questionRows, error: questionError } = await supabase.from("test_questions").select("id,prompt,question_type,options,match_left,position,image_path").eq("test_id", testId).order("position");
      if (questionError) throw questionError;
      if (!questionRows?.length) throw new Error("This test has no questions yet.");
      const rows = questionRows as Question[];
      const withImages = await Promise.all(rows.map(async (question) => {
        if (!question.image_path) return question;
        const { data } = await supabase.storage.from(bucket).createSignedUrl(question.image_path, 21600);
        return { ...question, imageUrl: data?.signedUrl };
      }));
      const info = testRow as TestInfo;
      const saveKey = `studastra-exam:${user.id}:${testId}`;
      let saved: SavedState | null = null;
      try { saved = JSON.parse(sessionStorage.getItem(saveKey) || "null") as SavedState | null; } catch { saved = null; }
      const validSaved = saved && Number.isFinite(saved.expiresAt) ? saved : null;
      const deadline = validSaved?.expiresAt ?? Date.now() + info.duration_minutes * 60_000;
      setStorageKey(saveKey);
      setTest(info);
      setQuestions(withImages);
      setAnswers(validSaved?.answers || {});
      setMarked(validSaved?.marked || []);
      const startingQuestion = Math.min(validSaved?.current || 0, rows.length - 1);
      setCurrent(startingQuestion);
      setVisited(validSaved?.visited || [rows[startingQuestion].id]);
      setExpiresAt(deadline);
      setSecondsLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
      setMessage("");
    }
    void load().catch((error) => setMessage(error instanceof Error ? error.message : "Could not open this exam."));
  }, [router, testId]);

  const submitTest = useCallback(async (automatic = false) => {
    if (submissionLock.current || !questions.length) return;
    submissionLock.current = true;
    setBusy(true);
    setShowSubmit(false);
    setMessage(automatic ? "Time is up. Submitting your exam…" : "Submitting your exam…");
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("submit_test", {
        p_test_id: testId,
        p_question_ids: questions.map((question) => question.id),
        p_answers: questions.map((question) => answers[question.id] ?? null),
      });
      if (error) throw error;
      const score = Array.isArray(data) ? data[0] : data;
      if (!score || typeof score.score !== "number" || typeof score.total !== "number") throw new Error("The score could not be read. Please try again.");
      for (const key of Object.keys(sessionStorage)) if (key.startsWith("studastra-exam:") && key.endsWith(`:${testId}`)) sessionStorage.removeItem(key);
      setResult({ score: score.score, total: score.total });
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not submit this exam.");
      submissionLock.current = false;
    } finally { setBusy(false); }
  }, [answers, questions, testId]);
  submitRef.current = submitTest;

  useEffect(() => {
    if (expiresAt === null || result || busy) return;
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) {
        window.clearInterval(timer);
        if (!timeoutHandled.current) {
          timeoutHandled.current = true;
          void submitRef.current(true);
        }
      }
    }, 500);
    return () => window.clearInterval(timer);
  }, [expiresAt, result, busy]);

  useEffect(() => {
    if (!expiresAt || !questions.length || result) return;
    if (storageKey) sessionStorage.setItem(storageKey, JSON.stringify({ answers, marked, visited, current, expiresAt } satisfies SavedState));
  }, [answers, marked, visited, current, expiresAt, questions.length, result, storageKey]);

  function goToQuestion(index: number) {
    const nextIndex = Math.max(0, Math.min(questions.length - 1, index));
    setCurrent(nextIndex);
    const nextId = questions[nextIndex]?.id;
    if (nextId) setVisited((value) => value.includes(nextId) ? value : [...value, nextId]);
  }

  function toggleMarked(id: string) {
    setMarked((value) => value.includes(id) ? value.filter((item) => item !== id) : [...value, id]);
  }

  function markForReviewAndNext() {
    if (question) setMarked((value) => value.includes(question.id) ? value : [...value, question.id]);
    if (current < questions.length - 1) goToQuestion(current + 1);
  }

  function clearResponse() {
    if (!question) return;
    setAnswers((value) => { const next = { ...value }; delete next[question.id]; return next; });
  }

  function toggleMultipleOption(questionId: string, optionIndex: number) {
    setAnswers((currentAnswers) => {
      const selected = Array.isArray(currentAnswers[questionId]) ? currentAnswers[questionId] as number[] : [];
      const next = selected.includes(optionIndex) ? selected.filter((item) => item !== optionIndex) : [...selected, optionIndex].sort((a, b) => a - b);
      const updated = { ...currentAnswers };
      if (next.length) updated[questionId] = next;
      else delete updated[questionId];
      return updated;
    });
  }

  function setMatch(questionId: string, leftIndex: number, rightIndex: number | null) {
    setAnswers((currentAnswers) => {
      const selected = currentAnswers[questionId] && !Array.isArray(currentAnswers[questionId]) && typeof currentAnswers[questionId] === "object"
        ? { ...currentAnswers[questionId] as Record<string, number> }
        : {};
      if (rightIndex === null) delete selected[String(leftIndex)];
      else selected[String(leftIndex)] = rightIndex;
      const updated = { ...currentAnswers };
      if (Object.keys(selected).length) updated[questionId] = selected;
      else delete updated[questionId];
      return updated;
    });
  }

  function hasAnswer(question: Question) {
    const answer = answers[question.id];
    if (question.question_type === "single_correct") return typeof answer === "number";
    if (question.question_type === "multiple_correct") return Array.isArray(answer) && answer.length > 0;
    return Boolean(answer && !Array.isArray(answer) && typeof answer === "object" && Object.keys(answer).length > 0);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setShowSubmit(true);
  }

  const question = questions[current];
  const answeredCount = questions.filter(hasAnswer).length;
  const unansweredCount = Math.max(0, questions.length - answeredCount);
  const clock = secondsLeft === null ? "--:--" : `${String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:${String(secondsLeft % 60).padStart(2, "0")}`;

  return <main className="exam-page">
    <header className="exam-topbar"><Link className="brand" href="/dashboard"><span className="logo">✦</span> StudAstra <span className="exam-label">JEE CBT PRACTICE</span></Link><div className="exam-title">{test?.title || "Practice exam"}</div><div className={`exam-clock ${secondsLeft !== null && secondsLeft < 300 ? "exam-clock-low" : ""}`} aria-live="polite"><Clock3 size={17}/><span>Time Left&nbsp; {clock}</span></div><div className="exam-toplinks"><span><BookOpen size={14}/> Question Paper</span><span><Info size={14}/> Instructions</span></div></header>
    {result ? <section className="exam-result"><span className="pill">EXAM COMPLETE</span><h1>Your score: {result.score} / {result.total}</h1><p className="muted">Your result is saved to your account.</p><Link className="btn primary" href="/dashboard/tests">Back to practice tests</Link></section> : <div className="exam-layout">
      <section className="exam-main">
        <div className="exam-subjectbar"><span className="exam-subject">Practice Test <Info size={13}/></span><span className="exam-subject-help">{test?.title}</span></div>
        <div className="exam-sectionbar"><span>Q. No: {questions.length ? current + 1 : "—"} &nbsp; · &nbsp; Test size: {questions.length}</span><span>Q. Type : <b>{question?.question_type === "multiple_correct" ? "MCQ Multiple" : question?.question_type === "match_columns" ? "Match Columns" : "MCQ Single"}</b></span></div>
        {message && <p className="muted" role="status">{message}</p>}
        {question && <form onSubmit={onSubmit}>
          <div className="exam-question-head"><span className="exam-question-count">Question {current + 1}</span><span className="muted">{question.question_type === "multiple_correct" ? "Select all correct options" : question.question_type === "match_columns" ? "Match each item from Column I" : "Select one option"}</span></div>
          {question.prompt.trim() && <h1 className="exam-prompt">{question.prompt}</h1>}
          {question.image_path && (question.imageUrl ? <img className="exam-image" src={question.imageUrl} alt={`Image for question ${current + 1}`} /> : <p className="muted"><ImageIcon size={15}/> Question image unavailable.</p>)}
          {question.question_type === "match_columns" ? <div className="exam-match-grid">
            <div className="exam-match-head"><b>Column I</b><b>Match with Column II</b></div>
            {(question.match_left || []).map((item, index) => {
              const matchAnswer = answers[question.id] && !Array.isArray(answers[question.id]) && typeof answers[question.id] === "object" ? answers[question.id] as Record<string, number> : {};
              const usedByAnotherRow = new Set(Object.entries(matchAnswer).filter(([leftIndex]) => leftIndex !== String(index)).map(([, rightIndex]) => rightIndex));
              return <label className="exam-match-row" key={index}><span><b>{String.fromCharCode(65 + index)}.</b> {item}</span><select className="exam-match-select" aria-label={`Match Column I item ${index + 1}`} value={matchAnswer[String(index)] ?? ""} onChange={(event) => setMatch(question.id, index, event.target.value === "" ? null : Number(event.target.value))}><option value="">Select a match</option>{question.options.map((option, optionIndex) => <option key={optionIndex} value={optionIndex} disabled={usedByAnotherRow.has(optionIndex)}>{String.fromCharCode(65 + optionIndex)}. {option}</option>)}</select></label>;
            })}
          </div> : <div className="exam-options">{(question.options as string[]).map((option, index) => {
            const selected = question.question_type === "multiple_correct"
              ? Array.isArray(answers[question.id]) && (answers[question.id] as number[]).includes(index)
              : answers[question.id] === index;
            return <button className={`exam-option ${selected ? "selected" : ""}`} key={index} type="button" onClick={() => question.question_type === "multiple_correct" ? toggleMultipleOption(question.id, index) : setAnswers((value) => ({ ...value, [question.id]: index }))} aria-pressed={selected}><span className={`exam-option-key ${question.question_type === "multiple_correct" ? "checkbox" : ""}`}>{String.fromCharCode(65 + index)}</span><span>{option}</span>{selected && <Check size={18} className="exam-option-check"/>}</button>;
          })}</div>}
          <div className="exam-actionbar"><div className="exam-action-left"><button className="exam-action secondary" type="button" onClick={markForReviewAndNext}><Flag size={15}/> Mark for Review &amp; Next</button><button className="exam-action secondary" type="button" onClick={clearResponse}><Trash2 size={15}/> Clear Response</button></div><div className="exam-action-right"><button className="exam-action primary" type="button" disabled={current === 0} onClick={() => goToQuestion(current - 1)}><ChevronLeft size={15}/> Previous</button><button className="exam-action primary" type="button" onClick={() => goToQuestion(current + 1)} disabled={current === questions.length - 1}>Save &amp; Next <ChevronRight size={15}/></button></div></div>
          <p className="exam-save-note">Your selected answer is saved automatically on this device.</p>
        </form>}
      </section>
      <aside className="exam-sidebar">
        <div className="exam-status-legend"><span><i className="answered"/> Answered</span><span><i className="unanswered"/> Not Answered</span><span><i className="not-visited"/> Not Visited</span><span><i className="marked"/> Marked for Review</span><span className="exam-legend-wide"><i className="answered-marked"/> Answered &amp; Marked for Review</span></div>
        <h3 className="exam-palette-heading">Practice Test</h3>
        <div className="exam-palette">{questions.map((item, index) => {
          const isAnswered = answers[item.id] !== undefined;
          const isMarked = marked.includes(item.id);
          const isVisited = visited.includes(item.id);
          const state = isAnswered && isMarked ? "answered-marked" : isAnswered ? "answered" : isMarked ? "marked" : isVisited ? "unanswered" : "not-visited";
          return <button type="button" key={item.id} className={`exam-number ${state} ${index === current ? "current" : ""}`} onClick={() => goToQuestion(index)} aria-label={`Go to question ${index + 1}${isAnswered ? ", answered" : isVisited ? ", not answered" : ", not visited"}${isMarked ? ", marked for review" : ""}`}>{index + 1}{isAnswered && isMarked && <Check size={11}/>}</button>;
        })}</div>
        <div className="exam-counts"><span>Answered <b>{answeredCount}</b></span><span>Not answered <b>{questions.length - answeredCount}</b></span><span>Marked for review <b>{marked.length}</b></span></div>
        <button className="exam-submit-side" type="button" onClick={() => setShowSubmit(true)} disabled={busy}><Send size={15}/> Submit Test</button>
      </aside>
    </div>}
    <footer className="exam-footer"><Link href="/dashboard/tests"><ArrowLeft size={14}/> Exit to practice tests</Link><span>{test?.description}</span></footer>
    {showSubmit && <div className="exam-modal-backdrop" role="presentation"><section className="exam-modal" role="dialog" aria-modal="true" aria-labelledby="submit-heading"><h2 id="submit-heading">Submit this exam?</h2><p>You have answered {answeredCount} of {questions.length} questions. {unansweredCount ? `${unansweredCount} question${unansweredCount === 1 ? " is" : "s are"} unanswered and will be scored as incorrect.` : "All questions have an answer."}</p><div className="row"><button className="btn" type="button" onClick={() => setShowSubmit(false)}>Continue exam</button><button className="btn primary" type="button" disabled={busy} onClick={() => void submitTest(false)}>{busy ? "Submitting…" : "Submit exam"}</button></div></section></div>}
  </main>;
}

