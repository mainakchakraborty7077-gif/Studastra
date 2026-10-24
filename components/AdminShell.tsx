"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Wraps every admin page: checks the admin role, then shows the page inside a shared layout.
// The real protection is in the database (row level security); this check is for the interface.
export default function AdminShell({
  title, subtitle, back = "/admin", backLabel = "← Admin home", children,
}: { title: string; subtitle?: string; back?: string; backLabel?: string; children: ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "ok" | "denied">("checking");

  useEffect(() => {
    async function check() {
      const s = createClient();
      const { data: { user } } = await s.auth.getUser();
      if (!user) { router.replace("/auth"); return; }
      const { data } = await s.from("profiles").select("role").eq("id", user.id).maybeSingle();
      setStatus(data?.role === "admin" ? "ok" : "denied");
    }
    void check();
  }, [router]);

  return (
    <div className="ad-shell">
      <style>{css}</style>
      <div className="ad-wrap">
        <Link href={back} className="ad-back">{backLabel}</Link>
        {status === "checking" && <p className="ad-sub">Checking access...</p>}
        {status === "denied" && (
          <div className="ad-card"><h1 className="ad-title">Admins only</h1><p className="ad-sub">Your account does not have admin access.</p><Link href="/dashboard" className="ad-btn">Go to dashboard</Link></div>
        )}
        {status === "ok" && (<>
          <h1 className="ad-title">{title}</h1>
          {subtitle && <p className="ad-sub">{subtitle}</p>}
          {children}
        </>)}
      </div>
    </div>
  );
}

const css = `
.ad-shell{min-height:100vh;padding:28px 18px 70px;background:radial-gradient(ellipse at 70% 0%,#0f2530 0%,#0a1016 55%);color:#e8f1f5;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.ad-wrap{max-width:980px;margin:0 auto;display:flex;flex-direction:column;gap:16px}
.ad-back{color:rgba(232,241,245,.65);text-decoration:none;font-size:14px}
.ad-title{margin:6px 0 0;font-size:32px}
.ad-sub{margin:0;color:rgba(232,241,245,.65);font-size:15px;line-height:1.5}
.ad-card{box-sizing:border-box;padding:22px;border-radius:20px;background:rgba(18,28,37,.85);border:1px solid rgba(255,255,255,.08)}
.ad-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.ad-tile{display:block;color:inherit;text-decoration:none}
.ad-tile:hover{border-color:rgba(34,211,238,.45)}
.ad-tile.off{opacity:.55;pointer-events:none}
.ad-tile h2{margin:10px 0 6px;font-size:19px}
.ad-tile p{margin:0;font-size:14px;color:rgba(232,241,245,.65);line-height:1.45}
.ad-tile em{display:inline-block;margin-top:12px;font-style:normal;font-size:12px;padding:3px 10px;border-radius:99px;background:rgba(34,211,238,.12);color:#7fe7f2}
.ad-tile.off em{background:rgba(255,255,255,.08);color:rgba(232,241,245,.6)}
.ad-icon{font-size:26px}
.ad-form{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.ad-form .full{grid-column:1/-1}
.ad-form label{display:block;font-size:13px;color:rgba(232,241,245,.7);margin-bottom:5px}
.ad-form input,.ad-form select,.ad-form textarea{box-sizing:border-box;width:100%;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:#0c141b;color:#e8f1f5;font-size:15px;font-family:inherit}
.ad-btn{display:inline-block;padding:11px 20px;border:0;border-radius:12px;background:#22d3ee;color:#04222a;font-weight:600;font-size:15px;cursor:pointer;text-decoration:none;font-family:inherit}
.ad-btn:disabled{opacity:.6}
.ad-ghost{padding:6px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.15);background:none;color:rgba(232,241,245,.75);font-size:13px;cursor:pointer;font-family:inherit}
.ad-msg{margin:0;padding:10px 14px;border-radius:12px;background:rgba(34,211,238,.1);border:1px solid rgba(34,211,238,.25);font-size:14px}
.ad-q{padding:14px 0;border-top:1px solid rgba(255,255,255,.07)}
.ad-q p{margin:0 0 6px}
.ad-meta{font-size:12px;color:rgba(232,241,245,.55)}
.ad-q ol{margin:6px 0 0;padding-left:22px;font-size:14px;color:rgba(232,241,245,.8)}
.ad-q li.ok{color:#7fe7f2;font-weight:600}
.ad-table{width:100%;border-collapse:collapse;font-size:14px}
.ad-table th{text-align:left;font-weight:500;color:rgba(232,241,245,.55);font-size:12px;padding:8px 10px}
.ad-table td{padding:11px 10px;border-top:1px solid rgba(255,255,255,.07)}
.ad-scroll{overflow-x:auto}
@media(max-width:760px){.ad-grid{grid-template-columns:1fr}.ad-form{grid-template-columns:1fr}}
`;

