import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeMobile } from "@/lib/auth/phone";
import { passwordProblem } from "@/lib/auth/accounts";
import type { Role } from "@/lib/auth/roles";

export type BaseAccountInput = {
  full_name?: unknown;
  mobile?: unknown;
  email?: unknown;
  password?: unknown;
  account_status?: unknown;
};

export type CleanAccount = {
  full_name: string;
  mobile: string;
  email: string | null;
  password: string;
  account_status: "active" | "inactive" | "suspended";
};

const STATUSES = ["active", "inactive", "suspended"] as const;

export function str(v: unknown, max = 200) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/** Validates the fields every account type shares. Returns an error message or the clean values. */
export function validateBase(input: BaseAccountInput): { error: string } | { value: CleanAccount } {
  const full_name = str(input.full_name, 120);
  if (full_name.length < 2) return { error: "Enter the full name." };
  const mobile = normalizeMobile(str(input.mobile, 20));
  if (!mobile) return { error: "Enter a valid 10-digit mobile number." };
  const emailRaw = str(input.email, 200).toLowerCase();
  if (emailRaw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) return { error: "Enter a valid email or leave it blank." };
  const password = typeof input.password === "string" ? input.password : "";
  const pwErr = passwordProblem(password);
  if (pwErr) return { error: `Password: ${pwErr}` };
  const status = str(input.account_status, 20) || "active";
  if (!STATUSES.includes(status as CleanAccount["account_status"])) return { error: "Choose a valid account status." };
  return { value: { full_name, mobile, email: emailRaw || null, password, account_status: status as CleanAccount["account_status"] } };
}

export function isStatus(v: unknown): v is CleanAccount["account_status"] {
  return STATUSES.includes(v as CleanAccount["account_status"]);
}

/** Supabase ban duration that matches an account status (suspended/inactive users cannot sign in). */
export function banFor(status: CleanAccount["account_status"]) {
  return status === "active" ? "none" : "876000h";
}

/**
 * Creates the auth user (phone confirmed) and sets the profile row. If anything
 * after user creation fails, the auth user is deleted so no half-made account remains.
 * `after` runs role-specific inserts (students row, links, ...).
 */
export async function createAccount(
  role: Role,
  acc: CleanAccount,
  after: (userId: string) => Promise<void>,
): Promise<{ id: string } | { error: string; status: number }> {
  const admin = createAdminClient();

  const { data: clash } = await admin.from("profiles").select("id").eq("mobile_number", acc.mobile).maybeSingle();
  if (clash) return { error: "An account with this mobile number already exists.", status: 409 };

  const { data, error } = await admin.auth.admin.createUser({
    phone: acc.mobile,
    phone_confirm: true,
    password: acc.password,
    ...(acc.email ? { email: acc.email, email_confirm: true } : {}),
    user_metadata: { full_name: acc.full_name, display_name: acc.full_name },
    ...(acc.account_status !== "active" ? { ban_duration: banFor(acc.account_status) } : {}),
  });
  if (error || !data.user) {
    const msg = error?.message ?? "Could not create the account.";
    const dup = /already|exists|registered/i.test(msg);
    return { error: dup ? "This mobile number or email is already registered." : msg, status: dup ? 409 : 400 };
  }
  const userId = data.user.id;
  try {
    const { error: pErr } = await admin.from("profiles").upsert({
      id: userId,
      full_name: acc.full_name,
      display_name: acc.full_name,
      mobile_number: acc.mobile,
      email: acc.email,
      role,
      account_status: acc.account_status,
    });
    if (pErr) throw pErr;
    if (role !== "student") {
      // The signup trigger may have created a students row for the default role.
      await admin.from("students").delete().eq("id", userId);
    }
    await after(userId);
    return { id: userId };
  } catch (e) {
    await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    const msg = (e as { message?: string })?.message ?? "Could not finish creating the account.";
    const dup = /duplicate key|unique/i.test(msg);
    return { error: dup ? "That Student ID, mobile or email is already in use." : msg, status: dup ? 409 : 400 };
  }
}

const RELATIONSHIPS = ["father", "mother", "guardian", "other"];

/** Resolves [{student_code, relationship}] to student ids, or returns an error message. */
export async function resolveLinks(raw: unknown) {
  const list = Array.isArray(raw) ? raw.slice(0, 10) : [];
  const links = list
    .map((l) => ({ code: str((l as Record<string, unknown>)?.student_code, 40).toUpperCase(), relationship: str((l as Record<string, unknown>)?.relationship, 20) || "guardian" }))
    .filter((l) => l.code);
  if (!links.length) return { error: "Link at least one Student ID." } as const;
  if (links.some((l) => !RELATIONSHIPS.includes(l.relationship))) return { error: "Choose a valid relationship." } as const;
  const admin = createAdminClient();
  const { data, error } = await admin.from("students").select("id, student_code").in("student_code", links.map((l) => l.code));
  if (error) return { error: error.message } as const;
  const byCode = new Map((data ?? []).map((s) => [String(s.student_code).toUpperCase(), s.id as string]));
  const missing = links.filter((l) => !byCode.has(l.code)).map((l) => l.code);
  if (missing.length) return { error: `No student found with ID: ${missing.join(", ")}` } as const;
  return { links: links.map((l) => ({ student_id: byCode.get(l.code)!, relationship: l.relationship, code: l.code })) } as const;
}

