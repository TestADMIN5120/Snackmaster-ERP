import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
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

      // 1. Fetch Machines for this Org
      const mSnap = await getDocs(query(
        collection(db, "machines"),
        where("orgId", "==", orgId),
        where("deleted", "==", false)
      ));

      // 2. Fetch Recent Refills
      const rSnap = await getDocs(query(
        collection(db, "refill_logs"),
        where("orgId", "==", orgId),
        where("createdAt", ">=", sevenDaysAgo)
      ));

      const machines = mSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Calculate Stale Machines (Total Machines - Machines refilled in last 7 days)
      const refilledIds = new Set(rSnap.docs.map(doc => doc.data().machineId));
      const staleCount = machines.filter(m => m.status === "active" && !refilledIds.has(m.id)).length;

      setStats({
        totalMachines: machines.length,
        activeMachines: machines.filter(m => m.status === "active").length,
        inactiveMachines: machines.filter(m => m.status !== "active").length,
        refills7d: rSnap.size,
        staleMachines7d: staleCount,
        lowStockMachines: machines.filter(m => (m.fillPercent || 0) < 30).length,
      });
    } catch (err) {
      console.error("❌ Dashboard Load Error:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: "30px", maxWidth: "1200px", margin: "0 auto" }}>
      <header style={{ marginBottom: "30px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "28px", color: "#1a1a1a" }}>Admin Dashboard</h1>
          <p style={{ margin: "5px 0 0", color: "#666" }}>
            Overview for <strong>{orgId}</strong> • {user?.email}
          </p>
        </div>
        <button onClick={loadDashboard} style={refreshBtn}>
          {loading ? "Refreshing..." : "🔄 Refresh Data"}
        </button>
      </header>

      {/* STATS GRID */}
      <div style={gridStyle}>
        <StatCard title="Total Inventory" value={stats.totalMachines} subtitle="Managed Machines" color="#3b82f6" />
        <StatCard title="Active Status" value={stats.activeMachines} subtitle="Online & Available" color="#10b981" />
        <StatCard title="Low Stock" value={stats.lowStockMachines} subtitle="Under 30% Fill" color={stats.lowStockMachines > 0 ? "#f59e0b" : "#10b981"} />
        <StatCard title="7D Refill Volume" value={stats.refills7d} subtitle="Total actions taken" color="#8b5cf6" />
        <StatCard title="Needs Attention" value={stats.staleMachines7d} subtitle="No refill in 7 days" color={stats.staleMachines7d > 0 ? "#ef4444" : "#10b981"} />
      </div>

      {/* EMPTY STATE */}
      {!loading && stats.totalMachines === 0 && (
        <div style={emptyState}>
          <p>No machines found for this organization.</p>
        </div>
      )}
    </div>
  );
}

/* ───────── SUB-COMPONENTS ───────── */

function StatCard({ title, value, subtitle, color }) {
  return (
    <div style={cardStyle}>
      <div style={{ ...lineStyle, backgroundColor: color }} />
      <h3 style={{ fontSize: "14px", color: "#666", margin: "0 0 10px 0", textTransform: "uppercase", letterSpacing: "0.5px" }}>{title}</h3>
      <div style={{ fontSize: "32px", fontWeight: "bold", color: "#1a1a1a", marginBottom: "5px" }}>{value}</div>
      <div style={{ fontSize: "12px", color: "#999" }}>{subtitle}</div>
    </div>
  );
}

/* ───────── STYLES ───────── */

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "20px",
};

const cardStyle = {
  background: "#fff",
  padding: "20px",
  borderRadius: "12px",
  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
  position: "relative",
  overflow: "hidden",
  border: "1px solid #f0f0f0"
};

const lineStyle = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  height: "4px",
};

const refreshBtn = {
  padding: "10px 18px",
  borderRadius: "8px",
  border: "1px solid #e2e8f0",
  background: "#fff",
  cursor: "pointer",
  fontWeight: "600",
  transition: "all 0.2s",
  fontSize: "14px"
};

const emptyState = {
  textAlign: "center",
  padding: "50px",
  background: "#f8fafc",
  borderRadius: "12px",
  marginTop: "20px",
  color: "#64748b",
  border: "2px dashed #e2e8f0"
};