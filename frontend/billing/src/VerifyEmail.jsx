import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { API_BASE } from "./api";
import { KeyRound, Loader2, ArrowLeft, RefreshCw, CheckCircle, XCircle } from "lucide-react";

function Toast({ message, type }) {
  if (!message) return null;
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border px-4 py-3 shadow-lg transition-all duration-300 ${
      type === 'error' ? 'bg-red-900/90 border-red-500 text-red-100' : 'bg-emerald-900/90 border-emerald-500 text-emerald-100'
    }`}>
      {type === 'error' ? <XCircle className="h-4 w-4 text-red-400" /> : <CheckCircle className="h-4 w-4 text-emerald-400" />}
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
}

export default function VerifyEmail({ email, onVerified, onGoLogin }) {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(60);
  const [shake, setShake] = useState(false);
  const [toast, setToast] = useState(null);

  const inputRefs = useRef([]);

  // Auto-focus first input on load
  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  // Cooldown countdown
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((c) => c - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleOtpChange = (index, value) => {
    // Only accept numeric inputs
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1); // Take only the last digit entered
    setOtp(newOtp);

    // Shift focus forward if digit is entered
    if (value && index < 5) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace") {
      const newOtp = [...otp];
      if (!otp[index] && index > 0) {
        // Move focus backward and delete value
        inputRefs.current[index - 1].focus();
        newOtp[index - 1] = "";
      } else {
        newOtp[index] = "";
      }
      setOtp(newOtp);
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text").trim();
    if (/^\d{6}$/.test(pasteData)) {
      const chars = pasteData.split("");
      setOtp(chars);
      inputRefs.current[5].focus();
    } else {
      showToast("Please paste a valid 6-digit numeric verification code.", "error");
    }
  };

  const handleVerify = async (e) => {
    if (e) e.preventDefault();
    const fullOtp = otp.join("");
    if (fullOtp.length < 6) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      showToast("Please enter all 6 digits of the verification code.", "error");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/verify-email`, {
        email,
        otp: fullOtp,
      });
      showToast(res.data.message || "Email verified successfully!");
      setTimeout(() => onVerified(), 1500);
    } catch (err) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      const status = err.response?.status;
      const msg = err.response?.data?.detail || "Verification failed. Please check the code and try again.";
      if (status === 429) {
        const secs = err.response?.data?.retry_after || 60;
        showToast(`Too many attempts. Please wait ${secs} seconds.`, "error");
      } else {
        showToast(msg, "error");
      }
      // Clear OTP digits if maximum verification attempts exceeded and a new OTP was sent
      if (msg.includes("Maximum verification attempts exceeded") || msg.includes("expired")) {
        setOtp(["", "", "", "", "", ""]);
        inputRefs.current[0].focus();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    try {
      const res = await axios.post(`${API_BASE}/resend-otp`, { email });
      showToast(res.data.message || "A new verification code has been sent!");
      setCooldown(60);
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0].focus();
    } catch (err) {
      const status = err.response?.status;
      if (status === 429) {
        const secs = err.response?.data?.retry_after || 60;
        setCooldown(secs); // use server-driven cooldown
        showToast(`Too many requests. Please wait ${secs} seconds.`, "error");
      } else {
        const msg = err.response?.data?.detail || "Failed to resend verification code. Please try again.";
        showToast(msg, "error");
      }
    } finally {
      setResending(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)" }}
    >
      <div
        className={`w-full max-w-[440px] bg-slate-900/80 border border-slate-700/50 rounded-2xl p-8 backdrop-blur-md shadow-2xl text-center transition-all ${
          shake ? "animate-shake border-red-500/50" : ""
        }`}
      >
        {/* Logo or Shield Icon Header */}
        <div className="flex justify-center mb-6">
          <div
            style={{
              width: "50px",
              height: "50px",
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              borderRadius: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 8px 30px rgba(99, 102, 241, 0.4)",
            }}
          >
            <KeyRound className="h-6 w-6 text-white" />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-white tracking-tight">Verify Your Email</h2>
        <p className="mt-2.5 text-sm text-slate-400 leading-relaxed">
          We Cloud has sent a secure 6-digit verification code to
        </p>
        <p className="mt-1 text-sm font-semibold text-indigo-400 break-all">{email}</p>

        <form onSubmit={handleVerify} className="mt-8 space-y-6">
          {/* OTP Digit Boxes Container */}
          <div className="flex justify-between gap-2" onPaste={handlePaste}>
            {otp.map((digit, index) => (
              <input
                key={index}
                type="text"
                maxLength="1"
                ref={(el) => (inputRefs.current[index] = el)}
                value={digit}
                onChange={(e) => handleOtpChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                disabled={loading}
                className="w-12 h-14 text-center text-xl font-bold text-white bg-slate-800/80 border border-slate-700 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-900/50 outline-none transition"
              />
            ))}
          </div>

          {/* Verify Action Button */}
          <button
            type="submit"
            disabled={loading || otp.includes("")}
            className="w-full h-11 flex items-center justify-center rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-500 shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify Account"}
          </button>
        </form>

        {/* Resend Cooldown and Button */}
        <div className="mt-6 flex flex-col items-center gap-1.5 text-xs">
          {cooldown > 0 ? (
            <span className="text-slate-500">
              Resend code in <strong className="text-slate-400 font-semibold">{cooldown}s</strong>
            </span>
          ) : (
            <button
              onClick={handleResend}
              disabled={resending}
              className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 font-semibold transition cursor-pointer bg-transparent border-0"
            >
              {resending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              Resend Verification Code
            </button>
          )}
        </div>

        {/* Back to Login Anchor */}
        <div className="mt-8 border-t border-slate-800/80 pt-6">
          <button
            onClick={onGoLogin}
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition cursor-pointer bg-transparent border-0"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Login
          </button>
        </div>
      </div>

      <Toast toast={toast} message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
    </div>
  );
}
