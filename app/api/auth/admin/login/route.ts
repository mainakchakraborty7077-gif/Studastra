import { NextResponse } from "next/server";
import { normalizeMobile } from "@/lib/auth/phone";
import { jsonError, limitOrNull, readJson } from "@/lib/auth/http";
import { createClient } from "@/lib/supabase/server";
import { audit } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

// Step 1 of staff sign-in: password (mobile or email). Step 2 (TOTP) happens in the browser.
export async function POST(request: Request) {
  const body = await readJson<{ identifier: string; password: string }>(request);
  const identifier = String(body.identifier ?? "").trim();
  const password = String(body.password ?? "");
  if (!identifier || !password) return jsonError("Enter your mobile number (or email) and password.");

  const isEmail = identifier.includes("@");
  const mobile = isEmail ? null : normalizeMobile(identifier);
  if (!isEmail && !mobile) return jsonError("Enter a valid mobile number or email address.");

  const limited = limitOrNull(request, "staff-login", { perIp: 8, perKey: 5, windowMs: 15 * 60_000, key: (mobile ?? identifier).toLowerCase() });
  if (limited) return limited;

  try {
    const supabase = await createClient();
    const { data, error } = isEmail
      ? await supabase.auth.signInWithPassword({ email: identifier, password })
      : await supabase.auth.signInWithPassword({ phone: mobile!, password });
    if (error || !data.user) {
      await audit(request, null, "staff.login_failed", "identifier", isEmail ? identifier.toLowerCase() : mobile, {});
      return jsonError("Incorrect credentials.", 401);
    }
    const { data: profile } = await supabase
      .from("profiles").select("role, account_status").eq("id", data.user.id).maybeSingle();
    if (!profile || (profile.role !== "admin" && profile.role !== "teacher") || profile.account_status !== "active") {
      await supabase.auth.signOut();
      await audit(request, data.user.id, "staff.login_denied", "profile", data.user.id, { role: profile?.role ?? null });
      return jsonError("This account does not have staff access.", 403);
    }
    await audit(request, data.user.id, "staff.login_password", "profile", data.user.id, { role: profile.role });
    return NextResponse.json({ ok: true, role: profile.role });
  } catch (e) {
    console.error("admin/login", e);
    return jsonError("Sign-in is temporarily unavailable. Please try again shortly.", 500);
  }
}
