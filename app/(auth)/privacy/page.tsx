import type { Metadata } from "next";
import { AuthPage } from "@/components/auth/AuthScene";

export const metadata: Metadata = { title: "Privacy Policy — StudAstra" };

export default function PrivacyPage() {
  return (
    <AuthPage>
      <article className="ax-doc">
        <span className="ax-chip">LEGAL</span>
        <h1>Privacy Policy</h1>
        <p>This policy explains what StudAstra collects and how it is used. The institute that operates your StudAstra account is responsible for your data.</p>
        <h2>What we collect</h2>
        <ul>
          <li>Account details your institute provides: name, mobile number, optional email, Student ID, class, batch and course enrolment.</li>
          <li>Learning activity: test attempts and scores, study sessions, chapter progress, notes and attendance.</li>
          <li>Security information: sign-in times, IP address and an audit trail of administrator actions.</li>
        </ul>
        <h2>How it is used</h2>
        <ul>
          <li>To sign you in (including one-time codes sent by SMS) and keep your account secure.</li>
          <li>To show students their own progress, and parents the progress of their linked children only.</li>
          <li>To let authorised teachers and administrators manage classes, content and attendance.</li>
        </ul>
        <h2>Sharing</h2>
        <p>We do not sell personal data. Data is stored with our hosting and database providers, and mobile numbers are shared with an SMS provider only to deliver one-time codes.</p>
        <h2>Your choices</h2>
        <p>You can ask your institute to correct or delete your information. Parents can request access to, or correction of, their child&apos;s data.</p>
        <h2>Contact</h2>
        <p>Questions about privacy? Visit the <a href="/support">support page</a>.</p>
        <p className="ax-muted" style={{ fontSize: 13 }}>Template text — the institute should review it before launch.</p>
      </article>
    </AuthPage>
  );
}
