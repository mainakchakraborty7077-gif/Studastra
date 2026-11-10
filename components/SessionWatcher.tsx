"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Signs the user out after a period of inactivity on protected pages, and sends
// them to the right login page if their session ends in another tab or expires.
const PROTECTED = ["/dashboard", "/profile", "/parent", "/admin", "/student"];
const IDLE_MINUTES_STAFF = 20;
const IDLE_MINUTES_DEFAULT = 60;

export default function SessionWatcher() {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isProtected = PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/")) && !pathname.startsWith("/admin/login");
  const isStaff = pathname.startsWith("/admin");
  const loginPath = isStaff ? "/admin/login" : "/login";

  useEffect(() => {
    if (!isProtected) return;
    let supabase: ReturnType<typeof createClient>;
    try { supabase = createClient(); } catch { return; }

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        router.replace(`${loginPath}?reason=expired`);
        router.refresh();
      }
    });

    const limit = (isStaff ? IDLE_MINUTES_STAFF : IDLE_MINUTES_DEFAULT) * 60_000;
    const KEY = "sa-last-activity";
    const bump = () => {
      try { localStorage.setItem(KEY, String(Date.now())); } catch { /* private mode */ }
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(check, limit);
    };
    const check = async () => {
      let last = Date.now();
      try { last = Number(localStorage.getItem(KEY)) || last; } catch { /* ignore */ }
      if (Date.now() - last >= limit) {
        await supabase.auth.signOut();
        router.replace(`${loginPath}?reason=expired`);
      } else {
        timer.current = setTimeout(check, limit - (Date.now() - last));
      }
    };
    const events = ["mousemove", "keydown", "click", "touchstart", "scroll"] as const;
    let throttle = 0;
    const onActivity = () => { const now = Date.now(); if (now - throttle > 15_000) { throttle = now; bump(); } };
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    bump();

    return () => {
      sub.subscription.unsubscribe();
      events.forEach((e) => window.removeEventListener(e, onActivity));
      if (timer.current) clearTimeout(timer.current);
    };
  }, [isProtected, isStaff, loginPath, router]);

  return null;
}
