"use client";

import { useEffect, useState, type FormEvent } from "react";
import AdminShell from "@/components/AdminShell";
import { createClient } from "@/lib/supabase/client";
import {
  LEARNING_CONTENT_BUCKET,
  type ContentClass,
  type ContentSubject,
  type LearningNote,
} from "@/lib/learning-content";

const SUBJECTS: ContentSubject[] = [
  "Physics",
  "Chemistry",
  "Mathematics",
  "Biology",
];
const CLASSES: ContentClass[] = ["11", "12"];
const NOTE_SELECT =
  "id,title,summary,content,subject,class_level,attachment_path,attachment_type,published,created_at";
const MAX_FILE_SIZE = 200 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "video/mp4", "application/pdf"];

export default function AdminNotesPage() {
  const [notes, setNotes] = useState<LearningNote[]>([]);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [subject, setSubject] = useState<ContentSubject>("Physics");
  const [classLevel, setClassLevel] = useState<ContentClass>("11");
  const [file, setFile] = useState<File | null>(null);
  const [published, setPublished] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Loading notes...");

  async function loadNotes() {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("learning_notes")
      .select(NOTE_SELECT)
      .order("created_at", { ascending: false });
    if (error) throw error;
    setNotes((data ?? []) as LearningNote[]);
    setMessage("");
  }

  useEffect(() => {
    void loadNotes().catch((error) =>
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load notes. Run the learning library SQL setup first.",
      ),
    );
  }, []);

  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    let uploadedPath: string | null = null;

    try {
      if (!content.trim() && !file) {
        throw new Error("Write notes or attach a JPEG, MP4, or PDF file.");
      }

      if (file && !ALLOWED_TYPES.includes(file.type)) {
        throw new Error("Attachments must be JPEG, MP4, or PDF files.");
      }
      if (file && file.size > MAX_FILE_SIZE) {
        throw new Error("The attachment must be 200 MB or smaller.");
      }

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Please sign in again.");

      if (file) {
        const extensionByType: Record<string, string> = {
          "image/jpeg": "jpg",
          "video/mp4": "mp4",
          "application/pdf": "pdf",
        };
        const extension = extensionByType[file.type];
        const folder = file.type === "video/mp4" ? "notes/videos" : "notes/files";
        uploadedPath = folder + "/" + crypto.randomUUID() + "." + extension;

        const { error: uploadError } = await supabase.storage
          .from(LEARNING_CONTENT_BUCKET)
          .upload(uploadedPath, file, {
            contentType: file.type,
            upsert: false,
          });
        if (uploadError) throw uploadError;
      }

      const { data, error } = await supabase
        .from("learning_notes")
        .insert({
          title: title.trim(),
          summary: summary.trim(),
          content: content.trim(),
          subject,
          class_level: classLevel,
          attachment_path: uploadedPath,
          attachment_type: file?.type ?? null,
          published,
          created_by: user.id,
        })
        .select(NOTE_SELECT)
        .single();

      if (error) throw error;

      setNotes((current) => [data as LearningNote, ...current]);
      setTitle("");
      setSummary("");
      setContent("");
      setFile(null);
      setMessage("Notes added to the student library.");
    } catch (error) {
      if (uploadedPath) {
        await createClient()
          .storage.from(LEARNING_CONTENT_BUCKET)
          .remove([uploadedPath]);
      }
      setMessage(
        error instanceof Error ? error.message : "Could not save these notes.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function deleteNote(note: LearningNote) {
    const supabase = createClient();
    const { error } = await supabase
      .from("learning_notes")
      .delete()
      .eq("id", note.id);
    if (error) {
      setMessage(error.message);
      return;
    }
    if (note.attachment_path) {
      await supabase.storage
        .from(LEARNING_CONTENT_BUCKET)
        .remove([note.attachment_path]);
    }
    setNotes((current) => current.filter((item) => item.id !== note.id));
    setMessage("Notes removed.");
  }

  async function togglePublished(note: LearningNote) {
    const supabase = createClient();
    const { error } = await supabase
      .from("learning_notes")
      .update({ published: !note.published })
      .eq("id", note.id);
    if (error) {
      setMessage(error.message);
      return;
    }
    setNotes((current) =>
      current.map((item) =>
        item.id === note.id ? { ...item, published: !note.published } : item,
      ),
    );
  }

  return (
    <AdminShell
      title="Notes editor"
      subtitle="Write or paste notes, then optionally attach a JPEG, MP4, or PDF."
    >
      <form onSubmit={addNote} className="ad-card ad-form">
        <div>
          <label htmlFor="note-title">Title</label>
          <input
            id="note-title"
            required
            maxLength={160}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="note-subject">Subject</label>
          <select
            id="note-subject"
            value={subject}
            onChange={(event) =>
              setSubject(event.target.value as ContentSubject)
            }
          >
            {SUBJECTS.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="note-class">Class</label>
          <select
            id="note-class"
            value={classLevel}
            onChange={(event) =>
              setClassLevel(event.target.value as ContentClass)
            }
          >
            {CLASSES.map((item) => (
              <option key={item} value={item}>
                Class {item}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="note-summary">Short description</label>
          <input
            id="note-summary"
            maxLength={1000}
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
          />
        </div>
        <div className="full">
          <label htmlFor="note-content">Write or paste notes</label>
          <textarea
            id="note-content"
            rows={10}
            maxLength={50000}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Type lesson notes here. You can also attach a file below."
          />
        </div>
        <div className="full">
          <label htmlFor="note-file">Optional attachment (JPEG, MP4, or PDF; up to 200 MB)</label>
          <input
            id="note-file"
            type="file"
            accept=".jpg,.jpeg,.mp4,.pdf,image/jpeg,video/mp4,application/pdf"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          {file && <p className="ad-meta">Selected: {file.name}</p>}
        </div>
        <label className="full">
          <input
            type="checkbox"
            checked={published}
            onChange={(event) => setPublished(event.target.checked)}
          />{" "}
          Publish for students
        </label>
        <div className="full">
          <button className="ad-btn" disabled={busy}>
            {busy ? "Saving..." : "Save notes"}
          </button>
        </div>
        {message && (
          <p className="ad-msg full" role="status">
            {message}
          </p>
        )}
      </form>

      <section className="ad-card">
        <h2>Notes library</h2>
        {notes.length === 0 ? (
          <p className="ad-sub">No notes added yet.</p>
        ) : (
          notes.map((note) => (
            <article className="ad-q" key={note.id}>
              <p>
                <strong>{note.title}</strong>
              </p>
              <p className="ad-meta">
                Class {note.class_level} · {note.subject} ·{" "}
                {note.attachment_type || "Text notes"} ·{" "}
                {note.published ? "Published" : "Draft"}
              </p>
              {note.summary && <p>{note.summary}</p>}
              <div>
                <button
                  type="button"
                  className="ad-ghost"
                  onClick={() => void togglePublished(note)}
                >
                  {note.published ? "Unpublish" : "Publish"}
                </button>{" "}
                <button
                  type="button"
                  className="ad-ghost"
                  onClick={() => void deleteNote(note)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))
        )}
      </section>
    </AdminShell>
  );
}
