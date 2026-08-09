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
  const [collapsed, setCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState({
    inventory: true,
    warehouse: true,
    tracking: true,
    sales: true,
    team: true,
  });

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

  const toggleSection = (key) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const NavLink = ({ to, label, icon }) => {
    const active = isActive(to);
    return (
      <Link
        to={to}
        className={active ? undefined : "fx-navlink"}
        style={{
          textDecoration: "none",
          padding: collapsed ? "10px 0" : "9px 14px 9px 20px",
          fontWeight: active ? 600 : 500,
          transition: "all 0.15s ease",
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "flex-start",
          fontSize: 13,
          gap: 10,
          background: active ? "var(--fx-lavender)" : "transparent",
          color: active ? "var(--fx-indigo)" : "#4b5563",
          position: "relative",
          borderBottom: "1px solid #f2f4f6",
        }}
      >
        {active && (
          <span style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 3,
            background: "var(--fx-indigo)",
          }} />
        )}
        <span style={{
          width: 22,
          textAlign: "center",
          fontSize: 14,
          flexShrink: 0,
        }}>
          {icon}
        </span>
        {!collapsed && <span>{label}</span>}
      </Link>
    );
  };

  const SectionToggle = ({ label, sectionKey }) => {
    const open = openSections[sectionKey];
    return (
      <button
        onClick={() => toggleSection(sectionKey)}
        className="fx-section"
        style={{
          display: collapsed ? "none" : "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          background: open ? "var(--fx-lavender)" : "#fff",
          border: "none",
          borderBottom: "1px solid #eef0f2",
          color: open ? "var(--fx-indigo)" : "var(--fx-text)",
          fontSize: 13.5,
          fontWeight: 600,
          padding: "12px 14px",
          cursor: "pointer",
          textAlign: "left",
          transition: "all 0.15s",
        }}
      >
        {label}
        <span style={{
          fontSize: 10,
          transition: "transform 0.2s",
          transform: open ? "rotate(180deg)" : "rotate(0deg)",
          opacity: 0.65,
        }}>
          &#9660;
        </span>
      </button>
    );
  };

  const sidebarWidth = collapsed ? 68 : 260;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--fx-bg)" }}>
      {/* TOP APP BAR (teal) */}
      <header style={{
        height: 52,
        minHeight: 52,
        background: "var(--fx-teal)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 18px",
        boxShadow: "0 1px 4px rgba(16,54,61,0.25)",
        zIndex: 20,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: "rgba(255,255,255,0.18)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
            flexShrink: 0,
          }}>
            🍿
          </div>
          <h2 style={{
            color: "#fff",
            margin: 0,
            fontSize: 17,
            fontWeight: 800,
            letterSpacing: 0.4,
            whiteSpace: "nowrap",
          }}>
            SNACK<span style={{ color: "#ffe0b2" }}>MASTER</span>
          </h2>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
          <span style={{
            color: "rgba(255,255,255,0.85)",
            fontSize: 12.5,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: 260,
          }}>
            {user?.email}
          </span>
          <button
            onClick={handleLogout}
            className="fx-logout"
            style={{
              background: "transparent",
              border: "none",
              color: "#fff",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              padding: "8px 12px",
              borderRadius: 6,
              transition: "background 0.15s",
              flexShrink: 0,
            }}
          >
            Logout
          </button>
        </div>
      </header>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* LEFT SIDEBAR (white) */}
        <aside style={{
          width: sidebarWidth,
          minWidth: sidebarWidth,
          flexShrink: 0,
          background: "#fff",
          borderRight: "1px solid var(--fx-border)",
          display: "flex",
          flexDirection: "column",
          zIndex: 10,
          transition: "width 0.25s ease, min-width 0.25s ease",
          overflow: "hidden",
        }}>
          {/* SIDEBAR HEADER */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "space-between",
            padding: collapsed ? "14px 8px" : "14px 14px",
            borderBottom: "1px solid #eef0f2",
          }}>
            {!collapsed && (
              <div style={{ fontSize: 15.5, fontWeight: 700, color: "#23292f", whiteSpace: "nowrap" }}>
                Admin Manager
              </div>
            )}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="fx-collapse"
              style={{
                background: "#fff",
                border: "1px solid var(--fx-border)",
                color: "#6c757d",
                width: 28,
                height: 28,
                borderRadius: 6,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                flexShrink: 0,
                transition: "all 0.2s",
              }}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? ">" : "<"}
            </button>
          </div>

          {/* USER INFO */}
          {!collapsed && (
            <div style={{
              padding: "12px 14px",
              borderBottom: "1px solid #eef0f2",
              background: "#fafbfc",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  background: "var(--fx-teal)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#fff",
                  flexShrink: 0,
                }}>
                  {(user?.email || "A")[0].toUpperCase()}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--fx-teal-dark)", textTransform: "uppercase", letterSpacing: 1 }}>Admin</div>
                  <div style={{ fontSize: 11.5, color: "#6c757d", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {user?.email}
                  </div>
                </div>
              </div>
              <div style={{
                marginTop: 8,
                fontSize: 10,
                color: "#6c757d",
                fontFamily: "monospace",
                background: "#fff",
                padding: "4px 8px",
                borderRadius: 5,
                display: "inline-block",
                border: "1px solid var(--fx-border)",
              }}>
                🏢 {orgId}
              </div>
            </div>
          )}

          {/* NAVIGATION */}
          <nav className="fx-nav" style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
          }}>
            <NavLink to="/admin" label="Dashboard" icon="📊" />

            {/* ZONE 1: INVENTORY & ROUTE */}
            <SectionToggle label="Inventory & Route" sectionKey="inventory" />
            {(collapsed || openSections.inventory) && (
              <div>
                <NavLink to="/admin/machines" label="All Machines" icon="🤖" />
                <NavLink to="/admin/machines/assign" label="Assign Route" icon="📍" />
                <NavLink to="/admin/products" label="Active Products" icon="🍫" />
                <NavLink to="/admin/product-images" label="Product Images" icon="🖼️" />
              </div>
            )}

            {/* ZONE 2: WAREHOUSE OPS */}
            <SectionToggle label="Warehouse Ops" sectionKey="warehouse" />
            {(collapsed || openSections.warehouse) && (
              <div>
                <NavLink to="/admin/warehouse/dashboard" label="Dashboard" icon="📈" />
                <NavLink to="/admin/warehouse/master-products" label="Master Catalog" icon="📖" />
                <NavLink to="/admin/warehouse/inward" label="Inward Stock" icon="📥" />
                <NavLink to="/admin/warehouse/outward" label="Manual Outward" icon="📤" />
                <NavLink to="/admin/warehouse/returns" label="Manual Returns" icon="🔄" />
                <NavLink to="/admin/warehouse/expired" label="Manual Expiry" icon="⚠️" />
                <NavLink to="/admin/warehouse/kits" label="Issue Kits" icon="📦" />
                <NavLink to="/admin/warehouse/movements" label="Stock Ledger" icon="📋" />
              </div>
            )}

            {/* ZONE 3: TRACKING & AUDITS */}
            <SectionToggle label="Tracking & Audits" sectionKey="tracking" />
            {(collapsed || openSections.tracking) && (
              <div>
                <NavLink to="/admin/issues" label="Machine Issues" icon="🚨" />
                <NavLink to="/admin/refill-logs" label="Refill Logs" icon="📋" />
                <NavLink to="/admin/audit-logs" label="Audit Logs" icon="🔍" />
              </div>
            )}

            {/* ZONE 4: SALES & FINANCIALS */}
            <SectionToggle label="Sales & Financials" sectionKey="sales" />
            {(collapsed || openSections.sales) && (
              <div>
                <NavLink to="/admin/sales/ledger" label="Transaction Ledger" icon="🧾" />
                <NavLink to="/admin/sales/new-ledger" label="New Transaction Ledger" icon="🆕" />
                <NavLink to="/admin/sales/analytics" label="Sales Analytics" icon="📈" />
              </div>
            )}

            {/* ZONE 5: TEAM & SECURITY */}
            <SectionToggle label="Team & Security" sectionKey="team" />
            {(collapsed || openSections.team) && (
              <div>
                <NavLink to="/admin/users" label="Team (Refillers)" icon="👔" />
                <NavLink to="/admin/access-requests" label="Access Requests" icon="🔑" />
                <NavLink to="/admin/change-password" label="Change Password" icon="🔒" />
              </div>
            )}
          </nav>
        </aside>

        {/* RIGHT CONTENT */}
        <main style={{ flex: 1, overflowY: "auto", overflowX: "auto" }}>
          {isBlocked && (
            <div style={{
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
              zIndex: 100,
            }}>
              <div style={{ fontSize: 20 }}>&#9888;</div>
              <div>
                <strong>Organisation Restricted:</strong> Your organisation ({orgId}) has been
                {orgStatus.deleted ? " deleted " : " suspended "} by the system administrator.
                Operations are locked.
              </div>
            </div>
          )}
          <div style={{ padding: 24, boxSizing: "border-box" }}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
