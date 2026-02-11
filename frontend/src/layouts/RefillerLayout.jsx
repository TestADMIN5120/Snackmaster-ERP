import React from "react";
import { Outlet, useNavigate, Link } from "react-router-dom";
import { auth } from "../firebaseClient";
import { signOut } from "firebase/auth";

export default function RefillerLayout() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f5f7fa" }}>
      <header style={header}>
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <span style={{ fontWeight: 700, fontSize: "1.2rem" }}>Refiller App</span>
          <nav style={{ display: "flex", gap: "15px" }}>
            <Link to="/refiller/machines" style={navLink}>Machines</Link>
            <Link to="/refiller/history" style={navLink}>History</Link>
          </nav>
        </div>
        <button onClick={handleLogout} style={logoutBtn}>Logout</button>
      </header>

      <main style={{ padding: 16, maxWidth: 600, margin: "0 auto" }}>
        <Outlet />
      </main>
    </div>
  );
}

const header = {
  height: 60,
  background: "#0f2f4a",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 16px",
  position: "sticky",
  top: 0,
  zIndex: 1000
};

const navLink = { color: "#fff", textDecoration: "none", fontSize: "14px", opacity: 0.8 };
const logoutBtn = { background: "#e53935", color: "#fff", border: "none", padding: "6px 12px", borderRadius: 4, cursor: "pointer" };