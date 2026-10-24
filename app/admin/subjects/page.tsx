"use client";

import AdminShell from "@/components/AdminShell";
import { SYLLABUS } from "@/lib/syllabus";

export default function SubjectsAdminPage() {
  return <AdminShell title="Subjects" subtitle="Browse the current NCERT-based PCMB chapter outline.">
    <div className="ad-grid">
      {Object.entries(SYLLABUS).map(([subject, chapters]) => <section className="ad-card" key={subject}>
        <h2>{subject}</h2>
        <p className="ad-meta">{chapters.length} chapters</p>
        <ol>{chapters.map((chapter) => <li key={chapter}>{chapter}</li>)}</ol>
      </section>)}
    </div>
    <p className="ad-meta">This outline is currently maintained in <code>lib/syllabus.ts</code>. Database-backed syllabus editing is not configured yet.</p>
  </AdminShell>;
}

