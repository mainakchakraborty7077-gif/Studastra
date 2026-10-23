 
"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: `${window.location.origin}/auth/reset-password`,
        }
      );

      if (error) throw error;

      setMessage(
        "If an account exists for that email, a password-reset link will be sent. Please check your inbox."
      );
    } catch (err) {
      setMessage(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      className="wrap"
      style={{ paddingTop: 38, paddingBottom: 70 }}
    >
      <Link className="brand" href="/">
        <span className="logo">✦</span> StudAstra
      </Link>

      <section>
        <div className="panel auth">
          <span className="pill">✦ ACCOUNT RECOVERY</span>
          <h1 style={{ fontSize: 34, marginBottom: 4 }}>
            Forgot your password?
          </h1>
          <p className="muted">
            Enter the email address you used for StudAstra, and we’ll send
            you a password-reset link.
          </p>

          <form onSubmit={submit} className="stack">
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              className="input"
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <button className="btn primary" disabled={busy}>
              {busy ? "Sending…" : "Send reset link →"}
            </button>
          </form>

          {message && (
            <p className="muted" role="status">
              {message}
            </p>
          )}

          <p className="muted" style={{ fontSize: 13 }}>
            Remember your password? <Link href="/auth">Back to sign in</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
