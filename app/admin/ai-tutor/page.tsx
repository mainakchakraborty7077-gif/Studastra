import AdminShell from "@/components/AdminShell";

export default function AiTutorAdminPage() {
  return <AdminShell title="AI Tutor" subtitle="AI tutor configuration and availability.">
    <section className="ad-card">
      <h2>Not connected yet</h2>
      <p>The repository does not include an AI tutor service or an admin control for one. To add it safely, the app needs a server-side tutor endpoint and a provider API key stored as a private Vercel environment variable.</p>
      <p className="ad-meta">Do not place provider API keys in browser code or in a <code>NEXT_PUBLIC_*</code> variable.</p>
    </section>
  </AdminShell>;
}

