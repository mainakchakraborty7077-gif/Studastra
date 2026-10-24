import Link from "next/link";
import AdminShell from "@/components/AdminShell";

export default function DppAdminPage() {
  return <AdminShell title="Daily Practice Problems" subtitle="Prepare a daily practice set for students.">
    <section className="ad-card">
      <h2>Build a practice set</h2>
      <p>Use the question bank to prepare questions, then publish them from the practice-test builder. Give the set a clear DPP title so students can identify it.</p>
      <div className="ad-actions">
        <Link className="ad-btn" href="/admin/questions">Open question bank</Link>
        <Link className="ad-btn" href="/admin/tests">Create practice set</Link>
      </div>
    </section>
    <p className="ad-meta">Daily scheduling and a separate DPP collection are not configured in this project yet. Published sets use the existing practice-test workflow.</p>
  </AdminShell>;
}

