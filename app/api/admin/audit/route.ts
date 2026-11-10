import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/auth/guard";
import { jsonError } from "@/lib/auth/http";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireStaffApi("view_audit");
  if ("error" in gate) return gate.error;
  const { data, error } = await createAdminClient()
    .from("audit_logs")
    .select("id, action, target_type, target_id, details, ip_address, created_at, actor:profiles!audit_logs_actor_id_fkey(full_name, role)")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true, logs: data });
}
