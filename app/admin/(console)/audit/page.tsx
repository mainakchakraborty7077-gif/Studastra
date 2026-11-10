"use client";

import { useEffect, useState } from "react";
import AdminShell from "@/components/AdminShell";
import { api, one } from "@/components/admin/api";

type Actor = { full_name: string | null; role: string };
type Log = { id: number; action: string; target_type: string | null; target_id: string | null; details: Record<string, unknown>; ip_address: string | null; created_at: string; actor: Actor | Actor[] | null };

export default function AuditPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [msg, setMsg] = useState("Loading…");
  const [q, setQ] = useState("");
  useEffect(() => { void (async () => {
    const r = await api<{ logs: Log[] }>("/api/admin/audit");
    if (r.ok) { setLogs(r.logs); setMsg(""); } else setMsg(r.error);
  })(); }, []);
  const shown = logs.filter((l) => `${l.action} ${one(l.actor)?.full_name ?? ""} ${l.target_id ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <AdminShell title="Audit log" subtitle="The latest 300 sign-ins and admin actions. Entries cannot be edited or deleted from the app.">
      <input placeholder="Filter by action, person or target" value={q} onChange={(e) => setQ(e.target.value)}
        style={{ padding: "9px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,.12)", background: "#0c141b", color: "#e8f1f5", maxWidth: 360 }} />
      {msg && <p className="ad-msg">{msg}</p>}
      <div className="ad-card ad-scroll">
        <table className="ad-table">
          <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Target</th><th>Details</th></tr></thead>
          <tbody>
            {shown.map((l) => (
              <tr key={l.id}>
                <td style={{ whiteSpace: "nowrap" }}>{new Date(l.created_at).toLocaleString("en-IN")}</td>
                <td>{one(l.actor)?.full_name || <span className="ad-meta">system / unknown</span>}<div className="ad-meta">{one(l.actor)?.role ?? ""} {l.ip_address ? `· ${l.ip_address}` : ""}</div></td>
                <td><code>{l.action}</code></td>
                <td className="ad-meta">{l.target_type} {l.target_id ? String(l.target_id).slice(0, 12) : ""}</td>
                <td className="ad-meta" style={{ maxWidth: 320, wordBreak: "break-word" }}>{Object.keys(l.details || {}).length ? JSON.stringify(l.details) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
