import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

// Server-side gate for every admin page (the login page lives outside this group).
// Middleware additionally checks per-section teacher permissions.
export default async function AdminConsoleLayout({ children }: { children: ReactNode }) {
  await requireRole(["admin", "teacher"], "/admin/login");
  return <>{children}</>;
}
