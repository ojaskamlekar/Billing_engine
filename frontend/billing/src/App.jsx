import { useEffect, useState } from "react";
import { getUserName, getUserRole, decodeToken } from "./api";
import LoginPage from "./LoginPage";
import RegisterPage from "./RegisterPage";
import StorageDashboard from "./StorageDashboard";
import AdminDashboard from "./AdminDashboard";
import VerifyEmail from "./VerifyEmail";

/**
 * App — top-level auth/view router.
 *
 * Views:
 *  "login"        → LoginPage     (default when no valid token)
 *  "register"     → RegisterPage
 *  "verify-email" → VerifyEmail
 *  "dashboard"    → StorageDashboard or AdminDashboard (requires JWT in localStorage)
 *
 * Auto-logout:
 *  api.js fires the CustomEvent "auth:logout" whenever any API call
 *  receives HTTP 401 (expired or invalid token).  App listens here
 *  and transitions to the login view immediately.
 */
function App() {
  const hasToken = () => {
    const token = localStorage.getItem("access_token");
    if (!token || token === "undefined" || token === "null") return false;
    return Boolean(decodeToken(token));
  };

  const [view, setView] = useState(() => (hasToken() ? "dashboard" : "login"));
  const [verifyEmail, setVerifyEmail] = useState("");
  // Derived from the JWT payload — no extra API call needed.
  const [userName, setUserName] = useState(() => getUserName());
  const [userRole, setUserRole] = useState(() => getUserRole());

  /* ── Listen for 401-triggered auto-logout from api.js ─────────────────── */
  useEffect(() => {
    function onAuthLogout() {
      setUserName("");
      setUserRole("customer");
      setView("login");
    }
    window.addEventListener("auth:logout", onAuthLogout);
    return () => window.removeEventListener("auth:logout", onAuthLogout);
  }, []);

  /* ── Handlers ─────────────────────────────────────────────────────────── */
  function handleLogin() {
    setUserName(getUserName()); // re-read from the freshly stored token
    setUserRole(getUserRole());
    setView("dashboard");
  }

  function handleLogout() {
    localStorage.removeItem("access_token");
    setUserName("");
    setUserRole("customer");
    setView("login");
  }

  function handleGoRegister() {
    setView("register");
  }

  function handleRegistered(email) {
    setVerifyEmail(email);
    setView("verify-email");
  }

  function handleGoLogin() {
    setView("login");
  }

  /* ── Render ───────────────────────────────────────────────────────────── */
  if (view === "dashboard") {
    if (userRole === "admin") {
      return <AdminDashboard userName={userName} onLogout={handleLogout} />;
    }
    return <StorageDashboard userName={userName} onLogout={handleLogout} />;
  }

  if (view === "register") {
    return (
      <RegisterPage
        onRegistered={handleRegistered}
        onGoLogin={handleGoLogin}
      />
    );
  }

  if (view === "verify-email") {
    return (
      <VerifyEmail
        email={verifyEmail}
        onVerified={() => setView("login")}
        onGoLogin={() => setView("login")}
      />
    );
  }

  return (
    <LoginPage
      onLogin={handleLogin}
      onGoRegister={handleGoRegister}
      onGoVerify={(email) => {
        setVerifyEmail(email);
        setView("verify-email");
      }}
    />
  );
}

export default App;
