"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SaStyles } from "@/components/CosmicBackdrop";

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
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function ProfileMenu({
  className = "sa-fixed",
}: {
  className?: string;
}) {
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
      .select(
        "full_name, grade, target_exam, gender, blood_group, date_of_birth, phone"
      )
      .eq("id", user.id)
      .maybeSingle();

    setProfile({
      email: user.email ?? "",
      full_name:
        data?.full_name ??
        ((user.user_metadata?.display_name as string | undefined) || null),
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

  // Close the panel when clicking outside it or pressing Escape
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
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

  // Not signed in: show nothing
  if (!profile) return null;

  const displayName = profile.full_name?.trim() || profile.email;
  const initial = displayName.charAt(0).toUpperCase();

  const details: { label: string; value: string | null }[] = [
    { label: "Email", value: profile.email },
    { label: "Grade", value: profile.grade },
    { label: "Targeted exam", value: profile.target_exam },
    { label: "Gender", value: profile.gender },
    { label: "Blood group", value: profile.blood_group },
    { label: "Date of birth", value: formatDate(profile.date_of_birth) },
    { label: "Phone", value: profile.phone },
  ];

  const incomplete = details.some((d) => !d.value);

  return (
    <div ref={wrapperRef} className={`sa-menu ${className}`}>
      <SaStyles />
      <button
        type="button"
        onClick={() => {
          if (!open) loadProfile();
          setOpen(!open);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Open your profile"
        className="sa-pill"
      >
        <span className="sa-dot">{initial}</span>
        <span>{displayName.split(" ")[0]}</span>
      </button>

      {open && (
        <div role="dialog" aria-label="Student profile" className="sa-pop">
          <p style={{ margin: 0, fontWeight: 600 }}>{displayName}</p>
          <p className="sa-small" style={{ margin: "2px 0 12px" }}>Student profile</p>
          <dl style={{ margin: 0 }}>
            {details.map((d) => (
              <div key={d.label} className="sa-item">
                <dt>{d.label}</dt>
                <dd>{d.value || <span className="sa-dim">Not added</span>}</dd>
              </div>
            ))}
          </dl>
          {incomplete && (
            <p className="sa-small" style={{ marginTop: 12 }}>
              Some details are missing. Add them to complete your profile.
            </p>
          )}
          <div className="sa-row" style={{ marginTop: 16 }}>
            <a href="/profile" className="sa-btn" style={{ width: "auto", padding: "8px 14px", fontSize: 14 }}>
              Edit profile
            </a>
            <button type="button" onClick={handleSignOut} className="sa-link">
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

