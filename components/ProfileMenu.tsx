"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type ProfileData = {
  email: string;
  full_name: string | null;
  grade: string | null;
  target_exam: string | null;
  gender: string | null;
  blood_group: string | null;
  date_of_birth: string | null;
  phone: string | null;
};

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

// Styles are self-contained (no Tailwind needed).
const css = `
.pm{position:relative;z-index:50;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.pm-fixed{position:fixed;top:16px;right:16px}
.pm-pill{display:flex;align-items:center;gap:8px;border-radius:999px;border:1px solid rgba(242,196,109,.45);background:linear-gradient(135deg,#1b1f5c,#141845);padding:4px 14px 4px 4px;color:#f4efe4;font-size:14px;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.35)}
.pm-pill:hover{border-color:#f2c46d}
.pm-dot{width:32px;height:32px;border-radius:50%;background:#f2c46d;color:#2a1d03;font-family:Georgia,serif;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.pm-caret{font-size:10px;color:#f2c46d;transition:transform .2s}
.pm-caret.up{transform:rotate(180deg)}
.pm-pop{position:absolute;right:0;top:calc(100% + 10px);width:340px;max-width:calc(100vw - 32px);box-sizing:border-box;overflow:hidden;border-radius:22px;border:1px solid rgba(242,196,109,.3);background:#141845;color:#f4efe4;box-shadow:0 28px 70px rgba(0,0,0,.55);text-align:left;animation:pmIn .18s ease-out}
@keyframes pmIn{from{opacity:0;transform:translateY(-6px) scale(.98)}to{opacity:1;transform:none}}
@media(prefers-reduced-motion:reduce){.pm-pop{animation:none}.pm-caret{transition:none}}
.pm-head{position:relative;padding:26px 20px 18px;text-align:center;background:radial-gradient(ellipse at 50% 0%,#33298a 0%,#1a1d57 70%)}
.pm-orbit{position:absolute;left:50%;top:-40px;transform:translateX(-50%);pointer-events:none}
.pm-avatar{position:relative;width:68px;height:68px;margin:0 auto;border-radius:50%;border:2px solid #f2c46d;background:#0c1033;color:#f2c46d;font-family:Georgia,serif;font-size:28px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 5px rgba(242,196,109,.12)}
.pm-name{position:relative;margin:12px 0 0;font-family:Georgia,"Times New Roman",serif;font-size:21px;font-weight:600}
.pm-sub{position:relative;margin:4px 0 0;font-size:13px;color:rgba(244,239,228,.7)}
.pm-chip{position:relative;display:inline-block;margin-top:12px;padding:5px 12px;border-radius:999px;border:1px solid rgba(242,196,109,.5);background:rgba(242,196,109,.12);color:#f2c46d;font-size:12px}
.pm-body{padding:16px 20px 20px}
.pm-bar{height:5px;border-radius:99px;background:rgba(255,255,255,.1);overflow:hidden}
.pm-bar>div{height:100%;border-radius:99px;background:linear-gradient(90deg,#f2c46d,#ffe3a3)}
.pm-note{margin:6px 0 14px;font-size:12px;color:rgba(244,239,228,.6)}
.pm-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.pm-cell{padding:10px 12px;border-radius:12px;background:rgba(12,16,51,.55);border:1px solid rgba(255,255,255,.07);min-width:0}
.pm-cell.full{grid-column:1/-1}
.pm-k{font-size:11px;color:rgba(244,239,228,.55);margin:0}
.pm-v{margin:3px 0 0;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pm-empty{color:rgba(244,239,228,.35)}
.pm-foot{display:flex;align-items:center;justify-content:space-between;margin-top:16px}
.pm-edit{display:inline-block;padding:9px 18px;border-radius:12px;background:#f2c46d;color:#2a1d03;font-size:14px;font-weight:600;text-decoration:none}
.pm-edit:hover{opacity:.9}
.pm-out{background:none;border:0;padding:0;color:rgba(244,239,228,.65);font-size:13px;text-decoration:underline;cursor:pointer;font-family:inherit}
.pm-pill:focus-visible,.pm-edit:focus-visible,.pm-out:focus-visible{outline:2px solid #f2c46d;outline-offset:2px}
`;

export default function ProfileMenu({ className = "pm-fixed" }: { className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const loadProfile = useCallback(async () => {
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) {
      setProfile(null);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("full_name, grade, target_exam, gender, blood_group, date_of_birth, phone")
      .eq("id", user.id)
      .maybeSingle();

    setProfile({
      email: user.email ?? "",
      full_name:
        data?.full_name ?? ((user.user_metadata?.display_name as string | undefined) || null),
      grade: data?.grade ?? null,
      target_exam: data?.target_exam ?? null,
      gender: data?.gender ?? null,
      blood_group: data?.blood_group ?? null,
      date_of_birth: data?.date_of_birth ?? null,
      phone: data?.phone ?? null,
    });
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth");
    router.refresh();
  }

  if (!profile) return null;

  const displayName = profile.full_name?.trim() || profile.email;
  const initial = displayName.charAt(0).toUpperCase();

  const cells: { k: string; v: string | null; full?: boolean }[] = [
    { k: "Email", v: profile.email, full: true },
    { k: "Grade", v: profile.grade },
    { k: "Gender", v: profile.gender },
    { k: "Blood group", v: profile.blood_group },
    { k: "Date of birth", v: formatDate(profile.date_of_birth) },
    { k: "Phone", v: profile.phone, full: true },
  ];
  const all = [profile.full_name, profile.grade, profile.target_exam, profile.gender, profile.blood_group, profile.date_of_birth, profile.phone];
  const percent = Math.round((all.filter(Boolean).length / all.length) * 100);

  return (
    <div ref={wrapperRef} className={`pm ${className}`}>
      <style>{css}</style>
      <button
        type="button"
        onClick={() => {
          if (!open) loadProfile();
          setOpen(!open);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Open your profile"
        className="pm-pill"
      >
        <span className="pm-dot">{initial}</span>
        <span>{displayName.split(" ")[0]}</span>
        <span className={`pm-caret ${open ? "up" : ""}`} aria-hidden="true">▼</span>
      </button>

      {open && (
        <div role="dialog" aria-label="Student profile" className="pm-pop">
          <div className="pm-head">
            <svg className="pm-orbit" aria-hidden="true" width="300" height="300" viewBox="0 0 300 300" fill="none">
              <circle cx="150" cy="150" r="140" stroke="#f2c46d" strokeOpacity=".18" />
              <circle cx="150" cy="150" r="100" stroke="#8b7cf6" strokeOpacity=".25" />
              <circle cx="150" cy="10" r="3" fill="#f2c46d" />
              <circle cx="50" cy="150" r="2.5" fill="#c9c2ff" />
            </svg>
            <div className="pm-avatar">{initial}</div>
            <p className="pm-name">{displayName}</p>
            <p className="pm-sub">{profile.grade ? `Student • ${profile.grade}` : "StudAstra student"}</p>
            {profile.target_exam && <span className="pm-chip">✦ Aiming for {profile.target_exam}</span>}
          </div>

          <div className="pm-body">
            <div className="pm-bar"><div style={{ width: `${percent}%` }} /></div>
            <p className="pm-note">
              {percent === 100 ? "Your profile is complete." : `${percent}% complete. Add the missing details.`}
            </p>

            <div className="pm-grid">
              {cells.map((c) => (
                <div key={c.k} className={`pm-cell ${c.full ? "full" : ""}`}>
                  <p className="pm-k">{c.k}</p>
                  <p className="pm-v">{c.v || <span className="pm-empty">Not added</span>}</p>
                </div>
              ))}
            </div>

            <div className="pm-foot">
              <a href="/profile" className="pm-edit">Edit profile</a>
              <button type="button" onClick={handleSignOut} className="pm-out">Sign out</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

