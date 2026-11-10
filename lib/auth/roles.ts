export type Role = "student" | "parent" | "teacher" | "admin";
export type LoginRole = "student" | "parent";

export const PERMISSIONS = [
  { id: "manage_students", label: "Manage students" },
  { id: "manage_parents", label: "Manage parents" },
  { id: "manage_content", label: "Manage videos, notes & tests" },
  { id: "view_progress", label: "View student progress" },
  { id: "manage_attendance", label: "Mark attendance" },
  { id: "view_audit", label: "View audit log" },
] as const;
export type Permission = (typeof PERMISSIONS)[number]["id"];

export function isRole(v: unknown): v is Role {
  return v === "student" || v === "parent" || v === "teacher" || v === "admin";
}
export function isPermission(v: unknown): v is Permission {
  return PERMISSIONS.some((p) => p.id === v);
}

/**
 * Where each role lands after signing in (or when opening /login while signed in).
 * Students see their profile first; it links on to /dashboard.
 */
export function homeForRole(role: Role | string | null | undefined): string {
  switch (role) {
    case "parent": return "/parent/dashboard";
    case "teacher":
    case "admin": return "/admin";
    case "student": return "/profile";
    default: return "/login";
  }
}

/** Admin-area paths and the teacher permission each one needs (admins need none). */
export const ADMIN_PATH_PERMISSIONS: { prefix: string; permission: Permission | "admin" }[] = [
  { prefix: "/admin/teachers", permission: "admin" },
  { prefix: "/admin/students", permission: "manage_students" },
  { prefix: "/admin/parents", permission: "manage_parents" },
  { prefix: "/admin/attendance", permission: "manage_attendance" },
  { prefix: "/admin/progress", permission: "view_progress" },
  { prefix: "/admin/audit", permission: "view_audit" },
  { prefix: "/admin/videos", permission: "manage_content" },
  { prefix: "/admin/notes", permission: "manage_content" },
  { prefix: "/admin/tests", permission: "manage_content" },
  { prefix: "/admin/questions", permission: "manage_content" },
  { prefix: "/admin/subjects", permission: "manage_content" },
];

export function requiredAdminPermission(pathname: string) {
  return ADMIN_PATH_PERMISSIONS.find((r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/"))?.permission ?? null;
}

/** Only allow same-site relative redirect targets. */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}

const AREA_ROLES: { prefix: string; roles: Role[] }[] = [
  { prefix: "/admin", roles: ["admin", "teacher"] },
  { prefix: "/parent", roles: ["parent"] },
  { prefix: "/dashboard", roles: ["student", "admin"] },
  { prefix: "/profile", roles: ["student", "admin"] },
  { prefix: "/student", roles: ["student", "admin"] },
];

/** The page to open after sign-in: `next` if this role may open it, else the role's home. */
export function landingFor(role: Role | string, next?: string | null) {
  const n = safeNext(next ?? null);
  if (n && !n.startsWith("/admin/login") && !n.startsWith("/login")) {
    const area = AREA_ROLES.find((a) => n === a.prefix || n.startsWith(a.prefix + "/") || n.startsWith(a.prefix + "?"));
    if (area && area.roles.includes(role as Role)) return n;
  }
  return homeForRole(role);
}
