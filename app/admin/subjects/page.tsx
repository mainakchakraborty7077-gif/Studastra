"use client";

import AdminShell from "@/components/AdminShell";
import {
  SYLLABUS_BY_CLASS,
  type ClassLevel,
  type Subject,
} from "@/lib/syllabus";

const CLASSES: { level: ClassLevel; title: string }[] = [
  { level: "11", title: "Class 11" },
  { level: "12", title: "Class 12" },
];

const SUBJECTS: Subject[] = [
  "Physics",
  "Chemistry",
  "Mathematics",
  "Biology",
];

export default function SubjectsAdminPage() {
  return (
    <AdminShell
      title="Syllabus"
      subtitle="Browse the NCERT-aligned PCMB chapters by class and subject."
    >
      {CLASSES.map(({ level, title }) => (
        <section className="ad-card" key={level}>
          <h2>{title}</h2>
          <div className="ad-grid">
            {SUBJECTS.map((subject) => {
              const chapters = SYLLABUS_BY_CLASS[level][subject];

              return (
                <article key={subject}>
                  <h3>{subject}</h3>
                  <p className="ad-meta">{chapters.length} chapters</p>
                  <ol>
                    {chapters.map((chapter) => (
                      <li key={chapter}>{chapter}</li>
                    ))}
                  </ol>
                </article>
              );
            })}
          </div>
        </section>
      ))}
      <p className="ad-meta">
        The chapter lists are maintained in <code>lib/syllabus.ts</code>.
      </p>
    </AdminShell>
  );
}
