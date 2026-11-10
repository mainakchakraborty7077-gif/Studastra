import { NextResponse } from "next/server";
import { audit, requireStaffApi } from "@/lib/auth/guard";
import { jsonError, readJson } from "@/lib/auth/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { str } from "@/lib/admin/accounts";

export const dynamic = "force-dynamic";
const STATUSES = ["present", "absent", "late", "excused"];
const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d));

export async function GET(request: Request) {
  const gate = await requireStaffApi("manage_attendance");
  if ("error" in gate) return gate.error;
  const url = new URL(request.url);
  const date = url.searchParams.get("date") ?? "";
  const session = (url.searchParams.get("session") || "General").slice(0, 40);
  if (!isDate(date)) return jsonError("Choose a valid date.");
  const admin = createAdminClient();
  const [students, marks] = await Promise.all([
    admin.from("students").select("id, student_code, class_name, batch, profiles!inner(full_name, account_status)").eq("profiles.account_status", "active").order("student_code"),
    admin.from("attendance").select("student_id, status, remarks").eq("attendance_date", date).eq("session_label", session),
  ]);
  if (students.error) return jsonError(students.error.message, 500);
  if (marks.error) return jsonError(marks.error.message, 500);
  return NextResponse.json({ ok: true, students: students.data, marks: marks.data });
}

export async function POST(request: Request) {
  const gate = await requireStaffApi("manage_attendance");
  if ("error" in gate) return gate.error;
  const body = await readJson<{ date: string; session: string; records: unknown[] }>(request);
  const date = str(body.date, 10);
  const session_label = str(body.session, 40) || "General";
  if (!isDate(date)) return jsonError("Choose a valid date.");
  const records = (Array.isArray(body.records) ? body.records : [])
    .map((r) => r as Record<string, unknown>)
    .filter((r) => typeof r.student_id === "string" && STATUSES.includes(String(r.status)))
    .slice(0, 1000)
    .map((r) => ({
      student_id: r.student_id as string,
      attendance_date: date,
      session_label,
      status: String(r.status),
      remarks: str(r.remarks, 200) || null,
      marked_by: gate.viewer.userId,
      updated_at: new Date().toISOString(),
    }));
  if (!records.length) return jsonError("Mark at least one student.");
  const { error } = await createAdminClient().from("attendance").upsert(records, { onConflict: "student_id,attendance_date,session_label" });
  if (error) return jsonError(error.message, 400);
  await audit(request, gate.viewer.userId, "attendance.mark", "attendance", `${date}:${session_label}`, {
    count: records.length,
    present: records.filter((r) => r.status === "present").length,
  });
  return NextResponse.json({ ok: true, saved: records.length });
}
