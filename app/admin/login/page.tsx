import type { Metadata } from "next";
import AuthScene from "@/components/auth/AuthScene";
import AdminLoginClient from "./AdminLoginClient";

export const metadata: Metadata = {
  title: "Staff sign in — StudAstra",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminLoginPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const params = Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] ?? "" : v ?? ""]));
  return (
    <AuthScene badges={false}>
      <AdminLoginClient params={params} />
    </AuthScene>
  );
}
