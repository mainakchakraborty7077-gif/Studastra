import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./env";

// Service-role client. Bypasses RLS: use ONLY in server route handlers after
// the caller's role has been checked. Never import this from a client component.
export function createAdminClient() {
  const url = supabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured on the server.");
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
