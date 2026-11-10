import Link from "next/link";
import Logo from "@/components/Logo";

// The StudAstra mark as it appears across the student dashboard: a crisp round
// logo with the "StudAstra" wordmark beside it. One size everywhere.
const css = `
.db-brand{gap:11px;padding:4px 6px;border-radius:14px;color:#f3f6ff}
.db-brand .sa-logo-text{color:#f3f6ff;font-size:19px;letter-spacing:-.2px}
.db-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 22px;padding-bottom:14px;border-bottom:1px solid rgba(255,255,255,.07)}
.db-back{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:999px;border:1px solid rgba(255,255,255,.12);
  color:rgba(232,241,245,.8);text-decoration:none;font-size:14px;white-space:nowrap}
.db-back:hover{color:#fff;border-color:rgba(255,255,255,.28)}
@media(max-width:480px){.db-brand .sa-logo-text{font-size:17px}.db-back{padding:7px 11px;font-size:13px}}
`;

export function DashboardStyles() {
  return <style>{css}</style>;
}

/** Logo + wordmark linking to /dashboard. */
export default function DashboardBrand({ className = "" }: { className?: string }) {
  return (
    <>
      <DashboardStyles />
      <Logo size={40} href="/dashboard" className={`db-brand ${className}`} label="StudAstra" textSize={19} />
    </>
  );
}

/** Header row for dashboard subpages: brand on the left, a way back on the right. */
export function DashboardBar({ backHref = "/dashboard", backLabel = "Dashboard" }: { backHref?: string; backLabel?: string }) {
  return (
    <div className="db-bar">
      <DashboardBrand />
      <Link href={backHref} className="db-back">← {backLabel}</Link>
    </div>
  );
}
