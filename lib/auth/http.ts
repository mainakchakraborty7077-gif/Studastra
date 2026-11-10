import "server-only";
import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "./rate-limit";

export function jsonError(message: string, status = 400, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

/** Applies per-IP and (optionally) per-identifier limits. Returns a 429 response when exceeded. */
export function limitOrNull(request: Request, scope: string, opts: { perIp: number; perKey?: number; windowMs: number; key?: string }) {
  const ip = clientIp(request);
  const a = rateLimit(`${scope}:ip:${ip}`, opts.perIp, opts.windowMs);
  if (!a.ok) return jsonError(`Too many attempts. Please wait ${a.retryAfter}s and try again.`, 429, { retryAfter: a.retryAfter });
  if (opts.key && opts.perKey) {
    const b = rateLimit(`${scope}:key:${opts.key}`, opts.perKey, opts.windowMs);
    if (!b.ok) return jsonError(`Too many attempts for this number. Please wait ${b.retryAfter}s and try again.`, 429, { retryAfter: b.retryAfter });
  }
  return null;
}

export async function readJson<T>(request: Request): Promise<Partial<T>> {
  try { return (await request.json()) as Partial<T>; } catch { return {}; }
}
