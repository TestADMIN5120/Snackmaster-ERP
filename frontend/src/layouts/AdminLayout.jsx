import React, { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { db, auth } from "../firebaseClient";
import { useAdmin } from "../contexts/AdminContext";

export default function AdminLayout() {
  const { orgId, user } = useAdmin();
  const location = useLocation();
  const navigate = useNavigate();
  const [orgStatus, setOrgStatus] = useState({ suspended: false, deleted: false });

  useEffect(() => {
    if (!orgId) return;
    const unsub = onSnapshot(doc(db, "organisations", orgId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setOrgStatus({
          suspended: data.suspended || false,
          deleted: data.deleted || false
        });
      }
    });
    return () => unsub();
  }, [orgId]);

  async function handleLogout() {
    await signOut(auth);
    navigate("/login", { replace: true });
  }

  const isBlocked = orgStatus.suspended || orgStatus.deleted;

  const isActive = (path) => {
    if (path === "/admin" && location.pathname === "/admin") return true;
    if (path !== "/admin" && location.pathname.startsWith(path)) return true;
    return false;
  };

  const NavLink = ({ to, label, icon }) => (
    <Link
      to={to}
      style={{
        ...linkStyle,
        background: isActive(to) ? "rgba(11, 195, 255, 0.15)" : "transparent",
        color: isActive(to) ? "#0bc3ff" : "#eee",
        borderLeft: isActive(to)
          ? "4px solid #0bc3ff"
          : "4px solid transparent"
      }}
    >
      <span style={{ marginRight: 10 }}>{icon}</span>
      {label}
    </Link>
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#f4f7f6" }}>
      {/* LEFT SIDEBAR */}
      <aside style={sidebarStyle}>
        <div style={{ marginBottom: 20, padding: "0 10px" }}>
          <h2 style={{ color: "#0bc3ff", margin: "0 0 5px 0", letterSpacing: 1 }}>
            ADMIN PANEL
          </h2>
          <div style={{ fontSize: 12, color: "#90caf9", wordBreak: "break-all" }}>
            {user?.email}
          </div>
          <div style={{ fontSize: 11, color: "#777", marginTop: 4, fontFamily: "monospace" }}>
            ORG: {orgId}
          </div>
        </div>

        {/* NAVIGATION */}
        <nav
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            flex: 1,
            overflowY: "auto",
            paddingRight: 5,
            marginBottom: 20
          }}
        >
          <NavLink to="/admin" label="Dashboard" icon="📊" />
          <NavLink to="/admin/issues" label="Machine Issues" icon="🚨" />

          <div style={{ margin: "10px 0" }}>
            <div style={sectionHeader}>Inventory</div>
            <NavLink to="/admin/machines" label="All Machines" icon="🤖" />
            <NavLink to="/admin/machines/assign" label="Assign Route" icon="📍" />
          </div>

          <div style={{ margin: "10px 0" }}>
            <div style={sectionHeader}>Warehouse Ops</div>
            <NavLink to="/admin/warehouse/dashboard" label="Dashboard" icon="📈" />
            <NavLink to="/admin/warehouse/master-products" label="Master Catalog" icon="📖" />
            <NavLink to="/admin/warehouse/inward" label="Inward Stock" icon="📥" />
            <NavLink to="/admin/warehouse/outward" label="Manual Outward" icon="📤" />
            <NavLink to="/admin/warehouse/returns" label="Manual Returns" icon="🔄" />
            <NavLink to="/admin/warehouse/expired" label="Manual Expiry" icon="⚠️" />
            <NavLink to="/admin/warehouse/kits" label="Issue Kits" icon="📦" />
            <NavLink to="/admin/warehouse/movements" label="Stock Ledger" icon="📋" />
          </div>

          <NavLink to="/admin/products" label="Active Products" icon="🍫" />
          <NavLink to="/admin/refill-logs" label="Refill Logs" icon="📦" />
          <NavLink to="/admin/audit-logs" label="Audit Logs" icon="📋" />
          <NavLink to="/admin/users" label="Team (Refillers)" icon="👔" />

          {/* 🟢 SECURITY SECTION */}
          <div style={{ margin: "10px 0" }}>
            <div style={sectionHeader}>Security</div>
            <NavLink to="/admin/access-requests" label="Access Requests" icon="🔑" />
            <NavLink to="/admin/change-password" label="Change Password" icon="🔒" />
          </div>
        </nav>

        <button onClick={handleLogout} style={logoutStyle}>
          🚪 Logout
        </button>
      </aside>

      {/* RIGHT CONTENT */}
      <main style={{ flex: 1, height: "100vh", overflowY: "auto", overflowX: "auto" }}>
        {isBlocked && (
          <div style={suspendedBanner}>
            <div style={{ fontSize: 20 }}>⚠️</div>
            <div>
              <strong>Organisation Restricted:</strong> Your organisation ({orgId}) has been
              {orgStatus.deleted ? " deleted " : " suspended "} by the system administrator.
              Operations are locked.
            </div>
          </div>
        )}
        <div style={{ padding: 30, boxSizing: "border-box" }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}

/* ───────── STYLES ───────── */

const sidebarStyle = {
  width: 260,
  minWidth: 260,
  flexShrink: 0,
  background: "#111",
  color: "#fff",
  padding: "30px 12px",
  display: "flex",
  flexDirection: "column",
  boxShadow: "4px 0 15px rgba(0,0,0,0.1)",
  zIndex: 10
};

const sectionHeader = {
  color: "#777",
  fontSize: 11,
  padding: "0 12px",
  textTransform: "uppercase",
  letterSpacing: 1,
  marginBottom: 5
};

const linkStyle = {
  textDecoration: "none",
  padding: "12px 16px",
  borderRadius: "0 8px 8px 0",
  fontWeight: 600,
  transition: "all 0.2s ease",
  display: "flex",
  alignItems: "center",
  fontSize: 14
};

const logoutStyle = {
  padding: "12px",
  background: "rgba(229, 57, 53, 0.1)",
  border: "1px solid rgba(229, 57, 53, 0.3)",
  color: "#ef5350",
  borderRadius: 8,
  fontWeight: "bold",
  cursor: "pointer",
  width: "100%",
  transition: "all 0.2s ease",
  flexShrink: 0
};

const suspendedBanner = {
  background: "#fff1f2",
  color: "#be123c",
  padding: "16px 24px",
  borderBottom: "2px solid #fda4af",
  display: "flex",
  alignItems: "center",
  gap: 15,
  fontWeight: 500,
  position: "sticky",
  top: 0,
  zIndex: 100
};