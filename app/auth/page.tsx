"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import CosmicBackdrop from "@/components/CosmicBackdrop";

const card =
  "w-full max-w-md rounded-3xl border border-[#f2c46d]/20 bg-[#141845]/80 p-8 shadow-2xl backdrop-blur";
const input =
  "w-full rounded-xl border border-white/15 bg-[#0c1033]/70 px-4 py-3 text-[#f4efe4] placeholder:text-white/35 focus:border-[#f2c46d] focus:outline-none focus:ring-2 focus:ring-[#f2c46d]/30";
const label = "mb-1.5 block text-sm text-white/75";

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
      <div className={card}>
        <Link href="/" className="text-sm text-white/60 hover:text-white">
          ← Back to StudAstra
        </Link>

        <div className="mt-6 text-center">
          <p className="text-lg text-[#f2c46d]">✦ StudAstra</p>
          <h1 className="mt-3 font-serif text-3xl leading-tight">
            {isSignUp ? "Begin your journey" : "Welcome back, stargazer"}
          </h1>
          <p className="mt-2 text-sm text-white/65">
            {isSignUp
              ? "Create an account to keep your notes, goals and progress."
              : "Sign in and continue your learning journey."}
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Choose sign in or create account"
          className="mt-6 grid grid-cols-2 rounded-xl border border-white/10 bg-[#0c1033]/60 p-1 text-sm"
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
              className={`rounded-lg px-3 py-2 font-medium transition-colors ${
                isSignUp === t.signUp
                  ? "bg-[#f2c46d] text-[#2a1d03]"
                  : "text-white/70 hover:text-white"
              }`}
            >
              {t.text}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {isSignUp && (
            <div>
              <label htmlFor="name" className={label}>Your name</label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={input}
                placeholder="Enter your name"
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className={label}>Email address</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={input}
              placeholder="you@example.com"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="password" className="text-sm text-white/75">
                Password
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-xs text-white/60 underline hover:text-white"
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
              className={input}
              placeholder="At least 6 characters"
            />
          </div>

          {!isSignUp && (
            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={handleResendConfirmation}
                disabled={busy}
                className="text-white/65 underline hover:text-white disabled:opacity-50"
              >
                {resending ? "Sending..." : "Resend confirmation email"}
              </button>
              <Link href="/auth/forgot-password" className="text-[#f2c46d] underline">
                Forgot password?
              </Link>
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-[#f2c46d] px-4 py-3 font-semibold text-[#2a1d03] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Please wait..." : isSignUp ? "Create account" : "Sign in"}
          </button>

          {message && (
            <p
              role="status"
              aria-live="polite"
              className="rounded-xl border border-[#f2c46d]/30 bg-[#f2c46d]/10 px-4 py-3 text-sm"
            >
              {message}
            </p>
          )}
        </form>
      </div>
    </CosmicBackdrop>
  );
}
