import { NextResponse } from "next/server";
import { normalizeMobile } from "@/lib/auth/phone";
import { jsonError, limitOrNull, readJson } from "@/lib/auth/http";
import { accountProblem, anonClient, findAccountByMobile, isAudience } from "@/lib/auth/accounts";

export const dynamic = "force-dynamic";
const RESEND_SECONDS = 60;

export async function POST(request: Request) {
  const body = await readJson<{ mobile: string; role: string; purpose: string }>(request);
  const mobile = normalizeMobile(String(body.mobile ?? ""));
  if (!mobile) return jsonError("Enter a valid 10-digit mobile number.");
  if (!isAudience(body.role)) return jsonError("Choose Student or Parent.");
  const purpose = body.purpose === "reset" ? "reset" : "login";

  const limited = limitOrNull(request, "otp-send", { perIp: 10, perKey: 4, windowMs: 10 * 60_000, key: mobile });
  if (limited) return limited;

  try {
    const problem = accountProblem(await findAccountByMobile(mobile), body.role);
    if (problem) return jsonError(problem, 404);

    const { error } = await anonClient().auth.signInWithOtp({
      phone: mobile,
      options: { shouldCreateUser: false, channel: "sms" },
    });
    if (error) {
      console.error("OTP send failed", error.message);
      const tooMany = error.status === 429 || /rate|too many|seconds/i.test(error.message);
      return jsonError(
        tooMany ? "Please wait a minute before requesting another code." : "We couldn't send the code right now. Please try again shortly or use your password.",
        tooMany ? 429 : 502,
      );
    }
    return NextResponse.json({ ok: true, purpose, resendIn: RESEND_SECONDS });
  } catch (e) {
    console.error("otp/send", e);
    return jsonError("Sign-in is temporarily unavailable. Please try again shortly.", 500);
  }
}
