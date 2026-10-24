"use client";

import { useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/AdminShell";
import { createClient } from "@/lib/supabase/client";
import { SYLLABUS } from "@/lib/syllabus";

type Student = {
  id: string;
  full_name: string | null;
  email: string | null;
  grade: string | null;
  target_exam: string | null;
};

type Session = {
  user_id: string;
  minutes: number;
  created_at: string;
};

type ChapterProgress = {
  user_id: string;
  studied: boolean;
};

type ProgressRow = Student & {
  done: number;
  week: number;
  total: number;
  last: number;
};

const TOTAL = Object.values(SYLLABUS).reduce(
  (sum, chapters) => sum + chapters.length,
  0,
);

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

export default function ProgressPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [chapters, setChapters] = useState<Record<string, number>>({});
  const [sessions, setSessions] = useState<Session[]>([]);
  const [message, setMessage] = useState("Loading students...");

  useEffect(() => {
    let cancelled = false;

    async function loadStudents() {
      try {
        const supabase = createClient();
        const [profilesResult, chaptersResult, sessionsResult] = await Promise.all([
          supabase
            .from("profiles")
            .select("id,full_name,email,grade,target_exam"),
          supabase.from("chapter_progress").select("user_id,studied"),
          supabase.from("study_sessions").select("user_id,minutes,created_at"),
        ]);

        const error =
          profilesResult.error || chaptersResult.error || sessionsResult.error;
        if (error) throw error;

        const chapterCounts: Record<string, number> = {};
        (chaptersResult.data as ChapterProgress[] | null)?.forEach((row) => {
          if (row.studied) {
            chapterCounts[row.user_id] = (chapterCounts[row.user_id] ?? 0) + 1;
          }
        });

        if (cancelled) return;
        setStudents((profilesResult.data ?? []) as Student[]);
        setChapters(chapterCounts);
        setSessions((sessionsResult.data ?? []) as Session[]);
        setMessage("");
      } catch (error) {
        if (cancelled) return;
        setMessage(
          error instanceof Error ? error.message : "Unable to load student progress.",
        );
      }
    }

    void loadStudents();
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo<ProgressRow[]>(() => {
    const now = Date.now();
    const weekInMilliseconds = 7 * 24 * 60 * 60 * 1000;

    return students
      .map((student) => {
        const studentSessions = sessions.filter(
          (session) => session.user_id === student.id,
        );
        const week = studentSessions
          .filter(
            (session) =>
              now - new Date(session.created_at).getTime() < weekInMilliseconds,
          )
          .reduce((sum, session) => sum + session.minutes, 0);
        const total = studentSessions.reduce(
          (sum, session) => sum + session.minutes,
          0,
        );
        const last = studentSessions.reduce(
          (latest, session) =>
            Math.max(latest, new Date(session.created_at).getTime()),
          0,
        );

        return {
          ...student,
          done: chapters[student.id] ?? 0,
          week,
          total,
          last,
        };
      })
      .sort((first, second) => second.last - first.last);
  }, [students, chapters, sessions]);

  return (
    <AdminShell
      title="Student progress"
      subtitle="Review chapter completion and study time for each student."
    >
      {message && (
        <p className="ad-msg" role="status">
          {message}
        </p>
      )}

      {!message && rows.length === 0 && (
        <div className="ad-card">No student profiles found.</div>
      )}

      {rows.length > 0 && (
        <div className="ad-card ad-scroll">
          <table className="ad-table">
            <thead>
              <tr>
                <th scope="col">Student</th>
                <th scope="col">Grade</th>
                <th scope="col">Exam</th>
                <th scope="col">Chapters</th>
                <th scope="col">Last 7 days</th>
                <th scope="col">Total time</th>
                <th scope="col">Last active</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.full_name || "Unnamed"}</strong>
                    {row.email && <div className="ad-meta">{row.email}</div>}
                  </td>
                  <td>{row.grade || "-"}</td>
                  <td>{row.target_exam || "-"}</td>
                  <td>
                    {row.done}/{TOTAL}
                  </td>
                  <td>{formatMinutes(row.week)}</td>
                  <td>{formatMinutes(row.total)}</td>
                  <td>
                    {row.last
                      ? new Date(row.last).toLocaleDateString()
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}

