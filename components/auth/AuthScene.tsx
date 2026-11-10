import type { ReactNode } from "react";
import Logo from "@/components/Logo";
import "./auth.css";

/** Deep-space backdrop: nebula glow, two star layers, a shooting star and floating planets. */
export function AuthSky() {
  return (
    <div className="ax-sky" aria-hidden="true">
      <div className="ax-nebula n1" />
      <div className="ax-nebula n2" />
      <div className="ax-nebula n3" />
      <div className="ax-stars s1" />
      <div className="ax-stars s2" />
      <span className="ax-shoot" />
      <span className="ax-planet p1" />
      <span className="ax-planet p2" />
      <span className="ax-planet p3" />
    </div>
  );
}

/** Two-column sign-in layout: brand on the left, the glass card on the right. */
export default function AuthScene({ children, badges = true }: { children: ReactNode; badges?: boolean }) {
  return (
    <main className="ax">
      <AuthSky />
      <div className="ax-layout">
        <section className="ax-hero">
          <Logo size={120} label={null} href="/" priority className="ax-hero-logo" />
          <h1 className="ax-word">STUD ASTRA</h1>
          <p className="ax-tag">
            Explore Beyond Limits. <b>Achieve Beyond Stars.</b>
          </p>
          {badges && (
            <div className="ax-badges">
              <span className="ax-badge"><i /> Live classes &amp; notes</span>
              <span className="ax-badge"><i /> JEE-style practice tests</span>
              <span className="ax-badge"><i /> Parent progress view</span>
            </div>
          )}
        </section>
        {children}
      </div>
    </main>
  );
}

/** Single-column page shell for policy / support pages. */
export function AuthPage({ children }: { children: ReactNode }) {
  return (
    <main className="ax">
      <AuthSky />
      <div className="ax-page">
        <header>
          <Logo size={44} />
          <a className="ax-link gold" href="/login">Sign in →</a>
        </header>
        {children}
      </div>
    </main>
  );
}
