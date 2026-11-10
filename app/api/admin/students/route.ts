import { NextResponse } from "next/server";
import { audit, requireStaffApi } from "@/lib/auth/guard";
import { jsonError, limitOrNull, readJson } from "@/lib/auth/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAccount, str, validateBase } from "@/lib/admin/accounts";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireStaffApi("manage_students");
  if ("error" in gate) return gate.error;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("students")
    .select("id, student_code, class_name, batch, created_at, profiles!inner(full_name, mobile_number, email, account_status), enrollments(course_id, status, courses(code, name))")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true, students: data });
}

export async function POST(request: Request) {
  const gate = await requireStaffApi("manage_students");
  if ("error" in gate) return gate.error;
  const limited = limitOrNull(request, "admin-create", { perIp: 60, windowMs: 10 * 60_000 });
  if (limited) return limited;

  const body = await readJson<Record<string, unknown>>(request);
  const base = validateBase(body);
  if ("error" in base) return jsonError(base.error);
  const student_code = str(body.student_code, 40).toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9\-_/]{1,39}$/.test(student_code)) return jsonError("Enter a Student ID (letters, numbers, - _ /).");
  const class_name = str(body.class_name, 40) || null;
  const batch = str(body.batch, 60) || null;
  const course_ids = Array.isArray(body.course_ids) ? body.course_ids.filter((c): c is string => typeof c === "string").slice(0, 20) : [];

  const admin = createAdminClient();
  const { data: codeClash } = await admin.from("students").select("id").eq("student_code", student_code).maybeSingle();
  if (codeClash) return jsonError("That Student ID is already in use.", 409);

  const result = await createAccount("student", base.value, async (id) => {
    const { error } = await admin.from("students").insert({ id, student_code, class_name, batch });
    if (error) throw error;
    if (class_name) await admin.from("profiles").update({ grade: class_name }).eq("id", id);
    if (course_ids.length) {
      const { error: eErr } = await admin.from("enrollments").insert(course_ids.map((course_id) => ({ student_id: id, course_id })));
      if (eErr) throw eErr;
    }
  });
  if ("error" in result) return jsonError(result.error, result.status);

  await audit(request, gate.viewer.userId, "student.create", "student", result.id, {
    student_code, class_name, batch, course_ids, mobile: base.value.mobile, status: base.value.account_status,
  });
  return NextResponse.json({ ok: true, id: result.id });
}
