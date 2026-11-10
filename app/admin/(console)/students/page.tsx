"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import AdminShell from "@/components/AdminShell";
import AccountRowActions from "@/components/admin/AccountRowActions";
import { api, generatePassword, one, STATUS_OPTIONS } from "@/components/admin/api";

type Course = { id: string; code: string; name: string; is_active: boolean };
type Row = {
  id: string; student_code: string; class_name: string | null; batch: string | null; created_at: string;
  profiles: { full_name: string | null; mobile_number: string | null; email: string | null; account_status: string } | { full_name: string | null; mobile_number: string | null; email: string | null; account_status: string }[];
  enrollments: { course_id: string; status: string; courses: { code: string; name: string } | { code: string; name: string }[] | null }[];
};

const CLASSES = ["Class 6", "Class 7", "Class 8", "Class 9", "Class 10", "Class 11", "Class 12", "Dropper"];
const empty = { full_name: "", student_code: "", mobile: "", email: "", password: "", class_name: "", batch: "", account_status: "active" };

export default function StudentsAdminPage() {
  const [form, setForm] = useState(empty);
  const [courseIds, setCourseIds] = useState<string[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [newCourse, setNewCourse] = useState({ code: "", name: "" });

  const load = useCallback(async () => {
    const [s, c] = await Promise.all([api<{ students: Row[] }>("/api/admin/students"), api<{ courses: Course[] }>("/api/admin/courses")]);
    if (s.ok) setRows(s.students); else setMsg(s.error);
    if (c.ok) setCourses(c.courses);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const set = (k: keyof typeof empty) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg("");
    const res = await api("/api/admin/students", "POST", { ...form, course_ids: courseIds });
    setBusy(false);
    if (!res.ok) { setMsg(res.error); return; }
    setMsg(`Student ${form.full_name} (${form.student_code.toUpperCase()}) created. They can sign in with ${form.mobile} by OTP or the password you set.`);
    setForm(empty); setCourseIds([]);
    void load();
  }

  async function addCourse(e: FormEvent) {
    e.preventDefault();
    const res = await api("/api/admin/courses", "POST", newCourse);
    if (!res.ok) { setMsg(res.error); return; }
    setNewCourse({ code: "", name: "" });
    setMsg("Course added.");
    void load();
  }

  const filtered = rows.filter((r) => {
    const p = one(r.profiles);
    const hay = `${r.student_code} ${p?.full_name ?? ""} ${p?.mobile_number ?? ""} ${r.batch ?? ""} ${r.class_name ?? ""}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  return (
    <AdminShell title="Students" subtitle="Create student accounts. Students sign in with their mobile number — there is no public sign-up.">
      <form className="ad-card ad-form" onSubmit={submit}>
        <div><label htmlFor="fn">Full name *</label><input id="fn" required value={form.full_name} onChange={(e) => set("full_name")(e.target.value)} /></div>
        <div><label htmlFor="sid">Student ID *</label><input id="sid" required placeholder="e.g. SA-2026-001" value={form.student_code} onChange={(e) => set("student_code")(e.target.value)} /></div>
        <div><label htmlFor="mob">Mobile number * (+91)</label><input id="mob" required inputMode="numeric" placeholder="98765 43210" value={form.mobile} onChange={(e) => set("mobile")(e.target.value)} /></div>
        <div><label htmlFor="em">Email (optional)</label><input id="em" type="email" value={form.email} onChange={(e) => set("email")(e.target.value)} /></div>
        <div>
          <label htmlFor="pw">Password *</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input id="pw" required value={form.password} onChange={(e) => set("password")(e.target.value)} placeholder="8+ chars, letters & numbers" />
            <button type="button" className="ad-ghost" onClick={() => set("password")(generatePassword())}>Generate</button>
          </div>
        </div>
        <div><label htmlFor="st">Status</label><select id="st" value={form.account_status} onChange={(e) => set("account_status")(e.target.value)}>{STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
        <div><label htmlFor="cl">Class</label><select id="cl" value={form.class_name} onChange={(e) => set("class_name")(e.target.value)}><option value="">—</option>{CLASSES.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div><label htmlFor="bt">Batch</label><input id="bt" placeholder="e.g. JEE 2027 Morning" value={form.batch} onChange={(e) => set("batch")(e.target.value)} /></div>
        <div className="full">
          <label>Course enrolment</label>
          {courses.length === 0 ? <p className="ad-meta" style={{ margin: 0 }}>No courses yet — add one below.</p> : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {courses.filter((c) => c.is_active).map((c) => (
                <label key={c.id} style={{ display: "flex", gap: 6, alignItems: "center", margin: 0, fontSize: 14, color: "#e8f1f5" }}>
                  <input type="checkbox" style={{ width: "auto" }} checked={courseIds.includes(c.id)}
                    onChange={(e) => setCourseIds((ids) => e.target.checked ? [...ids, c.id] : ids.filter((x) => x !== c.id))} />
                  {c.name} <span className="ad-meta">({c.code})</span>
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="full"><button className="ad-btn" disabled={busy}>{busy ? "Creating…" : "Create student account"}</button></div>
      </form>

      {msg && <p className="ad-msg" role="status">{msg}</p>}

      <form className="ad-card ad-form" onSubmit={addCourse}>
        <div><label htmlFor="cc">New course code</label><input id="cc" value={newCourse.code} onChange={(e) => setNewCourse((c) => ({ ...c, code: e.target.value }))} placeholder="JEE27" /></div>
        <div><label htmlFor="cn">Course name</label><input id="cn" value={newCourse.name} onChange={(e) => setNewCourse((c) => ({ ...c, name: e.target.value }))} placeholder="JEE 2027 Two-Year Programme" /></div>
        <div className="full"><button className="ad-ghost" type="submit">Add course (admins)</button></div>
      </form>

      <div className="ad-card">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontSize: 19 }}>All students ({rows.length})</h2>
          <input className="ad-search" placeholder="Search name, ID, mobile, batch" value={q} onChange={(e) => setQ(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,.12)", background: "#0c141b", color: "#e8f1f5", minWidth: 240 }} />
        </div>
        <div className="ad-scroll">
          <table className="ad-table">
            <thead><tr><th>Student</th><th>ID</th><th>Mobile</th><th>Class / batch</th><th>Courses</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.map((r) => {
                const p = one(r.profiles);
                return (
                  <tr key={r.id}>
                    <td>{p?.full_name || "—"}<div className="ad-meta">{p?.email || ""}</div></td>
                    <td>{r.student_code}</td>
                    <td>{p?.mobile_number || <span className="ad-meta">not set</span>}</td>
                    <td>{r.class_name || "—"}<div className="ad-meta">{r.batch || ""}</div></td>
                    <td>{r.enrollments.map((e) => one(e.courses)?.code).filter(Boolean).join(", ") || "—"}</td>
                    <td><AccountRowActions id={r.id} status={p?.account_status ?? "active"} onChanged={(m) => { setMsg(m); void load(); }} /></td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={6} className="ad-meta">No students found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
