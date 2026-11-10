import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { getChildren } from "@/lib/parent/data";

export const dynamic = "force-dynamic";

export default async function ParentProfile() {
  const viewer = await requireRole(["parent"]);
  const kids = await getChildren(viewer.userId);
  const p = viewer.profile;
  return (
    <>
      <h1 className="pp-h1">Your profile</h1>
      <p className="pp-sub">To change these details, contact your institute.</p>
      <div className="pp-grid">
        <div className="pp-card">
          <h3>Account</h3>
          <table className="pp-table"><tbody>
            <tr><td className="pp-meta">Name</td><td>{p.full_name || "—"}</td></tr>
            <tr><td className="pp-meta">Mobile</td><td>{p.mobile_number || "—"}</td></tr>
            <tr><td className="pp-meta">Email</td><td>{p.email || "—"}</td></tr>
            <tr><td className="pp-meta">Status</td><td style={{ textTransform: "capitalize" }}>{p.account_status}</td></tr>
          </tbody></table>
          <div className="pp-links">
            <Link href="/login?mode=forgot&role=parent">Change password</Link>
            <Link href="/support">Contact support</Link>
          </div>
        </div>
        <div className="pp-card">
          <h3>Linked students</h3>
          {kids.length === 0 ? <div className="pp-empty">No students linked yet.</div> : (
            <table className="pp-table"><tbody>
              {kids.map((k) => (
                <tr key={k.id}><td>{k.full_name}<div className="pp-meta">ID {k.student_code}{k.class_name ? ` · ${k.class_name}` : ""}</div></td><td className="pp-meta" style={{ textTransform: "capitalize" }}>{k.relationship}</td></tr>
              ))}
            </tbody></table>
          )}
        </div>
      </div>
    </>
  );
}
