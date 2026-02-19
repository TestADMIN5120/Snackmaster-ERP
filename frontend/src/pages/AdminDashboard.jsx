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
      console.error("❌ Dashboard Load Error:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div style={{ padding: 30 }}>Loading Dashboard Metrics...</div>;

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
      <header style={{ marginBottom: "30px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, color: "#1e293b" }}>Admin Overview</h1>
          <p style={{ margin: "5px 0 0", color: "#64748b", fontSize: 14 }}>
            Managing <strong>{orgId}</strong> • Logged in as {user?.email}
          </p>
        </div>
        <button onClick={loadDashboard} style={refreshBtn}>
          🔄 Refresh Data
        </button>
      </header>

      {/* STATS GRID */}
      <div style={gridStyle}>
        <StatCard title="Total Machines" value={stats.totalMachines} subtitle="Managed by your org" color="#3b82f6" />
        <StatCard title="Active / Online" value={stats.activeMachines} subtitle="Ready for customers" color="#10b981" />
        <StatCard title="Low Stock" value={stats.lowStockMachines} subtitle="Under 30% Fill" color={stats.lowStockMachines > 0 ? "#f59e0b" : "#cbd5e1"} />
        <StatCard title="7D Refills" value={stats.refills7d} subtitle="Completed this week" color="#8b5cf6" />
        <StatCard title="Stale Machines" value={stats.staleMachines7d} subtitle="No refill in 7 days" color={stats.staleMachines7d > 0 ? "#ef4444" : "#cbd5e1"} />
      </div>

      {stats.totalMachines === 0 && (
        <div style={emptyState}>
          <h3>No machines assigned yet.</h3>
          <p>Contact your SuperAdmin to have machines assigned to your organization.</p>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, subtitle, color }) {
  return (
    <div style={{...cardStyle, borderTop: `4px solid ${color}`}}>
      <h3 style={{ fontSize: "13px", color: "#64748b", margin: "0 0 10px 0", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: "bold" }}>{title}</h3>
      <div style={{ fontSize: "36px", fontWeight: "900", color: "#0f172a", marginBottom: "5px" }}>{value}</div>
      <div style={{ fontSize: "13px", color: "#94a3b8", fontWeight: "500" }}>{subtitle}</div>
    </div>
  );
}

const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px" };
const cardStyle = { background: "#fff", padding: "20px 24px", borderRadius: "12px", boxShadow: "0 4px 15px rgba(0, 0, 0, 0.04)" };
const refreshBtn = { padding: "10px 16px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer", fontWeight: "bold", color: "#475569" };
const emptyState = { textAlign: "center", padding: "60px", background: "#fff", borderRadius: "12px", marginTop: "30px", color: "#64748b", border: "1px dashed #cbd5e1" };