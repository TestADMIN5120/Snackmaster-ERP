import React from "react";
import { useNavigate } from "react-router-dom";
import { useAdmin } from "../contexts/AdminContext";
import { signOut } from "firebase/auth";
import { auth } from "../firebaseClient";

export default function Navbar() {
  const nav = useNavigate();
  const { role, user } = useAdmin();

  // 🔑 ROLE-AWARE HOME
  const home =
    role === "super_admin"
      ? "/super"
      : role === "admin"
      ? "/admin"
      : "/refiller";

  async function handleLogout() {
    await signOut(auth);
    nav("/login", { replace: true });
  }

  return (
    <nav
      style={{
        width: "100%",
        padding: "12px 24px",
        background: "#111",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 99,
        boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
      }}
    >
      {/* LOGO */}
      <div
        style={{
          fontSize: "1.4rem",
          fontWeight: 700,
          letterSpacing: "1px",
          cursor: "pointer",
        }}
        onClick={() => nav(home)}
      >
        SNACK<span style={{ color: "#03a9f4" }}>MASTER</span>
      </div>

      {/* CENTER MENU */}
      <div style={{ display: "flex", gap: "28px", fontSize: "1rem" }}>
        <span style={linkStyle} onClick={() => nav(home)}>
          Dashboard
        </span>

        {(role === "admin" || role === "super_admin") && (
          <span style={linkStyle} onClick={() => nav("/admin/machines")}>
            Machines
          </span>
        )}

        {role !== "refiller" && (
          <span style={linkStyle} onClick={() => nav("/admin/products")}>
            Products
          </span>
        )}

        <span style={linkStyle} onClick={() => nav("/admin/refill-logs")}>
          Refill Logs
        </span>
      </div>

      {/* RIGHT SIDE */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <span style={{ fontSize: "0.95rem", opacity: 0.8 }}>
          {user?.email}
        </span>

        <button
          onClick={handleLogout}
          style={{
            padding: "6px 14px",
            background: "#e53935",
            border: "none",
            color: "#fff",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "0.9rem",
          }}
        >
          Logout
        </button>
      </div>
    </nav>
  );
}

const linkStyle = {
  cursor: "pointer",
  color: "#ccc",
  transition: "0.2s",
  fontWeight: 500,
};
