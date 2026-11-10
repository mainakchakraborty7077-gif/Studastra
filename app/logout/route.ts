import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Visiting /logout signs out and returns to the login page.
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let target = "/login?reason=signedout";
  if (user) {
    const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (p?.role === "admin" || p?.role === "teacher") target = "/admin/login?reason=signedout";
  }
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL(target, request.url));
}
