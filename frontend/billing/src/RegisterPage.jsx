import { useState, useEffect } from "react";
import axios from "axios";
import { API_BASE } from "./api";

/* ─────────────────────────────────────────────────────────────────────────────
   Shared SVG icons (same set as LoginPage for design consistency)
───────────────────────────────────────────────────────────────────────────── */
function IconShield() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
function IconUser() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function IconMail() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M22 7L12 13 2 7" />
    </svg>
  );
}
function IconLock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
function IconEye({ off = false }) {
  return off ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Input field — shared styling helper
───────────────────────────────────────────────────────────────────────────── */
const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "11px 14px 11px 42px",
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "10px",
  color: "white",
  fontSize: "0.9rem",
  outline: "none",
  transition: "border-color 0.2s, box-shadow 0.2s",
};

function onFocusGlow(e) {
  e.target.style.borderColor = "rgba(99,102,241,0.7)";
  e.target.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.15)";
}
function onBlurGlow(e) {
  e.target.style.borderColor = "rgba(255,255,255,0.12)";
  e.target.style.boxShadow = "none";
}

/* ─────────────────────────────────────────────────────────────────────────────
   Register Page
───────────────────────────────────────────────────────────────────────────── */
export default function RegisterPage({ onRegistered, onGoLogin }) {
  const [name, setName]                   = useState("");
  const [email, setEmail]                 = useState("");
  const [password, setPassword]           = useState("");
  const [showPassword, setShowPassword]   = useState(false);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState(null);
  const [success, setSuccess]             = useState(false);
  const [retryCooldown, setRetryCooldown] = useState(0);

  useEffect(() => {
    if (retryCooldown <= 0) return;
    const interval = setInterval(() => {
      setRetryCooldown(prev => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [retryCooldown]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/register`, { name, email, password });
      setSuccess(true);
      // Give the user a moment to see the success state, then go to Verify Email.
      setTimeout(() => onRegistered(email), 1400);
    } catch (err) {
      const status = err.response?.status;
      const msg =
        err.response?.data?.detail ||
        "Registration failed. Please try again.";
      if (status === 429) {
        const secs = err.response?.data?.retry_after || 600;
        setRetryCooldown(secs);
      }
      setError(Array.isArray(msg) ? msg[0]?.msg ?? String(msg) : String(msg));
    } finally {
      setLoading(false);
    }
  }

  /* ── shared feature list for the left panel ── */
  const features = [
    "Usage metering per file upload",
    "Real-time billing forecasts",
    "Tier recommendation engine",
    "Downloadable PDF invoices",
  ];

  return (
    <div
      className="min-h-screen flex"
      style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)" }}
    >
      {/* ── Left branding panel (desktop only) ──────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-14 relative overflow-hidden">

        {/* Ambient orbs */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
          <div style={{
            position: "absolute", top: "-80px", left: "-80px",
            width: "380px", height: "380px", borderRadius: "50%",
            background: "radial-gradient(circle, rgba(99,102,241,0.35) 0%, transparent 70%)",
          }} />
          <div style={{
            position: "absolute", bottom: "-60px", right: "-60px",
            width: "300px", height: "300px", borderRadius: "50%",
            background: "radial-gradient(circle, rgba(139,92,246,0.25) 0%, transparent 70%)",
          }} />
        </div>

        {/* Logo */}
        <div className="relative z-10">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: "40px", height: "40px",
              background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
              borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 24px rgba(99,102,241,0.5)",
            }}>
              <div style={{ width: "20px", color: "white" }}><IconShield /></div>
            </div>
            <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "white", letterSpacing: "-0.01em" }}>
              SaaSBilling
            </span>
          </div>
        </div>

        {/* Tagline */}
        <div className="relative z-10">
          <h2 style={{
            fontSize: "2.6rem", fontWeight: 800, lineHeight: 1.15,
            color: "white", letterSpacing: "-0.03em", marginBottom: "1rem",
          }}>
            Everything you need<br />
            <span style={{
              background: "linear-gradient(90deg,#818cf8,#c084fc)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              to bill smarter.
            </span>
          </h2>
          <p style={{ color: "rgba(226,232,240,0.65)", fontSize: "1rem", lineHeight: 1.75, maxWidth: "380px", marginBottom: "2rem" }}>
            Create your free account and start monitoring storage costs across all your buckets in minutes.
          </p>

          {/* Feature checklist */}
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
            {features.map((f) => (
              <li key={f} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{
                  width: "20px", height: "20px", flexShrink: 0,
                  background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
                  borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <div style={{ width: "10px", color: "white" }}><IconCheck /></div>
                </span>
                <span style={{ color: "rgba(226,232,240,0.8)", fontSize: "0.9rem" }}>{f}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom badge */}
        <div className="relative z-10">
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "8px",
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "40px", padding: "8px 16px",
            backdropFilter: "blur(8px)",
          }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#4ade80", display: "inline-block" }} />
            <span style={{ color: "rgba(148,163,184,0.9)", fontSize: "0.8rem" }}>Free to start · No credit card required</span>
          </div>
        </div>
      </div>

      {/* ── Right form panel ────────────────────────────────────────────────── */}
      <div className="flex flex-1 items-center justify-center p-6 lg:p-14">
        <div style={{
          width: "100%", maxWidth: "420px",
          background: "rgba(15,23,42,0.75)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "20px",
          padding: "40px 36px",
          backdropFilter: "blur(24px)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
        }}>

          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2 mb-8">
            <div style={{
              width: "34px", height: "34px",
              background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
              borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <div style={{ width: "18px", color: "white" }}><IconShield /></div>
            </div>
            <span style={{ fontWeight: 700, color: "white", fontSize: "0.95rem" }}>SaaSBilling</span>
          </div>

          {/* Heading */}
          <div style={{ marginBottom: "28px" }}>
            <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "white", letterSpacing: "-0.02em", marginBottom: "6px" }}>
              Create your account
            </h1>
            <p style={{ color: "rgba(148,163,184,0.85)", fontSize: "0.875rem" }}>
              Start managing your SaaS storage billing today.
            </p>
          </div>

          {/* ── Success state ── */}
          {success ? (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: "16px",
              padding: "24px 0",
            }}>
              <div style={{
                width: "56px", height: "56px",
                background: "linear-gradient(135deg, #22c55e, #16a34a)",
                borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 4px 24px rgba(34,197,94,0.4)",
                animation: "popIn 0.4s cubic-bezier(0.34,1.56,0.64,1)",
              }}>
                <div style={{ width: "26px", color: "white" }}><IconCheck /></div>
              </div>
              <div style={{ textAlign: "center" }}>
                <p style={{ color: "white", fontWeight: 700, fontSize: "1.05rem", marginBottom: "4px" }}>
                  Account created!
                </p>
                <p style={{ color: "rgba(148,163,184,0.8)", fontSize: "0.85rem" }}>
                  Redirecting you to sign in…
                </p>
              </div>
            </div>
          ) : (
            /* ── Registration form ── */
            <form
              id="register-form"
              onSubmit={handleSubmit}
              noValidate
              style={{ display: "flex", flexDirection: "column", gap: "16px" }}
            >
              {/* Name */}
              <div>
                <label
                  htmlFor="register-name"
                  style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "rgba(203,213,225,0.9)", marginBottom: "6px", letterSpacing: "0.02em" }}
                >
                  FULL NAME
                </label>
                <div style={{ position: "relative" }}>
                  <div style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", width: "16px", color: "rgba(148,163,184,0.7)", pointerEvents: "none" }}>
                    <IconUser />
                  </div>
                  <input
                    id="register-name"
                    type="text"
                    autoComplete="name"
                    required
                    placeholder="Jane Smith"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={inputStyle}
                    onFocus={onFocusGlow}
                    onBlur={onBlurGlow}
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label
                  htmlFor="register-email"
                  style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "rgba(203,213,225,0.9)", marginBottom: "6px", letterSpacing: "0.02em" }}
                >
                  EMAIL ADDRESS
                </label>
                <div style={{ position: "relative" }}>
                  <div style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", width: "16px", color: "rgba(148,163,184,0.7)", pointerEvents: "none" }}>
                    <IconMail />
                  </div>
                  <input
                    id="register-email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={inputStyle}
                    onFocus={onFocusGlow}
                    onBlur={onBlurGlow}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="register-password"
                  style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "rgba(203,213,225,0.9)", marginBottom: "6px", letterSpacing: "0.02em" }}
                >
                  PASSWORD
                </label>
                <div style={{ position: "relative" }}>
                  <div style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", width: "16px", color: "rgba(148,163,184,0.7)", pointerEvents: "none" }}>
                    <IconLock />
                  </div>
                  <input
                    id="register-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={6}
                    placeholder="Min. 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{ ...inputStyle, paddingRight: "42px" }}
                    onFocus={onFocusGlow}
                    onBlur={onBlurGlow}
                  />
                  <button
                    type="button"
                    id="register-toggle-password"
                    onClick={() => setShowPassword((p) => !p)}
                    style={{
                      position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)",
                      width: "18px", color: "rgba(148,163,184,0.7)",
                      background: "none", border: "none", cursor: "pointer", padding: 0,
                    }}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    <IconEye off={showPassword} />
                  </button>
                </div>
                {/* Strength hint */}
                {password.length > 0 && (
                  <div style={{ marginTop: "6px", display: "flex", gap: "4px" }}>
                    {[...Array(3)].map((_, i) => {
                      const strength = password.length >= 10 ? 3 : password.length >= 6 ? 2 : 1;
                      const colors = ["#ef4444", "#f59e0b", "#22c55e"];
                      return (
                        <div key={i} style={{
                          flex: 1, height: "3px", borderRadius: "2px",
                          background: i < strength ? colors[strength - 1] : "rgba(255,255,255,0.1)",
                          transition: "background 0.3s",
                        }} />
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Error banner */}
              {error && (
                <div style={{
                  background: "rgba(239,68,68,0.15)",
                  border: "1px solid rgba(239,68,68,0.4)",
                  borderRadius: "8px", padding: "10px 14px",
                  color: "#fca5a5", fontSize: "0.85rem",
                  display: "flex", alignItems: "center", gap: "8px",
                }}>
                  <span style={{ fontSize: "1rem" }}>⚠️</span>
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                id="register-submit-btn"
                type="submit"
                disabled={loading || retryCooldown > 0}
                style={{
                  width: "100%", padding: "13px", marginTop: "4px",
                  background: (loading || retryCooldown > 0)
                    ? "rgba(99,102,241,0.5)"
                    : "linear-gradient(135deg,#6366f1,#8b5cf6)",
                  border: "none", borderRadius: "10px",
                  color: "white", fontSize: "0.95rem", fontWeight: 700,
                  cursor: (loading || retryCooldown > 0) ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                  transition: "opacity 0.2s, transform 0.1s",
                  boxShadow: (loading || retryCooldown > 0) ? "none" : "0 4px 24px rgba(99,102,241,0.45)",
                }}
                onMouseEnter={(e) => { if (!loading && retryCooldown <= 0) e.currentTarget.style.opacity = "0.9"; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
                onMouseDown={(e) => { if (!loading && retryCooldown <= 0) e.currentTarget.style.transform = "scale(0.98)"; }}
                onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
              >
                {loading ? (
                  <>
                    <span style={{
                      width: "16px", height: "16px",
                      border: "2px solid rgba(255,255,255,0.3)",
                      borderTopColor: "white", borderRadius: "50%",
                      display: "inline-block", animation: "spin 0.7s linear infinite",
                    }} />
                    Creating account…
                  </>
                ) : retryCooldown > 0 ? (
                  `Retry in: ${retryCooldown}s`
                ) : (
                  "Create account"
                )}
              </button>

              {/* Switch to Login */}
              <p style={{ textAlign: "center", fontSize: "0.85rem", color: "rgba(148,163,184,0.75)", marginTop: "4px" }}>
                Already have an account?{" "}
                <button
                  type="button"
                  id="go-to-login-link"
                  onClick={onGoLogin}
                  style={{
                    background: "none", border: "none", padding: 0, cursor: "pointer",
                    color: "#818cf8", fontWeight: 600, fontSize: "inherit",
                    textDecoration: "underline", textUnderlineOffset: "2px",
                  }}
                >
                  Sign in
                </button>
              </p>
            </form>
          )}

          {/* Footer */}
          {!success && (
            <p style={{ textAlign: "center", fontSize: "0.78rem", color: "rgba(100,116,139,0.8)", marginTop: "24px" }}>
              Protected by JWT · 256-bit encryption
            </p>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes popIn   { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        input::placeholder { color: rgba(100,116,139,0.6); }
      `}</style>
    </div>
  );
}
