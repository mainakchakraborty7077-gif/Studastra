"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import CosmicBackdrop from "@/components/CosmicBackdrop";

export default function AuthPage() {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);

  function switchTo(signUp: boolean) {
    setIsSignUp(signUp);
    setMessage("");
  }

  async function handleResendConfirmation() {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setMessage("Enter your email address above first.");
      return;
    }
    setBusy(true);
    setResending(true);
    setMessage("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: normalizedEmail,
      });
      if (error) throw error;
      setMessage(
        "If this address has an unconfirmed account, a confirmation email has been sent. Check your inbox and spam folder."
      );
    } catch (err) {
      setMessage(
        err instanceof Error
          ? err.message
          : "Could not resend the confirmation email. Please try again later."
      );
    } finally {
      setBusy(false);
      setResending(false);
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const supabase = createClient();
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: name.trim() } },
        });
        if (error) throw error;
        if (data.session) {
          router.push("/dashboard");
          router.refresh();
          return;
        }
        setMessage(
          "Account request submitted. Check your email to confirm your account, then sign in."
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        router.push("/dashboard");
        router.refresh();
        return;
      }
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
    <CosmicBackdrop>
      <div className="sa-card">
        <Link href="/" className="sa-back">
          ← Back to StudAstra
        </Link>

        <div className="sa-center">
          <p className="sa-brand">✦ StudAstra</p>
          <h1 className="sa-title">
            {isSignUp ? "Begin your journey" : "Welcome back, stargazer"}
          </h1>
          <p className="sa-sub">
            {isSignUp
              ? "Create an account to keep your notes, goals and progress."
              : "Sign in and continue your learning journey."}
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Choose sign in or create account"
          className="sa-tabs"
        >
          {[
            { text: "Sign in", signUp: false },
            { text: "Create account", signUp: true },
          ].map((t) => (
            <button
              key={t.text}
              type="button"
              role="tab"
              aria-selected={isSignUp === t.signUp}
              onClick={() => switchTo(t.signUp)}
              className={`sa-tab ${isSignUp === t.signUp ? "on" : ""}`}
            >
              {t.text}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="sa-form">
          {isSignUp && (
            <div>
              <label htmlFor="name" className="sa-label">Your name</label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="sa-input"
                placeholder="Enter your name"
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="sa-label">Email address</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="sa-input"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <div className="sa-row" style={{ marginBottom: 6 }}>
              <label htmlFor="password" className="sa-label" style={{ margin: 0 }}>
                Password
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="sa-link"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete={isSignUp ? "new-password" : "current-password"}
              minLength={6}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="sa-input"
              placeholder="At least 6 characters"
            />
          </div>

          {!isSignUp && (
            <div className="sa-row">
              <button
                type="button"
                onClick={handleResendConfirmation}
                disabled={busy}
                className="sa-link"
              >
                {resending ? "Sending..." : "Resend confirmation email"}
              </button>
              <Link href="/auth/forgot-password" className="sa-gold">
                Forgot password?
              </Link>
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="sa-btn"
          >
            {busy ? "Please wait..." : isSignUp ? "Create account" : "Sign in"}
          </button>

          {message && (
            <p
              role="status"
              aria-live="polite"
              className="sa-msg"
            >
              {message}
            </p>
          )}
        </form>
      </div>
    </CosmicBackdrop>
  );
}

