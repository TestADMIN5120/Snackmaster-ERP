import React, { useState } from "react";
import { useOperationalMetrics } from "../../hooks/useOperationalMetrics";

export default function SuperAdminInsights() {
  const [days, setDays] = useState(7);
  const { loading, data } = useOperationalMetrics(days);

  if (loading) return <div style={{ padding: 24 }}>Loading operational insights…</div>;

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <h1 style={{ color: "#1e293b", marginBottom: 20 }}>Operational Insights</h1>

      {/* TIME FILTER */}
      <div style={{ marginBottom: 30, display: "flex", gap: 10 }}>
        {[7, 14, 30].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            style={{
              padding: "10px 20px",
              background: days === d ? "#1e88e5" : "#fff",
              color: days === d ? "#fff" : "#475569",
              border: days === d ? "none" : "1px solid #cbd5e1",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: "bold"
            }}
          >
            Last {d} Days
          </button>
        ))}
      </div>

      {/* KPI CARDS */}
      <div style={grid}>
        <Card title="Active Machines" value={data.machines.active} color="#10b981" />
        <Card title="Disabled/Down" value={data.machines.disabled} color="#ef4444" />
        <Card title="Unassigned" value={data.machines.unassigned} color="#f59e0b" />
        <Card title="Avg Refill Match" value={`${data.refills.avgPercent}%`} color="#3b82f6" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 40 }}>
        {/* STALE MACHINES */}
        <div style={panel}>
          <h2 style={panelTitle}>Machines not refilled in {days} days</h2>
          <SimpleTable
            rows={data.machines.stale}
            empty="No stale machines 🎉"
            columns={[
              ["Machine ID", "id"],
              ["Org ID", "orgId"]
            ]}
          />
        </div>

        {/* ORG HEALTH */}
        <div style={panel}>
          <h2 style={panelTitle}>Organisation Health Check</h2>
          <SimpleTable
            rows={data.organisations.map((o) => ({
              ...o,
              health: o.deleted ? "🔴 DELETED" : (o.status === "active" ? "🟢 ACTIVE" : "🟡 PENDING")
            }))}
            empty="No organisations"
            columns={[
              ["Organisation", "name"],
              ["Status", "health"]
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function Card({ title, value, color }) {
  return (
    <div style={{ background: "#fff", padding: 24, borderRadius: 12, borderTop: `4px solid ${color}`, boxShadow: "0 4px 14px rgba(0,0,0,.04)" }}>
      <h3 style={{ margin: "0 0 10px 0", color: "#64748b", fontSize: 14, textTransform: "uppercase" }}>{title}</h3>
      <div style={{ fontSize: 36, fontWeight: 800, color: "#1e293b" }}>{value}</div>
    </div>
  );
}

function SimpleTable({ rows, columns, empty }) {
  if (!rows || !rows.length) return <div style={{ color: "#94a3b8", padding: 20, textAlign: "center" }}>{empty}</div>;

  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ borderBottom: "2px solid #e2e8f0", textAlign: "left" }}>
          {columns.map((c) => (
            <th key={c[0]} style={{ padding: "12px", color: "#64748b", fontSize: 13, textTransform: "uppercase" }}>{c[0]}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
            {columns.map((c) => (
              <td key={c[1]} style={{ padding: "12px", fontSize: 14, fontWeight: c[1] === 'name' || c[1] === 'id' ? 'bold' : 'normal' }}>
                {r[c[1]] || "—"}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 20 };
const panel = { background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 4px 14px rgba(0,0,0,.04)", border: "1px solid #e2e8f0" };
const panelTitle = { margin: "0 0 20px 0", fontSize: 18, color: "#1e293b" };