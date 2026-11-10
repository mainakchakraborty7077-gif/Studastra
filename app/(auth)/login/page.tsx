import type { Metadata } from "next";
import { redirect } from "next/navigation";
import LoginScene from "@/components/auth/LoginScene";
import { getViewer } from "@/lib/auth/guard";
import { landingFor } from "@/lib/auth/roles";
import LoginClient from "./LoginClient";

export const metadata: Metadata = {
  title: "Sign in — Studastra",
  description: "Sign in to Studastra as a student or parent with your registered mobile number.",
};

export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;

/** Already signed in with an active account? Skip the form and go to that role's home (students: /profile). */
async function signedInLanding(next: string | undefined) {
  try {
    const viewer = await getViewer();
    if (viewer && viewer.profile.account_status === "active") return landingFor(viewer.profile.role, next);
  } catch {
    // No Supabase config or session lookup failed: just show the form.
  }
  return null;
}

export default async function LoginPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const params = Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] ?? "" : v ?? ""]));
  const target = await signedInLanding(params.next);
  if (target) redirect(target);
  return (
    <LoginScene>
      <LoginClient params={params} />
    </LoginScene>
  );
}
