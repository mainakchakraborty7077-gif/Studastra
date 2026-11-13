"use client";

import { ChangeEvent, FormEvent, KeyboardEvent, ReactNode, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ImagePlus, Send, Sparkles, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import TwinkleStars from "@/components/TwinkleStars";

type Msg = { role: "user" | "assistant"; text: string; image?: string; error?: boolean };
type Status = "loading" | "ready" | "soon";

const HISTORY_TURNS = 6;
const STORE_KEY = "studastra-ask-ai-chat";
const LANGS = [
  { id: "auto", label: "Auto" },
  { id: "en", label: "English" },
  { id: "bn", label: "বাংলা" },
  { id: "hi", label: "हिन्दी" },
];
const EXAMPLES = [
  "A ball is thrown up at 20 m/s. How high does it go? (g = 10 m/s²)",
  "SN1 আর SN2 বিক্রিয়ার পার্থক্য কী?",
  "Integration by parts kab use karte hain? Ek example do.",
  "Explain the light reaction of photosynthesis in simple steps.",
];

/* ---------- tiny safe Markdown renderer (no HTML injection) ---------- */
function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g;
  let last = 0; let m: RegExpExecArray | null; let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith("**")) out.push(<strong key={`${key}-${i++}`}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`")) out.push(<code key={`${key}-${i++}`}>{t.slice(1, -1)}</code>);
    else out.push(<em key={`${key}-${i++}`}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let code: string[] | null = null;
  let para: string[] = [];
  const flushPara = () => { if (para.length) { blocks.push(<p key={blocks.length}>{inline(para.join(" "), `p${blocks.length}`)}</p>); para = []; } };
  const flushList = () => {
    if (!list) return;
    const items = list.items.map((it, n) => <li key={n}>{inline(it, `l${blocks.length}-${n}`)}</li>);
    blocks.push(list.ordered ? <ol key={blocks.length}>{items}</ol> : <ul key={blocks.length}>{items}</ul>);
    list = null;
  };
  for (const raw of lines) {
    if (code) {
      if (raw.trim().startsWith("```")) { blocks.push(<pre key={blocks.length}>{code.join("\n")}</pre>); code = null; }
      else code.push(raw);
      continue;
    }
    const line = raw.trimEnd();
    if (line.trim().startsWith("```")) { flushPara(); flushList(); code = []; continue; }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    const ol = /^\s*(\d+)[.)]\s+(.*)$/.exec(line);
    const ul = /^\s*[-*•]\s+(.*)$/.exec(line);
    if (h) { flushPara(); flushList(); blocks.push(<h4 key={blocks.length}>{inline(h[2], `h${blocks.length}`)}</h4>); }
    else if (ol) { flushPara(); if (!list || !list.ordered) { flushList(); list = { ordered: true, items: [] }; } list.items.push(ol[2]); }
    else if (ul) { flushPara(); if (!list || list.ordered) { flushList(); list = { ordered: false, items: [] }; } list.items.push(ul[1]); }
    else if (!line.trim()) { flushPara(); flushList(); }
    else if (/^-{3,}$/.test(line.trim())) { flushPara(); flushList(); blocks.push(<hr key={blocks.length} />); }
    else { flushList(); para.push(line.trim()); }
  }
  if (code) blocks.push(<pre key={blocks.length}>{(code as string[]).join("\n")}</pre>);
  flushPara(); flushList();
  return <div className="ai-md">{blocks}</div>;
}

/* ---------- shrink a photo in the browser before sending ---------- */
async function shrinkImage(file: File): Promise<{ mimeType: string; data: string; preview: string }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image(); el.onload = () => resolve(el); el.onerror = () => reject(new Error("Could not read that image.")); el.src = url;
    });
    const max = 1400;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not read that image.");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const preview = canvas.toDataURL("image/jpeg", 0.85);
    return { mimeType: "image/jpeg", data: preview.split(",")[1], preview };
  } finally { URL.revokeObjectURL(url); }
}

export default function AskAIPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("loading");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [lang, setLang] = useState("auto");
  const [busy, setBusy] = useState(false);
  const [used, setUsed] = useState(0);
  const [limit, setLimit] = useState(20);
  const [photo, setPhoto] = useState<{ mimeType: string; data: string; preview: string } | null>(null);
  const [note, setNote] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function init() {
      try {
        const s = createClient();
        const { data: { user } } = await s.auth.getUser();
        if (!user) { router.replace("/auth"); return; }
        const r = await fetch("/api/ask-ai", { cache: "no-store" });
        if (r.status === 401) { router.replace("/auth"); return; }
        const d = await r.json().catch(() => ({}));
        if (!d.enabled) { setStatus("soon"); return; }
        setLimit(d.limit ?? 20); setUsed(d.used ?? 0);
        try { const saved = JSON.parse(sessionStorage.getItem(STORE_KEY) || "[]"); if (Array.isArray(saved)) setMessages(saved); } catch { /* ignore */ }
        setStatus("ready");
      } catch { setStatus("soon"); }
    }
    void init();
  }, [router]);

  useEffect(() => {
    if (status !== "ready") return;
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify(messages.filter(m => !m.error).slice(-30).map(m => ({ role: m.role, text: m.text })))); } catch { /* ignore */ }
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status, busy]);

  async function pickPhoto(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) { setNote("Please choose a photo."); return; }
    try { setPhoto(await shrinkImage(f)); setNote(""); } catch (err) { setNote(err instanceof Error ? err.message : "Could not read that image."); }
  }

  async function ask(text?: string) {
    const question = (text ?? input).trim();
    if ((!question && !photo) || busy) return;
    if (used >= limit) { setNote(`You've used all ${limit} questions for today. Come back tomorrow!`); return; }
    const history = messages.filter(m => !m.error).slice(-HISTORY_TURNS * 2).map(m => ({ role: m.role, text: m.text }));
    const sentPhoto = photo;
    setMessages(old => [...old, { role: "user", text: question || "(photo of a question)", image: sentPhoto?.preview }]);
    setInput(""); setPhoto(null); setNote(""); setBusy(true);
    try {
      const r = await fetch("/api/ask-ai", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history, lang, image: sentPhoto ? { mimeType: sentPhoto.mimeType, data: sentPhoto.data } : undefined }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.status === 401) { router.replace("/auth"); return; }
      if (d.code === "disabled") { setStatus("soon"); return; }
      if (!r.ok || !d.answer) {
        if (d.code === "limit") setUsed(d.limit ?? limit);
        setMessages(old => [...old, { role: "assistant", text: d.error || (r.status === 429 ? "AI is busy, try again in a minute." : "Something went wrong. Please try again."), error: true }]);
        return;
      }
      if (typeof d.used === "number") setUsed(d.used);
      setMessages(old => [...old, { role: "assistant", text: d.answer }]);
    } catch {
      setMessages(old => [...old, { role: "assistant", text: "Network problem. Check your connection and try again.", error: true }]);
    } finally { setBusy(false); }
  }

  function onSubmit(e: FormEvent) { e.preventDefault(); void ask(); }
  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void ask(); }
  }
  function clearChat() { setMessages([]); try { sessionStorage.removeItem(STORE_KEY); } catch { /* ignore */ } }

  const left = Math.max(0, limit - used);

  return (
    <div className="ai-shell">
      <style>{css}</style>
      <TwinkleStars />
      <div className="ai-wrap">
        <Link href="/dashboard" className="ai-back">← Back to dashboard</Link>
        <div className="ai-head">
          <span className="ai-mark"><Sparkles size={20} /></span>
          <div>
            <h1 className="ai-title">Ask AI</h1>
            <p className="ai-sub">Your free doubt solver for Physics, Chemistry, Maths and Biology. Ask in English, বাংলা or हिन्दी.</p>
          </div>
        </div>

        {status === "loading" && <section className="ai-card ai-center"><p className="ai-k">Loading…</p></section>}

        {status === "soon" && (
          <section className="ai-card ai-center ai-soon">
            <span className="ai-mark big"><Sparkles size={28} /></span>
            <h2>Ask AI is coming soon</h2>
            <p className="ai-k">We're switching on the StudAstra doubt solver. Soon you'll be able to ask any study doubt and get step-by-step answers in English, Bangla or Hindi.</p>
            <Link href="/dashboard" className="ai-go">Back to dashboard</Link>
          </section>
        )}

        {status === "ready" && (
          <>
            <div className="ai-bar">
              <div className="ai-chips" role="group" aria-label="Answer language">
                {LANGS.map(l => <button key={l.id} type="button" className={lang === l.id ? "on" : ""} onClick={() => setLang(l.id)}>{l.label}</button>)}
              </div>
              <span className="ai-count" title="Questions left today">{left} / {limit} left today</span>
              {messages.length > 0 && <button type="button" className="ai-ghost" onClick={clearChat}><Trash2 size={14} /> New chat</button>}
            </div>

            <section className="ai-card ai-chat" aria-live="polite">
              {messages.length === 0 && (
                <div className="ai-empty">
                  <p className="ai-k">Try one of these, or type your own doubt. You can also add a photo of a question.</p>
                  <div className="ai-examples">
                    {EXAMPLES.map(x => <button key={x} type="button" onClick={() => void ask(x)} disabled={busy || left === 0}>{x}</button>)}
                  </div>
                </div>
              )}
              {messages.map((m, n) => (
                <div key={n} className={`ai-msg ${m.role} ${m.error ? "err" : ""}`}>
                  {m.image && <img src={m.image} alt="Question photo" className="ai-photo" />}
                  {m.role === "assistant" && !m.error ? <Markdown text={m.text} /> : <p>{m.text}</p>}
                </div>
              ))}
              {busy && <div className="ai-msg assistant"><span className="ai-typing"><i /><i /><i /></span></div>}
              <div ref={endRef} />
            </section>

            {note && <p className="ai-note" role="status">{note}</p>}

            <form className="ai-form" onSubmit={onSubmit}>
              {photo && (
                <div className="ai-attach">
                  <img src={photo.preview} alt="Selected photo" />
                  <button type="button" aria-label="Remove photo" onClick={() => setPhoto(null)}><X size={14} /></button>
                </div>
              )}
              <div className="ai-row">
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={pickPhoto} />
                <button type="button" className="ai-icon" aria-label="Add a photo of a question" onClick={() => fileRef.current?.click()} disabled={busy || left === 0}><ImagePlus size={19} /></button>
                <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKey} rows={2} maxLength={4000}
                  placeholder={left === 0 ? "Daily limit reached. Come back tomorrow!" : "Ask any doubt… (Enter to send, Shift+Enter for a new line)"} disabled={left === 0} aria-label="Your question" />
                <button className="ai-send" disabled={busy || left === 0 || (!input.trim() && !photo)} aria-label="Send"><Send size={18} /></button>
              </div>
              <p className="ai-fine">AI can make mistakes. Double-check important answers with your teacher or textbook.</p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

const css = `
.ai-shell{position:relative;min-height:100vh;padding:28px 18px 50px;background:radial-gradient(ellipse at 70% 0%,#0f2530 0%,#0a1016 55%);color:#e8f1f5;font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans Bengali","Noto Sans Devanagari",sans-serif}
.ai-wrap{position:relative;z-index:1;max-width:820px;margin:0 auto;display:flex;flex-direction:column;gap:14px}
.ai-back{color:rgba(232,241,245,.65);text-decoration:none;font-size:14px}
.ai-head{display:flex;align-items:center;gap:14px;margin-top:4px}
.ai-mark{flex-shrink:0;width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#123846,#0a1a24);border:1px solid rgba(34,211,238,.4);color:#22d3ee;box-shadow:0 0 30px rgba(34,211,238,.15)}
.ai-mark.big{width:64px;height:64px}
.ai-title{margin:0;font-size:30px}
.ai-sub{margin:2px 0 0;color:rgba(232,241,245,.65);font-size:15px;line-height:1.5}
.ai-card{box-sizing:border-box;padding:20px;border-radius:20px;background:rgba(18,28,37,.85);border:1px solid rgba(255,255,255,.08)}
.ai-center{display:flex;flex-direction:column;align-items:center;text-align:center;gap:12px}
.ai-soon{padding:44px 24px;border-color:rgba(34,211,238,.3);box-shadow:0 0 50px rgba(34,211,238,.07)}
.ai-soon h2{margin:4px 0 0;font-size:24px}
.ai-soon .ai-k{max-width:460px;line-height:1.6}
.ai-k{margin:0;font-size:14px;color:rgba(232,241,245,.6)}
.ai-go{display:inline-flex;align-items:center;gap:8px;margin-top:8px;padding:11px 20px;border-radius:12px;background:#22d3ee;color:#04222a;font-weight:600;text-decoration:none}
.ai-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.ai-chips{display:flex;flex-wrap:wrap;gap:6px}
.ai-chips button{padding:6px 14px;border-radius:99px;border:1px solid rgba(255,255,255,.12);background:none;color:rgba(232,241,245,.75);font-size:13px;cursor:pointer;font-family:inherit}
.ai-chips button.on{border-color:#22d3ee;background:rgba(34,211,238,.1);color:#fff}
.ai-count{margin-left:auto;font-size:13px;color:rgba(232,241,245,.7);padding:6px 12px;border-radius:99px;background:rgba(255,255,255,.05)}
.ai-ghost{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:99px;border:1px solid rgba(255,255,255,.14);background:none;color:rgba(232,241,245,.8);font-size:13px;cursor:pointer;font-family:inherit}
.ai-chat{display:flex;flex-direction:column;gap:12px;min-height:340px;max-height:62vh;overflow-y:auto;border-color:rgba(34,211,238,.2)}
.ai-empty{display:flex;flex-direction:column;gap:12px;margin:auto 0}
.ai-examples{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.ai-examples button{text-align:left;padding:12px 14px;border-radius:14px;border:1px solid rgba(255,255,255,.1);background:#0f1922;color:rgba(232,241,245,.85);font-size:14px;line-height:1.4;cursor:pointer;font-family:inherit}
.ai-examples button:hover{border-color:rgba(34,211,238,.45)}
.ai-msg{max-width:88%;padding:12px 16px;border-radius:16px;font-size:15px;line-height:1.6;word-wrap:break-word;overflow-wrap:anywhere}
.ai-msg p{margin:0;white-space:pre-wrap}
.ai-msg.user{align-self:flex-end;background:#123846;border:1px solid rgba(34,211,238,.3);border-bottom-right-radius:4px}
.ai-msg.assistant{align-self:flex-start;background:#0f1922;border:1px solid rgba(255,255,255,.08);border-bottom-left-radius:4px}
.ai-msg.err{border-color:rgba(245,158,11,.45);background:rgba(245,158,11,.08)}
.ai-photo{display:block;max-width:240px;max-height:240px;border-radius:10px;margin-bottom:8px}
.ai-md p{margin:0 0 10px;white-space:normal}.ai-md p:last-child{margin-bottom:0}
.ai-md h4{margin:12px 0 6px;font-size:16px;color:#7fe7f2}
.ai-md ol,.ai-md ul{margin:0 0 10px;padding-left:22px}.ai-md li{margin:3px 0}
.ai-md strong{color:#fff}
.ai-md code{padding:1px 6px;border-radius:6px;background:rgba(255,255,255,.08);font-size:14px}
.ai-md pre{margin:0 0 10px;padding:10px 12px;border-radius:10px;background:#0a1016;overflow-x:auto;font-size:13px}
.ai-md hr{border:0;border-top:1px solid rgba(255,255,255,.1);margin:12px 0}
.ai-typing{display:inline-flex;gap:5px;padding:4px 0}
.ai-typing i{width:7px;height:7px;border-radius:50%;background:#22d3ee;opacity:.4;animation:aiDot 1.2s infinite}
.ai-typing i:nth-child(2){animation-delay:.2s}.ai-typing i:nth-child(3){animation-delay:.4s}
@keyframes aiDot{0%,80%,100%{opacity:.25;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}
.ai-note{margin:0;padding:10px 14px;border-radius:12px;background:rgba(34,211,238,.1);border:1px solid rgba(34,211,238,.25);font-size:14px}
.ai-form{display:flex;flex-direction:column;gap:8px}
.ai-row{display:flex;align-items:flex-end;gap:8px;padding:8px;border-radius:18px;background:rgba(18,28,37,.9);border:1px solid rgba(255,255,255,.12)}
.ai-row:focus-within{border-color:rgba(34,211,238,.5)}
.ai-row textarea{flex:1;min-width:0;resize:none;border:0;outline:0;background:none;color:#e8f1f5;font-size:15px;line-height:1.5;padding:8px 4px;font-family:inherit;max-height:160px}
.ai-icon,.ai-send{flex-shrink:0;width:42px;height:42px;display:flex;align-items:center;justify-content:center;border-radius:12px;cursor:pointer}
.ai-icon{border:1px solid rgba(255,255,255,.14);background:none;color:rgba(232,241,245,.8)}
.ai-send{border:0;background:#22d3ee;color:#04222a}
.ai-icon:disabled,.ai-send:disabled{opacity:.45;cursor:default}
.ai-attach{position:relative;align-self:flex-start}
.ai-attach img{display:block;max-height:110px;border-radius:10px;border:1px solid rgba(255,255,255,.15)}
.ai-attach button{position:absolute;top:-8px;right:-8px;width:24px;height:24px;border-radius:50%;border:0;background:#e8f1f5;color:#0a1016;display:flex;align-items:center;justify-content:center;cursor:pointer}
.ai-fine{margin:0;text-align:center;font-size:12px;color:rgba(232,241,245,.45)}
.ai-chips button:focus-visible,.ai-send:focus-visible,.ai-icon:focus-visible,.ai-examples button:focus-visible{outline:2px solid #22d3ee;outline-offset:2px}
@media(max-width:640px){.ai-title{font-size:25px}.ai-examples{grid-template-columns:1fr}.ai-msg{max-width:94%}.ai-count{margin-left:0}.ai-chat{max-height:58vh}}
`;
