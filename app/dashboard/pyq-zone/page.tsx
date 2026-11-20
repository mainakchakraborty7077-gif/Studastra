"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Atom, ChevronDown, CircleHelp, Orbit, Search, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import ProfileMenu from "@/components/ProfileMenu";
import TwinkleStars from "@/components/TwinkleStars";

type Question = {
  id: string; exam: "JEE Main" | "JEE Advanced"; year: number; subject: string;
  topic: string | null; paper: string | null; prompt: string; options: string[];
  question_type: string; source_url: string | null; source_name: string; question_number: number;
  answer: string | number | null; explanation?: string; source_page?: number;
};

const exams = ["JEE Main", "JEE Advanced"] as const;
const yearRanges = [1, 5, 10, 15, 20, 25];

export default function PyqZonePage() {
  const router = useRouter();
  const [items, setItems] = useState<Question[]>([]);
  const [exam, setExam] = useState<(typeof exams)[number]>("JEE Main");
  const [chapter, setChapter] = useState("All chapters");
  const [yearRange, setYearRange] = useState<number | null>(null);
  const [year, setYear] = useState("All years");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Loading the question archive…");
  const [visibleCount, setVisibleCount] = useState(50);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.replace("/auth"); return; }
        const indexResponse = await fetch("/pyq-data/index.json");
        if (!indexResponse.ok) throw new Error("The Chemistry PYQ files are not available yet.");
        const index = await indexResponse.json() as { files: string[] };
        const responses = await Promise.all(index.files.map(file => fetch(`/pyq-data/${file}`).then(response => {
          if (!response.ok) throw new Error(`Could not load ${file}.`);
          return response.json() as Promise<Question[]>;
        })));
        if (!active) return;
        setItems(responses.flat().sort((a, b) => b.year - a.year || a.question_number - b.question_number));
        setStatus("");
      } catch (error) {
        if (active) setStatus(error instanceof Error ? error.message : "Unable to load the question archive.");
      }
    }
    void load();
    return () => { active = false; };
  }, [router]);

  useEffect(() => { setVisibleCount(50); }, [exam, chapter, year, yearRange, search]);

  const years = useMemo(() => [...new Set(items.filter(q => q.exam === exam).map(q => q.year))].sort((a, b) => b - a), [items, exam]);
  const chapterCounts = useMemo(() => items.reduce((counts, q) => {
    if (q.exam === exam && q.topic) counts.set(q.topic, (counts.get(q.topic) || 0) + 1);
    return counts;
  }, new Map<string, number>()), [items, exam]);
  const chapters = useMemo(() => [...chapterCounts.keys()].sort(), [chapterCounts]);
  const filtered = useMemo(() => {
    const cutoff = yearRange ? new Date().getFullYear() - yearRange + 1 : null;
    return items.filter(q => q.exam === exam && (chapter === "All chapters" || q.topic === chapter) && (year === "All years" || String(q.year) === year) && (cutoff === null || q.year >= cutoff) && (!search || `${q.prompt} ${q.topic || ""} ${q.subject}`.toLowerCase().includes(search.toLowerCase())));
  }, [items, exam, chapter, year, yearRange, search]);

  function reveal(questionId: string) { setOpen(open === questionId ? null : questionId); }

  return <div className="pyq-shell">
    <style>{styles}{extraStyles}{chapterStyles}</style><TwinkleStars />
    <header className="pyq-top"><Link href="/dashboard" aria-label="Back to dashboard" className="back"><ArrowLeft size={18} /></Link><Link href="/dashboard" className="brand"><span className="brand-orbit"><Orbit size={20}/></span><b>StudAstra</b></Link><span className="top-label">PRACTICE UNIVERSE</span><ProfileMenu className="profile" /></header>
    <main className="pyq-content">
      <div className="eyebrow"><Sparkles size={14}/> THE PYQ ZONE</div>
      <div className="hero">
        <div><h1>Past papers.<br/><span>Future rank.</span></h1><p>Explore JEE questions by exam, year, and subject. Build consistency one orbit at a time.</p></div>
        <div className="solar" aria-hidden="true"><i className="ring ring-one"/><i className="ring ring-two"/><i className="sun"><Atom size={25}/></i><i className="planet planet-a"/><i className="planet planet-b"/><i className="planet planet-c"/></div>
      </div>
      <div className="exam-tabs" role="tablist" aria-label="Choose exam">{exams.map((x, n) => <button key={x} role="tab" aria-selected={exam === x} className={exam === x ? "selected" : ""} onClick={() => { setExam(x); setYear("All years"); }}><span className="tab-orbit">{n === 0 ? "◉" : "✦"}</span>{x}<small>{x === "JEE Main" ? "01" : "02"}</small></button>)}</div>
      <section className="chapter-section" aria-label="Choose a Chemistry chapter">
        <div className="chapter-heading"><div><span>STUDY BY CHAPTER</span><h2>Chemistry chapters</h2></div><small>{chapters.length} chapters</small></div>
        <div className="chapter-grid">
          <button className={`chapter-card all-chapters ${chapter === "All chapters" ? "selected" : ""}`} aria-pressed={chapter === "All chapters"} onClick={() => setChapter("All chapters")}><b>All chapters</b><span>{items.filter(q => q.exam === exam).length} questions</span></button>
          {chapters.map(name => <button key={name} className={`chapter-card ${chapter === name ? "selected" : ""}`} aria-pressed={chapter === name} onClick={() => setChapter(name)}><b>{name}</b><span>{chapterCounts.get(name)} questions</span></button>)}
        </div>
      </section>
      <section className="filter-panel" aria-label="Filter questions">
        <label className="search"><Search size={17}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search a topic or question" /></label>
        <label className="select-wrap"><select value={year} onChange={e => setYear(e.target.value)}><option>All years</option>{years.map(y => <option key={y}>{y}</option>)}</select><ChevronDown size={15}/></label>
        <span className="count">{filtered.length} {filtered.length === 1 ? "question" : "questions"}</span>
      </section>
      <section className="year-ranges" aria-label="Filter by recent years"><span>RECENT YEARS</span><button className={yearRange === null ? "active" : ""} onClick={() => setYearRange(null)}>All</button>{yearRanges.map(n => <button className={yearRange === n ? "active" : ""} key={n} onClick={() => setYearRange(n)}>Last {n} {n === 1 ? "year" : "years"}</button>)}</section>
      {status && <div className="empty"><div className="empty-icon"><CircleHelp size={24}/></div><h2>Your archive is taking shape</h2><p>{status}</p><a className="source-link" href="https://my.newtonschool.co/study-buddy" target="_blank" rel="noreferrer">Open Newton School Study Buddy <ArrowUpRight size={16}/></a></div>}
      {!status && filtered.length === 0 && <div className="empty"><div className="empty-icon"><Orbit size={25}/></div><h2>No questions in this orbit yet</h2><p>The current uploads cover JEE Main Chemistry. Try another Chemistry chapter or year.</p></div>}
      {!status && <div className="question-list">{filtered.slice(0, visibleCount).map(q => <article className="question-card" key={q.id}>
        <div className="q-meta"><span className="q-num">{String(q.question_number).padStart(2, "0")}</span><span>{q.subject}</span>{q.topic && <><i/> <span>{q.topic}</span></>}<b>{q.year}{q.paper ? ` · ${q.paper}` : ""}</b></div>
        <p className="prompt">{q.prompt}</p>
        <div className="options">{q.options.map((o, oi) => <div className="option" key={oi}><span>{String.fromCharCode(65 + oi)}</span>{o}</div>)}</div>
        {q.source_url && <a className="question-page-link" href={q.source_url} target="_blank" rel="noreferrer">View full question <ArrowUpRight size={13}/></a>}
        <button className="answer-toggle" onClick={() => reveal(q.id)}>{open === q.id ? "Hide answer" : "Show answer"}<ChevronDown size={16} className={open === q.id ? "turned" : ""}/></button>
        {open === q.id && <div className="answer"><b>Answer</b><p>{q.answer ?? "Not available in the answer key."}</p>{q.explanation && <p>{q.explanation}</p>}</div>}
      </article>)}</div>}
      {!status && filtered.length > visibleCount && <button className="load-more" onClick={() => setVisibleCount(n => n + 50)}>Load more questions</button>}
      <footer>Pick a chapter to practise its PYQs. <Link href="/dashboard/tests">Open practice tests <ArrowUpRight size={13}/></Link></footer>
    </main>
  </div>;
}

const styles = `
.pyq-shell{min-height:100vh;position:relative;overflow:hidden;color:#eaf5fa;background:radial-gradient(ellipse at 82% 13%,#132f3e 0,#0b1721 34%,#080f17 74%);font-family:system-ui,-apple-system,"Segoe UI",sans-serif}.pyq-top{height:66px;display:flex;align-items:center;gap:17px;padding:0 max(24px,calc((100vw - 1120px)/2));border-bottom:1px solid rgba(206,236,255,.08);position:relative;z-index:2;background:rgba(7,14,21,.5)}.back{color:#9ab1bd;display:flex}.brand{display:flex;align-items:center;gap:9px;color:#ecfaff;text-decoration:none}.brand-orbit{color:#49d9ed;width:32px;height:32px;display:grid;place-items:center;border:1px solid #36bfd5;border-radius:50%;box-shadow:0 0 20px #24bdd52e}.top-label{font-size:10px;letter-spacing:.18em;color:#617b8b;margin-left:12px}.profile{position:relative;margin-left:auto}.pyq-content{max-width:1000px;margin:0 auto;padding:50px 28px 55px;position:relative;z-index:1}.eyebrow{display:inline-flex;gap:7px;align-items:center;color:#6ddceb;letter-spacing:.14em;font-size:11px;font-weight:700}.hero{display:flex;align-items:center;justify-content:space-between;min-height:245px}.hero h1{font-size:52px;letter-spacing:-.045em;line-height:1.05;margin:18px 0 12px}.hero h1 span{color:#70e1ed}.hero p{color:#94aab6;max-width:480px;line-height:1.65;margin:0}.solar{width:210px;height:210px;position:relative;margin-right:35px}.ring{position:absolute;border:1px solid rgba(98,215,235,.2);border-radius:50%;left:50%;top:50%;transform:translate(-50%,-50%)}.ring-one{width:114px;height:114px}.ring-two{width:190px;height:190px;border-style:dashed;animation:spin 36s linear infinite}.sun{width:54px;height:54px;position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:grid;place-items:center;border-radius:50%;color:#8af0fa;background:radial-gradient(circle,#25758b,#102d3c 70%);box-shadow:0 0 38px #21bed755}.planet{position:absolute;border-radius:50%;box-shadow:0 0 15px currentColor}.planet-a{width:12px;height:12px;background:#f0bb83;color:#f0bb83;left:26px;top:72px}.planet-b{width:8px;height:8px;background:#75c8ff;color:#75c8ff;right:8px;top:104px}.planet-c{width:7px;height:7px;background:#c0a4ff;color:#c0a4ff;right:40px;top:22px}.exam-tabs{display:flex;gap:10px;margin:5px 0 18px}.exam-tabs button{display:flex;align-items:center;gap:11px;padding:13px 17px;background:rgba(15,28,38,.75);border:1px solid rgba(190,229,242,.11);border-radius:13px;color:#9db2bd;font:inherit;cursor:pointer}.exam-tabs button.selected{background:linear-gradient(115deg,#123846,#142735);border-color:#3ec6d8;color:#f2fcff;box-shadow:0 0 26px #34d4e513}.exam-tabs button small{font-size:10px;color:#66828e;margin-left:9px}.tab-orbit{font-size:18px;color:#57cfdf}.filter-panel{display:flex;align-items:center;gap:10px;padding:12px;background:rgba(12,23,32,.8);border:1px solid rgba(190,229,242,.1);border-radius:16px}.search,.select-wrap{display:flex;align-items:center;gap:9px;padding:0 12px;height:42px;border-radius:10px;background:#0a151e;border:1px solid rgba(180,220,236,.09);color:#7c9aa7}.search{flex:1}.search input{width:100%;min-width:100px;background:none;border:0;outline:0;color:#edf8fc;font:inherit;font-size:13px}.search input::placeholder{color:#68818d}.select-wrap{position:relative}.select-wrap select{appearance:none;border:0;outline:0;background:transparent;color:#c6d5da;font:inherit;font-size:13px;min-width:92px;padding-right:4px}.select-wrap option{background:#101d27}.select-wrap>svg:last-child{pointer-events:none}.count{font-size:12px;color:#6d8996;padding:0 9px;white-space:nowrap}.empty{margin-top:22px;text-align:center;padding:58px 24px 62px;border:1px solid rgba(133,203,221,.12);border-radius:20px;background:radial-gradient(ellipse at 50% 0%,rgba(36,119,143,.1),transparent 60%),rgba(11,21,29,.65)}.empty-icon{width:50px;height:50px;border-radius:50%;margin:0 auto 15px;display:grid;place-items:center;color:#71deeb;background:#173440;border:1px solid #2f7180}.empty h2{font-size:20px;margin:0 0 8px}.empty p{max-width:560px;margin:0 auto;color:#8fa5b1;font-size:14px;line-height:1.65}.source-link{margin-top:21px;display:inline-flex;gap:7px;align-items:center;color:#73e1ec;text-decoration:none;font-size:13px;font-weight:600}.attribution{margin-top:10px;color:#688590;font-size:11px}.attribution a{color:#70cfdb;text-decoration:none;display:inline-flex;align-items:center;gap:3px}.question-list{display:grid;gap:13px;margin-top:18px}.question-card{background:rgba(13,24,33,.88);border:1px solid rgba(175,224,240,.12);border-radius:16px;padding:20px}.q-meta{display:flex;align-items:center;gap:9px;color:#7f9ba8;font-size:11px}.q-meta i{height:3px;width:3px;border-radius:50%;background:#4c6a76}.q-meta b{margin-left:auto;color:#83d9e4;font-weight:600}.q-num{color:#50cada;font-weight:700;font-variant-numeric:tabular-nums}.prompt{font-size:16px;line-height:1.65;color:#e7f2f5;margin:16px 0}.options{display:grid;grid-template-columns:1fr 1fr;gap:9px}.option{display:flex;gap:10px;align-items:flex-start;padding:11px 12px;border:1px solid rgba(177,218,232,.09);border-radius:10px;color:#a9bec7;font-size:13px;line-height:1.5}.option span{color:#55cddd;font-weight:700}.answer-toggle{border:0;background:none;color:#6cdce8;display:flex;align-items:center;gap:5px;padding:14px 0 0;font:inherit;font-size:12px;cursor:pointer}.turned{transform:rotate(180deg)}.answer{margin-top:12px;border-left:2px solid #4ac8d7;background:#10242e;padding:12px 15px;border-radius:0 9px 9px 0;color:#b8cbd2;font-size:13px}.answer p{margin:4px 0}.answer b{color:#78e0ea}footer{margin-top:22px;display:flex;justify-content:space-between;gap:12px;color:#59727e;font-size:11px}footer a{color:#73dce7;text-decoration:none;display:inline-flex;align-items:center;gap:3px}@keyframes spin{to{transform:translate(-50%,-50%) rotate(360deg)}}@media(max-width:700px){.pyq-top{padding:0 16px}.top-label{display:none}.pyq-content{padding:32px 16px 42px}.hero{min-height:225px}.hero h1{font-size:42px}.solar{transform:scale(.72);transform-origin:center right;margin-right:-22px}.filter-panel{flex-wrap:wrap}.search{flex-basis:100%}.select-wrap{flex:1;justify-content:space-between}.count{margin-left:auto}.options{grid-template-columns:1fr}.exam-tabs button{flex:1;justify-content:center;padding:12px 8px}.exam-tabs button small{display:none}footer{flex-direction:column}}
`;
const extraStyles = `
.year-ranges{display:flex;align-items:center;flex-wrap:wrap;gap:7px;padding:16px 2px 0}.year-ranges span{font-size:9px;letter-spacing:.14em;color:#63828f;margin-right:4px}.year-ranges button{border:1px solid rgba(166,215,231,.12);border-radius:99px;padding:7px 11px;background:rgba(12,23,32,.65);color:#91a9b4;font:inherit;font-size:11px;cursor:pointer}.year-ranges button:hover,.year-ranges button.active{color:#e8fcff;border-color:#3db7c7;background:#12313b}.load-more{display:block;margin:18px auto 0;border:1px solid #3db7c7;border-radius:12px;padding:11px 18px;background:#12313b;color:#dffaff;font:inherit;cursor:pointer}.load-more:disabled{opacity:.65;cursor:wait}
`;

const chapterStyles = `
.chapter-section{margin:0 0 18px;padding:16px;border:1px solid rgba(190,229,242,.1);border-radius:16px;background:rgba(12,23,32,.58)}.chapter-heading{display:flex;align-items:center;justify-content:space-between;margin:0 2px 13px}.chapter-heading>div>span{font-size:9px;letter-spacing:.15em;color:#6c9ba8}.chapter-heading h2{margin:3px 0 0;font-size:17px;color:#e7f6fa}.chapter-heading>small{color:#698895;font-size:11px}.chapter-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.chapter-card{min-height:66px;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:5px;padding:10px 12px;border:1px solid rgba(171,216,232,.1);border-radius:11px;background:rgba(8,18,26,.76);color:#d6e7eb;text-align:left;font:inherit;cursor:pointer;transition:border-color .18s,background .18s,transform .18s}.chapter-card:hover{border-color:#3e9dac;background:#112a35;transform:translateY(-1px)}.chapter-card.selected{border-color:#46c3d2;background:linear-gradient(115deg,#123846,#142735);box-shadow:0 0 18px #34d4e510}.chapter-card b{font-size:12px;font-weight:600;line-height:1.3}.chapter-card span{color:#77949e;font-size:10px}.question-page-link{display:inline-flex;align-items:center;gap:5px;margin-top:2px;color:#70cfdb;text-decoration:none;font-size:11px}.question-page-link:hover{color:#a3f4fa}@media(max-width:850px){.chapter-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:600px){.chapter-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.chapter-section{padding:12px}.chapter-card{min-height:62px;padding:9px}.chapter-card b{font-size:11px}}
`;
