import React, { useState } from "react";
import { updatePassword } from "firebase/auth";
// 🟢 FIXED PATH: Added an extra "../" to reach the root src folder
import { auth } from "../../../firebaseClient"; 
import { useNavigate } from "react-router-dom";

export default function ChangePassword() {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      return setError("Passwords do not match.");
    }
    if (newPassword.length < 6) {
      return setError("Password must be at least 6 characters.");
    }

    setLoading(true);
    try {
      // Firebase function to update the currently logged-in user
      await updatePassword(auth.currentUser, newPassword);
      alert("✅ Password updated successfully!");
      navigate(-1); // Go back to dashboard
    } catch (err) {
      console.error(err);
      if (err.code === "auth/requires-recent-login") {
        setError("For security, please log out and log back in before changing your password.");
      } else {
        setError("Failed to update password.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 500, margin: "0 auto" }}>
      <button onClick={() => navigate(-1)} style={{ background: "none", border: "none", color: "#0ea5e9", cursor: "pointer", fontWeight: "bold", marginBottom: 20 }}>← Back</button>
      <div style={{ background: "#fff", padding: 30, borderRadius: 12, border: "1px solid #e2e8f0" }}>
        <h2 style={{ marginTop: 0 }}>🔒 Change Password</h2>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 15 }}>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={{ fontSize: 13, fontWeight: "bold", color: "#475569" }}>New Password</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required style={{ padding: 12, borderRadius: 8, border: "1px solid #cbd5e1" }} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={{ fontSize: 13, fontWeight: "bold", color: "#475569" }}>Confirm New Password</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required style={{ padding: 12, borderRadius: 8, border: "1px solid #cbd5e1" }} />
          </div>

          {error && <div style={{ background: "#fef2f2", color: "#ef4444", padding: 10, borderRadius: 8, fontSize: 13, fontWeight: "bold", textAlign: "center" }}>{error}</div>}

          <button type="submit" disabled={loading} style={{ padding: 15, background: "#10b981", color: "#fff", border: "none", borderRadius: 8, fontWeight: "bold", cursor: loading ? "not-allowed" : "pointer" }}>
            {loading ? "Updating..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}