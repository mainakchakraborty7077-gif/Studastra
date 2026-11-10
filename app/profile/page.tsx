"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ArrowRight } from "lucide-react";
import CosmicBackdrop from "@/components/CosmicBackdrop";
import Logo from "@/components/Logo";

const ctaCss = `
.pf-top{display:flex;align-items:center;justify-content:space-between;gap:12px}
.pf-top .sa-logo-text{color:#fff}
.pf-cta{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;box-sizing:border-box;margin-top:22px;padding:15px 18px;border-radius:14px;
  background:linear-gradient(100deg,#8b5cf6 0%,#6d6bff 45%,#3b9dff 100%);color:#fff;font-weight:700;font-size:16px;text-decoration:none;
  box-shadow:0 10px 28px rgba(91,108,255,.38);transition:transform .15s,box-shadow .2s}
.pf-cta:hover{transform:translateY(-1px);box-shadow:0 14px 34px rgba(91,108,255,.5)}
.pf-cta:focus-visible{outline:2px solid #fff;outline-offset:3px}
`;

const GENDERS = ["Male", "Female", "Other", "Prefer not to say"];
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Not sure"];
const EXAMS = ["JEE Main", "JEE Advanced", "WBJEE", "NEET", "CUET", "Board exams", "GATE", "CAT", "UPSC"];

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
        router.replace("/login?reason=signin");
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
      const reason = (err as { message?: string })?.message;
      setMessage(
        reason
          ? `Could not save your profile: ${reason}`
          : "Could not save your profile. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  function handleSignOut() {
    // Server route clears the session cookie and returns to the login page.
    window.location.href = "/logout";
  }

  if (loading) {
    return (
      <CosmicBackdrop>
        <p className="sa-sub">Loading your profile...</p>
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
      <style>{ctaCss}</style>
      <div className="sa-card wide">
        <div className="pf-top">
          <Logo size={36} href="/dashboard" textSize={18} />
          <Link href="/dashboard" className="sa-back">Dashboard →</Link>
        </div>

        <div className="sa-center">
          <span className="sa-avatar">
            {name.charAt(0).toUpperCase()}
          </span>
          <h1 className="sa-title">{name}</h1>
          <p className="sa-sub">
            {editing ? "Update your details" : "Student profile"}
          </p>
          <div className="sa-bar">
            <div style={{ width: `${percent}%` }} />
          </div>
          <p className="sa-small">{percent}% of your profile is complete</p>
          <Link href="/dashboard" className="pf-cta">
            Continue to Dashboard <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>

        {editing ? (
          <form onSubmit={handleSave} className="sa-form">
            <div>
              <label htmlFor="email" className="sa-label">Email address</label>
              <input id="email" type="email" value={email} readOnly className="sa-input" />
            </div>
            <div>
              <label htmlFor="fullName" className="sa-label">Student name</label>
              <input id="fullName" type="text" autoComplete="name" required value={f.fullName}
                onChange={(e) => set("fullName")(e.target.value)} className="sa-input" placeholder="Enter your name" />
            </div>
            <div className="sa-grid">
              <div>
                <label htmlFor="grade" className="sa-label">Grade or class</label>
                <input id="grade" type="text" value={f.grade}
                  onChange={(e) => set("grade")(e.target.value)} className="sa-input" placeholder="For example, Class 11" />
              </div>
              <div>
                <label htmlFor="exam" className="sa-label">Targeted exam</label>
                <input id="exam" type="text" list="exam-options" value={f.targetExam}
                  onChange={(e) => set("targetExam")(e.target.value)} className="sa-input" placeholder="Pick or type" />
                <datalist id="exam-options">
                  {EXAMS.map((x) => <option key={x} value={x} />)}
                </datalist>
              </div>
              <div>
                <label htmlFor="gender" className="sa-label">Gender</label>
                <select id="gender" value={f.gender} onChange={(e) => set("gender")(e.target.value)} className="sa-input">
                  <option value="">Select</option>
                  {GENDERS.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="blood" className="sa-label">Blood group</label>
                <select id="blood" value={f.bloodGroup} onChange={(e) => set("bloodGroup")(e.target.value)} className="sa-input">
                  <option value="">Select</option>
                  {BLOOD_GROUPS.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="dob" className="sa-label">Date of birth</label>
                <input id="dob" type="date" max={new Date().toISOString().split("T")[0]} value={f.dateOfBirth}
                  onChange={(e) => set("dateOfBirth")(e.target.value)} className="sa-input" />
              </div>
              <div>
                <label htmlFor="phone" className="sa-label">Phone number</label>
                <input id="phone" type="tel" autoComplete="tel" pattern="[0-9+\s\-]{7,15}"
                  title="Enter 7 to 15 digits. You can use + and spaces." value={f.phone}
                  onChange={(e) => set("phone")(e.target.value)} className="sa-input" placeholder="+91 98765 43210" />
              </div>
            </div>
            <div className="sa-actions">
              <button type="submit" disabled={saving}
                className="sa-btn">
                {saving ? "Saving..." : "Save profile"}
              </button>
              <button type="button" onClick={() => { setEditing(false); setMessage(""); }}
                className="sa-btn ghost">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div>
            <dl className="sa-list">
              {rows.map((r) => (
                <div key={r.k} className="sa-item">
                  <dt>{r.k}</dt>
                  <dd>{r.v || <span className="sa-dim">Not added yet</span>}</dd>
                </div>
              ))}
            </dl>
            <button type="button" onClick={() => { setEditing(true); setMessage(""); }}
              className="sa-btn" style={{ marginTop: 20 }}>
              Edit details
            </button>
          </div>
        )}

        {message && (
          <p role="status" aria-live="polite"
            className="sa-msg" style={{ marginTop: 20 }}>
            {message}
          </p>
        )}

        <button type="button" onClick={handleSignOut} className="sa-link sa-foot" style={{ display: "block", width: "100%" }}>
          Sign out
        </button>
      </div>
    </CosmicBackdrop>
  );
}

