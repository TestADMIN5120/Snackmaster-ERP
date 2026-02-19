// frontend/src/pages/admin/AdminAuditLogs.jsx
import React, { useEffect, useState, useMemo } from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  where
} from "firebase/firestore";
import { db } from "../../firebaseClient";
import { useAdmin } from "../../contexts/AdminContext";

export default function AdminAuditLogs() {
  const { orgId } = useAdmin(); // 🟢 SECURE: Get orgId
  const [logs, setLogs] = useState([]);

  const [emailFilter, setEmailFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");

  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  // 🟢 SECURE LIVE: LOAD LOGS FOR THIS ORG ONLY
  useEffect(() => {
    if (!orgId) return;
    const q = query(
      collection(db, "admin_actions"),
      where("orgId", "==", orgId),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => unsub();
  }, [orgId]);

  // FILTERED LOGS
  const filtered = useMemo(() => {
    return logs.filter((log) => {
      const matchEmail = !emailFilter || (log.actorEmail || "").toLowerCase().includes(emailFilter.toLowerCase());
      const matchAction = actionFilter === "all" || log.actionType === actionFilter || log.action === actionFilter;
      const matchDate = !dateFilter || (log.createdAt && new Date(log.createdAt.seconds * 1000).toISOString().slice(0, 10) === dateFilter);
      return matchEmail && matchAction && matchDate;
    });
  }, [logs, emailFilter, actionFilter, dateFilter]);

  // PAGED
  const paged = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  function formatDate(ts) {
    if (!ts?.seconds) return "-";
    return new Date(ts.seconds * 1000).toLocaleString("en-IN");
  }

  function exportCSV() {
    const header = "Email,Action,Machine ID,Details,Date\n";

    const rows = filtered.map((log) => {
      return [
        log.actorEmail || log.performedBy || "",
        log.actionType || log.action || "",
        log.machineId || "",
        log.newStatus || log.assignedToEmail || "",
        formatDate(log.createdAt),
      ].join(",");
    }).join("\n");

    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit_logs_${orgId}.csv`;
    a.click();
  }

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ marginBottom: 20 }}>Team Audit Logs</h1>

      {/* FILTER BAR */}
      <div style={{ display: "flex", gap: 15, background: "#fff", padding: 15, borderRadius: 10, border: "1px solid #e2e8f0" }}>
        <input
          type="text"
          placeholder="Filter by email…"
          value={emailFilter}
          onChange={(e) => setEmailFilter(e.target.value)}
          style={inputStyle}
        />

        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          style={inputStyle}
        >
          <option value="all">All Actions</option>
          <option value="change_status">Status Change</option>
          <option value="machine_assigned">Machine Assigned</option>
          <option value="machine_unassigned">Machine Unassigned</option>
          <option value="ISSUE_RESOLVED">Issue Resolved</option>
        </select>

        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          style={inputStyle}
        />

        <button onClick={exportCSV} style={exportBtn}>
          ⬇ Export CSV
        </button>
      </div>

      {/* TABLE */}
      <div style={{ background: "#fff", borderRadius: 10, marginTop: 20, overflow: "hidden", border: "1px solid #e2e8f0" }}>
        <table style={table}>
            <thead style={{ background: "#f8fafc" }}>
            <tr>
                <th style={th}>Team Member</th>
                <th style={th}>Action Taken</th>
                <th style={th}>Target (Machine/Issue)</th>
                <th style={th}>Timestamp</th>
            </tr>
            </thead>

            <tbody>
            {paged.map((log) => (
                <tr key={log.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={td}><b>{log.actorEmail || log.performedBy || "System"}</b></td>
                <td style={{...td, color: "#1976d2", fontWeight: "bold"}}>{log.actionType || log.action}</td>
                <td style={{...td, fontFamily: "monospace"}}>{log.machineId || log.issueId || "-"}</td>
                <td style={{...td, color: "#666"}}>{formatDate(log.createdAt)}</td>
                </tr>
            ))}
            {paged.length === 0 && (
                <tr>
                    <td colSpan="4" style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>No logs found for your organization.</td>
                </tr>
            )}
            </tbody>
        </table>
      </div>
    </div>
  );
}

/* STYLES */
const inputStyle = { padding: "10px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 14 };
const exportBtn = { padding: "10px 16px", background: "#10b981", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: "bold", marginLeft: "auto" };
const table = { width: "100%", borderCollapse: "collapse" };
const th = { padding: 15, textAlign: "left", fontWeight: 600, color: "#64748b", fontSize: 13, textTransform: "uppercase" };
const td = { padding: 15, fontSize: 14 };