import type { ReactNode } from "react";
import type { Metadata } from "next";
import Logo from "@/components/Logo";
import TwinkleStars from "@/components/TwinkleStars";
import { requireRole } from "@/lib/auth/guard";
import ParentNav from "./ParentNav";
import "./parent.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Parent portal — StudAstra" };

export default async function ParentLayout({ children }: { children: ReactNode }) {
  await requireRole(["parent"]);
  return (
    <div className="pp">
      <TwinkleStars />
      <div className="pp-wrap">
        <header className="pp-top">
          <Logo size={40} caption="Parent portal" href="/parent/dashboard" />
          <ParentNav />
          <a className="pp-out" href="/logout">Sign out</a>
        </header>
        {children}
      </div>
    </div>
  );
}
