import Link from "next/link";
import type { Child } from "@/lib/parent/data";

export default function ChildTabs({ items, current, base }: { items: Child[]; current: string; base: string }) {
  if (items.length < 2) return null;
  return (
    <div className="pp-kids" role="tablist" aria-label="Choose child">
      {items.map((c) => (
        <Link key={c.id} href={`${base}?student=${c.id}`} className={c.id === current ? "on" : ""} role="tab" aria-selected={c.id === current}>
          {c.full_name}
        </Link>
      ))}
    </div>
  );
}
