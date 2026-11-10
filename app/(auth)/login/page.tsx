import { Suspense } from "react";
import type { Metadata } from "next";
import AuthScene from "@/components/auth/AuthScene";
import LoginClient from "./LoginClient";

export const metadata: Metadata = {
  title: "Sign in — StudAstra",
  description: "Sign in to StudAstra as a student or parent with your mobile number.",
};

export default function LoginPage() {
  return (
    <AuthScene>
      <Suspense fallback={<div className="ax-card" aria-busy="true" style={{ minHeight: 420 }} />}>
        <LoginClient />
      </Suspense>
    </AuthScene>
  );
}
