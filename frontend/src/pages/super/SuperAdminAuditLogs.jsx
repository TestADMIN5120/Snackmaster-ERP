import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  orderBy,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../firebaseClient";

export default function SuperAdminAuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedDate, setSelectedDate] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  useEffect(() => {
    loadLogs();
  }, []);

  async function loadLogs(filters = {}) {
    setLoading(true);

    try {
      let q = collection(db, "admin_actions");
      const constraints = [];

      // Day-wise filter
      if (filters.date) {
        const date = new Date(filters.date);
        const start = new Date(date.setHours(0, 0, 0, 0));
        const end = new Date(date.setHours(23, 59, 59, 999));

        constraints.push(
          where("createdAt", ">=", Timestamp.fromDate(start)),
          where("createdAt", "<=", Timestamp.fromDate(end))
        );
      }

      // Action filter
      if (filters.action) {
        constraints.push(where("action", ">=", filters.action));
        constraints.push(where("action", "<=", filters.action + "\uf8ff"));
      }

      const finalQuery = query(q, ...constraints, orderBy("createdAt", "desc"));
      const snap = await getDocs(finalQuery);

      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("❌ Failed to load audit logs", err);
    } finally {
      setLoading(false);
    }
  }

  function applyFilters() {
    loadLogs({ date: selectedDate, action: actionFilter });
  }

  function resetFilters() {
    setSelectedDate("");
    setActionFilter("");
    loadLogs();
  }

  if (loading) return <div style={{ padding: 24 }}>Loading audit logs…</div>;

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ marginBottom: 20 }}>System Audit Logs</h1>

      {/* FILTER BAR */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center", background: "#fff", padding: 15, borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
        <input
          type="date"
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          style={inputStyle}
        />

        <select
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
          style={inputStyle}
        >
          <option value="">All Categories</option>
          <option value="ADMIN">Admin Actions</option>
          <option value="MACHINE">Machine Actions</option>
          <option value="ORG">Organisation Actions</option>
        </select>

        <button onClick={applyFilters} style={primaryBtn}>Search</button>
        <button onClick={resetFilters} style={secondaryBtn}>Clear</button>
      </div>

      {/* TABLE */}
      <div style={tableContainer}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Action Event</th>
              <th style={th}>Target ID (Org/Machine)</th>
              <th style={th}>Performed By</th>
              <th style={th}>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <tr key={log.id} style={tr}>
                <td style={{...td, color: "#1976d2", fontWeight: "bold"}}>{log.action}</td>
                <td style={{...td, fontFamily: "monospace", color: "#555"}}>
                    {log.orgId || log.machineId || log.toOrg || "—"}
                </td>
                <td style={td}>{log.performedBy || log.actorEmail || "System"}</td>
                <td style={td}>
                  {log.createdAt?.toDate ? log.createdAt.toDate().toLocaleString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && (
          <div style={emptyBox}>No audit logs found for this filter.</div>
        )}
      </div>
    </div>
  );
}

const tableContainer = { background: "#fff", borderRadius: 12, boxShadow: "0 2px 10px rgba(0,0,0,0.05)", overflow: "hidden" };
const table = { width: "100%", borderCollapse: "collapse" };
const th = { textAlign: "left", padding: "16px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#64748b", fontSize: 13, textTransform: "uppercase" };
const td = { padding: "16px", verticalAlign: "middle" };
const tr = { borderBottom: "1px solid #f1f5f9" };
const inputStyle = { padding: "10px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 };
const primaryBtn = { padding: "10px 20px", background: "#1e88e5", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: "bold" };
const secondaryBtn = { padding: "10px 20px", background: "#e2e8f0", color: "#475569", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: "bold" };
const emptyBox = { padding: "60px", textAlign: "center", color: "#94a3b8", fontSize: 16 };