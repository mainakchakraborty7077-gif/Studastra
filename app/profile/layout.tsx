import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

// Server-side gate for the profile page.
export default async function ProfileLayout({ children }: { children: ReactNode }) {
  await requireRole(["student", "admin"]);
  return <>{children}</>;
}
