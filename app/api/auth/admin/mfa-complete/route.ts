import { NextResponse } from "next/server";
import { audit, getViewer } from "@/lib/auth/guard";
import { jsonError } from "@/lib/auth/http";

export const dynamic = "force-dynamic";

// Called after the browser finishes the TOTP challenge; records it in the audit log.
export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return jsonError("Not signed in.", 401);
  if (viewer.aal !== "aal2") return jsonError("Two-factor verification is not complete.", 403);
  const body = (await request.json().catch(() => ({}))) as { enrolled?: boolean };
  await audit(request, viewer.userId, body.enrolled ? "staff.mfa_enrolled" : "staff.mfa_verified", "profile", viewer.userId);
  return NextResponse.json({ ok: true });
}
