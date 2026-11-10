import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { homeForRole, type Permission, type Role } from "./roles";
import { jsonError } from "./http";
import { clientIp } from "./rate-limit";

export type ViewerProfile = {
  id: string;
  role: Role;
  account_status: string;
  full_name: string | null;
  mobile_number: string | null;
  email: string | null;
};

export type Viewer = {
  userId: string;
  profile: ViewerProfile;
  aal: "aal1" | "aal2" | null;
  permissions: Permission[];
};

/** Reads the signed-in user, their profile, MFA level and (for staff) permissions. */
export async function getViewer(): Promise<Viewer | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, account_status, full_name, mobile_number, email")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return null;
  const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  let permissions: Permission[] = [];
  if (profile.role === "teacher") {
    const { data: perms } = await supabase.from("admin_permissions").select("permission").eq("profile_id", user.id);
    permissions = (perms ?? []).map((p) => p.permission as Permission);
  }
  return {
    userId: user.id,
    profile: profile as ViewerProfile,
    aal: (aalData?.currentLevel as "aal1" | "aal2" | null) ?? null,
    permissions,
  };
}

export function viewerCan(viewer: Viewer, permission: Permission | "admin") {
  if (viewer.profile.role === "admin") return true;
  if (permission === "admin") return false;
  return viewer.profile.role === "teacher" && viewer.permissions.includes(permission);
}

/** For server components/pages: redirect anyone who is not one of `roles`. */
export async function requireRole(roles: Role[], loginPath = "/login") {
  const viewer = await getViewer();
  if (!viewer) redirect(`${loginPath}?reason=signin`);
  if (viewer.profile.account_status !== "active") redirect(`${loginPath}?reason=inactive`);
  if (!roles.includes(viewer.profile.role)) redirect(homeForRole(viewer.profile.role));
  if ((viewer.profile.role === "admin" || viewer.profile.role === "teacher") && viewer.aal !== "aal2") {
    redirect("/admin/login?step=mfa");
  }
  return viewer;
}

/** For admin API routes: requires an active admin/teacher session at aal2 with the permission. */
export async function requireStaffApi(permission: Permission | "admin") {
  const viewer = await getViewer();
  if (!viewer) return { error: jsonError("Your session has expired. Please sign in again.", 401) } as const;
  const { role, account_status } = viewer.profile;
  if (account_status !== "active" || (role !== "admin" && role !== "teacher")) {
    return { error: jsonError("You do not have access to this action.", 403) } as const;
  }
  if (viewer.aal !== "aal2") return { error: jsonError("Two-factor verification is required.", 403) } as const;
  if (!viewerCan(viewer, permission)) return { error: jsonError("You do not have permission for this action.", 403) } as const;
  return { viewer } as const;
}

/** Writes one audit row with the service role (never blocks the main action on failure). */
export async function audit(
  request: Request,
  actorId: string | null,
  action: string,
  targetType: string | null,
  targetId: string | null,
  details: Record<string, unknown> = {},
) {
  try {
    const admin = createAdminClient();
    await admin.from("audit_logs").insert({
      actor_id: actorId,
      action,
      target_type: targetType,
      target_id: targetId,
      details,
      ip_address: clientIp(request),
    });
  } catch (e) {
    console.error("audit log failed", e);
  }
}
