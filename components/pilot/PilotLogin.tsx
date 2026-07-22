"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export function PilotLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/pilot/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Prijava nije uspjela.");
      window.location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Prijava nije uspjela.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="pilot-login-shell">
      <div className="pilot-login-art" aria-hidden="true">
        <span>IX</span>
        <i /><i /><i /><i /><i /><i /><i /><i /><i />
      </div>
      <form className="pilot-login" onSubmit={submit}>
        <p className="eyebrow">SKRIVENI AUTORSKI SLOJ</p>
        <h1>PILOT</h1>
        <p>Ovdje se pakao ne čita. Ovdje mu se mijenja arhitektura.</p>
        <label>
          <span>Pristupna lozinka</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoFocus
          />
        </label>
        {error && <p className="pilot-error" role="alert">{error}</p>}
        <button type="submit" disabled={loading}>{loading ? "PROVJERA..." : "OTVORI PILOT"}</button>
        <Link href="/">← javni pad</Link>
      </form>
    </main>
  );
}
