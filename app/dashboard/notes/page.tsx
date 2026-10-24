"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LEARNING_CONTENT_BUCKET,
  type LearningNote,
} from "@/lib/learning-content";

type NoteWithUrl = LearningNote & { signedUrl: string | null };
const NOTE_SELECT =
  "id,title,summary,content,subject,class_level,attachment_path,attachment_type,published,created_at";

export default function StudentNotesPage() {
  const router = useRouter();
  const [notes, setNotes] = useState<NoteWithUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadNotes() {
      const supabase = createClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/auth");
        return;
      }

      const { data, error } = await supabase
        .from("learning_notes")
        .select(NOTE_SELECT)
        .eq("published", true)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const items = await Promise.all(
        ((data ?? []) as LearningNote[]).map(async (note) => {
          if (!note.attachment_path) return { ...note, signedUrl: null };
          const { data: signed, error: signedError } = await supabase.storage
            .from(LEARNING_CONTENT_BUCKET)
            .createSignedUrl(note.attachment_path, 60 * 60);
          if (signedError) throw signedError;
          return { ...note, signedUrl: signed.signedUrl };
        }),
      );

      if (cancelled) return;
      setNotes(items);
      setLoading(false);
    }

    void loadNotes().catch((error) => {
      if (cancelled) return;
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load notes. Please try again.",
      );
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="nl-page">
      <style>{styles}</style>
      <div className="nl-wrap">
        <Link href="/dashboard" className="nl-back">
          ← Back to dashboard
        </Link>
        <header>
          <p className="nl-kicker">STUDY LIBRARY</p>
          <h1>Class notes</h1>
          <p className="nl-sub">Notes and attachments shared by your teachers.</p>
        </header>

        {loading && <p role="status">Loading notes...</p>}
        {message && <p className="nl-message" role="status">{message}</p>}
        {!loading && !message && notes.length === 0 && (
          <section className="nl-card">No notes are published yet.</section>
        )}

        <div className="nl-list">
          {notes.map((note) => (
            <article className="nl-card" key={note.id}>
              <p className="nl-meta">Class {note.class_level} · {note.subject}</p>
              <h2>{note.title}</h2>
              {note.summary && <p className="nl-sub">{note.summary}</p>}
              {note.content && <div className="nl-content">{note.content}</div>}

              {note.signedUrl && note.attachment_type === "image/jpeg" && (
                <img src={note.signedUrl} alt={note.title} />
              )}
              {note.signedUrl && note.attachment_type === "video/mp4" && (
                <video controls preload="metadata" src={note.signedUrl}>
                  Your browser does not support HTML video.
                </video>
              )}
              {note.signedUrl && note.attachment_type === "application/pdf" && (
                <a href={note.signedUrl} target="_blank" rel="noreferrer">
                  Open PDF notes
                </a>
              )}
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}

const styles = `
.nl-page{min-height:100vh;padding:28px 18px 64px;background:radial-gradient(ellipse at 70% 0%,#0f2530 0%,#0a1016 55%);color:#e8f1f5;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.nl-wrap{max-width:950px;margin:0 auto}
.nl-back{color:rgba(232,241,245,.7);text-decoration:none}
.nl-back:hover{color:#7fe7f2}
.nl-wrap header{margin:30px 0}
.nl-kicker{font-size:12px;letter-spacing:.14em;color:#7fe7f2}
.nl-wrap h1{margin:8px 0;font-size:34px}
.nl-sub{color:rgba(232,241,245,.65);line-height:1.6}
.nl-list{display:grid;gap:16px}
.nl-card{padding:20px;border:1px solid rgba(255,255,255,.09);border-radius:18px;background:rgba(18,28,37,.88)}
.nl-card h2{font-size:20px;margin:8px 0}
.nl-meta{font-size:12px;color:#7fe7f2}
.nl-content{white-space:pre-wrap;line-height:1.7;margin:14px 0}
.nl-card img,.nl-card video{display:block;max-width:100%;max-height:600px;border-radius:12px;margin-top:14px}
.nl-card video{width:100%;background:#05080b}
.nl-card a{display:inline-block;margin-top:12px;color:#7fe7f2}
.nl-message{padding:12px;border:1px solid rgba(255,255,255,.14);border-radius:12px}
`;
