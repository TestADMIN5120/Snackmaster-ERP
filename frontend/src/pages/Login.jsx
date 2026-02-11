// frontend/src/pages/Login.jsx
import React, { useState } from "react";


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
      // 🔐 Firebase Auth ONLY
      await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      // ❌ NO redirect here
      // ❌ NO role check here
      // ❌ NO localStorage

      // AdminContext + AppRoutes will take over automatically

    } catch (err) {
      console.error("Login failed:", err);

      if (err.code === "auth/user-not-found") {
        setError("User not found");
      } else if (err.code === "auth/wrong-password") {
        setError("Incorrect password");
      } else {
        setError("Invalid login credentials");
      }
    }

    setLoading(false);
  }

  return (
    <div className="login-page">
      <div className="login-bg" aria-hidden="true" />

      <main className="login-card">
        <h1 className="brand">SNACKMASTER</h1>
        <p className="muted">Sign in to manage machines & refills</p>

        <form onSubmit={handleSubmit} className="login-form">
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>

          {error && <div className="error">{error}</div>}

          <button type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="help-text">
          Need help?{" "}
          <a href="mailto:vdsofficial@snackmaster.in">
            Contact tech team
          </a>
        </div>
      </main>
    </div>
  );
}
