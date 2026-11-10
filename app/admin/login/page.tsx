import { Suspense } from "react";
import type { Metadata } from "next";
import AuthScene from "@/components/auth/AuthScene";
import AdminLoginClient from "./AdminLoginClient";

export const metadata: Metadata = {
  title: "Staff sign in — StudAstra",
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return (
    <AuthScene badges={false}>
      <Suspense fallback={<div className="ax-card" aria-busy="true" style={{ minHeight: 380 }} />}>
        <AdminLoginClient />
      </Suspense>
    </AuthScene>
  );
}
