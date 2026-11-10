"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, GraduationCap, KeyRound, MessageSquareText, ShieldCheck, Users } from "lucide-react";
import { Alert, MobileField, OtpInput, PasswordField, Spinner, postJson, useCountdown } from "@/components/auth/fields";
import { maskMobile, mobileError, normalizeMobile } from "@/lib/auth/phone";

type Role = "student" | "parent";
type Method = "otp" | "password";
type Mode = "login" | "forgot";
type Step = "mobile" | "code" | "newpass" | "done";

const REASONS: Record<string, { kind: "warn" | "ok" | "err"; text: string }> = {
  expired: { kind: "warn", text: "Your session expired. Please sign in again." },
  signin: { kind: "warn", text: "Please sign in to continue." },
  inactive: { kind: "err", text: "This account is not active. Please contact support." },
  noprofile: { kind: "err", text: "We couldn't find a profile for this account. Please contact support." },
  signedout: { kind: "ok", text: "You've signed out safely. See you soon, explorer." },
  reset: { kind: "ok", text: "Password updated. Sign in with your new password." },
};

export default function LoginClient({ params: initial }: { params: Record<string, string> }) {
  const router = useRouter();
  const params = { get: (k: string): string | null => initial[k] || null };
  const next = params.get("next");
  const reason = params.get("reason");

  const [role, setRole] = useState<Role>(params.get("role") === "parent" ? "parent" : "student");
  const [method, setMethod] = useState<Method>("otp");
  const [mode, setMode] = useState<Mode>(params.get("mode") === "forgot" ? "forgot" : "login");
  const [step, setStep] = useState<Step>("mobile");

  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [fieldErr, setFieldErr] = useState<Record<string, string | null>>({});
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const countdown = useCountdown();

  const e164 = useMemo(() => normalizeMobile(mobile), [mobile]);
  const banner = reason ? REASONS[reason] : undefined;

  useEffect(() => { setError(null); setInfo(null); setFieldErr({}); }, [role, method, mode]);

  function resetFlow(nextMode: Mode = mode) {
    setMode(nextMode);
    setStep("mobile");
    setCode("");
    setPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    setInfo(null);
  }

  function validateMobile() {
    const err = mobileError(mobile);
    setFieldErr((f) => ({ ...f, mobile: err }));
    return !err;
  }

  async function sendOtp(purpose: "login" | "reset") {
    if (!validateMobile()) return;
    setBusy(true); setError(null); setInfo(null);
    const res = await postJson<{ resendIn?: number }>("/api/auth/otp/send", { mobile, role, purpose });
    setBusy(false);
    if (!res.ok) { setError(res.error ?? null); return; }
    setStep("code");
    setCode("");
    countdown.start(res.resendIn ?? 60);
    setInfo(`We sent a 6-digit code to ${maskMobile(e164 ?? mobile)}.`);
  }

  async function verifyOtp(purpose: "login" | "reset", token = code) {
    const clean = token.replace(/\D/g, "");
    if (clean.length !== 6) { setFieldErr((f) => ({ ...f, code: "Enter all 6 digits." })); return; }
    setFieldErr((f) => ({ ...f, code: null }));
    setBusy(true); setError(null);
    const res = await postJson<{ redirect?: string }>("/api/auth/otp/verify", { mobile, role, token: clean, purpose, next });
    if (!res.ok) { setBusy(false); setError(res.error ?? null); return; }
    if (purpose === "reset") {
      setBusy(false);
      setInfo("Number verified. Now choose a new password.");
      setStep("newpass");
      return;
    }
    router.replace(res.redirect || "/dashboard");
    router.refresh();
  }

  async function passwordLogin(e: FormEvent) {
    e.preventDefault();
    const okMobile = validateMobile();
    const pwErr = password ? null : "Enter your password.";
    setFieldErr((f) => ({ ...f, password: pwErr }));
    if (!okMobile || pwErr) return;
    setBusy(true); setError(null);
    const res = await postJson<{ redirect?: string }>("/api/auth/password/login", { mobile, role, password, next });
    if (!res.ok) { setBusy(false); setError(res.error ?? null); return; }
    router.replace(res.redirect || "/dashboard");
    router.refresh();
  }

  async function saveNewPassword(e: FormEvent) {
    e.preventDefault();
    let err: string | null = null;
    if (newPassword.length < 8) err = "Use at least 8 characters.";
    else if (!/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) err = "Use at least one letter and one number.";
    const confirmErr = !err && newPassword !== confirmPassword ? "The passwords don't match." : null;
    setFieldErr((f) => ({ ...f, newPassword: err, confirmPassword: confirmErr }));
    if (err || confirmErr) return;
    setBusy(true); setError(null);
    const res = await postJson<{ redirect?: string }>("/api/auth/password/update", { password: newPassword });
    setBusy(false);
    if (!res.ok) { setError(res.error ?? null); return; }
    setStep("done");
    setInfo("Your password has been updated and you're signed in.");
    setTimeout(() => { router.replace(res.redirect || "/dashboard"); router.refresh(); }, 1200);
  }

  const roleLabel = role === "student" ? "Student" : "Parent";
  const isForgot = mode === "forgot";

  return (
    <div className="ax-card">
      <div className="ax-card-head">
        {isForgot ? (
          <>
            <span className="ax-chip"><KeyRound size={12} /> ACCOUNT RECOVERY</span>
            <h2 className="ax-h1">Reset your password</h2>
            <p className="ax-sub">Verify your mobile number with a one-time code, then choose a new password.</p>
          </>
        ) : (
          <>
            <h2 className="ax-h1">Welcome Back, Explorer!</h2>
            <p className="ax-sub">Continue your journey towards academic excellence.</p>
          </>
        )}
      </div>

      {banner && !error && step === "mobile" && <Alert kind={banner.kind}>{banner.text}</Alert>}

      {/* Student / Parent */}
      <div className="ax-seg" role="tablist" aria-label="I am a" data-right={role === "parent" ? "1" : "0"}>
        <span className="ax-seg-ind" aria-hidden="true" />
        <button type="button" role="tab" aria-selected={role === "student"} onClick={() => { setRole("student"); resetFlow(); }} disabled={busy}>
          <GraduationCap size={16} /> Student
        </button>
        <button type="button" role="tab" aria-selected={role === "parent"} onClick={() => { setRole("parent"); resetFlow(); }} disabled={busy}>
          <Users size={16} /> Parent
        </button>
      </div>

      {!isForgot && (
        <div className="ax-tabs" role="tablist" aria-label="Sign-in method">
          <button type="button" role="tab" aria-selected={method === "otp"} onClick={() => { setMethod("otp"); resetFlow("login"); }} disabled={busy}>
            <MessageSquareText size={14} style={{ verticalAlign: -2, marginRight: 6 }} />Login with OTP
          </button>
          <button type="button" role="tab" aria-selected={method === "password"} onClick={() => { setMethod("password"); resetFlow("login"); }} disabled={busy}>
            <KeyRound size={14} style={{ verticalAlign: -2, marginRight: 6 }} />Login with Password
          </button>
        </div>
      )}

      {/* ---------- OTP login & recovery ---------- */}
      {(isForgot || method === "otp") && step === "mobile" && (
        <form className="ax-form" onSubmit={(e) => { e.preventDefault(); void sendOtp(isForgot ? "reset" : "login"); }} noValidate>
          <MobileField value={mobile} onChange={(v) => { setMobile(v); setFieldErr((f) => ({ ...f, mobile: null })); }} error={fieldErr.mobile} autoFocus />
          <button className="ax-btn" type="submit" disabled={busy}>
            {busy ? <><Spinner /> Sending code…</> : "Send OTP"}
          </button>
          {isForgot ? (
            <div className="ax-row" style={{ justifyContent: "center" }}>
              <button type="button" className="ax-link" onClick={() => resetFlow("login")}>← Back to sign in</button>
            </div>
          ) : (
            <div className="ax-row">
              <span className="ax-muted">Signing in as a {roleLabel.toLowerCase()}</span>
              <button type="button" className="ax-link gold" onClick={() => resetFlow("forgot")}>Forgot Password?</button>
            </div>
          )}
        </form>
      )}

      {(isForgot || method === "otp") && step === "code" && (
        <form className="ax-form" onSubmit={(e) => { e.preventDefault(); void verifyOtp(isForgot ? "reset" : "login"); }} noValidate>
          <button type="button" className="ax-link ax-back" onClick={() => { setStep("mobile"); setError(null); setInfo(null); }}>
            <ArrowLeft size={14} /> Change number
          </button>
          <div>
            <div className="ax-label"><span>Enter the 6-digit code</span><span className="ax-muted">{e164 ? maskMobile(e164) : ""}</span></div>
            <OtpInput value={code} onChange={(v) => { setCode(v); setFieldErr((f) => ({ ...f, code: null })); }} onComplete={(v) => { if (!busy) void verifyOtp(isForgot ? "reset" : "login", v); }} />
            {fieldErr.code && <p className="ax-hint">{fieldErr.code}</p>}
          </div>
          <button className="ax-btn alt" type="submit" disabled={busy}>
            {busy ? <><Spinner /> Verifying…</> : isForgot ? "Verify code" : "Verify & Sign in"}
          </button>
          <div className="ax-row" style={{ justifyContent: "center" }}>
            {countdown.left > 0 ? (
              <span className="ax-muted">Resend code in 0:{String(countdown.left).padStart(2, "0")}</span>
            ) : (
              <button type="button" className="ax-link" disabled={busy} onClick={() => void sendOtp(isForgot ? "reset" : "login")}>Didn&apos;t get it? Resend OTP</button>
            )}
          </div>
        </form>
      )}

      {isForgot && step === "newpass" && (
        <form className="ax-form" onSubmit={saveNewPassword} noValidate>
          <PasswordField id="new-password" label="New password" autoComplete="new-password" placeholder="At least 8 characters"
            value={newPassword} onChange={setNewPassword} error={fieldErr.newPassword} />
          <PasswordField id="confirm-password" label="Confirm new password" autoComplete="new-password" placeholder="Type it again"
            value={confirmPassword} onChange={setConfirmPassword} error={fieldErr.confirmPassword} />
          <p className="ax-help" style={{ margin: 0 }}>Use 8+ characters with at least one letter and one number.</p>
          <button className="ax-btn" type="submit" disabled={busy}>
            {busy ? <><Spinner /> Saving…</> : "Save new password"}
          </button>
        </form>
      )}

      {/* ---------- Password login ---------- */}
      {!isForgot && method === "password" && (
        <form className="ax-form" onSubmit={passwordLogin} noValidate>
          <MobileField value={mobile} onChange={(v) => { setMobile(v); setFieldErr((f) => ({ ...f, mobile: null })); }} error={fieldErr.mobile} autoFocus />
          <PasswordField value={password} onChange={(v) => { setPassword(v); setFieldErr((f) => ({ ...f, password: null })); }} error={fieldErr.password}
            aside={<button type="button" className="ax-link gold" onClick={() => resetFlow("forgot")}>Forgot Password?</button>} />
          <button className="ax-btn" type="submit" disabled={busy}>
            {busy ? <><Spinner /> Signing in…</> : `Sign in as ${roleLabel}`}
          </button>
        </form>
      )}

      {error && <Alert kind="err">{error}</Alert>}
      {info && !error && <Alert kind="ok">{info}</Alert>}

      <p className="ax-note">
        <ShieldCheck size={13} style={{ verticalAlign: -2, marginRight: 4 }} />
        Accounts are created by your institute. <Link href="/register">New here?</Link>
      </p>

      <nav className="ax-foot" aria-label="Help and policies">
        <Link href="/support">Contact Support</Link>
        <Link href="/privacy">Privacy Policy</Link>
        <Link href="/terms">Terms of Service</Link>
        <Link href="/admin/login">Staff login</Link>
      </nav>
    </div>
  );
}
