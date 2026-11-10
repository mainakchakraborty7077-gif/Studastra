import type { Metadata } from "next";
import AuthScene from "@/components/auth/AuthScene";
import LoginClient from "./LoginClient";

export const metadata: Metadata = {
  title: "Sign in — StudAstra",
  description: "Sign in to StudAstra as a student or parent with your mobile number.",
};

export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function LoginPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const params = Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] ?? "" : v ?? ""]));
  return (
    <AuthScene>
      <LoginClient params={params} />
    </AuthScene>
  );
}
