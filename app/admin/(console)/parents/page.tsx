"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import AdminShell from "@/components/AdminShell";
import AccountRowActions from "@/components/admin/AccountRowActions";
import { api, generatePassword, one, STATUS_OPTIONS } from "@/components/admin/api";

type P = { full_name: string | null; mobile_number: string | null; email: string | null; account_status: string };
type Link = { relationship: string; students: { id: string; student_code: string; profiles: { full_name: string | null } | { full_name: string | null }[] | null } | null };
type Row = { id: string; created_at: string; profiles: P | P[]; parent_student: Link[] };

const RELS = ["father", "mother", "guardian", "other"];
const empty = { full_name: "", mobile: "", email: "", password: "", account_status: "active" };

export default function ParentsAdminPage() {
  const [form, setForm] = useState(empty);
  const [links, setLinks] = useState([{ student_code: "", relationship: "father" }]);
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    const r = await api<{ parents: Row[] }>("/api/admin/parents");
    if (r.ok) setRows(r.parents); else setMsg(r.error);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const set = (k: keyof typeof empty) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg("");
    const res = await api("/api/admin/parents", "POST", { ...form, links });
    setBusy(false);
    if (!res.ok) { setMsg(res.error); return; }
    setMsg(`Parent ${form.full_name} created and linked. They can sign in as a Parent with ${form.mobile}.`);
    setForm(empty); setLinks([{ student_code: "", relationship: "father" }]);
    void load();
  }

  async function addLink(id: string) {
    const code = prompt("Student ID to link:");
    if (!code) return;
    const rel = (prompt("Relationship (father, mother, guardian, other):", "guardian") || "guardian").toLowerCase().trim();
    const res = await api(`/api/admin/users/${id}`, "PATCH", { add_links: [{ student_code: code, relationship: rel }] });
    setMsg(res.ok ? "Student linked." : res.error);
    void load();
  }
  async function removeLink(id: string, studentId: string) {
    if (!confirm("Unlink this student from the parent?")) return;
    const res = await api(`/api/admin/users/${id}`, "PATCH", { remove_student_id: studentId });
    setMsg(res.ok ? "Student unlinked." : res.error);
    void load();
  }

  const filtered = rows.filter((r) => {
    const p = one(r.profiles);
    const codes = r.parent_student.map((l) => l.students?.student_code ?? "").join(" ");
    return `${p?.full_name ?? ""} ${p?.mobile_number ?? ""} ${codes}`.toLowerCase().includes(q.toLowerCase());
  });

  return (
    <AdminShell title="Parents" subtitle="Create parent accounts and link them to one or more students by Student ID.">
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
        <div><label htmlFor="st">Status</label><select id="st" value={form.account_status} onChange={(e) => set("account_status")(e.target.value)}>{STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
        <div className="full">
          <label>Linked students *</label>
          {links.map((l, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input aria-label="Student ID" placeholder="Student ID" value={l.student_code} onChange={(e) => setLinks((ls) => ls.map((x, j) => j === i ? { ...x, student_code: e.target.value } : x))} />
              <select aria-label="Relationship" value={l.relationship} onChange={(e) => setLinks((ls) => ls.map((x, j) => j === i ? { ...x, relationship: e.target.value } : x))} style={{ maxWidth: 160 }}>
                {RELS.map((r) => <option key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}</option>)}
              </select>
              {links.length > 1 && <button type="button" className="ad-ghost" onClick={() => setLinks((ls) => ls.filter((_, j) => j !== i))}>Remove</button>}
            </div>
          ))}
          <button type="button" className="ad-ghost" onClick={() => setLinks((ls) => [...ls, { student_code: "", relationship: "guardian" }])}>+ Link another student</button>
        </div>
        <div className="full"><button className="ad-btn" disabled={busy}>{busy ? "Creating…" : "Create parent account"}</button></div>
      </form>

      {msg && <p className="ad-msg" role="status">{msg}</p>}

      <div className="ad-card">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontSize: 19 }}>All parents ({rows.length})</h2>
          <input placeholder="Search name, mobile, Student ID" value={q} onChange={(e) => setQ(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,.12)", background: "#0c141b", color: "#e8f1f5", minWidth: 240 }} />
        </div>
        <div className="ad-scroll">
          <table className="ad-table">
            <thead><tr><th>Parent</th><th>Mobile</th><th>Linked students</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.map((r) => {
                const p = one(r.profiles);
                return (
                  <tr key={r.id}>
                    <td>{p?.full_name || "—"}<div className="ad-meta">{p?.email || ""}</div></td>
                    <td>{p?.mobile_number || "—"}</td>
                    <td>
                      {r.parent_student.map((l) => l.students && (
                        <div key={l.students.id} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <span>{one(l.students.profiles)?.full_name || "Student"} <span className="ad-meta">({l.students.student_code}, {l.relationship})</span></span>
                          <button className="ad-ghost" style={{ padding: "2px 8px" }} onClick={() => removeLink(r.id, l.students!.id)} aria-label="Unlink">×</button>
                        </div>
                      ))}
                      <button className="ad-ghost" style={{ marginTop: 4 }} onClick={() => addLink(r.id)}>+ Link student</button>
                    </td>
                    <td><AccountRowActions id={r.id} status={p?.account_status ?? "active"} onChanged={(m) => { setMsg(m); void load(); }} /></td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={4} className="ad-meta">No parents found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
