import type { ReactNode } from "react";
import Link from "next/link";
import { Kaushan_Script } from "next/font/google";
import { BarChart3, GraduationCap, Target } from "lucide-react";
import Logo from "@/components/Logo";
import "./auth.css";
import "./login.css";

const script = Kaushan_Script({ weight: "400", subsets: ["latin"], display: "swap", variable: "--lg-script" });

/**
 * Student / parent sign-in layout: full-bleed illustration, brand top-left,
 * marketing copy on the left and the glass sign-in card on the right.
 */
export default function LoginScene({ children }: { children: ReactNode }) {
  return (
    <main className={`ax lg ${script.variable}`}>
      <div className="lg-bg" aria-hidden="true" />
      <div className="lg-shell">
        <header className="lg-top">
          <Logo size={54} label="Studastra" caption="Learn • Practise • Excel" href="/" priority className="lg-brand" textSize={30} />
          <p className="lg-motto">Dream Big. Aim Higher.</p>
        </header>

        <div className="lg-grid">
          <section className="lg-copy" aria-label="About Studastra">
            <h1 className="lg-h1">
              Your Journey to
              <br />
              <span className="lg-grad">Excellence</span> Begins Here
            </h1>
            <p className="lg-lead">
              Join Studastra – your ultimate learning companion for <b>JEE &amp; NEET</b> preparation.
            </p>
            <ul className="lg-chips">
              <li><GraduationCap size={20} aria-hidden="true" /><span>Expert<br />Mentorship</span></li>
              <li><BarChart3 size={20} aria-hidden="true" /><span>Personalised<br />Analytics</span></li>
              <li><Target size={20} aria-hidden="true" /><span>Smart Practice<br />&amp; Tests</span></li>
            </ul>
          </section>

          <div className="lg-side">
            {children}
            <nav className="lg-legal" aria-label="Policies">
              <Link href="/privacy">Privacy Policy</Link>
              <span aria-hidden="true">·</span>
              <Link href="/terms">Terms of Service</Link>
              <span aria-hidden="true">·</span>
              <Link href="/admin/login">Staff login</Link>
            </nav>
          </div>
        </div>

        <p className="lg-reach" aria-hidden="true">Reach for the Stars <span>★</span></p>
      </div>
    </main>
  );
}
