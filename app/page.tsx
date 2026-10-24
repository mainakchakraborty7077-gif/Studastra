"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import CosmicBackdrop from "@/components/CosmicBackdrop";

const GENDERS = ["Male", "Female", "Other", "Prefer not to say"];
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Not sure"];
const EXAMS = ["JEE Main", "JEE Advanced", "WBJEE", "NEET", "CUET", "Board exams", "GATE", "CAT", "UPSC"];

const card =
  "w-full max-w-xl rounded-3xl border border-[#f2c46d]/20 bg-[#141845]/80 p-8 shadow-2xl backdrop-blur";
const input =
  "w-full rounded-xl border border-white/15 bg-[#0c1033]/70 px-4 py-3 text-[#f4efe4] placeholder:text-white/35 focus:border-[#f2c46d] focus:outline-none focus:ring-2 focus:ring-[#f2c46d]/30";
const label = "mb-1.5 block text-sm text-white/75";

type Form = {
  fullName: string;
  grade: string;
  targetExam: string;
  gender: string;
  bloodGroup: string;
  dateOfBirth: string;
  phone: string;
};

const empty: Form = {
  fullName: "", grade: "", targetExam: "", gender: "",
  bloodGroup: "", dateOfBirth: "", phone: "",
};

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [f, setF] = useState<Form>(empty);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const set = (key: keyof Form) => (value: string) =>
    setF((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) {
        router.replace("/auth");
        return;
      }
      setUserId(user.id);
      setEmail(user.email ?? "");

      const { data: p } = await supabase
        .from("profiles")
        .select("full_name, grade, target_exam, gender, blood_group, date_of_birth, phone")
        .eq("id", user.id)
        .maybeSingle();

      const loaded: Form = {
        fullName: p?.full_name ?? (user.user_metadata?.display_name as string) ?? "",
        grade: p?.grade ?? "",
        targetExam: p?.target_exam ?? "",
        gender: p?.gender ?? "",
        bloodGroup: p?.blood_group ?? "",
        dateOfBirth: p?.date_of_birth ?? "",
        phone: p?.phone ?? "",
      };
      setF(loaded);
      // New students land straight in edit mode
      setEditing(!loaded.grade && !loaded.targetExam && !loaded.phone);
      setLoading(false);
    }
    load();
  }, [router]);

  async function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const supabase = createClient();
      const { error } = await supabase.from("profiles").upsert({
        id: userId,
        email,
        full_name: f.fullName.trim(),
        grade: f.grade.trim() || null,
        target_exam: f.targetExam.trim() || null,
        gender: f.gender || null,
        blood_group: f.bloodGroup || null,
        date_of_birth: f.dateOfBirth || null,
        phone: f.phone.trim() || null,
      });
      if (error) throw error;
      setEditing(false);
      setMessage("Your profile is saved.");
    } catch (err) {
      setMessage(
        err instanceof Error
          ? `Could not save your profile: ${err.message}`
          : "Could not save your profile. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth");
    router.refresh();
  }

  if (loading) {
    return (
      <CosmicBackdrop>
        <p className="text-sm text-white/70">Loading your profile...</p>
      </CosmicBackdrop>
    );
  }

  const name = f.fullName.trim() || email;
  const dob = f.dateOfBirth
    ? new Date(`${f.dateOfBirth}T00:00:00`).toLocaleDateString("en-IN", {
        day: "numeric", month: "long", year: "numeric",
      })
    : "";
  const rows = [
    { k: "Email address", v: email },
    { k: "Grade", v: f.grade },
    { k: "Targeted exam", v: f.targetExam },
    { k: "Gender", v: f.gender },
    { k: "Blood group", v: f.bloodGroup },
    { k: "Date of birth", v: dob },
    { k: "Phone number", v: f.phone },
  ];
  const filled = rows.filter((r) => r.v).length;
  const percent = Math.round((filled / rows.length) * 100);

  return (
    <CosmicBackdrop>
      <div className={card}>
        <Link href="/dashboard" className="text-sm text-white/60 hover:text-white">
          ← Back to dashboard
        </Link>

        <div className="mt-6 flex flex-col items-center text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-[#f2c46d] bg-[#0c1033] font-serif text-3xl text-[#f2c46d]">
            {name.charAt(0).toUpperCase()}
          </span>
          <h1 className="mt-4 font-serif text-3xl">{name}</h1>
          <p className="mt-1 text-sm text-white/65">
            {editing ? "Update your details" : "Student profile"}
          </p>
          <div className="mt-4 w-full max-w-xs">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-[#f2c46d]" style={{ width: `${percent}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-white/60">{percent}% of your profile is complete</p>
          </div>
        </div>

        {editing ? (
          <form onSubmit={handleSave} className="mt-8 space-y-4">
            <div>
              <label htmlFor="email" className={label}>Email address</label>
              <input id="email" type="email" value={email} readOnly className={`${input} opacity-60`} />
            </div>
            <div>
              <label htmlFor="fullName" className={label}>Student name</label>
              <input id="fullName" type="text" autoComplete="name" required value={f.fullName}
                onChange={(e) => set("fullName")(e.target.value)} className={input} placeholder="Enter your name" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="grade" className={label}>Grade or class</label>
                <input id="grade" type="text" value={f.grade}
                  onChange={(e) => set("grade")(e.target.value)} className={input} placeholder="For example, Class 11" />
              </div>
              <div>
                <label htmlFor="exam" className={label}>Targeted exam</label>
                <input id="exam" type="text" list="exam-options" value={f.targetExam}
                  onChange={(e) => set("targetExam")(e.target.value)} className={input} placeholder="Pick or type" />
                <datalist id="exam-options">
                  {EXAMS.map((x) => <option key={x} value={x} />)}
                </datalist>
              </div>
              <div>
                <label htmlFor="gender" className={label}>Gender</label>
                <select id="gender" value={f.gender} onChange={(e) => set("gender")(e.target.value)} className={input}>
                  <option value="" className="bg-[#141845]">Select</option>
                  {GENDERS.map((x) => <option key={x} value={x} className="bg-[#141845]">{x}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="blood" className={label}>Blood group</label>
                <select id="blood" value={f.bloodGroup} onChange={(e) => set("bloodGroup")(e.target.value)} className={input}>
                  <option value="" className="bg-[#141845]">Select</option>
                  {BLOOD_GROUPS.map((x) => <option key={x} value={x} className="bg-[#141845]">{x}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="dob" className={label}>Date of birth</label>
                <input id="dob" type="date" max={new Date().toISOString().split("T")[0]} value={f.dateOfBirth}
                  onChange={(e) => set("dateOfBirth")(e.target.value)} className={input} />
              </div>
              <div>
                <label htmlFor="phone" className={label}>Phone number</label>
                <input id="phone" type="tel" autoComplete="tel" pattern="[0-9+\s\-]{7,15}"
                  title="Enter 7 to 15 digits. You can use + and spaces." value={f.phone}
                  onChange={(e) => set("phone")(e.target.value)} className={input} placeholder="+91 98765 43210" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving}
                className="flex-1 rounded-xl bg-[#f2c46d] px-4 py-3 font-semibold text-[#2a1d03] hover:opacity-90 disabled:opacity-50">
                {saving ? "Saving..." : "Save profile"}
              </button>
              <button type="button" onClick={() => { setEditing(false); setMessage(""); }}
                className="rounded-xl border border-white/20 px-5 py-3 text-white/80 hover:text-white">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-8">
            <dl className="divide-y divide-white/10 rounded-2xl border border-white/10 bg-[#0c1033]/50">
              {rows.map((r) => (
                <div key={r.k} className="flex items-center justify-between gap-4 px-5 py-3.5 text-sm">
                  <dt className="text-white/60">{r.k}</dt>
                  <dd className="text-right">{r.v || <span className="text-white/40">Not added yet</span>}</dd>
                </div>
              ))}
            </dl>
            <button type="button" onClick={() => { setEditing(true); setMessage(""); }}
              className="mt-5 w-full rounded-xl bg-[#f2c46d] px-4 py-3 font-semibold text-[#2a1d03] hover:opacity-90">
              Edit details
            </button>
          </div>
        )}

        {message && (
          <p role="status" aria-live="polite"
            className="mt-5 rounded-xl border border-[#f2c46d]/30 bg-[#f2c46d]/10 px-4 py-3 text-sm">
            {message}
          </p>
        )}

        <button type="button" onClick={handleSignOut} className="mt-6 w-full text-sm text-white/60 underline hover:text-white">
          Sign out
        </button>
      </div>
    </CosmicBackdrop>
  );
}
