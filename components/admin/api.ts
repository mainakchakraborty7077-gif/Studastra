"use client";

export type ApiResult<T> = (T & { ok: true }) | { ok: false; error: string };

export async function api<T = Record<string, unknown>>(url: string, method = "GET", body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: "same-origin",
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      window.location.href = "/admin/login?reason=expired";
      return { ok: false, error: "Your session expired." };
    }
    if (!res.ok || data.ok === false) return { ok: false, error: data.error || `Request failed (${res.status}).` };
    return data as T & { ok: true };
  } catch {
    return { ok: false, error: "Network error. Check your connection." };
  }
}

/** A readable random password: 3 letters + 4 digits + 3 letters (meets the 8+ letter/number rule). */
export function generatePassword() {
  const letters = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
  const pick = (n: number, set: string) => Array.from(crypto.getRandomValues(new Uint32Array(n)), (x) => set[x % set.length]).join("");
  return `${pick(3, letters)}${pick(4, "23456789")}${pick(3, letters)}`;
}

export const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "suspended", label: "Suspended" },
];

export const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);
