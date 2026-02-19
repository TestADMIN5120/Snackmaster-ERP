import React from "react";
import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebaseClient";
import { useAdmin } from "../contexts/AdminContext";

export default function RefillerLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAdmin();

  async function handleLogout() {
    await signOut(auth);
    navigate("/login");
  }

  const isActive = (path) => location.pathname === path;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", backgroundColor: "#f4f6f8" }}>
      
      {/* 🟢 TOP APP BAR (Mobile Friendly) */}
      <header style={topBar}>
        <div>
          <h2 style={{ margin: 0, fontSize: "20px", color: "#fff", letterSpacing: 1 }}>Route Ops</h2>
          <div style={{ fontSize: 12, color: "#90caf9" }}>{user?.email}</div>
        </div>
        <button onClick={handleLogout} style={logoutBtn}>Logout</button>
      </header>

      {/* MAIN CONTENT AREA */}
      <main style={{ flex: 1, padding: "20px", overflowY: "auto", paddingBottom: "80px" }}>
        <Outlet />
      </main>

      {/* 🟢 BOTTOM NAVIGATION (For Phones/Tablets in the field) */}
      <nav style={bottomNav}>
        <Link 
          to="/refiller" 
          style={{...navItem, color: isActive("/refiller") ? "#1e88e5" : "#64748b"}}
        >
          <div style={{ fontSize: 24, marginBottom: 4 }}>📦</div>
          <span style={{ fontSize: 12, fontWeight: "bold" }}>My Route</span>
        </Link>
        
        <Link 
          to="/refiller/history" 
          style={{...navItem, color: isActive("/refiller/history") ? "#1e88e5" : "#64748b"}}
        >
          <div style={{ fontSize: 24, marginBottom: 4 }}>🕒</div>
          <span style={{ fontSize: 12, fontWeight: "bold" }}>History</span>
        </Link>
      </nav>
    </div>
  );
}

// --- Styles ---
const topBar = {
  background: "linear-gradient(90deg, #0f2f4a, #1a4a76)",
  padding: "15px 20px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
  zIndex: 10
};

const logoutBtn = {
  padding: "8px 16px",
  background: "rgba(255,255,255,0.1)",
  color: "#fff",
  border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: "8px",
  cursor: "pointer",
  fontSize: "13px",
  fontWeight: "bold",
};

const bottomNav = {
  position: "fixed",
  bottom: 0,
  left: 0,
  right: 0,
  background: "#fff",
  display: "flex",
  justifyContent: "space-around",
  borderTop: "1px solid #e2e8f0",
  boxShadow: "0 -2px 10px rgba(0,0,0,0.05)",
  padding: "10px 0",
  zIndex: 100
};

const navItem = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textDecoration: "none",
  flex: 1,
  padding: "5px 0",
  transition: "0.2s"
};