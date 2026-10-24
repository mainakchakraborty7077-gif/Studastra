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
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function ProfileMenu({
  className = "fixed right-4 top-4 z-50",
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
    <div ref={wrapperRef} className={className}>
      <button
        type="button"
        onClick={() => {
          if (!open) loadProfile();
          setOpen(!open);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Open your profile"
        className="flex items-center gap-2 rounded-full border border-white/25 bg-[#141845] py-1 pl-1 pr-3 text-sm text-white shadow-lg"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f2c46d] font-semibold text-[#2a1d03]">
          {initial}
        </span>
        <span className="max-w-[8rem] truncate">{displayName.split(" ")[0]}</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Student profile"
          className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-white/20 bg-[#141845] p-5 text-white shadow-2xl"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#f2c46d] text-lg font-semibold text-[#2a1d03]">
              {initial}
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold">{displayName}</p>
              <p className="text-xs opacity-70">Student profile</p>
            </div>
          </div>

          <dl className="mt-4 space-y-2 text-sm">
            {details.map((d) => (
              <div key={d.label} className="flex justify-between gap-4">
                <dt className="opacity-70">{d.label}</dt>
                <dd className="truncate text-right">
                  {d.value || <span className="opacity-50">Not added</span>}
                </dd>
              </div>
            ))}
          </dl>

          {incomplete && (
            <p className="mt-4 text-xs opacity-80">
              Some details are missing. Add them to complete your profile.
            </p>
          )}

          <div className="mt-4 flex items-center justify-between">
            <a
              href="/profile"
              className="rounded-lg bg-[#f2c46d] px-3 py-2 text-sm font-semibold text-[#2a1d03]"
            >
              Edit profile
            </a>
            <button
              type="button"
              onClick={handleSignOut}
              className="text-sm underline"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

