import React from "react";
import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebaseClient";
import { useAdmin } from "../contexts/AdminContext"; 

export default function SuperAdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAdmin();

  async function handleLogout() {
    try {
      await signOut(auth);
    } finally {
      navigate("/login", { replace: true });
    }
  }

  // Helper to highlight active route
  const isActive = (path) => {
    if (path === "/super" && location.pathname === "/super") return true;
    if (path !== "/super" && location.pathname.startsWith(path)) return true;
    return false;
  };

  const NavLink = ({ to, label, icon }) => (
    <Link 
      to={to} 
      style={{
        ...linkStyle, 
        background: isActive(to) ? "rgba(79, 195, 247, 0.2)" : "transparent",
        color: isActive(to) ? "#4fc3f7" : "#e3f2fd",
        borderLeft: isActive(to) ? "4px solid #4fc3f7" : "4px solid transparent"
      }}
    >
      <span style={{ marginRight: 10 }}>{icon}</span>
      {label}
    </Link>
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f4f7f6" }}>
      {/* SIDEBAR */}
      <aside style={sidebarStyle}>
        <div style={{ marginBottom: 30, padding: "0 10px" }}>
          <h2 style={{ color: "#4fc3f7", margin: "0 0 5px 0", letterSpacing: 1 }}>
            SUPER ADMIN
          </h2>
          <div style={{ fontSize: 12, color: "#90caf9", wordBreak: "break-all" }}>
            {user?.email}
          </div>
        </div>

        <nav style={navStyle}>
          <NavLink to="/super" label="Dashboard" icon="📊" />
          <NavLink to="/super/insights" label="Insights" icon="📈" />
          <NavLink to="/super/orgs" label="Organisations" icon="🏢" />
          <NavLink to="/super/admins" label="Admins" icon="👔" />
          <NavLink to="/super/refillers" label="Refillers" icon="🧑‍🔧" />
          <NavLink to="/super/machines" label="Machines" icon="🤖" />
          <NavLink to="/super/locations" label="Locations" icon="📍" />
          <NavLink to="/super/vendors" label="Vendors" icon="🚚" />
          <NavLink to="/super/issues" label="Issues" icon="🚨" />
          <NavLink to="/super/audit" label="Audit Logs" icon="📋" />

          {/* 🟢 SECURITY SECTION */}
          <div
            style={{
              margin: "15px 0 5px 0",
              color: "#607d8b",
              fontSize: 11,
              padding: "0 12px",
              textTransform: "uppercase",
              letterSpacing: 1
            }}
          >
            Security
          </div>

          <NavLink to="/super/access-requests" label="Access Requests" icon="🔑" />
          <NavLink to="/super/change-password" label="Change Password" icon="🔒" />
        </nav>

        <button onClick={handleLogout} style={logoutStyle}>
          🚪 Logout
        </button>
      </aside>

      {/* MAIN CONTENT */}
      <main
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "auto",
          height: "100vh",
          padding: 24,
          boxSizing: "border-box"
        }}
      >
        <Outlet />
      </main>
    </div>
  );
}

/* ─── Styles ─── */

const sidebarStyle = {
  width: 260,
  minWidth: 260,
  flexShrink: 0,
  background: "linear-gradient(180deg,#0b1c2d,#0f2f4a)",
  color: "#fff",
  padding: "30px 16px",
  display: "flex",
  flexDirection: "column",
  boxShadow: "4px 0 15px rgba(0,0,0,0.1)",
  zIndex: 10
};

const navStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 6
};

const linkStyle = {
  textDecoration: "none",
  padding: "12px 16px",
  borderRadius: "0 8px 8px 0",
  fontWeight: 600,
  transition: "all 0.2s ease",
  display: "flex",
  alignItems: "center",
  fontSize: 15
};

const logoutStyle = {
  marginTop: "auto",
  padding: "12px",
  background: "rgba(229, 57, 53, 0.1)",
  border: "1px solid rgba(229, 57, 53, 0.3)",
  color: "#ef5350",
  borderRadius: 8,
  fontWeight: "bold",
  cursor: "pointer",
  width: "100%",
  transition: "all 0.2s ease"
};