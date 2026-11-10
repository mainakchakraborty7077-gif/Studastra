"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, ShieldCheck, Smartphone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Alert, OtpInput, PasswordField, Spinner, postJson } from "@/components/auth/fields";
import { landingFor } from "@/lib/auth/roles";

type Step = "checking" | "creds" | "enroll" | "challenge";

export default function AdminLoginClient() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const reason = params.get("reason");

  const [step, setStep] = useState<Step>("checking");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [role, setRole] = useState<string>("admin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finish = useCallback((r: string) => {
    router.replace(landingFor(r, next ?? "/admin"));
    router.refresh();
  }, [next, router]);

  /** Decide whether this session must enrol a new TOTP factor or answer a challenge. */
  const startMfa = useCallback(async () => {
    const s = createClient();
    const { data: aal } = await s.auth.mfa.getAuthenticatorAssuranceLevel();
    const { data: { user } } = await s.auth.getUser();
    if (!user) { setStep("creds"); return; }
    const { data: profile } = await s.from("profiles").select("role, account_status").eq("id", user.id).maybeSingle();
    if (!profile || (profile.role !== "admin" && profile.role !== "teacher") || profile.account_status !== "active") {
      setStep("creds");
      return;
    }
    setRole(profile.role);
    if (aal?.currentLevel === "aal2") { finish(profile.role); return; }

    const { data: factors, error: fErr } = await s.auth.mfa.listFactors();
    if (fErr) { setError(fErr.message); setStep("creds"); return; }
    const verified = factors?.totp?.[0];
    if (verified) {
      setFactorId(verified.id);
      setStep("challenge");
      return;
    }
    // Clear half-finished enrolments, then enrol a fresh TOTP factor.
    for (const f of factors?.all ?? []) {
      if (f.factor_type === "totp" && f.status === "unverified") await s.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data: enrolled, error: eErr } = await s.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `StudAstra ${new Date().toISOString().slice(0, 16)}`,
      issuer: "StudAstra",
    });
    if (eErr || !enrolled) {
      setError(eErr?.message?.includes("MFA") ? "TOTP MFA is not enabled for this project yet. Enable it in Supabase → Authentication → MFA." : (eErr?.message ?? "Could not start two-factor setup."));
      setStep("creds");
      return;
    }
    setFactorId(enrolled.id);
    setQr(enrolled.totp.qr_code);
    setSecret(enrolled.totp.secret);
    setStep("enroll");
  }, [finish]);

  useEffect(() => { void startMfa(); }, [startMfa]);

  async function submitCreds(e: FormEvent) {
    e.preventDefault();
    if (!identifier.trim() || !password) { setError("Enter your mobile number (or email) and password."); return; }
    setBusy(true); setError(null);
    const res = await postJson("/api/auth/admin/login", { identifier, password });
    if (!res.ok) { setBusy(false); setError(res.error ?? null); return; }
    setPassword("");
    await startMfa();
    setBusy(false);
  }

  async function verify(token = code) {
    const clean = token.replace(/\D/g, "");
    if (clean.length !== 6 || !factorId) { setError("Enter the 6-digit code from your authenticator app."); return; }
    setBusy(true); setError(null);
    const s = createClient();
    const { error: vErr } = await s.auth.mfa.challengeAndVerify({ factorId, code: clean });
    if (vErr) { setBusy(false); setCode(""); setError("That code didn't work. Codes refresh every 30 seconds — try the current one."); return; }
    await postJson("/api/auth/admin/mfa-complete", { enrolled: step === "enroll" });
    finish(role);
  }

  async function cancel() {
    const s = createClient();
    await s.auth.signOut();
    setStep("creds"); setCode(""); setQr(null); setSecret(null); setFactorId(null); setError(null);
  }

  return (
    <div className="ax-card">
      <div className="ax-card-head">
        <span className="ax-chip"><Lock size={12} /> RESTRICTED ACCESS</span>
        <h2 className="ax-h1">{step === "enroll" ? "Set up two-factor sign-in" : step === "challenge" ? "Two-factor verification" : "Staff sign in"}</h2>
        <p className="ax-sub">
          {step === "enroll" && "Two-factor authentication is mandatory for admins and teachers."}
          {step === "challenge" && "Enter the 6-digit code from your authenticator app."}
          {(step === "creds" || step === "checking") && "For administrators and teachers only. Every sign-in is logged."}
        </p>
      </div>

      {reason === "signedout" && step === "creds" && !error && <Alert kind="ok">You&apos;ve signed out safely.</Alert>}
      {(reason === "expired" || reason === "signin") && step === "creds" && !error && <Alert kind="warn">Please sign in again to continue.</Alert>}
      {reason === "inactive" && step === "creds" && !error && <Alert kind="err">This account is not active.</Alert>}
      {params.get("step") === "mfa" && step === "creds" && !error && <Alert kind="warn">Sign in and complete two-factor verification to open the admin area.</Alert>}

      {step === "checking" && <div className="ax-form" style={{ alignItems: "center", padding: 20 }}><Spinner /></div>}

      {step === "creds" && (
        <form className="ax-form" onSubmit={submitCreds} noValidate>
          <div>
            <label className="ax-label" htmlFor="identifier">Mobile number or email</label>
            <div className="ax-field">
              <input id="identifier" className="ax-input" autoComplete="username" placeholder="+91 98765 43210 or you@institute.in"
                value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoFocus />
            </div>
          </div>
          <PasswordField value={password} onChange={setPassword} />
          <button className="ax-btn alt" type="submit" disabled={busy}>{busy ? <><Spinner /> Checking…</> : "Continue"}</button>
          <p className="ax-help" style={{ margin: 0, textAlign: "center" }}>Forgot your password? Ask the account owner to reset it from Admin → Teachers.</p>
        </form>
      )}

      {step === "enroll" && (
        <form className="ax-form" onSubmit={(e) => { e.preventDefault(); void verify(); }} noValidate>
          <div className="ax-step"><Smartphone size={14} /> Scan with Google Authenticator, Microsoft Authenticator, Authy or 1Password</div>
          <div className="ax-qr">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {qr && <img src={qr} alt="QR code for your authenticator app" />}
            <div className="ax-muted" style={{ fontSize: 13 }}>
              Can&apos;t scan? Enter this key manually:
              <code>{secret}</code>
            </div>
          </div>
          <OtpInput value={code} onChange={setCode} onComplete={(v) => { if (!busy) void verify(v); }} />
          <button className="ax-btn" type="submit" disabled={busy}>{busy ? <><Spinner /> Verifying…</> : "Verify & enable"}</button>
          <div className="ax-row" style={{ justifyContent: "center" }}><button type="button" className="ax-link" onClick={cancel}>Cancel and sign out</button></div>
        </form>
      )}

      {step === "challenge" && (
        <form className="ax-form" onSubmit={(e) => { e.preventDefault(); void verify(); }} noValidate>
          <OtpInput value={code} onChange={setCode} onComplete={(v) => { if (!busy) void verify(v); }} />
          <button className="ax-btn" type="submit" disabled={busy}>{busy ? <><Spinner /> Verifying…</> : <><ShieldCheck size={17} /> Verify</>}</button>
          <div className="ax-row" style={{ justifyContent: "center" }}><button type="button" className="ax-link" onClick={cancel}>Use a different account</button></div>
        </form>
      )}

      {error && <Alert kind="err">{error}</Alert>}

      <nav className="ax-foot" aria-label="Help and policies">
        <Link href="/login">Student / Parent login</Link>
        <Link href="/support">Contact Support</Link>
        <Link href="/privacy">Privacy Policy</Link>
        <Link href="/terms">Terms</Link>
      </nav>
    </div>
  );
}
