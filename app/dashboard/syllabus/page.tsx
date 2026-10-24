"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  SYLLABUS_BY_CLASS,
  type ClassLevel,
  type Subject,
} from "@/lib/syllabus";
import { createClient } from "@/lib/supabase/client";

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

export default function StudentSyllabusPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function checkAccess() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/auth");
        return;
      }

      if (!cancelled) setChecking(false);
    }

    void checkAccess();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (checking) {
    return (
      <main className="sy-page">
        <p role="status">Checking your account...</p>
      </main>
    );
  }

  return (
    <main className="sy-page">
      <style>{styles}</style>
      <div className="sy-wrap">
        <Link href="/dashboard" className="sy-back">
          ← Back to dashboard
        </Link>
        <header className="sy-header">
          <span className="sy-kicker">STUDY PLAN</span>
          <h1>Syllabus</h1>
          <p>Browse the NCERT-aligned PCMB chapters by class and subject.</p>
        </header>

        {CLASSES.map(({ level, title }) => (
          <section className="sy-class" key={level} aria-labelledby={`class-${level}`}>
            <h2 id={`class-${level}`}>{title}</h2>
            <div className="sy-grid">
              {SUBJECTS.map((subject) => {
                const chapters = SYLLABUS_BY_CLASS[level][subject];

                return (
                  <article className="sy-card" key={subject}>
                    <div className="sy-card-head">
                      <h3>{subject}</h3>
                      <span>{chapters.length} chapters</span>
                    </div>
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
      </div>
    </main>
  );
}

const styles = `
.sy-page{min-height:100vh;padding:28px 18px 64px;background:radial-gradient(ellipse at 70% 0%,#0f2530 0%,#0a1016 55%);color:#e8f1f5;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.sy-wrap{max-width:1120px;margin:0 auto}
.sy-back{color:rgba(232,241,245,.7);text-decoration:none}
.sy-back:hover{color:#7fe7f2}
.sy-header{margin:30px 0}
.sy-kicker{font-size:12px;letter-spacing:.14em;color:#7fe7f2}
.sy-header h1{margin:8px 0;font-size:36px}
.sy-header p{margin:0;color:rgba(232,241,245,.65)}
.sy-class{margin-top:30px}
.sy-class>h2{font-size:24px;margin:0 0 14px}
.sy-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.sy-card{padding:20px;border:1px solid rgba(255,255,255,.09);border-radius:18px;background:rgba(18,28,37,.88)}
.sy-card-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
.sy-card h3{margin:0;font-size:19px}
.sy-card-head span{font-size:12px;color:#7fe7f2}
.sy-card ol{padding-left:22px;line-height:1.8;color:rgba(232,241,245,.82)}
.sy-card li{padding-left:3px}
@media(max-width:700px){.sy-grid{grid-template-columns:1fr}.sy-header h1{font-size:30px}}
`;
