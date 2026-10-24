import type { ReactNode } from "react";

// Shared centered stage: indigo night sky with fine orbit lines.
export default function CosmicBackdrop({ children }: { children: ReactNode }) {
  return (
    <main
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-12 text-[#f4efe4]"
      style={{
        background:
          "radial-gradient(ellipse at 50% 0%, #2a2170 0%, #0c1033 55%, #070920 100%)",
      }}
    >
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        width="900"
        height="900"
        viewBox="0 0 900 900"
        fill="none"
      >
        <circle cx="450" cy="450" r="440" stroke="#f2c46d" strokeOpacity=".14" />
        <circle cx="450" cy="450" r="330" stroke="#8b7cf6" strokeOpacity=".2" />
        <circle cx="450" cy="450" r="220" stroke="#f2c46d" strokeOpacity=".1" />
        <circle cx="450" cy="10" r="4" fill="#f2c46d" />
        <circle cx="120" cy="450" r="3" fill="#c9c2ff" />
        <circle cx="683" cy="683" r="2.5" fill="#f2c46d" fillOpacity=".7" />
      </svg>
      <div className="relative z-10 flex w-full justify-center">{children}</div>
    </main>
  );
}

