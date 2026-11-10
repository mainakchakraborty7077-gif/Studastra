"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/parent/dashboard", label: "Overview" },
  { href: "/parent/performance", label: "Performance" },
  { href: "/parent/attendance", label: "Attendance" },
  { href: "/parent/profile", label: "Profile" },
];

export default function ParentNav() {
  const path = usePathname();
  return (
    <nav className="pp-nav" aria-label="Parent portal">
      {LINKS.map((l) => <Link key={l.href} href={l.href} className={path.startsWith(l.href) ? "on" : ""}>{l.label}</Link>)}
    </nav>
  );
}
