import { NextResponse } from "next/server";
import { audit, requireStaffApi } from "@/lib/auth/guard";
import { jsonError, readJson } from "@/lib/auth/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { banFor, isStatus, resolveLinks } from "@/lib/admin/accounts";
import { passwordProblem } from "@/lib/auth/accounts";
import { normalizeMobile } from "@/lib/auth/phone";
import { isPermission, type Permission } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

const PERMISSION_FOR_ROLE: Record<string, Permission | "admin"> = {
  student: "manage_students",
  parent: "manage_parents",
  teacher: "admin",
  admin: "admin",
};

// Update one account: status, password, login mobile, teacher permissions, parent links.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return jsonError("Unknown account.", 404);

  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles").select("id, role, account_status, mobile_number").eq("id", id).maybeSingle();
  if (!target) return jsonError("Unknown account.", 404);

  const gate = await requireStaffApi(PERMISSION_FOR_ROLE[target.role] ?? "admin");
  if ("error" in gate) return gate.error;
  const actor = gate.viewer.userId;

  const body = await readJson<Record<string, unknown>>(request);
  const changes: Record<string, unknown> = {};

  // Account status
  if (body.account_status !== undefined) {
    if (!isStatus(body.account_status)) return jsonError("Choose a valid account status.");
    if (id === actor) return jsonError("You can't change your own account status.");
    const { error: pErr } = await admin.from("profiles").update({ account_status: body.account_status }).eq("id", id);
    if (pErr) return jsonError(pErr.message, 400);
    await admin.auth.admin.updateUserById(id, { ban_duration: banFor(body.account_status) });
    changes.account_status = { from: target.account_status, to: body.account_status };
  }

  // Password reset by staff
  if (body.password !== undefined) {
    const pw = typeof body.password === "string" ? body.password : "";
    const problem = passwordProblem(pw);
    if (problem) return jsonError(`Password: ${problem}`);
    const { error } = await admin.auth.admin.updateUserById(id, { password: pw });
    if (error) return jsonError(error.message, 400);
    changes.password = "reset";
  }

  // Login mobile number
  if (body.mobile !== undefined) {
    const mobile = normalizeMobile(String(body.mobile));
    if (!mobile) return jsonError("Enter a valid 10-digit mobile number.");
    if (mobile !== target.mobile_number) {
      const { data: clash } = await admin.from("profiles").select("id").eq("mobile_number", mobile).neq("id", id).maybeSingle();
      if (clash) return jsonError("Another account already uses this mobile number.", 409);
      const { error } = await admin.auth.admin.updateUserById(id, { phone: mobile, phone_confirm: true });
      if (error) return jsonError(error.message, 400);
      const { error: pErr } = await admin.from("profiles").update({ mobile_number: mobile }).eq("id", id);
      if (pErr) return jsonError(pErr.message, 400);
      changes.mobile = { from: target.mobile_number, to: mobile };
    }
  }

  // Teacher permissions (admins only — enforced by the gate above for teacher targets)
  if (body.permissions !== undefined) {
    if (target.role !== "teacher") return jsonError("Permissions apply to teachers only.");
    const perms = (Array.isArray(body.permissions) ? body.permissions : []).filter(isPermission);
    const { error: dErr } = await admin.from("admin_permissions").delete().eq("profile_id", id);
    if (dErr) return jsonError(dErr.message, 400);
    if (perms.length) {
      const { error } = await admin.from("admin_permissions").insert(perms.map((permission) => ({ profile_id: id, permission, granted_by: actor })));
      if (error) return jsonError(error.message, 400);
    }
    changes.permissions = perms;
  }

  // Parent ↔ student links
  if (body.add_links !== undefined) {
    if (target.role !== "parent") return jsonError("Links apply to parents only.");
    const resolved = await resolveLinks(body.add_links);
    if ("error" in resolved) return jsonError(resolved.error!);
    const { error } = await admin.from("parent_student").upsert(
      resolved.links.map((l) => ({ parent_id: id, student_id: l.student_id, relationship: l.relationship })),
      { onConflict: "parent_id,student_id" },
    );
    if (error) return jsonError(error.message, 400);
    changes.add_links = resolved.links.map((l) => ({ student: l.code, relationship: l.relationship }));
  }
  if (typeof body.remove_student_id === "string") {
    if (target.role !== "parent") return jsonError("Links apply to parents only.");
    const { error } = await admin.from("parent_student").delete().eq("parent_id", id).eq("student_id", body.remove_student_id);
    if (error) return jsonError(error.message, 400);
    changes.remove_link = body.remove_student_id;
  }

  if (!Object.keys(changes).length) return jsonError("Nothing to update.");
  await audit(request, actor, `${target.role}.update`, target.role, id, changes);
  return NextResponse.json({ ok: true, changes: Object.keys(changes) });
}
