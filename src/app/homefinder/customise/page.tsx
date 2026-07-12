"use client";

import { useEffect, useState } from "react";

// Private renovation visualiser. Gated by the SAME passkey as the valuation report
// (verified server-side by /api/homefinder against HOMEFINDER_KEY). Once unlocked, it
// embeds the local Flux.1 Kontext editing tool that runs on the home PC's GPU, reached
// over a Cloudflare Tunnel. Nothing leaves the PC except the passkey-gated UI; the
// images and the render never touch Cloudflare.
//
// The tunnel hostname is injected at build time. Set it in the Pages project env:
//   NEXT_PUBLIC_CUSTOMISER_URL = https://customiser.rahulsp.com
// and set the Flask app's VIZ_PASSKEY to one of the HOMEFINDER_KEY values so the same
// passkey unlocks both.
const TUNNEL = (process.env.NEXT_PUBLIC_CUSTOMISER_URL || "https://customiser.rahulsp.com").replace(/\/$/, "");

export default function Customise() {
  const [key, setKey] = useState("");
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function unlock(k: string) {
    setLoading(true);
    setErr("");
    try {
      // A 200 (even the "no-report-yet" body) means the passkey is valid; 401 = wrong.
      const r = await fetch("/api/homefinder", { headers: { "x-homefinder-key": k } });
      if (r.status === 401) {
        setErr("Incorrect passkey.");
        setLoading(false);
        return;
      }
      sessionStorage.setItem("hf_key", k);
      setKey(k);
      setOk(true);
    } catch {
      setErr("Network error — try again.");
    }
    setLoading(false);
  }

  useEffect(() => {
    const saved = sessionStorage.getItem("hf_key");
    if (saved) {
      setKey(saved);
      unlock(saved);
    }
  }, []);

  if (!ok) {
    return (
      <main style={wrap}>
        <div style={gate}>
          <h1 style={{ fontSize: 22, margin: "0 0 6px" }}>🎨 Renovation Visualiser</h1>
          <p style={{ color: "#667", fontSize: 14, marginTop: 0 }}>
            Enter your passkey to edit the real listing photos.
          </p>
          <form onSubmit={(e) => { e.preventDefault(); unlock(key); }}>
            <input
              type="password" value={key} onChange={(e) => setKey(e.target.value)}
              placeholder="Passkey" autoFocus style={input}
            />
            <button type="submit" disabled={loading || !key} style={btn}>
              {loading ? "Checking…" : "Open visualiser"}
            </button>
          </form>
          {err && <p style={{ color: "#c01616", fontSize: 14 }}>{err}</p>}
          <p style={{ marginTop: 14 }}>
            <a href="/homefinder" style={{ color: "#1455c0", fontSize: 13, textDecoration: "none" }}>← Back to the valuation report</a>
          </p>
        </div>
      </main>
    );
  }

  const src = `${TUNNEL}/?key=${encodeURIComponent(key)}`;
  return (
    <main style={{ height: "100vh", display: "flex", flexDirection: "column", fontFamily: "-apple-system,Segoe UI,Roboto,Arial,sans-serif" }}>
      <div style={bar}>
        <a href="/homefinder" style={{ color: "#1455c0", fontSize: 13, textDecoration: "none", fontWeight: 600 }}>← Report</a>
        <span style={{ fontWeight: 700, fontSize: 14 }}>🎨 Renovation Visualiser</span>
        <span style={{ color: "#889", fontSize: 12 }}>runs on your PC's GPU · nothing leaves the machine</span>
        <button
          onClick={() => { sessionStorage.removeItem("hf_key"); setOk(false); setKey(""); }}
          style={{ marginLeft: "auto", padding: "5px 12px", fontSize: 12.5, fontWeight: 600, color: "#fff", background: "#1455c0", border: "none", borderRadius: 8, cursor: "pointer" }}>
          Lock
        </button>
      </div>
      <iframe
        src={src}
        title="Renovation visualiser"
        style={{ flex: 1, width: "100%", border: 0 }}
        allow="clipboard-write"
      />
      <p style={{ margin: 0, padding: "5px 14px", fontSize: 11.5, color: "#9aa", background: "#fafbfc", borderTop: "1px solid #eef1f4" }}>
        If this stays blank, your home PC or its tunnel may be offline — start ComfyUI + the visualiser, then reload.
      </p>
    </main>
  );
}

const wrap: React.CSSProperties = { maxWidth: 860, margin: "0 auto", padding: "30px 20px", fontFamily: "-apple-system,Segoe UI,Roboto,Arial,sans-serif", color: "#1a1f29" };
const gate: React.CSSProperties = { maxWidth: 360, margin: "12vh auto 0", background: "#fff", padding: 28, borderRadius: 14, boxShadow: "0 2px 10px rgba(0,0,0,.08)", textAlign: "center" };
const input: React.CSSProperties = { width: "100%", padding: "11px 13px", fontSize: 15, border: "1px solid #cdd6e0", borderRadius: 9, marginBottom: 10, boxSizing: "border-box" };
const btn: React.CSSProperties = { width: "100%", padding: "11px", fontSize: 15, fontWeight: 600, color: "#fff", background: "#1455c0", border: "none", borderRadius: 9, cursor: "pointer" };
const bar: React.CSSProperties = { display: "flex", alignItems: "center", gap: 12, padding: "8px 14px", borderBottom: "1px solid #e6eaef", background: "#fff", flexWrap: "wrap" };
