import { useState, useEffect } from "react";
import axios from "axios";
import { API_BASE } from "./api";

/* ─────────────────────────────────────────────────────────────────────────────
   SVG icon helpers
───────────────────────────────────────────────────────────────────────────── */
function IconShield() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
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
function IconArrow() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Login Page Component
───────────────────────────────────────────────────────────────────────────── */
export default function LoginPage({ onLogin, onGoRegister, onGoVerify }) {
  const [email, setEmail] = useState(() => localStorage.getItem("remembered_email") || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showResend, setShowResend] = useState(false);
  const [resending, setResending] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => Boolean(localStorage.getItem("remembered_email")));
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
      const res = await axios.post(`${API_BASE}/login`, { email, password });
      const { access_token } = res.data;
      localStorage.setItem("access_token", access_token);
      
      if (rememberMe) {
        localStorage.setItem("remembered_email", email);
      } else {
        localStorage.removeItem("remembered_email");
      }
      
      onLogin();
    } catch (err) {
      const status = err.response?.status;
      const msg =
        err.response?.data?.detail ||
        "Invalid credentials. Please try again.";
      if (status === 403 && String(msg).toLowerCase().includes("verify your email")) {
        setShowResend(true);
      }
      if (status === 429) {
        const secs = err.response?.data?.retry_after || 60;
        setRetryCooldown(secs);
      }
      setError(Array.isArray(msg) ? msg[0]?.msg ?? String(msg) : String(msg));
    } finally {
      setLoading(false);
    }
  }

  async function handleResendAndRedirect() {
    setResending(true);
    setError(null);
    try {
      await axios.post(`${API_BASE}/resend-otp`, { email });
      if (onGoVerify) {
        onGoVerify(email);
      }
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to resend verification code. Please try again.";
      setError(Array.isArray(msg) ? msg[0]?.msg ?? String(msg) : String(msg));
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)" }}>

      {/* ── Left panel — branding ───────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-14 relative overflow-hidden">

        {/* Background orbs */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden",
        }}>
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
              width: "40px", height: "40px", background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
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

        {/* Tagline block */}
        <div className="relative z-10">
          <h2 style={{
            fontSize: "2.6rem", fontWeight: 800, lineHeight: 1.15,
            color: "white", letterSpacing: "-0.03em", marginBottom: "1rem",
          }}>
            Metered billing<br />
            <span style={{ background: "linear-gradient(90deg,#818cf8,#c084fc)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              at every scale.
            </span>
          </h2>
          <p style={{ color: "rgba(226,232,240,0.65)", fontSize: "1rem", lineHeight: 1.75, maxWidth: "380px" }}>
            Monitor storage consumption, forecast spend, and generate PDF invoices—all from one intelligent dashboard.
          </p>
        </div>

        {/* Stats row */}
        <div className="relative z-10" style={{ display: "flex", gap: "24px" }}>
          {[
            { label: "Uptime", value: "99.9%" },
            { label: "Users", value: "10 k+" },
            { label: "Invoices", value: "500 k" },
          ].map(({ label, value }) => (
            <div key={label} style={{
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "12px", padding: "14px 20px", backdropFilter: "blur(8px)",
            }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "white" }}>{value}</div>
              <div style={{ fontSize: "0.75rem", color: "rgba(148,163,184,0.9)", marginTop: "2px" }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel — login form ─────────────────────────────────────────── */}
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

          <div style={{ marginBottom: "28px" }}>
            <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "white", letterSpacing: "-0.02em", marginBottom: "6px" }}>
              Welcome back
            </h1>
            <p style={{ color: "rgba(148,163,184,0.85)", fontSize: "0.875rem" }}>
              Sign in to access your billing dashboard.
            </p>
          </div>

          <form id="login-form" onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: "18px" }}>

            {/* Email field */}
            <div>
              <label htmlFor="login-email" style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "rgba(203,213,225,0.9)", marginBottom: "6px", letterSpacing: "0.02em" }}>
                EMAIL ADDRESS
              </label>
              <div style={{ position: "relative" }}>
                <div style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", width: "16px", color: "rgba(148,163,184,0.7)", pointerEvents: "none" }}>
                  <IconMail />
                </div>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setShowResend(false);
                    setError(null);
                  }}
                  style={{
                    width: "100%", boxSizing: "border-box",
                    padding: "11px 14px 11px 42px",
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: "10px",
                    color: "white", fontSize: "0.9rem",
                    outline: "none",
                    transition: "border-color 0.2s, box-shadow 0.2s",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "rgba(99,102,241,0.7)";
                    e.target.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.15)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "rgba(255,255,255,0.12)";
                    e.target.style.boxShadow = "none";
                  }}
                />
              </div>
            </div>

            {/* Password field */}
            <div>
              <label htmlFor="login-password" style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "rgba(203,213,225,0.9)", marginBottom: "6px", letterSpacing: "0.02em" }}>
                PASSWORD
              </label>
              <div style={{ position: "relative" }}>
                <div style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", width: "16px", color: "rgba(148,163,184,0.7)", pointerEvents: "none" }}>
                  <IconLock />
                </div>
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: "100%", boxSizing: "border-box",
                    padding: "11px 42px 11px 42px",
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: "10px",
                    color: "white", fontSize: "0.9rem",
                    outline: "none",
                    transition: "border-color 0.2s, box-shadow 0.2s",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "rgba(99,102,241,0.7)";
                    e.target.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.15)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "rgba(255,255,255,0.12)";
                    e.target.style.boxShadow = "none";
                  }}
                />
                <button
                  type="button"
                  id="toggle-password-visibility"
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
            </div>

            {/* Remember Me Checkbox */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", margin: "4px 0" }}>
              <input
                id="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{
                  cursor: "pointer",
                  width: "16px",
                  height: "16px",
                  accentColor: "#6366f1",
                }}
              />
              <label htmlFor="remember-me" style={{ fontSize: "0.85rem", color: "rgba(203,213,225,0.85)", cursor: "pointer", userSelect: "none" }}>
                Remember Me
              </label>
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

            {/* Resend Verification Code button when user is unverified */}
            {showResend && (
              <button
                type="button"
                onClick={handleResendAndRedirect}
                disabled={resending}
                style={{
                  width: "100%",
                  padding: "11px",
                  background: "rgba(99,102,241,0.15)",
                  border: "1px solid rgba(99,102,241,0.35)",
                  borderRadius: "10px",
                  color: "#c7d2fe",
                  fontSize: "0.85rem",
                  fontWeight: "600",
                  cursor: resending ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  transition: "background 0.2s, border-color 0.2s",
                }}
                onMouseEnter={(e) => { if (!resending) { e.currentTarget.style.background = "rgba(99,102,241,0.25)"; e.currentTarget.style.borderColor = "rgba(99,102,241,0.5)"; } }}
                onMouseLeave={(e) => { if (!resending) { e.currentTarget.style.background = "rgba(99,102,241,0.15)"; e.currentTarget.style.borderColor = "rgba(99,102,241,0.35)"; } }}
              >
                {resending ? "Sending verification email..." : "Resend Verification Code"}
              </button>
            )}

            {/* Submit button */}
            <button
              id="login-submit-btn"
              type="submit"
              disabled={loading || retryCooldown > 0}
              style={{
                width: "100%", padding: "13px",
                background: (loading || retryCooldown > 0)
                  ? "rgba(99,102,241,0.5)"
                  : "linear-gradient(135deg,#6366f1,#8b5cf6)",
                border: "none", borderRadius: "10px",
                color: "white", fontSize: "0.95rem", fontWeight: 700,
                cursor: (loading || retryCooldown > 0) ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                transition: "opacity 0.2s, transform 0.1s",
                boxShadow: (loading || retryCooldown > 0) ? "none" : "0 4px 24px rgba(99,102,241,0.45)",
                marginTop: "4px",
              }}
              onMouseEnter={(e) => { if (!loading && retryCooldown <= 0) e.currentTarget.style.opacity = "0.9"; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
              onMouseDown={(e) => { if (!loading && retryCooldown <= 0) e.currentTarget.style.transform = "scale(0.98)"; }}
              onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
            >
              {loading ? (
                <>
                  <span style={{
                    width: "16px", height: "16px", border: "2px solid rgba(255,255,255,0.3)",
                    borderTopColor: "white", borderRadius: "50%",
                    display: "inline-block", animation: "spin 0.7s linear infinite",
                  }} />
                  Signing in…
                </>
              ) : retryCooldown > 0 ? (
                <>
                  Retry in: {retryCooldown}s
                </>
              ) : (
                <>
                  Sign in
                  <span style={{ width: "16px" }}><IconArrow /></span>
                </>
              )}
            </button>
          </form>

          {/* Switch to Register */}
          <p style={{ textAlign: "center", fontSize: "0.85rem", color: "rgba(148,163,184,0.75)", marginTop: "16px" }}>
            Don’t have an account?{" "}
            <button
              type="button"
              id="go-to-register-link"
              onClick={onGoRegister}
              style={{
                background: "none", border: "none", padding: 0, cursor: "pointer",
                color: "#818cf8", fontWeight: 600, fontSize: "inherit",
                textDecoration: "underline", textUnderlineOffset: "2px",
              }}
            >
              Create an account
            </button>
          </p>

          {/* Footer */}
          <p style={{ textAlign: "center", fontSize: "0.78rem", color: "rgba(100,116,139,0.8)", marginTop: "28px" }}>
            Protected by JWT · 256-bit encryption
          </p>
        </div>
      </div>

      {/* Spinner keyframe */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: rgba(100,116,139,0.6); }
      `}</style>
    </div>
  );
}
