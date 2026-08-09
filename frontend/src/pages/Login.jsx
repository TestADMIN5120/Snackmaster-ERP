import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebaseClient";
import { FaEye, FaEyeSlash } from "react-icons/fa";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [focused, setFocused] = useState("");

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      let msg = "Failed to log in. Please check your credentials.";
      if (err.code === "auth/invalid-credential") msg = "Invalid email or password.";
      else if (err.code === "auth/user-not-found") msg = "No user found with this email.";
      else if (err.code === "auth/wrong-password") msg = "Incorrect password.";
      else if (err.code === "auth/too-many-requests") msg = "Too many failed attempts. Try later.";
      setError(msg);
      setLoading(false);
    }
  }

  async function handleResetRequest(e) {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setLoading(true);

    try {
      await addDoc(collection(db, "password_requests"), {
        email: email.trim().toLowerCase(),
        status: "pending",
        requestedAt: serverTimestamp()
      });
      setSuccessMsg("Request sent! Please contact your Admin for your new default password.");
      setEmail("");
    } catch (err) {
      setError("Failed to send request. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={pageStyle}>
      {/* BACKGROUND */}
      <div style={bgOverlay} />
      <div style={bgPattern} />

      {/* CONTENT */}
      <div style={contentWrapper}>
        {/* LEFT PANEL - BRANDING */}
        <div style={leftPanel}>
          <div>
            <h1 style={heroTitle}>
              SNACK<span style={{ color: "#38bdf8" }}>MASTER</span>
            </h1>
            <p style={heroSubtitle}>Enterprise Route Management</p>
            <div style={heroDivider} />
            <p style={heroDesc}>
              Manage your vending machines, inventory routes, and field operations from a single dashboard.
            </p>
          </div>

          <div style={featureList}>
            <FeatureItem icon={"\u2713"} text="Real-time machine monitoring" />
            <FeatureItem icon={"\u2713"} text="Smart inventory tracking" />
            <FeatureItem icon={"\u2713"} text="Offline-ready field operations" />
          </div>
        </div>

        {/* RIGHT PANEL - LOGIN FORM */}
        <div style={rightPanel}>
          <div style={cardContainer}>
            {/* MOBILE BRAND */}
            <h2 style={mobileBrand}>
              SNACK<span style={{ color: "#0ea5e9" }}>MASTER</span>
            </h2>

            <h2 style={cardTitle}>
              {isForgotMode ? "Reset Password" : "Welcome back"}
            </h2>
            <p style={cardSubtitle}>
              {isForgotMode
                ? "Request an account reset from your Admin"
                : "Sign in to your account to continue"}
            </p>

            <form
              onSubmit={isForgotMode ? handleResetRequest : handleLogin}
              style={{ display: "flex", flexDirection: "column", gap: 20 }}
            >
              {/* EMAIL */}
              <div style={fieldWrapper}>
                <label style={labelStyle}>Email Address</label>
                <div style={{
                  ...inputWrapper,
                  borderColor: focused === "email" ? "#0ea5e9" : "#e2e8f0",
                  boxShadow: focused === "email" ? "0 0 0 3px rgba(14,165,233,0.1)" : "none",
                }}>
                  <span style={inputIcon}>{"\u2709"}</span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setFocused("email")}
                    onBlur={() => setFocused("")}
                    placeholder="you@company.com"
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* PASSWORD */}
              {!isForgotMode && (
                <div style={fieldWrapper}>
                  <label style={labelStyle}>Password</label>
                  <div style={{
                    ...inputWrapper,
                    borderColor: focused === "password" ? "#0ea5e9" : "#e2e8f0",
                    boxShadow: focused === "password" ? "0 0 0 3px rgba(14,165,233,0.1)" : "none",
                  }}>
                    <span style={inputIcon}>{"\u26BF"}</span>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setFocused("password")}
                      onBlur={() => setFocused("")}
                      placeholder="Enter your password"
                      style={inputStyle}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={eyeButtonStyle}
                    >
                      {showPassword ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
                    </button>
                  </div>
                </div>
              )}

              {/* ERROR */}
              {error && (
                <div style={errorStyle}>
                  <span style={{ marginRight: 8 }}>{"\u26A0"}</span>
                  {error}
                </div>
              )}

              {/* SUCCESS */}
              {successMsg && (
                <div style={successStyle}>
                  <span style={{ marginRight: 8 }}>{"\u2713"}</span>
                  {successMsg}
                </div>
              )}

              {/* SUBMIT BUTTON */}
              <button
                type="submit"
                disabled={loading}
                style={btnStyle(loading)}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.background = "#0284c7"; }}
                onMouseLeave={e => { if (!loading) e.currentTarget.style.background = "#0ea5e9"; }}
              >
                {loading && <span style={spinnerStyle} />}
                {loading
                  ? "Processing..."
                  : isForgotMode
                    ? "Send Reset Request"
                    : "Sign In"
                }
              </button>
            </form>

            {/* FOOTER LINKS */}
            <div style={footerWrapper}>
              <button
                onClick={() => { setIsForgotMode(!isForgotMode); setError(""); setSuccessMsg(""); }}
                style={linkBtnStyle}
                onMouseEnter={e => e.currentTarget.style.color = "#0284c7"}
                onMouseLeave={e => e.currentTarget.style.color = "#0ea5e9"}
              >
                {isForgotMode ? "\u2190 Back to Login" : "Forgot Password?"}
              </button>

              <div style={helpText}>
                Need help?{" "}
                <a
                  href="mailto:vdsofficial@snackmaster.in"
                  style={{ color: "#0ea5e9", textDecoration: "none", fontWeight: 600 }}
                >
                  Contact Support
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureItem({ icon, text }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
      <div style={{
        width: 28,
        height: 28,
        borderRadius: "50%",
        background: "rgba(56, 189, 248, 0.2)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#38bdf8",
        fontSize: 14,
        fontWeight: 700,
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <span style={{ color: "#cbd5e1", fontSize: 14, fontWeight: 500 }}>{text}</span>
    </div>
  );
}

/* ───────── STYLES ───────── */

const pageStyle = {
  minHeight: "100vh",
  position: "relative",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  overflow: "hidden",
};

const bgOverlay = {
  position: "absolute",
  inset: 0,
  backgroundImage: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
  zIndex: 0,
};

const bgPattern = {
  position: "absolute",
  inset: 0,
  backgroundImage: "radial-gradient(rgba(56, 189, 248, 0.07) 1px, transparent 1px)",
  backgroundSize: "24px 24px",
  zIndex: 1,
};

const contentWrapper = {
  position: "relative",
  zIndex: 2,
  display: "flex",
  width: "100%",
  maxWidth: 960,
  minHeight: 560,
  margin: "20px",
  borderRadius: 20,
  overflow: "hidden",
  boxShadow: "0 25px 60px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.05)",
};

const leftPanel = {
  flex: 1,
  background: "linear-gradient(160deg, #0f172a, #1e293b)",
  padding: "48px 40px",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  borderRight: "1px solid rgba(255,255,255,0.06)",
};

const heroTitle = {
  fontSize: 36,
  fontWeight: 900,
  color: "#fff",
  margin: "0 0 8px",
  letterSpacing: "-0.5px",
};

const heroSubtitle = {
  fontSize: 16,
  color: "#64748b",
  margin: "0 0 20px",
  fontWeight: 500,
};

const heroDivider = {
  width: 48,
  height: 3,
  background: "linear-gradient(90deg, #38bdf8, #0ea5e9)",
  borderRadius: 2,
  marginBottom: 20,
};

const heroDesc = {
  fontSize: 15,
  color: "#94a3b8",
  lineHeight: 1.7,
  margin: 0,
  maxWidth: 340,
};

const featureList = {
  marginTop: 40,
};

const rightPanel = {
  flex: 1,
  background: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "40px",
};

const cardContainer = {
  width: "100%",
  maxWidth: 360,
};

const mobileBrand = {
  display: "none",
  fontSize: 24,
  fontWeight: 900,
  color: "#0f172a",
  textAlign: "center",
  margin: "0 0 24px",
  letterSpacing: 0.5,
};

const cardTitle = {
  fontSize: 24,
  fontWeight: 700,
  color: "#0f172a",
  margin: "0 0 6px",
};

const cardSubtitle = {
  fontSize: 14,
  color: "#94a3b8",
  margin: "0 0 28px",
  fontWeight: 400,
};

const fieldWrapper = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const labelStyle = {
  fontSize: 13,
  fontWeight: 600,
  color: "#374151",
};

const inputWrapper = {
  display: "flex",
  alignItems: "center",
  border: "1.5px solid #e2e8f0",
  borderRadius: 10,
  background: "#f8fafc",
  transition: "all 0.2s ease",
  overflow: "hidden",
};

const inputIcon = {
  padding: "0 0 0 14px",
  color: "#94a3b8",
  fontSize: 16,
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
};

const inputStyle = {
  flex: 1,
  padding: "13px 14px",
  border: "none",
  outline: "none",
  fontSize: 14,
  background: "transparent",
  color: "#1e293b",
  fontFamily: "inherit",
};

const eyeButtonStyle = {
  background: "none",
  border: "none",
  color: "#94a3b8",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 14px",
  transition: "color 0.2s",
};

const errorStyle = {
  background: "#fef2f2",
  color: "#dc2626",
  padding: "12px 14px",
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 600,
  display: "flex",
  alignItems: "center",
  border: "1px solid #fecaca",
};

const successStyle = {
  background: "#f0fdf4",
  color: "#16a34a",
  padding: "12px 14px",
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 600,
  display: "flex",
  alignItems: "center",
  border: "1px solid #bbf7d0",
};

const btnStyle = (loading) => ({
  padding: "14px 20px",
  borderRadius: 10,
  border: "none",
  background: loading ? "#94a3b8" : "#0ea5e9",
  color: "#fff",
  fontSize: 15,
  fontWeight: 700,
  cursor: loading ? "not-allowed" : "pointer",
  transition: "all 0.2s ease",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  boxShadow: loading ? "none" : "0 4px 14px rgba(14, 165, 233, 0.35)",
});

const spinnerStyle = {
  width: 16,
  height: 16,
  border: "2px solid rgba(255,255,255,0.3)",
  borderTop: "2px solid #fff",
  borderRadius: "50%",
  animation: "spin 0.8s linear infinite",
};

const linkBtnStyle = {
  background: "none",
  border: "none",
  color: "#0ea5e9",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: 13,
  padding: 0,
  transition: "color 0.2s",
};

const footerWrapper = {
  marginTop: 28,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 12,
};

const helpText = {
  fontSize: 13,
  color: "#94a3b8",
};
