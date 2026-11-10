import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { homeForRole, requiredAdminPermission } from "@/lib/auth/roles";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";

// Route areas and who may open them. Every page also re-checks on its own
// (server components / RLS), so this is the first line of defence, not the only one.
const AREAS: { prefix: string; roles: string[] }[] = [
  { prefix: "/admin", roles: ["admin", "teacher"] },
  { prefix: "/parent", roles: ["parent"] },
  { prefix: "/dashboard", roles: ["student", "admin"] },
  { prefix: "/profile", roles: ["student", "admin"] },
  { prefix: "/student", roles: ["student", "admin"] },
];
const PUBLIC_ADMIN = ["/admin/login"];

function areaFor(pathname: string) {
  if (PUBLIC_ADMIN.some((p) => pathname === p || pathname.startsWith(p + "/"))) return null;
  return AREAS.find((a) => pathname === a.prefix || pathname.startsWith(a.prefix + "/")) ?? null;
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = supabaseUrl();
  const key = supabaseAnonKey();
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Refreshes the session cookie when needed. Do not run code between
  // createServerClient and getUser.
  const { data: { user } } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;
  const area = areaFor(pathname);
  if (!area) return response;

  const isAdminArea = area.prefix === "/admin";
  const loginPath = isAdminArea ? "/admin/login" : "/login";

  const redirectTo = (path: string, params: Record<string, string> = {}) => {
    const target = request.nextUrl.clone();
    target.pathname = path;
    target.search = "";
    Object.entries(params).forEach(([k, v]) => target.searchParams.set(k, v));
    const res = NextResponse.redirect(target);
    // Keep any refreshed/cleared auth cookies on the redirect.
    response.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };

  if (!user) {
    const hadSession = request.cookies.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));
    return redirectTo(loginPath, { next: pathname + search, reason: hadSession ? "expired" : "signin" });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, account_status")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.account_status !== "active") {
    await supabase.auth.signOut();
    return redirectTo(loginPath, { reason: profile ? "inactive" : "noprofile" });
  }

  const role = profile.role as string;
  if (!area.roles.includes(role)) {
    return redirectTo(homeForRole(role));
  }

  // Staff must have completed TOTP (aal2) for anything under /admin, and an
  // admin viewing student pages must too.
  if (role === "admin" || role === "teacher") {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel !== "aal2") {
      return redirectTo("/admin/login", { step: "mfa", next: pathname + search });
    }
  }

  if (isAdminArea && role === "teacher") {
    const needed = requiredAdminPermission(pathname);
    if (needed === "admin") return redirectTo("/admin", { denied: "1" });
    if (needed) {
      const { data: perm } = await supabase
        .from("admin_permissions")
        .select("permission")
        .eq("profile_id", user.id)
        .eq("permission", needed)
        .maybeSingle();
      if (!perm) return redirectTo("/admin", { denied: "1" });
    }
  }

  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
