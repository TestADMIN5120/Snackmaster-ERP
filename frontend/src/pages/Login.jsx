import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth"; 
import { auth } from "../firebaseClient";
// Removed useNavigate because routing is handled automatically by auth state changes in main.jsx

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      // Let the onAuthStateChanged listener in AdminContext handle the redirect!
    } catch (err) {
      console.error("Login failed:", err);
      let msg = "Failed to log in. Please check your credentials.";
      
      if (err.code === "auth/invalid-credential") msg = "Invalid email or password.";
      else if (err.code === "auth/user-not-found") msg = "No user found with this email.";
      else if (err.code === "auth/wrong-password") msg = "Incorrect password.";
      else if (err.code === "auth/too-many-requests") msg = "Too many failed attempts. Try later.";
      
      setError(msg);
      setLoading(false); // Only stop loading if there's an error. If success, it unmounts.
    }
  }

  return (
    <div className="login-page" style={pageStyle}>
      <main className="login-card" style={cardStyle}>
        <h1 style={brandStyle}>SNACK<span style={{color:"#0ea5e9"}}>MASTER</span></h1>
        <p style={{color: "#64748b", marginBottom: 30, textAlign: "center"}}>Sign in to manage your operations</p>

        <form onSubmit={handleSubmit} style={{display: "flex", flexDirection: "column", gap: 15}}>
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

          <label style={labelStyle}>
            Password
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={inputStyle}
            />
          </label>

          {error && <div style={errorStyle}>{error}</div>}

          <button type="submit" disabled={loading} style={btnStyle(loading)}>
            {loading ? "Authenticating..." : "Sign In"}
          </button>
        </form>

        <div style={{ marginTop: 25, textAlign: "center", fontSize: 13, color: "#94a3b8" }}>
          Need help? <a href="mailto:vdsofficial@snackmaster.in" style={{color: "#0ea5e9", textDecoration: "none", fontWeight: "bold"}}>Contact Tech Support</a>
        </div>
      </main>
    </div>
  );
}

/* Inline Styles to ensure it always looks perfect */
const pageStyle = { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", fontFamily: "sans-serif" };
const cardStyle = { background: "#fff", padding: "40px 30px", borderRadius: 16, width: "100%", maxWidth: 400, boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)" };
const brandStyle = { margin: "0 0 5px 0", fontSize: 28, fontWeight: 900, color: "#0f172a", textAlign: "center", letterSpacing: 1 };
const labelStyle = { display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: "bold", color: "#475569" };
const inputStyle = { padding: 14, borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 15, outline: "none", background: "#f8fafc" };
const errorStyle = { background: "#fef2f2", color: "#ef4444", padding: 10, borderRadius: 8, fontSize: 13, fontWeight: "bold", textAlign: "center", border: "1px solid #fca5a5" };
const btnStyle = (loading) => ({ padding: 16, borderRadius: 8, border: "none", background: loading ? "#94a3b8" : "#0ea5e9", color: "#fff", fontSize: 16, fontWeight: "bold", cursor: loading ? "not-allowed" : "pointer", marginTop: 10, transition: "0.2s" });