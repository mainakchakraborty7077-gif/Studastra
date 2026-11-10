"use client";

import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent, type ReactNode } from "react";
import { Eye, EyeOff, AlertCircle, CheckCircle2, Info } from "lucide-react";

export function Spinner() {
  return <span className="ax-spin" aria-hidden="true" />;
}

export function Alert({ kind, children }: { kind: "err" | "ok" | "warn"; children: ReactNode }) {
  const Icon = kind === "err" ? AlertCircle : kind === "ok" ? CheckCircle2 : Info;
  return (
    <div className={`ax-alert ${kind}`} role={kind === "err" ? "alert" : "status"} aria-live="polite">
      <Icon size={17} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

export function MobileField({
  id = "mobile", value, onChange, error, disabled, autoFocus,
}: { id?: string; value: string; onChange: (v: string) => void; error?: string | null; disabled?: boolean; autoFocus?: boolean }) {
  return (
    <div>
      <label className="ax-label" htmlFor={id}>Mobile number</label>
      <div className={`ax-field ${error ? "bad" : ""}`}>
        <span className="ax-cc" aria-hidden="true">🇮🇳 +91</span>
        <input
          id={id}
          className="ax-input"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="98765 43210"
          maxLength={11}
          value={value}
          disabled={disabled}
          autoFocus={autoFocus}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-err` : undefined}
          onChange={(e) => onChange(e.target.value.replace(/[^\d ]/g, "").slice(0, 11))}
        />
      </div>
      {error && <p className="ax-hint" id={`${id}-err`}>{error}</p>}
    </div>
  );
}

export function PasswordField({
  id = "password", label = "Password", value, onChange, error, autoComplete = "current-password", aside, placeholder = "Enter your password",
}: {
  id?: string; label?: string; value: string; onChange: (v: string) => void; error?: string | null;
  autoComplete?: string; aside?: ReactNode; placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <div className="ax-label"><label htmlFor={id}>{label}</label>{aside}</div>
      <div className={`ax-field ${error ? "bad" : ""}`}>
        <input
          id={id}
          className="ax-input"
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          aria-invalid={!!error}
          onChange={(e) => onChange(e.target.value)}
        />
        <button type="button" className="ax-eye" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} aria-pressed={show}>
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {error && <p className="ax-hint">{error}</p>}
    </div>
  );
}

/** Six single-digit boxes with paste and backspace support. */
export function OtpInput({ value, onChange, length = 6, autoFocus = true, onComplete }: {
  value: string; onChange: (v: string) => void; length?: number; autoFocus?: boolean; onComplete?: (v: string) => void;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  useEffect(() => { if (autoFocus) refs.current[0]?.focus(); }, [autoFocus]);

  function setAt(i: number, digit: string) {
    const chars = value.padEnd(length, " ").split("");
    chars[i] = digit || " ";
    const next = chars.join("").replace(/\s+$/, "");
    onChange(next);
    const clean = next.replace(/\s/g, "");
    if (clean.length === length && onComplete) onComplete(clean);
  }
  function onKey(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !value[i]?.trim() && i > 0) { refs.current[i - 1]?.focus(); setAt(i - 1, ""); e.preventDefault(); }
    if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < length - 1) refs.current[i + 1]?.focus();
  }
  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!digits) return;
    e.preventDefault();
    onChange(digits);
    refs.current[Math.min(digits.length, length - 1)]?.focus();
    if (digits.length === length && onComplete) onComplete(digits);
  }
  return (
    <div className="ax-otp" role="group" aria-label="One-time code">
      {Array.from({ length }, (_, i) => {
        const ch = value[i]?.trim() ?? "";
        return (
          <input
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            className={ch ? "filled" : ""}
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={1}
            aria-label={`Digit ${i + 1}`}
            value={ch}
            onPaste={onPaste}
            onKeyDown={(e) => onKey(i, e)}
            onChange={(e) => {
              const d = e.target.value.replace(/\D/g, "");
              if (d.length > 1) { onChange(d.slice(0, length)); return; }
              setAt(i, d);
              if (d && i < length - 1) refs.current[i + 1]?.focus();
            }}
          />
        );
      })}
    </div>
  );
}

/** Counts down from `seconds` each time `start()` is called. */
export function useCountdown() {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return { left, start: (seconds: number) => setLeft(seconds) };
}

export async function postJson<T = Record<string, unknown>>(url: string, body: unknown): Promise<T & { ok: boolean; error?: string }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "same-origin",
    });
    const data = (await res.json().catch(() => ({}))) as T & { ok?: boolean; error?: string };
    if (!res.ok || data.ok === false) return { ...data, ok: false, error: data.error || "Something went wrong. Please try again." };
    return { ...data, ok: true };
  } catch {
    return { ok: false, error: "You appear to be offline. Check your connection and try again." } as T & { ok: boolean; error?: string };
  }
}
