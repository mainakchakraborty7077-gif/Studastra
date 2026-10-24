"use client";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, ClipboardCheck, Flame, LayoutDashboard, Library, ListChecks, Plus, Search, Settings, ShieldCheck, Sparkles, StickyNote, Target, Timer, Trash2, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import ProfileMenu from "@/components/ProfileMenu";

type StudyItem = { id: string; title: string; body: string; kind: "goal" | "note"; created_at: string };

const t = { morning: "Good Morning", afternoon: "Good Afternoon", evening: "Good Evening", student: "Student", search: "Search everything…", today: "Today's Goal", entries: "entries", streak: "Study Streak", days: "Days", week: "This Week's Progress", cont: "Continue Learning", open: "Open", first: "Add your first goal or note below.", subjects: "Subjects", ach: "Achievements", space: "Your study space", add: "Add a goal or note", saved: "Your saved entries", empty: "Nothing here yet. Add your first goal or note.", soon: "Soon", goal: "Study goal", note: "Study note", save: "Save to my account", saving: "Saving…", type: "Entry type", title: "Title", details: "Details", mention: "mentions" };
const NAV = [
  { en: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { en: "Syllabus", icon: BookOpen, href: "/dashboard/syllabus" },
  { en: "DPP", icon: ListChecks },
  { en: "Question Bank", icon: Library },
  { en: "Notes", icon: StickyNote, href: "#space" },
  { en: "AI Tutor", icon: Sparkles },
  { en: "Quiz", icon: Target },
  { en: "Tests", icon: ClipboardCheck, href: "/dashboard/tests" },
  { en: "Focus Timer", icon: Timer, href: "/dashboard/focus" },
  { en: "Progress", icon: TrendingUp },
  { en: "Settings", icon: Settings, href: "/profile" },
  { en: "Admin login", icon: ShieldCheck, href: "/admin/login" },
];
const SUBJECTS = [
  { name: "Physics", icon: "⚛️", key: "physics" },
  { name: "Chemistry", icon: "🧪", key: "chem" },
  { name: "Mathematics", icon: "📐", key: "math" },
  { name: "Biology", icon: "🧬", key: "bio" },
];
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export default function Dashboard() {
  const [items, setItems] = useState<StudyItem[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<"goal" | "note">("goal");
  const [message, setMessage] = useState("Loading your workspace…");
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [q, setQ] = useState("");
  const router = useRouter();

  async function load() {
    try {
      const s = createClient();
      const { data: { user }, error: userError } = await s.auth.getUser();
      if (userError || !user) { router.replace("/auth"); return; }
      const { data: p } = await s.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      const full = p?.full_name || (user.user_metadata?.display_name as string) || "";
      setName(full.trim().split(" ")[0] || "");
      const { data, error } = await s.from("study_items").select("id,title,body,kind,created_at").order("created_at", { ascending: false });
      if (error) throw error;
      setItems((data || []) as StudyItem[]);
      setMessage("");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Unable to load study data."); }
  }
  useEffect(() => { void load(); }, []);

  async function add(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMessage("");
    try {
      const s = createClient();
      const { data: { user } } = await s.auth.getUser();
      if (!user) { router.replace("/auth"); return; }
      const { data, error } = await s.from("study_items").insert({ user_id: user.id, title: title.trim(), body: body.trim(), kind }).select("id,title,body,kind,created_at").single();
      if (error) throw error;
      setItems(old => [data as StudyItem, ...old]); setTitle(""); setBody(""); setMessage("Saved to your account.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Could not save this item."); } finally { setBusy(false); }
  }
  async function remove(id: string) {
    const s = createClient();
    const { error } = await s.from("study_items").delete().eq("id", id);
    if (error) { setMessage(error.message); return; }
    setItems(old => old.filter(x => x.id !== id));
  }

  const stats = useMemo(() => {
    const days = new Set(items.map(i => dayKey(new Date(i.created_at))));
    const now = new Date();
    const last7 = Array.from({ length: 7 }, (_, n) => { const d = new Date(now); d.setDate(now.getDate() - (6 - n)); return days.has(dayKey(d)); });
    let streak = 0; const d = new Date(now);
    if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
    while (days.has(dayKey(d))) { streak++; d.setDate(d.getDate() - 1); }
    const today = items.filter(i => dayKey(new Date(i.created_at)) === dayKey(now)).length;
    const week = items.filter(i => now.getTime() - new Date(i.created_at).getTime() < 7 * 864e5).length;
    return { last7, streak, today, weekPct: Math.min(100, Math.round((week / 10) * 100)) };
  }, [items]);

  const goals = items.filter(i => i.kind === "goal").length;
  const notes = items.length - goals;
  const achievements = [
    { label: "First entry", on: items.length >= 1 }, { label: "5 Goals Saved", on: goals >= 5 },
    { label: "Note Taker", on: notes >= 3 }, { label: "3 Day Streak", on: stats.streak >= 3 },
    { label: "7 Day Streak", on: stats.streak >= 7 }, { label: "10 Entries", on: items.length >= 10 },
  ];
  const hour = new Date().getHours();
  const hello = hour < 12 ? t.morning : hour < 17 ? t.afternoon : t.evening;
  const latest = items[0];
  const shown = items.filter(i => (i.title + " " + i.body).toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="ds-shell">
      <style>{css}</style>
      <aside className="ds-side">
        <Link href="/" className="ds-logo"><span className="ds-mark">✦</span><b>StudAstra</b></Link>
        <nav className="ds-nav">
          {NAV.map(n => {
            const Icon = n.icon; const label = n.en;
            return n.href
              ? <Link key={n.en} href={n.href} className={`ds-link ${n.en === "Dashboard" ? "on" : ""}`}><Icon size={17} />{label}</Link>
              : <div key={n.en} className="ds-link off" aria-disabled="true"><Icon size={17} />{label}<em>{t.soon}</em></div>;
          })}
        </nav>
        <div className="ds-tag"><b>PCMB only</b><span>Physics • Chemistry • Mathematics • Biology</span></div>
      </aside>

      <div className="ds-main">
        <header className="ds-top">
          <label className="ds-search"><Search size={16} /><input value={q} onChange={e => setQ(e.target.value)} placeholder={t.search} aria-label={t.search} /></label>
          <ProfileMenu className="ds-pm" />
        </header>

        <main className="ds-page">
          <h1 className="ds-hello">{hello}, {name || t.student} 👋</h1>
          <section className="ds-shortcuts" aria-label="Quick links">
            <Link href="/dashboard/syllabus" className="ds-card ds-shortcut"><BookOpen size={20} /><span><b>Syllabus</b><small>Class 11 and 12 PCMB chapters</small></span><ArrowRight size={17} /></Link>
            <Link href="/admin/login" className="ds-card ds-shortcut"><ShieldCheck size={20} /><span><b>Admin login</b><small>Administrator sign in</small></span><ArrowRight size={17} /></Link>
          </section>
          {message && <p className="ds-msg" role="status">{message}</p>}

          <section className="ds-cards3">
            <div className="ds-card"><p className="ds-k">{t.today}</p><p className="ds-big">{stats.today}<small> / 3 {t.entries}</small></p><div className="ds-bar"><i style={{ width: `${Math.min(100, (stats.today / 3) * 100)}%` }} /></div></div>
            <div className="ds-card"><p className="ds-k">{t.streak}</p><p className="ds-big"><Flame size={22} color="#f59e0b" /> {stats.streak} {t.days}</p><div className="ds-dots">{stats.last7.map((on, n) => <i key={n} className={on ? "on" : ""} />)}</div></div>
            <div className="ds-card"><p className="ds-k">{t.week}</p><p className="ds-big">{stats.weekPct}%</p><div className="ds-bar"><i style={{ width: `${stats.weekPct}%` }} /></div></div>
          </section>

          <section className="ds-card ds-continue">
            <div><p className="ds-k">{t.cont}</p><p className="ds-big" style={{ fontSize: 22 }}>{latest ? latest.title : "✦ StudAstra"}</p><p className="ds-k" style={{ margin: 0 }}>{latest ? `${latest.kind === "goal" ? t.goal : t.note} • ${new Date(latest.created_at).toLocaleDateString()}` : t.first}</p></div>
            <a href="#space" className="ds-go">{t.open} <ArrowRight size={16} /></a>
          </section>

          <h2 className="ds-h2">{t.subjects}</h2>
          <section className="ds-cards4">
            {SUBJECTS.map(s => {
              const n = items.filter(i => (i.title + " " + i.body).toLowerCase().includes(s.key)).length;
              return <div key={s.name} className="ds-card"><p className="ds-emoji">{s.icon}</p><p className="ds-big" style={{ fontSize: 19 }}>{s.name}</p><div className="ds-bar"><i style={{ width: `${items.length ? (n / items.length) * 100 : 0}%` }} /></div><p className="ds-k" style={{ margin: "8px 0 0" }}>{n} {t.mention}</p></div>;
            })}
          </section>

          <section className="ds-card">
            <p className="ds-k" style={{ color: "#e8f1f5", fontWeight: 600 }}>{t.ach}</p>
            <div className="ds-chips">{achievements.map(a => <span key={a.label} className={a.on ? "on" : ""}>{a.label}</span>)}</div>
          </section>

          <h2 className="ds-h2" id="space">{t.space}</h2>
          <section className="ds-two">
            <div className="ds-card">
              <h3 className="ds-h3">{t.add}</h3>
              <form onSubmit={add} className="ds-form">
                <label htmlFor="kind">{t.type}</label>
                <select id="kind" value={kind} onChange={e => setKind(e.target.value as "goal" | "note")}><option value="goal">{t.goal}</option><option value="note">{t.note}</option></select>
                <label htmlFor="title">{t.title}</label>
                <input id="title" value={title} onChange={e => setTitle(e.target.value)} maxLength={160} placeholder="e.g. Revise cell biology" required />
                <label htmlFor="body">{t.details}</label>
                <textarea id="body" rows={4} value={body} onChange={e => setBody(e.target.value)} maxLength={10000} placeholder="Write a few details…" />
                <button className="ds-go" disabled={busy}><Plus size={16} />{busy ? t.saving : t.save}</button>
              </form>
            </div>
            <div className="ds-card">
              <h3 className="ds-h3">{t.saved}</h3>
              {shown.length === 0 ? <p className="ds-k">{t.empty}</p> : shown.map(item => (
                <article className="ds-item" key={item.id}>
                  <div><b>{item.title}</b><p className="ds-k" style={{ margin: "2px 0" }}>{item.kind === "goal" ? t.goal : t.note} • {new Date(item.created_at).toLocaleDateString()}</p>{item.body && <p style={{ margin: "6px 0 0", whiteSpace: "pre-wrap", fontSize: 14 }}>{item.body}</p>}</div>
                  <button aria-label={"Delete " + item.title} onClick={() => void remove(item.id)}><Trash2 size={15} /></button>
                </article>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

const css = `
.ds-shell{display:flex;min-height:100vh;background:radial-gradient(ellipse at 70% 0%,#0f2530 0%,#0a1016 55%);color:#e8f1f5;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.ds-side{width:248px;flex-shrink:0;position:sticky;top:0;height:100vh;box-sizing:border-box;padding:16px 12px;display:flex;flex-direction:column;gap:18px;background:#0c141b;border-right:1px solid rgba(255,255,255,.07)}
.ds-logo{display:flex;align-items:center;gap:10px;padding:6px 8px;color:#7fe7f2;text-decoration:none;font-size:20px}
.ds-mark{width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#123846,#0a1a24);border:1px solid rgba(34,211,238,.4);color:#22d3ee}
.ds-nav{display:flex;flex-direction:column;gap:4px;flex:1;overflow:auto}
.ds-link{display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:999px;color:rgba(232,241,245,.72);font-size:15px;text-decoration:none;border:1px solid transparent}
.ds-link:hover{color:#fff;background:rgba(255,255,255,.05)}
.ds-link.on{color:#fff;background:#111d26;border-color:rgba(34,211,238,.35)}
.ds-link.off{opacity:.5;cursor:default}.ds-link.off:hover{background:none;color:rgba(232,241,245,.72)}
.ds-link em{margin-left:auto;font-style:normal;font-size:10px;padding:2px 7px;border-radius:99px;background:rgba(255,255,255,.08)}
.ds-tag{padding:14px;border-radius:16px;background:#111b24;border:1px solid rgba(255,255,255,.08);font-size:12px;color:rgba(232,241,245,.65);display:flex;flex-direction:column;gap:6px}
.ds-tag b{font-size:15px;color:#fff}
.ds-main{flex:1;min-width:0}
.ds-top{display:flex;align-items:center;gap:14px;padding:12px 28px;border-bottom:1px solid rgba(255,255,255,.06)}
.ds-search{flex:1;max-width:420px;display:flex;align-items:center;gap:10px;padding:10px 16px;border-radius:999px;background:#0f1922;border:1px solid rgba(255,255,255,.1);color:rgba(232,241,245,.6)}
.ds-search input{flex:1;background:none;border:0;outline:0;color:#e8f1f5;font-size:14px;font-family:inherit;min-width:0}
.ds-pm{position:relative;margin-left:auto}
.ds-page{max-width:1120px;margin:0 auto;padding:26px 28px 70px}
.ds-hello{font-size:34px;margin:0 0 20px;font-weight:700}
.ds-msg{padding:10px 14px;border-radius:12px;background:rgba(34,211,238,.1);border:1px solid rgba(34,211,238,.25);font-size:14px}
.ds-card{box-sizing:border-box;padding:20px;border-radius:20px;background:rgba(18,28,37,.85);border:1px solid rgba(255,255,255,.08)}
.ds-cards3{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:16px}
.ds-shortcuts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:-4px 0 18px}
.ds-shortcut{display:flex;align-items:center;gap:12px;color:inherit;text-decoration:none;border-color:rgba(34,211,238,.22)}
.ds-shortcut span{display:flex;flex:1;flex-direction:column;gap:3px}
.ds-shortcut small{font-size:12px;color:rgba(232,241,245,.6)}
.ds-cards4{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:16px}
.ds-two{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.ds-k{margin:0 0 6px;font-size:13px;color:rgba(232,241,245,.6)}
.ds-big{margin:0 0 12px;font-size:30px;font-weight:700;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.ds-big small{font-size:14px;color:rgba(232,241,245,.55);font-weight:500}
.ds-bar{height:8px;border-radius:99px;background:rgba(255,255,255,.08);overflow:hidden}
.ds-bar i{display:block;height:100%;border-radius:99px;background:#22d3ee}
.ds-dots{display:grid;grid-template-columns:repeat(7,1fr);gap:8px}
.ds-dots i{height:22px;border-radius:99px;background:rgba(255,255,255,.07)}
.ds-dots i.on{background:#1b6f7c}
.ds-continue{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:8px;border-color:rgba(34,211,238,.3);box-shadow:0 0 40px rgba(34,211,238,.07)}
.ds-continue .ds-big{margin-bottom:6px}
.ds-go{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:11px 20px;border:0;border-radius:12px;background:#22d3ee;color:#04222a;font-weight:600;font-size:15px;text-decoration:none;cursor:pointer;font-family:inherit;white-space:nowrap}
.ds-go:disabled{opacity:.6}
.ds-h2{font-size:18px;margin:26px 0 12px}
.ds-h3{margin:0 0 14px;font-size:17px}
.ds-emoji{font-size:26px;margin:0 0 12px}
.ds-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
.ds-chips span{padding:6px 14px;border-radius:99px;font-size:13px;color:rgba(232,241,245,.4);border:1px solid rgba(255,255,255,.08)}
.ds-chips span.on{color:#fff;border-color:#22d3ee;background:rgba(34,211,238,.08)}
.ds-form{display:flex;flex-direction:column;gap:8px}
.ds-form label{font-size:13px;color:rgba(232,241,245,.7)}
.ds-form input,.ds-form select,.ds-form textarea{box-sizing:border-box;width:100%;padding:11px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:#0c141b;color:#e8f1f5;font-size:15px;font-family:inherit}
.ds-form input:focus,.ds-form select:focus,.ds-form textarea:focus{outline:2px solid rgba(34,211,238,.45)}
.ds-form .ds-go{margin-top:8px}
.ds-item{display:flex;justify-content:space-between;gap:12px;padding:14px 0;border-top:1px solid rgba(255,255,255,.07)}
.ds-item button{align-self:flex-start;background:none;border:1px solid rgba(255,255,255,.12);border-radius:10px;color:rgba(232,241,245,.7);padding:7px;cursor:pointer}
.ds-item button:hover{color:#fff;border-color:#22d3ee}
@media(max-width:1000px){.ds-cards4{grid-template-columns:repeat(2,1fr)}}
@media(max-width:860px){.ds-side{display:none}.ds-shortcuts{grid-template-columns:1fr}.ds-cards3,.ds-two{grid-template-columns:1fr}.ds-top{padding:12px 16px}.ds-page{padding:20px 16px 60px}.ds-hello{font-size:26px}.ds-continue{flex-direction:column;align-items:flex-start}}
`;

