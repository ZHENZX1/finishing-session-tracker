"use client";

import React, { useEffect, useMemo, useState } from "react";

type Foot = "Right" | "Left" | "Both";

type Session = {
  id: string;
  date: string; // YYYY-MM-DD
  foot: Foot;
  shots: number;
  goals: number;
  durationMin: number;
  rpe: number; // 1-10
  notes: string;
  createdAt: number;
};

type FormState = {
  date: string;
  foot: Foot;
  shots: string;
  goals: string;
  durationMin: string;
  rpe: string;
  notes: string;
};

const STORAGE_KEY = "finishing_demo_v1";

function safeLoad(): Session[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];

    const out: Session[] = data
      .filter((x) => x && typeof x === "object")
      .map((x: any) => ({
        id: String(x.id ?? ""),
        date: String(x.date ?? ""),
        foot: (x.foot === "Left" || x.foot === "Both") ? x.foot : "Right",
        shots: Number(x.shots ?? 0),
        goals: Number(x.goals ?? 0),
        durationMin: Number(x.durationMin ?? 0),
        rpe: Number(x.rpe ?? 0),
        notes: String(x.notes ?? ""),
        createdAt: Number(x.createdAt ?? Date.now()),
      }))
      .filter((s) => s.id && s.date);

    out.sort((a, b) => b.createdAt - a.createdAt);
    return out;
  } catch {
    return [];
  }
}

function pct(x: number) {
  if (!Number.isFinite(x)) return "0.0%";
  return `${(x * 100).toFixed(1)}%`;
}

function toNum(s: string) {
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function validate(form: FormState): string[] {
  const errors: string[] = [];

  if (!form.date.trim()) errors.push("Date is required.");

  const shots = toNum(form.shots);
  const goals = toNum(form.goals);
  const durationMin = toNum(form.durationMin);
  const rpe = toNum(form.rpe);

  if (form.shots.trim() === "") errors.push("Shots is required.");
  if (form.goals.trim() === "") errors.push("Goals is required.");
  if (form.durationMin.trim() === "") errors.push("Duration is required.");
  if (form.rpe.trim() === "") errors.push("RPE is required.");

  if (form.shots.trim() !== "" && (!Number.isInteger(shots) || shots < 1)) errors.push("Shots must be an integer ≥ 1.");
  if (form.goals.trim() !== "" && (!Number.isInteger(goals) || goals < 0)) errors.push("Goals must be an integer ≥ 0.");
  if (Number.isInteger(shots) && Number.isInteger(goals) && goals > shots) errors.push("Goals must be ≤ shots.");

  if (form.durationMin.trim() !== "" && (!Number.isInteger(durationMin) || durationMin < 1)) {
    errors.push("Duration must be an integer ≥ 1 (minutes).");
  }

  if (form.rpe.trim() !== "" && (!Number.isInteger(rpe) || rpe < 1 || rpe > 10)) {
    errors.push("RPE must be an integer between 1 and 10.");
  }

  return errors;
}

function nextSuggestion(sessions: Session[]) {
  if (sessions.length === 0) return "Add a session to get a simple next-session suggestion.";

  const latest = sessions[0];
  const conv = latest.shots > 0 ? latest.goals / latest.shots : 0;

  if (latest.rpe >= 8) {
    return "High intensity (RPE ≥ 8). Next: reduce volume, focus on clean technique + placement.";
  }
  if (latest.shots >= 20 && conv < 0.2) {
    return "Low conversion today. Next: simplify (closer range / stationary ball) and aim for corners over power.";
  }
  if (latest.shots >= 15 && conv >= 0.6) {
    return "Strong conversion. Next: increase difficulty (weaker foot / one-touch / moving ball / time limit).";
  }
  return "Keep reps similar. Next: add one constraint (weaker foot or one-touch) while keeping conversion stable.";
}

export default function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const [form, setForm] = useState<FormState>({
    date: "",
    foot: "Right",
    shots: "",
    goals: "",
    durationMin: "",
    rpe: "",
    notes: "",
  });

  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    const loaded = safeLoad();
    setSessions(loaded);
    // set default date to today (optional but nice for demos)
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    setForm((p) => ({ ...p, date: `${yyyy}-${mm}-${dd}` }));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  }, [sessions, hydrated]);

  const summary = useMemo(() => {
    const totalShots = sessions.reduce((a, s) => a + s.shots, 0);
    const totalGoals = sessions.reduce((a, s) => a + s.goals, 0);
    const totalMin = sessions.reduce((a, s) => a + s.durationMin, 0);
    const avgRpe = sessions.length ? sessions.reduce((a, s) => a + s.rpe, 0) / sessions.length : 0;
    const conv = totalShots ? totalGoals / totalShots : 0;
    return { totalShots, totalGoals, totalMin, avgRpe, conv };
  }, [sessions]);

  const suggestion = useMemo(() => nextSuggestion(sessions), [sessions]);

  function onChange<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((p) => ({ ...p, [key]: value }));
  }

  function addSession(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate(form);
    if (errs.length) {
      setErrors(errs);
      console.warn("validation_error", { errs, form });
      return;
    }

    const newSession: Session = {
      id: String(Date.now()),
      date: form.date.trim(),
      foot: form.foot,
      shots: Number(form.shots),
      goals: Number(form.goals),
      durationMin: Number(form.durationMin),
      rpe: Number(form.rpe),
      notes: form.notes.trim(),
      createdAt: Date.now(),
    };

    setSessions((prev) => [newSession, ...prev]);
    setErrors([]);
    setForm((p) => ({ ...p, shots: "", goals: "", durationMin: "", rpe: "", notes: "" }));
    console.info("session_added", newSession);
  }

  function removeSession(id: string) {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    console.info("session_removed", { id });
  }

  function clearAll() {
    setSessions([]);
    localStorage.removeItem(STORAGE_KEY);
    setErrors([]);
    console.info("sessions_cleared");
  }

  const card: React.CSSProperties = {
    border: "1px solid #ddd",
    borderRadius: 12,
    padding: 12,
    background: "white",
  };

  return (
    <div style={{ maxWidth: 860, margin: "36px auto", padding: 16, fontFamily: "system-ui, Arial" }}>
      <h1 style={{ margin: 0 }}>Finishing Session Tracker</h1>
      <p style={{ marginTop: 6, color: "#444" }}>A focused shooting log: shots, goals, conversion, and load.</p>

      <div style={{ padding: 14, border: "1px solid #ddd", borderRadius: 12, background: "#fafafa", margin: "14px 0" }}>
        <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Next-session suggestion</div>
        <div style={{ fontSize: 14 }}>{suggestion}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 16 }}>
        <div style={card}><div style={{ fontSize: 12, color: "#666" }}>Total shots</div><div style={{ fontSize: 22, fontWeight: 700 }}>{summary.totalShots}</div></div>
        <div style={card}><div style={{ fontSize: 12, color: "#666" }}>Total goals</div><div style={{ fontSize: 22, fontWeight: 700 }}>{summary.totalGoals}</div></div>
        <div style={card}><div style={{ fontSize: 12, color: "#666" }}>Conversion</div><div style={{ fontSize: 22, fontWeight: 700 }}>{pct(summary.conv)}</div></div>
        <div style={card}><div style={{ fontSize: 12, color: "#666" }}>Avg RPE</div><div style={{ fontSize: 22, fontWeight: 700 }}>{summary.avgRpe.toFixed(1)}</div></div>
      </div>

      <form onSubmit={addSession} style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <h2 style={{ margin: "0 0 10px", fontSize: 18 }}>Add a session</h2>

        {errors.length > 0 && (
          <div style={{ background: "#fff3f3", border: "1px solid #ffd1d1", color: "#a40000", padding: 12, borderRadius: 10, marginBottom: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Fix these issues:</div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {errors.map((e) => <li key={e}>{e}</li>)}
            </ul>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, color: "#444" }}>Date</span>
            <input type="date" value={form.date} onChange={(e) => onChange("date", e.target.value)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }} />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, color: "#444" }}>Foot</span>
            <select value={form.foot} onChange={(e) => onChange("foot", e.target.value as Foot)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}>
              <option value="Right">Right</option>
              <option value="Left">Left</option>
              <option value="Both">Both</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, color: "#444" }}>Shots</span>
            <input type="number" inputMode="numeric" step={1} min={1} value={form.shots}
              onChange={(e) => onChange("shots", e.target.value)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }} />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, color: "#444" }}>Goals</span>
            <input type="number" inputMode="numeric" step={1} min={0} value={form.goals}
              onChange={(e) => onChange("goals", e.target.value)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }} />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, color: "#444" }}>Duration (min)</span>
            <input type="number" inputMode="numeric" step={1} min={1} value={form.durationMin}
              onChange={(e) => onChange("durationMin", e.target.value)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }} />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, color: "#444" }}>RPE (1–10)</span>
            <input type="number" inputMode="numeric" step={1} min={1} max={10} value={form.rpe}
              onChange={(e) => onChange("rpe", e.target.value)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }} />
          </label>
        </div>

        <label style={{ display: "grid", gap: 6, marginTop: 12 }}>
          <span style={{ fontSize: 13, color: "#444" }}>Notes (optional)</span>
          <textarea rows={3} value={form.notes} onChange={(e) => onChange("notes", e.target.value)}
            style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc", resize: "vertical" }} />
        </label>

        <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center" }}>
          <button type="submit" style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #333", background: "#111", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
            Add session
          </button>
          <button type="button" onClick={clearAll} style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #ccc", background: "#fff", cursor: "pointer" }}>
            Clear all
          </button>
          <div style={{ marginLeft: "auto", color: "#666", fontSize: 12 }}>{sessions.length} total</div>
        </div>
      </form>

      <div style={{ overflowX: "auto", border: "1px solid #ddd", borderRadius: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#fafafa" }}>
              <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #eee" }}>Date</th>
              <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #eee" }}>Foot</th>
              <th style={{ textAlign: "right", padding: 10, borderBottom: "1px solid #eee" }}>Shots</th>
              <th style={{ textAlign: "right", padding: 10, borderBottom: "1px solid #eee" }}>Goals</th>
              <th style={{ textAlign: "right", padding: 10, borderBottom: "1px solid #eee" }}>Conv</th>
              <th style={{ textAlign: "right", padding: 10, borderBottom: "1px solid #eee" }}>Min</th>
              <th style={{ textAlign: "right", padding: 10, borderBottom: "1px solid #eee" }}>RPE</th>
              <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #eee" }}>Notes</th>
              <th style={{ padding: 10, borderBottom: "1px solid #eee" }} />
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: 14, color: "#666" }}>No sessions yet.</td>
              </tr>
            ) : (
              sessions.map((s) => {
                const conv = s.shots ? s.goals / s.shots : 0;
                return (
                  <tr key={s.id}>
                    <td style={{ padding: 10, borderBottom: "1px solid #f0f0f0" }}>{s.date}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #f0f0f0" }}>{s.foot}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #f0f0f0", textAlign: "right" }}>{s.shots}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #f0f0f0", textAlign: "right" }}>{s.goals}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #f0f0f0", textAlign: "right" }}>{pct(conv)}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #f0f0f0", textAlign: "right" }}>{s.durationMin}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #f0f0f0", textAlign: "right" }}>{s.rpe}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #f0f0f0", color: "#444" }}>
                      {s.notes || <span style={{ color: "#999" }}>—</span>}
                    </td>
                    <td style={{ padding: 10, borderBottom: "1px solid #f0f0f0", textAlign: "right" }}>
                      <button
                        type="button"
                        onClick={() => removeSession(s.id)}
                        style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #ccc", background: "#fff", cursor: "pointer" }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
