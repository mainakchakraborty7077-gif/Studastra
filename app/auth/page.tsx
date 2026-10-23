"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthPage() {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendingConfirmation, setResendingConfirmation] = useState(false);

  async function handleResendConfirmation() {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setMessage("Enter your email address above first.");
      return;
    }

    setBusy(true);
    setResendingConfirmation(true);
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
      setResendingConfirmation(false);
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
          options: {
            data: { display_name: name.trim() },
          },
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
    <main className="min-h-screen flex items-center justify-center px-5 py-12">
      <div className="w-full max-w-md rounded-2xl border p-8 shadow-sm">
        <Link href="/" className="text-sm opacity-70">
          ← Back to StudAstra
        </Link>

        <div className="mt-8 mb-7">
          <p className="text-sm font-medium">✦ StudAstra</p>
          <h1 className="mt-3 text-3xl font-bold">
            {isSignUp ? "Create your account" : "Welcome back, stargazer"}
          </h1>
          <p className="mt-2 text-sm opacity-70">
            {isSignUp
              ? "Start building your own universe of learning."
              : "Sign in and continue your learning journey."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div>
              <label htmlFor="name" className="mb-1 block text-sm">
                Your name
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border bg-transparent px-3 py-3"
                placeholder="Enter your name"
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="mb-1 block text-sm">
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border bg-transparent px-3 py-3"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete={isSignUp ? "new-password" : "current-password"}
              minLength={6}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border bg-transparent px-3 py-3"
              placeholder="Enter your password"
            />
          </div>

          {!isSignUp && (
            <div className="text-right">
              <Link
                href="/auth/forgot-password"
                className="text-sm underline"
              >
                Forgot password?
              </Link>
            </div>
          )}

          {!isSignUp && (
            <button
              type="button"
              onClick={handleResendConfirmation}
              disabled={busy}
              className="w-full text-sm underline disabled:opacity-50"
            >
              {resendingConfirmation
                ? "Sending confirmation email..."
                : "Resend confirmation email"}
            </button>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg px-4 py-3 font-semibold disabled:opacity-50"
          >
            {busy
              ? "Please wait..."
              : isSignUp
                ? "Create account"
                : "Sign in"}
          </button>

          {message && (
            <p role="status" aria-live="polite" className="text-sm">
              {message}
            </p>
          )}
        </form>

        <p className="mt-6 text-center text-sm">
          {isSignUp ? "Already have an account?" : "New to StudAstra?"}{" "}
          <button
            type="button"
            className="font-semibold underline"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setMessage("");
            }}
          >
            {isSignUp ? "Sign in" : "Create an account"}
          </button>
        </p>
      </div>
    </main>
  );
}
