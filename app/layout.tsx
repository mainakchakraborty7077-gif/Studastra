import type { Metadata, Viewport } from "next";
import "./globals.css";
import SessionWatcher from "@/components/SessionWatcher";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "StudAstra — Explore Beyond Limits. Achieve Beyond Stars.",
  description: "StudAstra: classes, notes, practice tests and progress tracking for students, with a portal for parents.",
  applicationName: "StudAstra",
  openGraph: { title: "StudAstra", description: "Explore Beyond Limits. Achieve Beyond Stars.", images: ["/logo.png"] },
};

export const viewport: Viewport = { themeColor: "#080D24" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><SessionWatcher />{children}</body></html>;
}
