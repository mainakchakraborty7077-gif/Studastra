import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, signedIn: false }, { status: 401 });
  return NextResponse.json({
    ok: true,
    signedIn: true,
    role: viewer.profile.role,
    status: viewer.profile.account_status,
    name: viewer.profile.full_name,
    aal: viewer.aal,
    permissions: viewer.profile.role === "admin" ? "all" : viewer.permissions,
  });
}
