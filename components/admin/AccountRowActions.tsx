"use client";

import { useState } from "react";
import { api, generatePassword, STATUS_OPTIONS } from "./api";

/** Status dropdown + reset-password + change-mobile actions for one account row. */
export default function AccountRowActions({ id, status, onChanged }: { id: string; status: string; onChanged: (msg: string) => void }) {
  const [busy, setBusy] = useState(false);

  async function patch(body: Record<string, unknown>, done: string) {
    setBusy(true);
    const res = await api(`/api/admin/users/${id}`, "PATCH", body);
    setBusy(false);
    onChanged(res.ok ? done : res.error);
  }

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
      <select
        aria-label="Account status"
        value={status}
        disabled={busy}
        onChange={(e) => {
          const next = e.target.value;
          if (next !== "active" && !confirm(`Set this account to ${next}? The user will not be able to sign in.`)) return;
          void patch({ account_status: next }, `Status changed to ${next}.`);
        }}
        style={{ padding: "5px 8px", borderRadius: 8, background: "#0c141b", color: "#e8f1f5", border: "1px solid rgba(255,255,255,.15)" }}
      >
        {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      <button className="ad-ghost" disabled={busy} onClick={() => {
        const suggested = generatePassword();
        const pw = prompt("New password (8+ characters, letters and numbers). Share it with the user securely:", suggested);
        if (pw) void patch({ password: pw }, `Password reset. New password: ${pw}`);
      }}>Reset password</button>
      <button className="ad-ghost" disabled={busy} onClick={() => {
        const m = prompt("New login mobile number (10 digits):");
        if (m) void patch({ mobile: m }, "Mobile number updated.");
      }}>Change mobile</button>
    </div>
  );
}
