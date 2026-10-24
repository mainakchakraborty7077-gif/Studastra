"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const GENDERS = ["Male", "Female", "Other", "Prefer not to say"];
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Not sure"];
const EXAMS = [
  "JEE Main",
  "JEE Advanced",
  "WBJEE",
  "NEET",
  "CUET",
  "Board exams",
  "GATE",
  "CAT",
  "UPSC",
];

const inputClass = "w-full rounded-lg border bg-transparent px-3 py-3";
const labelClass = "mb-1 block text-sm";

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [grade, setGrade] = useState("");
  const [targetExam, setTargetExam] = useState("");
  const [gender, setGender] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;

      if (!user) {
        router.replace("/auth");
        return;
      }

      setUserId(user.id);
      setEmail(user.email ?? "");

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, grade, target_exam, gender, blood_group, date_of_birth, phone")
        .eq("id", user.id)
        .maybeSingle();

      setFullName(
        profile?.full_name ?? (user.user_metadata?.display_name as string) ?? ""
      );
      setGrade(profile?.grade ?? "");
      setTargetExam(profile?.target_exam ?? "");
      setGender(profile?.gender ?? "");
      setBloodGroup(profile?.blood_group ?? "");
      setDateOfBirth(profile?.date_of_birth ?? "");
      setPhone(profile?.phone ?? "");
      setLoading(false);
    }

    loadProfile();
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
        full_name: fullName.trim(),
        grade: grade.trim() || null,
        target_exam: targetExam.trim() || null,
        gender: gender || null,
        blood_group: bloodGroup || null,
        date_of_birth: dateOfBirth || null,
        phone: phone.trim() || null,
      });

      if (error) throw error;
      setMessage("Profile saved.");
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
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-sm opacity-70">Loading your profile...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-5 py-12">
      <div className="w-full max-w-md rounded-2xl border p-8 shadow-sm">
        <Link href="/dashboard" className="text-sm opacity-70">
          ← Back to dashboard
        </Link>

        <div className="mt-8 mb-7">
          <p className="text-sm font-medium">✦ StudAstra</p>
          <h1 className="mt-3 text-3xl font-bold">Your student profile</h1>
          <p className="mt-2 text-sm opacity-70">
            Keep your details up to date.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label htmlFor="email" className={labelClass}>Email address</label>
            <input
              id="email"
              type="email"
              value={email}
              readOnly
              className={`${inputClass} opacity-60`}
            />
          </div>

          <div>
            <label htmlFor="fullName" className={labelClass}>Student name</label>
            <input
              id="fullName"
              type="text"
              autoComplete="name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={inputClass}
              placeholder="Enter your name"
            />
          </div>

          <div>
            <label htmlFor="grade" className={labelClass}>Grade or class</label>
            <input
              id="grade"
              type="text"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className={inputClass}
              placeholder="For example, Class 11 or Dropper"
            />
          </div>

          <div>
            <label htmlFor="targetExam" className={labelClass}>Targeted exam</label>
            <input
              id="targetExam"
              type="text"
              list="exam-options"
              value={targetExam}
              onChange={(e) => setTargetExam(e.target.value)}
              className={inputClass}
              placeholder="Choose from the list or type your own"
            />
            <datalist id="exam-options">
              {EXAMS.map((exam) => (
                <option key={exam} value={exam} />
              ))}
            </datalist>
          </div>

          <div>
            <label htmlFor="gender" className={labelClass}>Gender</label>
            <select
              id="gender"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className={inputClass}
            >
              <option value="">Select</option>
              {GENDERS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="bloodGroup" className={labelClass}>Blood group</label>
            <select
              id="bloodGroup"
              value={bloodGroup}
              onChange={(e) => setBloodGroup(e.target.value)}
              className={inputClass}
            >
              <option value="">Select</option>
              {BLOOD_GROUPS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="dob" className={labelClass}>Date of birth</label>
            <input
              id="dob"
              type="date"
              max={new Date().toISOString().split("T")[0]}
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="phone" className={labelClass}>Phone number</label>
            <input
              id="phone"
              type="tel"
              autoComplete="tel"
              pattern="[0-9+\s\-]{7,15}"
              title="Enter 7 to 15 digits. You can use + and spaces."
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
              placeholder="+91 98765 43210"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg px-4 py-3 font-semibold disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save profile"}
          </button>

          {message && (
            <p role="status" aria-live="polite" className="text-sm">
              {message}
            </p>
          )}
        </form>

        <button
          type="button"
          onClick={handleSignOut}
          className="mt-6 w-full text-sm underline"
        >
          Sign out
        </button>
      </div>
    </main>
  );
}

