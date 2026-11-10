import { createBrowserClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseUrl } from "./env";

export function createClient() {
  const url = supabaseUrl();
  const key = supabaseAnonKey();
  if (!url || !key) {
    throw new Error("Supabase environment variables are missing. Copy .env.example to .env.local and fill them in.");
  }
  return createBrowserClient(url, key);
}
