import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "StudAstra — Your cosmic study companion",
  description: "A calmer, smarter place to plan study sessions, keep notes, and practise.",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}