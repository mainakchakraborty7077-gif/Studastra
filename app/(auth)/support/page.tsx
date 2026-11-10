import type { Metadata } from "next";
import Link from "next/link";
import { AuthPage } from "@/components/auth/AuthScene";

export const metadata: Metadata = { title: "Contact support — StudAstra" };

export default function SupportPage() {
  const email = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
  const phone = process.env.NEXT_PUBLIC_SUPPORT_PHONE;
  return (
    <AuthPage>
      <article className="ax-doc">
        <span className="ax-chip">HELP</span>
        <h1>Contact support</h1>
        <p>Having trouble signing in? We&apos;re here to help you get back on track.</p>
        <h2>Reach us</h2>
        <ul>
          {email && <li>Email: <a href={`mailto:${email}`}>{email}</a></li>}
          {phone && <li>Phone / WhatsApp: <a href={`tel:${phone.replace(/\s/g, "")}`}>{phone}</a></li>}
          {!email && !phone && <li>Please contact your institute&apos;s office or your batch coordinator.</li>}
        </ul>
        <h2>Common fixes</h2>
        <ul>
          <li><b>&ldquo;No active account found&rdquo;</b> — check that you chose Student or Parent correctly and typed the number your institute registered.</li>
          <li><b>OTP didn&apos;t arrive</b> — wait for the resend timer, check network coverage and DND settings, or sign in with your password.</li>
          <li><b>Forgot password</b> — use <Link href="/login?mode=forgot">Forgot Password</Link> on the sign-in page to reset it with an OTP.</li>
          <li><b>Account not active</b> — your institute can restore access from the admin panel.</li>
        </ul>
      </article>
    </AuthPage>
  );
}
