import { NextResponse } from "next/server";
import { normalizeMobile } from "@/lib/auth/phone";
import { jsonError, limitOrNull, readJson } from "@/lib/auth/http";
import { accountProblem, audienceAllows, findAccountByMobile, isAudience } from "@/lib/auth/accounts";
import { createClient } from "@/lib/supabase/server";
import { landingFor, type Role } from "@/lib/auth/roles";
import { audit } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await readJson<{ mobile: string; role: string; password: string; next: string }>(request);
  const mobile = normalizeMobile(String(body.mobile ?? ""));
  const password = String(body.password ?? "");
  if (!mobile) return jsonError("Enter a valid 10-digit mobile number.");
  if (!password) return jsonError("Enter your password.");
  if (!isAudience(body.role) || body.role === "staff") return jsonError("Choose Student or Parent.");

  const limited = limitOrNull(request, "pw-login", { perIp: 15, perKey: 6, windowMs: 10 * 60_000, key: mobile });
  if (limited) return limited;

  try {
    const problem = accountProblem(await findAccountByMobile(mobile), body.role);
    if (problem) return jsonError(problem, 404);

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ phone: mobile, password });
    if (error || !data.user) return jsonError("Incorrect mobile number or password.", 401);

    const { data: profile } = await supabase
      .from("profiles").select("role, account_status").eq("id", data.user.id).maybeSingle();
    if (!profile || profile.account_status !== "active" || !audienceAllows(body.role, profile.role as Role)) {
      await supabase.auth.signOut();
      return jsonError("This account cannot sign in here. Please contact support.", 403);
    }
    await audit(request, data.user.id, "auth.login_password", "profile", data.user.id, { role: profile.role });
    return NextResponse.json({ ok: true, role: profile.role, redirect: landingFor(profile.role as Role, body.next) });
  } catch (e) {
    console.error("password/login", e);
    return jsonError("Sign-in is temporarily unavailable. Please try again shortly.", 500);
  }
}
