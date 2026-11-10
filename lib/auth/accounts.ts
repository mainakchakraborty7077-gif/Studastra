import "server-only";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";
import type { Role } from "./roles";

export type LoginAudience = "student" | "parent" | "staff";

export function isAudience(v: unknown): v is LoginAudience {
  return v === "student" || v === "parent" || v === "staff";
}

export function audienceAllows(audience: LoginAudience, role: Role) {
  if (audience === "staff") return role === "admin" || role === "teacher";
  return role === audience;
}

export const AUDIENCE_LABEL: Record<LoginAudience, string> = { student: "Student", parent: "Parent", staff: "staff" };

/** Finds the profile for an E.164 mobile number using the service role. */
export async function findAccountByMobile(mobile: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id, role, account_status")
    .eq("mobile_number", mobile)
    .maybeSingle();
  if (error) throw error;
  return data as { id: string; role: Role; account_status: string } | null;
}

/** Explains why an account cannot sign in for this audience, or null when it can. */
export function accountProblem(account: { role: Role; account_status: string } | null, audience: LoginAudience) {
  if (!account || !audienceAllows(audience, account.role)) {
    return `We couldn't find an active ${AUDIENCE_LABEL[audience]} account for this mobile number. Check the number and the Student/Parent selection, or contact support.`;
  }
  if (account.account_status !== "active") {
    return "This account is not active. Please contact support to restore access.";
  }
  return null;
}

/** A stateless anon client for sending OTPs (no session is created here). */
export function anonClient() {
  return createPlainClient(supabaseUrl(), supabaseAnonKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function passwordProblem(pw: string) {
  if (typeof pw !== "string" || pw.length < 8) return "Use at least 8 characters.";
  if (pw.length > 72) return "Use 72 characters or fewer.";
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return "Use at least one letter and one number.";
  return null;
}
