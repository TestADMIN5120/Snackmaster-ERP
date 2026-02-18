import React from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebaseClient";

export default function RefillerLayout() {
  const navigate = useNavigate();

  async function handleLogout() {
    await signOut(auth);
    navigate("/login");
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#f4f6f8" }}>
      
      {/* SIDEBAR */}
      <aside style={sidebar}>
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ margin: 0, fontSize: "20px", color: "#64b5f6" }}>Refiller App</h2>
          <small style={{ color: "#aaa" }}>v1.0.0</small>
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Link to="/refiller" style={link}>
            📦 Dashboard
          </Link>
          <Link to="/refiller/history" style={link}>
            🕒 History
          </Link>
        </nav>

        <button onClick={handleLogout} style={logoutBtn}>
          Logout
        </button>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main style={{ flex: 1, padding: "24px", overflowY: "auto" }}>
        <Outlet />
      </main>
    </div>
  );
}

// --- Styles ---
const sidebar = {
  width: "250px",
  background: "#0f2f4a",
  color: "#fff",
  padding: "24px",
  display: "flex",
  flexDirection: "column",
  boxShadow: "2px 0 10px rgba(0,0,0,0.1)",
};

const link = {
  color: "#e3f2fd",
  textDecoration: "none",
  padding: "12px",
  background: "rgba(255,255,255,0.05)",
  borderRadius: "8px",
  fontSize: "15px",
  fontWeight: "500",
  transition: "0.2s",
};

const logoutBtn = {
  marginTop: "auto",
  padding: "12px",
  background: "#cf6679",
  color: "#fff",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
  fontSize: "14px",
  fontWeight: "bold",
};