// frontend/src/pages/admin/AdminRefillLogs.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  deleteDoc,
  doc,
  query,
  where,
  orderBy
} from "firebase/firestore";
import { db } from "../../firebaseClient";
import { useAdmin } from "../../contexts/AdminContext";

export default function AdminRefillLogs() {
  const { orgId } = useAdmin(); 
  const [logs, setLogs] = useState([]);
  
  // 🟢 NEW: Upgraded Search & Filters
  const [search, setSearch] = useState("");
  const [selectedRefiller, setSelectedRefiller] = useState("all");
  const [specificDate, setSpecificDate] = useState(""); // Exact date tracking

  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  // Auto-extract unique refillers for the dropdown
  const uniqueRefillers = useMemo(() => {
    const emails = logs.map(l => l.userEmail).filter(Boolean);
    return Array.from(new Set(emails));
  }, [logs]);

  useEffect(() => {
    if (!orgId) return;

    const q = query(
      collection(db, "refill_logs"),
      where("orgId", "==", orgId),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setLogs(data);
      },
      (err) => console.error("AdminLogs Error:", err)
    );

    return () => unsub();
  }, [orgId]);

  function formatDate(ts) {
    if (!ts || !ts.seconds) return "-";
    return new Date(ts.seconds * 1000).toLocaleDateString("en-IN");
  }
  
  function formatTime(ts) {
    if (!ts || !ts.seconds) return "-";
    return new Date(ts.seconds * 1000).toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit' });
  }

  const filtered = useMemo(() => {
    const txt = search.toLowerCase().trim();
    
    return logs.filter((l) => {
      // 1. Text Search (Machine Name or ID)
      const matchSearch =
        (l.machineId || "").toLowerCase().includes(txt) ||
        (l.machineName || "").toLowerCase().includes(txt);

      // 2. Refiller Filter
      const matchRefiller = selectedRefiller === "all" || l.userEmail === selectedRefiller;

      // 3. Specific Date Filter
      let matchDate = true;
      if (specificDate && l.createdAt) {
        const logDateStr = new Date(l.createdAt.seconds * 1000).toISOString().split('T')[0];
        matchDate = logDateStr === specificDate;
      }

      return matchSearch && matchRefiller && matchDate;
    });
  }, [logs, search, selectedRefiller, specificDate]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  async function deleteLog(id) {
    if (!confirm("Delete this log? It cannot be recovered.")) return;
    await deleteDoc(doc(db, "refill_logs", id));
  }

  function exportCSV() {
    const header = "Date,Time,Refiller Email,Machine ID,Machine Name,Duration (mins),Offline Sync\n";
    const rows = filtered
      .map((l) =>
          `${formatDate(l.createdAt)},${formatTime(l.createdAt)},${l.userEmail || "-"},${l.machineId || "-"},${l.machineName || "-"},${l.durationMinutes || "0"},${l.offline ? "Yes" : "No"}`
      )
      .join("\n");

    const blob = new Blob([header + rows], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Refiller_Tracking_${orgId}.csv`;
    link.click();
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <h1 style={{ marginBottom: 5, color: "#1e293b" }}>📍 Refiller Tracking Ledger</h1>
      <p style={{ color: "#64748b", marginBottom: 20 }}>Track exactly who refilled which machines on specific dates.</p>

      {/* Filters */}
      <div style={{ display: "flex", gap: 15, marginBottom: 20, background: "#fff", padding: 20, borderRadius: 10, border: "1px solid #e2e8f0", flexWrap: "wrap", alignItems: "flex-end" }}>
        
        <label style={labelStyle}>
          Search Machine
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search machine name/id..." style={inputStyle} />
        </label>

        <label style={labelStyle}>
          Filter by Refiller
          <select value={selectedRefiller} onChange={(e) => { setSelectedRefiller(e.target.value); setPage(1); }} style={inputStyle}>
            <option value="all">All Refillers</option>
            {uniqueRefillers.map(email => (
                <option key={email} value={email}>{email}</option>
            ))}
          </select>
        </label>

        <label style={labelStyle}>
          Specific Date
          <input type="date" value={specificDate} onChange={(e) => { setSpecificDate(e.target.value); setPage(1); }} style={inputStyle} />
        </label>

        <button onClick={exportCSV} style={{...exportBtn, marginLeft: "auto"}}>⬇ Export CSV Report</button>
      </div>

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", overflow: "hidden" }}>
        <table style={table}>
          <thead style={{ background: "#f8fafc" }}>
            <tr>
              <th style={th}>Date & Time</th>
              <th style={th}>Refiller Assigned</th>
              <th style={th}>Machine Synced</th>
              <th style={th}>Time Taken</th>
              <th style={th}>Sync Type</th>
              <th style={th}>Action</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((l) => (
              <tr key={l.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={td}>
                    <div style={{fontWeight: "bold", color: "#1e293b"}}>{formatDate(l.createdAt)}</div>
                    <div style={{fontSize: 12, color: "#64748b"}}>{formatTime(l.createdAt)}</div>
                </td>
                <td style={{...td, fontWeight: "bold", color: "#0ea5e9"}}>{l.userEmail || "-"}</td>
                <td style={td}>
                  <div style={{fontWeight: "bold"}}>{l.machineName || "Unknown"}</div>
                  <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: "monospace" }}>{l.machineId}</div>
                </td>
                <td style={td}>
                    <span style={{background: "#f1f5f9", padding: "4px 8px", borderRadius: 6, fontWeight: "bold", fontSize: 12}}>
                        {l.durationMinutes || "0"} mins
                    </span>
                </td>
                <td style={td}>
                  {l.offline ? (
                    <span style={{ background: "#fff3e0", color: "#ef6c00", padding: "4px 8px", borderRadius: 10, fontSize: 11, fontWeight: "bold" }}>📴 OFFLINE</span>
                  ) : (
                    <span style={{ background: "#e8f5e9", color: "#2e7d32", padding: "4px 8px", borderRadius: 10, fontSize: 11, fontWeight: "bold" }}>🟢 LIVE</span>
                  )}
                </td>
                <td style={td}>
                  <button onClick={() => deleteLog(l.id)} style={btnDel}>Del</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {paged.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>
            No refill tracking data found for this selection.
          </div>
        )}
      </div>

      {/* Pagination */}
      <div style={{ marginTop: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ color: "#64748b", fontSize: 14 }}>
          Rows per page:
          <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} style={{ marginLeft: 10, padding: 4, borderRadius: 4 }}>
            <option value={10}>10</option><option value={20}>20</option><option value={50}>50</option>
          </select>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} style={btnPage(page === 1)}>Prev</button>
          <button disabled={page * pageSize >= filtered.length} onClick={() => setPage((p) => p + 1)} style={btnPage(page * pageSize >= filtered.length)}>Next</button>
        </div>
      </div>
    </div>
  );
}

// Styles
const labelStyle = { display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: "bold", color: "#475569" };
const inputStyle = { width: 200, padding: "10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14, outline: "none" };
const exportBtn = { background: "#10b981", color: "#fff", padding: "10px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: "bold" };
const table = { width: "100%", borderCollapse: "collapse" };
const th = { textAlign: "left", padding: 15, fontWeight: "bold", fontSize: 13, color: "#64748b" };
const td = { padding: "12px 15px", fontSize: 14 };
const btnDel = { background: "#fef2f2", color: "#ef4444", border: "1px solid #fecaca", padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontWeight: "bold", fontSize: 12 };
const btnPage = (disabled) => ({ padding: "8px 16px", background: disabled ? "#f1f5f9" : "#3b82f6", color: disabled ? "#94a3b8" : "#fff", border: "none", borderRadius: 8, cursor: disabled ? "not-allowed" : "pointer", fontWeight: "bold" });