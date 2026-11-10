// One place to read the public Supabase settings (supports both the Vercel
// integration names and the plain names in .env.example).
export function supabaseUrl() {
  return process.env.NEXT_PUBLIC_STUDIASTRA_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
}
export function supabaseAnonKey() {
  return (
    process.env.NEXT_PUBLIC_STUDIASTRA_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ""
  );
}
