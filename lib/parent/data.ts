import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Child = {
  id: string;
  student_code: string;
  class_name: string | null;
  batch: string | null;
  full_name: string;
  relationship: string;
};
export type Attempt = { id: string; user_id: string; score: number; total: number; completed_at: string; title: string };
export type AttendanceRow = { student_id: string; attendance_date: string; session_label: string; status: string; remarks: string | null };

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

/** Children linked to this parent. RLS limits every query here to linked students only. */
export async function getChildren(parentId: string): Promise<Child[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("parent_student")
    .select("relationship, students(id, student_code, class_name, batch, profiles(full_name))")
    .eq("parent_id", parentId);
  type S = { id: string; student_code: string; class_name: string | null; batch: string | null; profiles: { full_name: string | null } | { full_name: string | null }[] | null };
  return (data ?? [])
    .map((row) => {
      const s = one(row.students as unknown as S | S[] | null);
      if (!s) return null;
      return {
        id: s.id,
        student_code: s.student_code,
        class_name: s.class_name,
        batch: s.batch,
        full_name: one(s.profiles)?.full_name || "Student",
        relationship: row.relationship as string,
      };
    })
    .filter((c): c is Child => c !== null);
}

export async function getAttempts(studentIds: string[]): Promise<Attempt[]> {
  if (!studentIds.length) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("test_attempts")
    .select("id, user_id, score, total, completed_at, tests(title)")
    .in("user_id", studentIds)
    .order("completed_at", { ascending: false })
    .limit(200);
  if (error) return [];
  return (data ?? []).map((a) => ({
    id: a.id as string,
    user_id: a.user_id as string,
    score: a.score as number,
    total: a.total as number,
    completed_at: a.completed_at as string,
    title: one(a.tests as unknown as { title: string } | { title: string }[] | null)?.title ?? "Practice test",
  }));
}

export async function getAttendance(studentIds: string[], sinceISO?: string): Promise<AttendanceRow[]> {
  if (!studentIds.length) return [];
  const supabase = await createClient();
  let q = supabase
    .from("attendance")
    .select("student_id, attendance_date, session_label, status, remarks")
    .in("student_id", studentIds)
    .order("attendance_date", { ascending: false })
    .limit(400);
  if (sinceISO) q = q.gte("attendance_date", sinceISO);
  const { data, error } = await q;
  if (error) return [];
  return (data ?? []) as AttendanceRow[];
}

export async function getStudyStats(studentIds: string[]) {
  const out: Record<string, { minutes7d: number; chapters: number }> = {};
  studentIds.forEach((id) => { out[id] = { minutes7d: 0, chapters: 0 }; });
  if (!studentIds.length) return out;
  const supabase = await createClient();
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const [sessions, chapters] = await Promise.all([
    supabase.from("study_sessions").select("user_id, minutes, created_at").in("user_id", studentIds).gte("created_at", since),
    supabase.from("chapter_progress").select("user_id, studied").in("user_id", studentIds).eq("studied", true),
  ]);
  (sessions.data ?? []).forEach((s) => { if (out[s.user_id as string]) out[s.user_id as string].minutes7d += Number(s.minutes) || 0; });
  (chapters.data ?? []).forEach((c) => { if (out[c.user_id as string]) out[c.user_id as string].chapters += 1; });
  return out;
}

export function attendanceRate(rows: AttendanceRow[]) {
  if (!rows.length) return null;
  const attended = rows.filter((r) => r.status === "present" || r.status === "late").length;
  return Math.round((attended / rows.length) * 100);
}

export function pct(a: { score: number; total: number }) {
  return a.total > 0 ? Math.round((a.score / a.total) * 100) : 0;
}

export function pickChild(children: Child[], requested?: string | null) {
  return children.find((c) => c.id === requested) ?? children[0] ?? null;
}

/** A YYYY-MM-DD date `days` ago on the India clock (attendance dates are IST calendar days). */
export function isoDaysAgo(days: number) {
  return new Date(Date.now() + 5.5 * 3600000 - days * 86400000).toISOString().slice(0, 10);
}
