import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth"; 
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebaseClient";
import { FaEye, FaEyeSlash } from "react-icons/fa"; // 🟢 Import icons

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false); // 🟢 State for visibility
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      console.error("Login failed:", err);
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
      console.error("Request failed:", err);
      setError("Failed to send request. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page" style={pageStyle}>
      <main className="login-card" style={cardStyle}>
        <h1 style={brandStyle}>SNACK<span style={{color:"#0ea5e9"}}>MASTER</span></h1>
        
        <p style={{color: "#64748b", marginBottom: 30, textAlign: "center"}}>
          {isForgotMode ? "Request an account reset from your Admin" : "Sign in to manage your operations"}
        </p>

        <form onSubmit={isForgotMode ? handleResetRequest : handleLogin} style={{display: "flex", flexDirection: "column", gap: 15}}>
          <label style={labelStyle}>
            Email Address
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@snackmaster.in"
              style={inputStyle}
            />
          </label>

          {!isForgotMode && (
            <label style={labelStyle}>
              Password
              <div style={{ position: "relative" }}> {/* 🟢 Container for icon positioning */}
                <input
                  type={showPassword ? "text" : "password"} // 🟢 Dynamic type
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{ ...inputStyle, width: "100%", boxSizing: "border-box", paddingRight: "45px" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={eyeButtonStyle}
                >
                  {showPassword ? <FaEyeSlash size={18} /> : <FaEye size={18} />}
                </button>
              </div>
            </label>
          )}

          {error && <div style={errorStyle}>{error}</div>}
          {successMsg && <div style={successStyle}>{successMsg}</div>}

          <button type="submit" disabled={loading} style={btnStyle(loading)}>
            {loading ? "Processing..." : isForgotMode ? "Send Reset Request" : "Sign In"}
          </button>
        </form>

        <div style={{ marginTop: 25, textAlign: "center", fontSize: 13, color: "#94a3b8", display: "flex", flexDirection: "column", gap: 10 }}>
          <button 
            onClick={() => { setIsForgotMode(!isForgotMode); setError(""); setSuccessMsg(""); }} 
            style={linkBtnStyle}
          >
            {isForgotMode ? "← Back to Login" : "Forgot Password?"}
          </button>
          
          <div>
            Need help? <a href="mailto:vdsofficial@snackmaster.in" style={{color: "#0ea5e9", textDecoration: "none", fontWeight: "bold"}}>Contact Tech Support</a>
          </div>
        </div>
      </main>
    </div>
  );
}

/* ───────── UI Styles ───────── */
const pageStyle = { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", fontFamily: "sans-serif" };
const cardStyle = { background: "#fff", padding: "40px 30px", borderRadius: 16, width: "100%", maxWidth: 400, boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)" };
const brandStyle = { margin: "0 0 5px 0", fontSize: 28, fontWeight: 900, color: "#0f172a", textAlign: "center", letterSpacing: 1 };
const labelStyle = { display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: "bold", color: "#475569" };
const inputStyle = { padding: 14, borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 15, outline: "none", background: "#f8fafc", width: "100%" };
const errorStyle = { background: "#fef2f2", color: "#ef4444", padding: 10, borderRadius: 8, fontSize: 13, fontWeight: "bold", textAlign: "center", border: "1px solid #fca5a5" };
const successStyle = { background: "#f0fdf4", color: "#16a34a", padding: 10, borderRadius: 8, fontSize: 13, fontWeight: "bold", textAlign: "center", border: "1px solid #bbf7d0" };
const btnStyle = (loading) => ({ padding: 16, borderRadius: 8, border: "none", background: loading ? "#94a3b8" : "#0ea5e9", color: "#fff", fontSize: 16, fontWeight: "bold", cursor: loading ? "not-allowed" : "pointer", marginTop: 10, transition: "0.2s" });
const linkBtnStyle = { background: "none", border: "none", color: "#0ea5e9", fontWeight: "bold", cursor: "pointer", fontSize: 13, textDecoration: "underline" };

// 🟢 NEW: Icon positioning style
const eyeButtonStyle = {
  position: "absolute",
  right: "12px",
  top: "50%",
  transform: "translateY(-50%)",
  background: "none",
  border: "none",
  color: "#94a3b8",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0"
};