import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth"; // 🟢 Critical Import
import { auth } from "../firebaseClient";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // 1. Authenticate with Firebase
      await signInWithEmailAndPassword(auth, email, password);

      // 2. Navigation
      // The AdminContext will detect the login, but we force navigation 
      // to ensure the router updates immediately.
      navigate("/");

    } catch (err) {
      console.error("Login failed:", err);
      let msg = "Failed to log in.";
      
      // Better error messages
      if (err.code === "auth/invalid-credential") msg = "Invalid email or password.";
      else if (err.code === "auth/user-not-found") msg = "No user found with this email.";
      else if (err.code === "auth/wrong-password") msg = "Incorrect password.";
      else if (err.code === "auth/too-many-requests") msg = "Too many failed attempts. Try later.";
      
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      {/* 🟢 Background Image Layer */}
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
              placeholder="user@snackmaster.in"
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
              placeholder="••••••••"
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