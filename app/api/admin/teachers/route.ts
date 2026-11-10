import { NextResponse } from "next/server";
import { audit, requireStaffApi } from "@/lib/auth/guard";
import { jsonError, limitOrNull, readJson } from "@/lib/auth/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAccount, str, validateBase } from "@/lib/admin/accounts";
import { isPermission } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireStaffApi("admin");
  if ("error" in gate) return gate.error;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id, full_name, mobile_number, email, account_status, role, created_at, teachers(employee_code, subjects), admin_permissions!admin_permissions_profile_id_fkey(permission)")
    .in("role", ["teacher", "admin"])
    .order("created_at", { ascending: false });
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true, staff: data, me: gate.viewer.userId });
}

export async function POST(request: Request) {
  const gate = await requireStaffApi("admin");
  if ("error" in gate) return gate.error;
  const limited = limitOrNull(request, "admin-create", { perIp: 60, windowMs: 10 * 60_000 });
  if (limited) return limited;

  const body = await readJson<Record<string, unknown>>(request);
  const base = validateBase(body);
  if ("error" in base) return jsonError(base.error);
  const employee_code = str(body.employee_code, 40).toUpperCase() || null;
  const subjects = str(body.subjects, 200) || null;
  const permissions = (Array.isArray(body.permissions) ? body.permissions : []).filter(isPermission);

  const admin = createAdminClient();
  const result = await createAccount("teacher", base.value, async (id) => {
    const { error } = await admin.from("teachers").insert({ id, employee_code, subjects });
    if (error) throw error;
    if (permissions.length) {
      const { error: pErr } = await admin.from("admin_permissions").insert(
        permissions.map((permission) => ({ profile_id: id, permission, granted_by: gate.viewer.userId })),
      );
      if (pErr) throw pErr;
    }
  });
  if ("error" in result) return jsonError(result.error, result.status);

  await audit(request, gate.viewer.userId, "teacher.create", "teacher", result.id, {
    mobile: base.value.mobile, employee_code, permissions,
  });
  return NextResponse.json({ ok: true, id: result.id });
}
