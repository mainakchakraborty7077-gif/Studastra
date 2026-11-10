import { NextResponse } from "next/server";
import { audit, requireStaffApi } from "@/lib/auth/guard";
import { jsonError, readJson } from "@/lib/auth/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { str } from "@/lib/admin/accounts";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireStaffApi("manage_students");
  if ("error" in gate) return gate.error;
  const { data, error } = await createAdminClient().from("courses").select("id, code, name, is_active").order("name");
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true, courses: data });
}

export async function POST(request: Request) {
  const gate = await requireStaffApi("admin");
  if ("error" in gate) return gate.error;
  const body = await readJson<Record<string, unknown>>(request);
  const code = str(body.code, 30).toUpperCase();
  const name = str(body.name, 160);
  if (!code || !name) return jsonError("Enter a course code and name.");
  const { data, error } = await createAdminClient().from("courses").insert({ code, name, description: str(body.description, 500) || null }).select("id").single();
  if (error) return jsonError(/duplicate|unique/i.test(error.message) ? "A course with this code already exists." : error.message, 400);
  await audit(request, gate.viewer.userId, "course.create", "course", data.id, { code, name });
  return NextResponse.json({ ok: true, id: data.id });
}
