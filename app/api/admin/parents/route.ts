import { NextResponse } from "next/server";
import { audit, requireStaffApi } from "@/lib/auth/guard";
import { jsonError, limitOrNull, readJson } from "@/lib/auth/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAccount, resolveLinks, validateBase } from "@/lib/admin/accounts";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireStaffApi("manage_parents");
  if ("error" in gate) return gate.error;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("parents")
    .select("id, created_at, profiles!inner(full_name, mobile_number, email, account_status), parent_student(relationship, students(id, student_code, profiles(full_name)))")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true, parents: data });
}

export async function POST(request: Request) {
  const gate = await requireStaffApi("manage_parents");
  if ("error" in gate) return gate.error;
  const limited = limitOrNull(request, "admin-create", { perIp: 60, windowMs: 10 * 60_000 });
  if (limited) return limited;

  const body = await readJson<Record<string, unknown>>(request);
  const base = validateBase(body);
  if ("error" in base) return jsonError(base.error);
  const resolved = await resolveLinks(body.links);
  if ("error" in resolved) return jsonError(resolved.error!);

  const admin = createAdminClient();
  const result = await createAccount("parent", base.value, async (id) => {
    const { error } = await admin.from("parents").insert({ id });
    if (error) throw error;
    const { error: lErr } = await admin.from("parent_student").insert(
      resolved.links.map((l) => ({ parent_id: id, student_id: l.student_id, relationship: l.relationship })),
    );
    if (lErr) throw lErr;
  });
  if ("error" in result) return jsonError(result.error, result.status);

  await audit(request, gate.viewer.userId, "parent.create", "parent", result.id, {
    mobile: base.value.mobile, links: resolved.links.map((l) => ({ student: l.code, relationship: l.relationship })),
  });
  return NextResponse.json({ ok: true, id: result.id });
}
