"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
type Item = { id: string; title: string; kind: string; created_at: string; user_id: string };
export default function AdminPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [users, setUsers] = useState(0);
  const [message, setMessage] = useState("Checking administrator access…");
  const [ok, setOk] = useState(false);
  const router = useRouter();
  useEffect(() => { async function load() { try {
    const s = createClient(); const { data: { user } } = await s.auth.getUser();
    if (!user) { router.replace("/admin/login"); return; }
    const { data: profile, error: pError } = await s.from("profiles").select("role").eq("id", user.id).single();
    if (pError || profile?.role !== "admin") { await s.auth.signOut(); router.replace("/admin/login"); return; }
    setOk(true);
    const { data, error } = await s.from("study_items").select("id,title,kind,created_at,user_id").order("created_at", { ascending: false }).limit(100);
    if (error) throw error; setItems((data || []) as Item[]);
    const { count } = await s.from("profiles").select("*", { count: "exact", head: true }); setUsers(count || 0); setMessage("");
  } catch (e) { setMessage(e instanceof Error ? e.message : "Unable to load admin data."); } } void load(); }, [router]);
  async function logout() { const s = createClient(); await s.auth.signOut(); router.replace("/"); router.refresh(); }
  return <main className="wrap" style={{ paddingTop: 24, paddingBottom: 60 }}><header className="nav" style={{ height: 64 }}><Link className="brand" href="/"><span className="logo">✦</span> StudAstra Admin</Link><button className="btn small" onClick={logout}>Sign out</button></header><section><span className="pill">ADMIN WORKSPACE</span><h1 style={{ fontSize: 38, marginBottom: 4 }}>Platform overview</h1><p className="muted">Review account activity and create practice tests.</p>{message && <p className="muted" role="status">{message}</p>}{ok && <><div className="admin-cards"><div className="feature"><strong>{users}</strong><span className="muted">Profiles</span></div><div className="feature"><strong>{items.length}</strong><span className="muted">Recent study entries</span></div><div className="feature"><strong>Live</strong><span className="muted">Supabase connection</span></div></div><div className="panel row between"><div><h3>Create practice tests</h3><p className="muted">Write multiple-choice questions and publish them for students.</p></div><Link className="btn primary" href="/admin/tests">Open test builder →</Link></div><div className="panel"><h3>Recent study entries</h3>{items.length === 0 ? <div className="empty">No study entries yet.</div> : items.map((i) => <article className="resource" key={i.id}><b>{i.title}</b><p>{i.kind} · {new Date(i.created_at).toLocaleString()} · student {i.user_id.slice(0, 8)}…</p></article>)}</div><div className="notice">Student entries remain private to their owners. Admin access is checked against your database role.</div></>}</section></main>;
}
