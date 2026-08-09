import React from "react";
import { useAdmin } from "../../contexts/AdminContext";
import { useSuperAdminKPIs } from "../../hooks/useSuperAdminKPIs";

export default function SuperAdminDashboard() {
  const { user } = useAdmin();
  const { loading, stats } = useSuperAdminKPIs();

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 5, color: "#1e293b" }}>Command Center</h1>
      <p style={{ color: "#64748b", marginBottom: 30, fontSize: 15 }}>
        Super Admin access active for <b>{user?.email}</b>
      </p>

      {/* KPI CARDS */}
      <div style={grid}>
        <Card 
          title="Organisations" 
          value={loading ? "..." : stats.organisations} 
          icon="🏢" 
          color="#3b82f6" 
        />
        <Card 
          title="Machines (Total)" 
          value={loading ? "..." : stats.machines} 
          icon="🤖" 
          color="#8b5cf6" 
        />
        <Card 
          title="Admins Active" 
          value={loading ? "..." : stats.admins} 
          icon="👔" 
          color="#10b981" 
        />
        <Card 
          title="Refills Logged" 
          value={loading ? "..." : stats.refills} 
          icon="📦" 
          color="#f59e0b" 
        />
      </div>
    </div>
  );
}

function Card({ title, value, icon, color }) {
  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 4px 20px rgba(0,0,0,.04)", border: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 20 }}>
      <div style={{ fontSize: 40, background: `${color}15`, width: 70, height: 70, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 16 }}>
        {icon}
      </div>
      <div>
        <h3 style={{ margin: "0 0 5px 0", color: "#64748b", fontSize: 14, textTransform: "uppercase", letterSpacing: 0.5 }}>{title}</h3>
        <div style={{ fontSize: 36, fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>{value}</div>
      </div>
    </div>
  );
}

const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 20 };