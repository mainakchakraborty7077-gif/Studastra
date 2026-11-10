import type { Metadata } from "next";
import { AuthPage } from "@/components/auth/AuthScene";

export const metadata: Metadata = { title: "Terms of Service — StudAstra" };

export default function TermsPage() {
  return (
    <AuthPage>
      <article className="ax-doc">
        <span className="ax-chip">LEGAL</span>
        <h1>Terms of Service</h1>
        <p>By signing in to StudAstra you agree to these terms.</p>
        <h2>Your account</h2>
        <ul>
          <li>Accounts are issued by your institute. Keep your password and one-time codes private; never share them.</li>
          <li>You are responsible for activity under your account. Tell support immediately if you suspect misuse.</li>
        </ul>
        <h2>Acceptable use</h2>
        <ul>
          <li>Use StudAstra for learning. Do not copy, resell or publicly share course videos, notes or test papers.</li>
          <li>Do not try to access other users&apos; data or interfere with the service.</li>
        </ul>
        <h2>Content</h2>
        <p>Course material belongs to the institute or its licensors. Practice-test scores are for guidance and are not official results.</p>
        <h2>Suspension</h2>
        <p>The institute may suspend accounts that break these terms or are no longer enrolled.</p>
        <h2>Changes</h2>
        <p>We may update these terms; continued use after an update means you accept the new terms.</p>
        <p className="ax-muted" style={{ fontSize: 13 }}>Template text — the institute should review it before launch.</p>
      </article>
    </AuthPage>
  );
}
