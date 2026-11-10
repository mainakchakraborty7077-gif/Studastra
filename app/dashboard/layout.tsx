import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

// Server-side gate for the student area.
export default async function StudentLayout({ children }: { children: ReactNode }) {
  await requireRole(["student", "admin"]);
  return <>{children}</>;
}
