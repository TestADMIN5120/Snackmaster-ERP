import React, { useEffect, useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebaseClient";
import { useAdmin } from "../contexts/AdminContext";

export default function AdminLayout() {
  const { orgId } = useAdmin();
  const [orgStatus, setOrgStatus] = useState({ suspended: false, deleted: false });

  useEffect(() => {
    if (!orgId) return;

    // Listen for real-time changes to the organization status
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

  const isBlocked = orgStatus.suspended || orgStatus.deleted;

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#f4f7f6" }}>

      {/* LEFT SIDEBAR */}
      <div style={{
        width: 240,
        background: "#111",
        color: "#fff",
        padding: "20px 12px",
        position: "fixed",
        height: "100vh"
      }}>
        <h2 style={{ color: "#0bc3ff", marginBottom: 30 }}>Admin Panel</h2>

        <nav style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Link to="/admin" style={linkStyle}>Dashboard</Link>

          <div>
            <div style={{ color: "#777", fontSize: 11, padding: "10px 12px", textTransform: "uppercase", letterSpacing: 1 }}>Inventory</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingLeft: 6 }}>
              <Link to="/admin/machines" style={subLinkStyle}>All Machines</Link>
              <Link to="/admin/machines/assign" style={subLinkStyle}>Assign Machines</Link>
            </div>
          </div>

          <Link to="/admin/products" style={linkStyle}>Manage Products</Link>
          <Link to="/admin/refill-logs" style={linkStyle}>Refill Logs</Link>
          <Link to="/admin/audit-logs" style={linkStyle}>Audit Logs</Link>
          <Link to="/admin/users" style={linkStyle}>Users</Link>
        </nav>
      </div>

      {/* RIGHT CONTENT AREA */}
      <div style={{ flex: 1, marginLeft: 240, padding: 0 }}>
        
        {/* 🚨 SUSPENSION BANNER */}
        {isBlocked && (
          <div style={suspendedBanner}>
            <div style={{ fontSize: 20 }}>⚠️</div>
            <div>
              <strong>Organisation Access Restricted:</strong> Your organisation ({orgId}) has been 
              {orgStatus.deleted ? " deleted " : " suspended "} by the system administrator. 
              Operations and data updates may be restricted.
            </div>
          </div>
        )}

        <div style={{ padding: 30 }}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}

/* ───────── STYLES ───────── */

const linkStyle = {
  color: "#eee",
  textDecoration: "none",
  padding: "10px 12px",
  borderRadius: 6,
  background: "transparent",
  display: "block",
  transition: "background 0.2s",
  fontSize: 14
};

const subLinkStyle = {
  color: "#aaa",
  textDecoration: "none",
  padding: "8px 10px",
  borderRadius: 6,
  background: "transparent",
  display: "block",
  fontSize: 13,
  transition: "color 0.2s"
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