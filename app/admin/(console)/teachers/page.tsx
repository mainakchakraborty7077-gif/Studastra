"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import AdminShell from "@/components/AdminShell";
import AccountRowActions from "@/components/admin/AccountRowActions";
import { api, generatePassword, one, STATUS_OPTIONS } from "@/components/admin/api";
import { PERMISSIONS } from "@/lib/auth/roles";

type T = { employee_code: string | null; subjects: string | null };
type Row = {
  id: string; full_name: string | null; mobile_number: string | null; email: string | null; account_status: string; role: string;
  teachers: T | T[] | null; admin_permissions: { permission: string }[];
};
const empty = { full_name: "", mobile: "", email: "", password: "", employee_code: "", subjects: "", account_status: "active" };

export default function TeachersAdminPage() {
  const [form, setForm] = useState(empty);
  const [perms, setPerms] = useState<string[]>(["manage_content", "view_progress", "manage_attendance"]);
  const [rows, setRows] = useState<Row[]>([]);
  const [me, setMe] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await api<{ staff: Row[]; me: string }>("/api/admin/teachers");
    if (r.ok) { setRows(r.staff); setMe(r.me); } else setMsg(r.error);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const set = (k: keyof typeof empty) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg("");
    const res = await api("/api/admin/teachers", "POST", { ...form, permissions: perms });
    setBusy(false);
    if (!res.ok) { setMsg(res.error); return; }
    setMsg(`Teacher ${form.full_name} created. They sign in at /admin/login and must set up an authenticator app on first sign-in.`);
    setForm(empty);
    void load();
  }

  async function togglePerm(row: Row, perm: string, on: boolean) {
    const current = row.admin_permissions.map((p) => p.permission);
    const next = on ? [...new Set([...current, perm])] : current.filter((p) => p !== perm);
    const res = await api(`/api/admin/users/${row.id}`, "PATCH", { permissions: next });
    setMsg(res.ok ? "Permissions updated." : res.error);
    void load();
  }

  return (
    <AdminShell title="Teachers & staff" subtitle="Admins only. Create teacher accounts and choose exactly what each teacher can do.">
      <form className="ad-card ad-form" onSubmit={submit}>
        <div><label htmlFor="fn">Full name *</label><input id="fn" required value={form.full_name} onChange={(e) => set("full_name")(e.target.value)} /></div>
        <div><label htmlFor="mob">Mobile number * (+91)</label><input id="mob" required inputMode="numeric" value={form.mobile} onChange={(e) => set("mobile")(e.target.value)} /></div>
        <div><label htmlFor="em">Email (optional)</label><input id="em" type="email" value={form.email} onChange={(e) => set("email")(e.target.value)} /></div>
        <div>
          <label htmlFor="pw">Password *</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input id="pw" required value={form.password} onChange={(e) => set("password")(e.target.value)} placeholder="8+ chars, letters & numbers" />
            <button type="button" className="ad-ghost" onClick={() => set("password")(generatePassword())}>Generate</button>
          </div>
        </div>
        <div><label htmlFor="ec">Employee code</label><input id="ec" value={form.employee_code} onChange={(e) => set("employee_code")(e.target.value)} /></div>
        <div><label htmlFor="sb">Subjects</label><input id="sb" placeholder="Physics, Maths" value={form.subjects} onChange={(e) => set("subjects")(e.target.value)} /></div>
        <div><label htmlFor="st">Status</label><select id="st" value={form.account_status} onChange={(e) => set("account_status")(e.target.value)}>{STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
        <div className="full">
          <label>Permissions</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {PERMISSIONS.map((p) => (
              <label key={p.id} style={{ display: "flex", gap: 6, alignItems: "center", margin: 0, fontSize: 14, color: "#e8f1f5" }}>
                <input type="checkbox" style={{ width: "auto" }} checked={perms.includes(p.id)}
                  onChange={(e) => setPerms((ps) => e.target.checked ? [...ps, p.id] : ps.filter((x) => x !== p.id))} />
                {p.label}
              </label>
            ))}
          </div>
        </div>
        <div className="full"><button className="ad-btn" disabled={busy}>{busy ? "Creating…" : "Create teacher account"}</button></div>
      </form>

      {msg && <p className="ad-msg" role="status">{msg}</p>}

      <div className="ad-card">
        <h2 style={{ margin: "0 0 10px", fontSize: 19 }}>Staff ({rows.length})</h2>
        <div className="ad-scroll">
          <table className="ad-table">
            <thead><tr><th>Name</th><th>Role</th><th>Mobile</th><th>Permissions</th><th>Actions</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const t = one(r.teachers);
                return (
                  <tr key={r.id}>
                    <td>{r.full_name || "—"}<div className="ad-meta">{[t?.employee_code, t?.subjects, r.email].filter(Boolean).join(" · ")}</div></td>
                    <td>{r.role}</td>
                    <td>{r.mobile_number || "—"}</td>
                    <td>
                      {r.role === "admin" ? <span className="ad-meta">All</span> : (
                        <div style={{ display: "grid", gap: 3 }}>
                          {PERMISSIONS.map((p) => (
                            <label key={p.id} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5 }}>
                              <input type="checkbox" checked={r.admin_permissions.some((x) => x.permission === p.id)} onChange={(e) => void togglePerm(r, p.id, e.target.checked)} />
                              {p.label}
                            </label>
                          ))}
                        </div>
                      )}
                    </td>
                    <td>{r.id === me ? <span className="ad-meta">You</span> : <AccountRowActions id={r.id} status={r.account_status} onChanged={(m) => { setMsg(m); void load(); }} />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
