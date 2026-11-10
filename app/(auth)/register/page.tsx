import type { Metadata } from "next";
import Link from "next/link";
import { AuthPage } from "@/components/auth/AuthScene";

export const metadata: Metadata = { title: "Getting an account — StudAstra" };

export default function RegisterPage() {
  return (
    <AuthPage>
      <article className="ax-doc">
        <span className="ax-chip">ACCOUNTS</span>
        <h1>Accounts are created by your institute</h1>
        <p>
          StudAstra doesn&apos;t offer public sign-up. To keep student data safe, every student, parent and teacher
          account is created by an administrator at your institute, using the mobile number you registered with them.
        </p>
        <h2>Students</h2>
        <p>Once your admission is confirmed, your institute adds you with your Student ID, class, batch and mobile number. You can then sign in with an OTP sent to that number.</p>
        <h2>Parents</h2>
        <p>Your institute links your mobile number to your child&apos;s Student ID. After that you can sign in as a Parent to see performance and attendance.</p>
        <h2>Already have an account?</h2>
        <p><Link href="/login">Go to sign in</Link> · <Link href="/support">Contact support</Link> if your number isn&apos;t recognised.</p>
      </article>
    </AuthPage>
  );
}
