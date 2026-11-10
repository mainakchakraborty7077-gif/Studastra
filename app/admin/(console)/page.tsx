"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import Logo from "@/components/Logo";
type Item = { id: string; title: string; kind: string; created_at: string; user_id: string };

// Admin options. `perm` is the teacher permission needed (admins see everything);
// an empty href means the section is not built yet.
const OPTIONS = [
  { icon: "🎓", name: "Students", text: "Create student accounts, set class, batch and course enrolment.", href: "/admin/students", perm: "manage_students" },
  { icon: "👪", name: "Parents", text: "Create parent accounts and link them to students.", href: "/admin/parents", perm: "manage_parents" },
  { icon: "🧑‍🏫", name: "Teachers", text: "Create teacher accounts and assign permissions.", href: "/admin/teachers", perm: "admin" },
  { icon: "🗓️", name: "Attendance", text: "Mark daily attendance that parents can see.", href: "/admin/attendance", perm: "manage_attendance" },
  { icon: "📚", name: "Subjects", text: "Review the Class 11 and 12 chapter lists.", href: "/admin/subjects", perm: "manage_content" },
  { icon: "🎥", name: "Video editor", text: "Add YouTube lessons or upload MP4 videos.", href: "/admin/videos", perm: "manage_content" },
  { icon: "🗒️", name: "Notes editor", text: "Write notes and attach JPEG, MP4, or PDF files.", href: "/admin/notes", perm: "manage_content" },
  { icon: "📝", name: "DPP", text: "Publish daily practice problem sets.", href: "", perm: "manage_content" },
  { icon: "🗂️", name: "Question Bank", text: "Add, review and remove questions by subject and chapter.", href: "/admin/questions", perm: "manage_content" },
  { icon: "✨", name: "AI Tutor", text: "Set up and control the AI tutor.", href: "", perm: "admin" },
  { icon: "🎯", name: "Quiz", text: "Build quizzes from the question bank.", href: "", perm: "manage_content" },
  { icon: "📈", name: "Progress", text: "See how every student is progressing.", href: "/admin/progress", perm: "view_progress" },
  { icon: "🛡️", name: "Audit log", text: "Every account and permission change, with who did it.", href: "/admin/audit", perm: "view_audit" },
];

function AdminHome() {
  const [items, setItems] = useState<Item[]>([]);
  const [users, setUsers] = useState(0);
  const [message, setMessage] = useState("Checking administrator access…");
  const [ok, setOk] = useState(false);
  const [role, setRole] = useState<"admin" | "teacher">("admin");
  const [perms, setPerms] = useState<string[]>([]);
  const router = useRouter();
  const denied = useSearchParams().get("denied");

  useEffect(() => { async function load() { try {
    const s = createClient(); const { data: { user } } = await s.auth.getUser();
    if (!user) { router.replace("/admin/login?reason=signin"); return; }
    const { data: profile, error: pError } = await s.from("profiles").select("role, account_status").eq("id", user.id).single();
    if (pError || (profile?.role !== "admin" && profile?.role !== "teacher") || profile?.account_status !== "active") { router.replace("/admin/login"); return; }
    setRole(profile.role);
    if (profile.role === "teacher") {
      const { data: p } = await s.from("admin_permissions").select("permission").eq("profile_id", user.id);
      setPerms((p ?? []).map((r) => r.permission as string));
    }
    setOk(true);
    if (profile.role === "admin") {
      const { data, error } = await s.from("study_items").select("id,title,kind,created_at,user_id").order("created_at", { ascending: false }).limit(100);
      if (error) throw error; setItems((data || []) as Item[]);
      const { count } = await s.from("profiles").select("*", { count: "exact", head: true }); setUsers(count || 0);
    }
    setMessage("");
  } catch (e) { setMessage(e instanceof Error ? e.message : "Unable to load admin data."); } } void load(); }, [router]);

  function logout() { window.location.href = "/logout"; }
  const can = (perm: string) => role === "admin" || (perm !== "admin" && perms.includes(perm));
  const visible = OPTIONS.filter((o) => can(o.perm));

  return <main className="wrap" style={{ paddingTop: 24, paddingBottom: 60 }}><header className="nav" style={{ height: 64 }}><Logo size={40} caption={role === "teacher" ? "Teacher" : "Admin"} href="/admin" /><button className="btn small" onClick={logout}>Sign out</button></header><section><span className="pill">{role === "teacher" ? "TEACHER WORKSPACE" : "ADMIN WORKSPACE"}</span><h1 style={{ fontSize: 38, marginBottom: 4 }}>Platform overview</h1><p className="muted">Manage accounts, content, attendance and practice tests.</p>{denied && <p className="muted" role="alert" style={{ color: "#ffb6c4" }}>You don&apos;t have permission for that section. Ask an admin to grant it.</p>}{message && <p className="muted" role="status">{message}</p>}{ok && <>{role === "admin" && <div className="admin-cards"><div className="feature"><strong>{users}</strong><span className="muted">Profiles</span></div><div className="feature"><strong>{items.length}</strong><span className="muted">Recent study entries</span></div><div className="feature"><strong>Live</strong><span className="muted">Supabase connection</span></div></div>}
    <h2 style={{ fontSize: 22, margin: "28px 0 12px" }}>Manage StudAstra</h2>
    {visible.length === 0 && <div className="panel"><p className="muted" style={{ margin: 0 }}>No sections have been assigned to you yet. Ask an admin to grant permissions.</p></div>}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 20 }}>
      {visible.map((o) => {
        const body = <><span style={{ fontSize: 26 }}>{o.icon}</span><h3 style={{ margin: "10px 0 6px" }}>{o.name}</h3><p className="muted" style={{ margin: 0 }}>{o.text}</p><span className="pill" style={{ marginTop: 12 }}>{o.href ? "Open →" : "Coming soon"}</span></>;
        return o.href
          ? <Link key={o.name} href={o.href} className="panel" style={{ display: "block", color: "inherit", textDecoration: "none" }}>{body}</Link>
          : <div key={o.name} className="panel" aria-disabled="true" style={{ opacity: 0.55 }}>{body}</div>;
      })}
    </div>
    {can("manage_content") && <div className="panel row between"><div><h3>Create practice tests</h3><p className="muted">Write multiple-choice questions and publish them for students.</p></div><Link className="btn primary" href="/admin/tests">Open test builder →</Link></div>}
    {role === "admin" && <div className="panel"><h3>Recent study entries</h3>{items.length === 0 ? <div className="empty">No study entries yet.</div> : items.map((i) => <article className="resource" key={i.id}><b>{i.title}</b><p>{i.kind} • {new Date(i.created_at).toLocaleString()} • student {i.user_id.slice(0, 8)}…</p></article>)}</div>}
    <div className="notice">Every admin action is recorded in the audit log. Access is enforced by role, two-factor sign-in and database row-level security.</div></>}</section></main>;
}

export default function AdminPage() {
  return <Suspense fallback={null}><AdminHome /></Suspense>;
}
