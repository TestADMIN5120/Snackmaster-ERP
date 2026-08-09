import React, { useEffect, useState } from "react";
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import { db } from "../firebaseClient";
import { useAdmin } from "../contexts/AdminContext";

export default function AdminDashboard() {
  const { user, orgId } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalMachines: 0,
    activeMachines: 0,
    inactiveMachines: 0,
    refills7d: 0,
    staleMachines7d: 0,
    lowStockMachines: 0,
  });

  useEffect(() => {
    if (orgId) loadDashboard();
  }, [orgId]);

  async function loadDashboard() {
    setLoading(true);
    try {
      const now = Date.now();
      const sevenDaysAgo = Timestamp.fromDate(new Date(now - 7 * 24 * 60 * 60 * 1000));

      // 1. Fetch Machines for THIS ORG ONLY
      const mSnap = await getDocs(query(
        collection(db, "machines"),
        where("orgId", "==", orgId),
        where("deleted", "==", false)
      ));

      // 2. Fetch Recent Refills for THIS ORG ONLY
      const rSnap = await getDocs(query(
        collection(db, "refill_logs"),
        where("orgId", "==", orgId),
        where("createdAt", ">=", sevenDaysAgo)
      ));

      const machines = mSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const refilledIds = new Set(rSnap.docs.map(doc => doc.data().machineId));
      const staleCount = machines.filter(m => m.status === "active" && !refilledIds.has(m.id)).length;

      setStats({
        totalMachines: machines.length,
        activeMachines: machines.filter(m => m.status === "active").length,
        inactiveMachines: machines.filter(m => m.status !== "active").length,
        refills7d: rSnap.size,
        staleMachines7d: staleCount,
        lowStockMachines: machines.filter(m => (m.current_stock_percent || 0) < 30).length,
      });
    } catch (err) {
      console.error("Dashboard Load Error:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return (
    <div style={loaderContainer}>
      <div style={loaderSpinner} />
      <p style={{ color: "#64748b", fontSize: 15, marginTop: 16 }}>Loading Dashboard...</p>
    </div>
  );

  const today = new Date();
  const greeting = today.getHours() < 12 ? "Good Morning" : today.getHours() < 17 ? "Good Afternoon" : "Good Evening";
  const dateStr = today.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
      {/* HEADER */}
      <header style={headerStyle}>
        <div>
          <h1 style={headingStyle}>{greeting}</h1>
          <p style={subheadingStyle}>
            {dateStr}
          </p>
        </div>
        <button onClick={loadDashboard} style={refreshBtn} onMouseEnter={e => { e.currentTarget.style.background = "#0ea5e9"; e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "#0ea5e9"; }} onMouseLeave={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.color = "#475569"; e.currentTarget.style.borderColor = "#e2e8f0"; }}>
          Refresh
        </button>
      </header>

      {/* ORG INFO BAR */}
      <div style={orgBarStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={orgBadge}>ORG</span>
          <span style={{ fontWeight: 600, color: "#1e293b" }}>{orgId}</span>
        </div>
        <span style={{ color: "#94a3b8", fontSize: 13 }}>{user?.email}</span>
      </div>

      {/* STATS GRID */}
      <div style={gridStyle}>
        <StatCard
          title="Total Machines"
          value={stats.totalMachines}
          subtitle="Managed by your org"
          color="#3b82f6"
          bgTint="rgba(59, 130, 246, 0.08)"
          icon="M"
        />
        <StatCard
          title="Active / Online"
          value={stats.activeMachines}
          subtitle="Ready for customers"
          color="#10b981"
          bgTint="rgba(16, 185, 129, 0.08)"
          icon="A"
        />
        <StatCard
          title="Low Stock"
          value={stats.lowStockMachines}
          subtitle="Under 30% fill level"
          color={stats.lowStockMachines > 0 ? "#f59e0b" : "#94a3b8"}
          bgTint={stats.lowStockMachines > 0 ? "rgba(245, 158, 11, 0.08)" : "rgba(148, 163, 184, 0.06)"}
          icon="L"
          alert={stats.lowStockMachines > 0}
        />
        <StatCard
          title="7-Day Refills"
          value={stats.refills7d}
          subtitle="Completed this week"
          color="#8b5cf6"
          bgTint="rgba(139, 92, 246, 0.08)"
          icon="R"
        />
        <StatCard
          title="Stale Machines"
          value={stats.staleMachines7d}
          subtitle="No refill in 7 days"
          color={stats.staleMachines7d > 0 ? "#ef4444" : "#94a3b8"}
          bgTint={stats.staleMachines7d > 0 ? "rgba(239, 68, 68, 0.08)" : "rgba(148, 163, 184, 0.06)"}
          icon="S"
          alert={stats.staleMachines7d > 0}
        />
      </div>

      {/* SUMMARY BAR */}
      <div style={summaryBarStyle}>
        <SummaryItem label="Operational Rate" value={stats.totalMachines > 0 ? Math.round((stats.activeMachines / stats.totalMachines) * 100) + "%" : "N/A"} />
        <div style={summaryDivider} />
        <SummaryItem label="Inactive Machines" value={stats.inactiveMachines} />
        <div style={summaryDivider} />
        <SummaryItem label="Needs Attention" value={stats.lowStockMachines + stats.staleMachines7d} />
      </div>

      {stats.totalMachines === 0 && (
        <div style={emptyState}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.4 }}>&#9881;</div>
          <h3 style={{ margin: "0 0 8px", color: "#334155", fontSize: 18 }}>No machines assigned yet</h3>
          <p style={{ margin: 0, fontSize: 14 }}>Contact your SuperAdmin to have machines assigned to your organization.</p>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, subtitle, color, bgTint, icon, alert }) {
  return (
    <div style={{ ...cardStyle, borderLeft: `4px solid ${color}`, background: bgTint || "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <h3 style={cardTitleStyle}>{title}</h3>
        <div style={{ ...iconBubble, background: color, boxShadow: `0 4px 12px ${color}44` }}>
          {icon}
        </div>
      </div>
      <div style={{ fontSize: 40, fontWeight: 800, color: "#0f172a", lineHeight: 1, marginBottom: 6 }}>
        {value}
        {alert && <span style={alertDot} />}
      </div>
      <div style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>{subtitle}</div>
    </div>
  );
}

function SummaryItem({ label, value }) {
  return (
    <div style={{ textAlign: "center", flex: 1 }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: "#1e293b" }}>{value}</div>
      <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
    </div>
  );
}

/* ───────── STYLES ───────── */

const headerStyle = {
  marginBottom: 8,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start"
};

const headingStyle = {
  margin: 0,
  color: "#0f172a",
  fontSize: 28,
  fontWeight: 800,
  letterSpacing: "-0.5px"
};

const subheadingStyle = {
  margin: "4px 0 0",
  color: "#94a3b8",
  fontSize: 14,
  fontWeight: 500
};

const orgBarStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  background: "#fff",
  padding: "12px 20px",
  borderRadius: 10,
  marginBottom: 24,
  marginTop: 16,
  border: "1px solid #e2e8f0"
};

const orgBadge = {
  background: "#0f172a",
  color: "#fff",
  fontSize: 10,
  fontWeight: 700,
  padding: "3px 8px",
  borderRadius: 4,
  letterSpacing: 1
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: 20
};

const cardStyle = {
  padding: "22px 24px",
  borderRadius: 14,
  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.06), 0 4px 16px rgba(0, 0, 0, 0.04)",
  transition: "transform 0.2s ease, box-shadow 0.2s ease"
};

const cardTitleStyle = {
  fontSize: 12,
  color: "#64748b",
  margin: 0,
  textTransform: "uppercase",
  letterSpacing: "0.8px",
  fontWeight: 700
};

const iconBubble = {
  width: 32,
  height: 32,
  borderRadius: 8,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#fff",
  fontSize: 14,
  fontWeight: 800,
  flexShrink: 0
};

const alertDot = {
  display: "inline-block",
  width: 8,
  height: 8,
  borderRadius: "50%",
  background: "#ef4444",
  marginLeft: 8,
  verticalAlign: "middle",
  boxShadow: "0 0 0 3px rgba(239, 68, 68, 0.2)"
};

const summaryBarStyle = {
  display: "flex",
  alignItems: "center",
  background: "#fff",
  padding: "20px 24px",
  borderRadius: 14,
  marginTop: 24,
  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.06)",
  border: "1px solid #f1f5f9"
};

const summaryDivider = {
  width: 1,
  height: 40,
  background: "#e2e8f0",
  margin: "0 16px",
  flexShrink: 0
};

const refreshBtn = {
  padding: "10px 20px",
  borderRadius: 10,
  border: "1px solid #e2e8f0",
  background: "#fff",
  cursor: "pointer",
  fontWeight: 600,
  color: "#475569",
  fontSize: 14,
  transition: "all 0.2s ease",
  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)"
};

const emptyState = {
  textAlign: "center",
  padding: "60px 30px",
  background: "#fff",
  borderRadius: 14,
  marginTop: 30,
  color: "#64748b",
  border: "1px dashed #cbd5e1"
};

const loaderContainer = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  height: "60vh"
};

const loaderSpinner = {
  width: 40,
  height: 40,
  border: "4px solid #e2e8f0",
  borderTop: "4px solid #0ea5e9",
  borderRadius: "50%",
  animation: "spin 0.8s linear infinite"
};