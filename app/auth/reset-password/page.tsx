
"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function prepare() {
      const supabase = createClient();
      const code = new URLSearchParams(window.location.search).get("code");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setMessage("This reset link is invalid or expired. Please request a new one.");
          return;
        }
      }

      const { data } = await supabase.auth.getSession();

      if (data.session) {
        setReady(true);
      } else {
        setMessage("Please open the password-reset link from your email. If it has expired, request a new one.");
      }
    }

    prepare().catch(() => {
      setMessage("Could not verify the reset link. Please request a new one.");
    });
  }, []);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");

    if (password.length < 8) {
      setMessage("Your password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("The passwords do not match.");
      return;
    }

    setBusy(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) throw error;

      setMessage("Your password has been changed successfully!");
      setTimeout(() => router.push("/auth"), 1800);
    } catch (err) {
      setMessage(
        err instanceof Error
          ? err.message
          : "Could not update your password. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="wrap" style={{ paddingTop: 38, paddingBottom: 70 }}>
      <Link className="brand" href="/">
        <span className="logo">✦</span> StudAstra
      </Link>

      <section>
        <div className="panel auth">
          <span className="pill">✦ ACCOUNT RECOVERY</span>
          <h1 style={{ fontSize: 34, marginBottom: 4 }}>
            Set a new password
          </h1>
          <p className="muted">
            Choose a new password for your StudAstra account.
          </p>

          {ready && (
            <form onSubmit={submit} className="stack">
              <label className="label" htmlFor="password">
                New password
              </label>
              <input
                className="input"
                id="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <label className="label" htmlFor="confirmPassword">
                Confirm new password
              </label>
              <input
                className="input"
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />

              <button className="btn primary" disabled={busy}>
                {busy ? "Updating…" : "Update password →"}
              </button>
            </form>
          )}

          {message && (
            <p className="muted" role="status">
              {message}
            </p>
          )}

          <p className="muted" style={{ fontSize: 13 }}>
            <Link href="/auth/forgot-password">Request another reset link</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
