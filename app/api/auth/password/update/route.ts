import { NextResponse } from "next/server";
import { jsonError, limitOrNull, readJson } from "@/lib/auth/http";
import { passwordProblem } from "@/lib/auth/accounts";
import { createClient } from "@/lib/supabase/server";
import { homeForRole } from "@/lib/auth/roles";
import { audit } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

// Sets a new password for the signed-in user (used after the forgot-password OTP).
export async function POST(request: Request) {
  const limited = limitOrNull(request, "pw-update", { perIp: 10, windowMs: 10 * 60_000 });
  if (limited) return limited;

  const body = await readJson<{ password: string }>(request);
  const password = String(body.password ?? "");
  const problem = passwordProblem(password);
  if (problem) return jsonError(problem);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return jsonError("Your verification expired. Please request a new code.", 401);

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    const msg = /different from the old/i.test(error.message)
      ? "Choose a password different from your current one."
      : /aal2|reauthentication/i.test(error.message)
        ? "For security, staff must complete two-factor verification before changing the password."
        : "We couldn't update your password. Please try again.";
    return jsonError(msg, 400);
  }
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  await audit(request, user.id, "auth.password_reset", "profile", user.id);
  return NextResponse.json({ ok: true, redirect: homeForRole(profile?.role) });
}
