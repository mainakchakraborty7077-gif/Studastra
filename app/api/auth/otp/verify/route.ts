import { NextResponse } from "next/server";
import { normalizeMobile } from "@/lib/auth/phone";
import { jsonError, limitOrNull, readJson } from "@/lib/auth/http";
import { accountProblem, audienceAllows, findAccountByMobile, isAudience } from "@/lib/auth/accounts";
import { createClient } from "@/lib/supabase/server";
import { landingFor, type Role } from "@/lib/auth/roles";
import { audit } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await readJson<{ mobile: string; role: string; token: string; purpose: string; next: string }>(request);
  const mobile = normalizeMobile(String(body.mobile ?? ""));
  const token = String(body.token ?? "").replace(/\D/g, "");
  if (!mobile) return jsonError("Enter a valid 10-digit mobile number.");
  if (!/^\d{6,8}$/.test(token)) return jsonError("Enter the 6-digit code from the SMS.");
  if (!isAudience(body.role)) return jsonError("Choose Student or Parent.");
  const purpose = body.purpose === "reset" ? "reset" : "login";

  const limited = limitOrNull(request, "otp-verify", { perIp: 20, perKey: 6, windowMs: 10 * 60_000, key: mobile });
  if (limited) return limited;

  try {
    const problem = accountProblem(await findAccountByMobile(mobile), body.role);
    if (problem) return jsonError(problem, 404);

    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({ phone: mobile, token, type: "sms" });
    if (error || !data.user) {
      return jsonError("That code is incorrect or has expired. Check the SMS or request a new code.", 401);
    }

    // Re-check the role for the account that actually signed in.
    const { data: profile } = await supabase
      .from("profiles").select("role, account_status").eq("id", data.user.id).maybeSingle();
    if (!profile || profile.account_status !== "active" || !audienceAllows(body.role, profile.role as Role)) {
      await supabase.auth.signOut();
      return jsonError("This account cannot sign in here. Please contact support.", 403);
    }

    await audit(request, data.user.id, purpose === "reset" ? "auth.reset_otp_verified" : "auth.login_otp", "profile", data.user.id, { role: profile.role });
    return NextResponse.json({ ok: true, role: profile.role, redirect: landingFor(profile.role as Role, body.next) });
  } catch (e) {
    console.error("otp/verify", e);
    return jsonError("Sign-in is temporarily unavailable. Please try again shortly.", 500);
  }
}
