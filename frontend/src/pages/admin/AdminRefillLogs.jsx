// frontend/src/pages/admin/AdminRefillLogs.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  deleteDoc,
  doc,
  query,
  where,
  getDocs
} from "firebase/firestore";
import { db } from "../../firebaseClient";
import { useAdmin } from "../../contexts/AdminContext";

export default function AdminRefillLogs() {
  const { orgId } = useAdmin();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [machinesMap, setMachinesMap] = useState({}); // machineId -> machine doc (for name lookup)
  const [orgRefillers, setOrgRefillers] = useState([]); // refiller emails from users collection

  // Filters
  const [selectedMachine, setSelectedMachine] = useState("all");
  const [selectedRefiller, setSelectedRefiller] = useState("all");
  const [specificDate, setSpecificDate] = useState(""); // Exact date tracking

  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  // Refiller dropdown: org refillers from users collection + any emails found in logs
  const uniqueRefillers = useMemo(() => {
    const emails = logs.map(l => l.userEmail).filter(Boolean);
    return Array.from(new Set([...orgRefillers, ...emails])).sort();
  }, [logs, orgRefillers]);

  // Resolve machine name: from the log itself, or looked up from the machines collection
  const getMachineName = (l) => l.machineName || machinesMap[l.machineId]?.name || "";

  // Existing machines for the Machine filter dropdown (all org machines + any ids found in logs)
  const machinesList = useMemo(() => {
    const map = {};
    Object.entries(machinesMap).forEach(([id, m]) => { map[id] = m.name || "Unnamed"; });
    logs.forEach(l => { if (l.machineId && !map[l.machineId]) map[l.machineId] = l.machineName || "Unknown"; });
    return Object.entries(map)
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: "base" }));
  }, [machinesMap, logs]);

  // Load lookup data: machines (for name resolution) and refiller users (for the filter dropdown)
  useEffect(() => {
    if (!orgId) return;
    (async () => {
      try {
        const mSnap = await getDocs(query(collection(db, "machines"), where("orgId", "==", orgId)));
        const map = {};
        mSnap.docs.forEach(d => { map[d.id] = d.data(); });
        setMachinesMap(map);

        const uSnap = await getDocs(query(collection(db, "users"), where("orgId", "==", orgId), where("role", "==", "refiller")));
        setOrgRefillers(uSnap.docs.map(d => d.data().email).filter(Boolean));
      } catch (err) {
        console.error("AdminLogs lookup load error:", err);
      }
    })();
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;

    // Sorted client-side to avoid requiring a Firestore composite index (orgId + createdAt)
    const q = query(
      collection(db, "refill_logs"),
      where("orgId", "==", orgId)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setLogs(data);
        setLoadError("");
        setLoading(false);
      },
      (err) => {
        console.error("AdminLogs Error:", err);
        setLoadError("Failed to load refill logs. " + (err?.message || ""));
        setLoading(false);
      }
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
    return logs.filter((l) => {
      // 1. Machine Filter
      const matchMachine = selectedMachine === "all" || l.machineId === selectedMachine;

      // 2. Refiller Filter
      const matchRefiller = selectedRefiller === "all" || l.userEmail === selectedRefiller;

      // 3. Specific Date Filter (compared in local time, not UTC, to avoid timezone mismatch)
      let matchDate = true;
      if (specificDate && l.createdAt) {
        const d = new Date(l.createdAt.seconds * 1000);
        const logDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        matchDate = logDateStr === specificDate;
      }

      return matchMachine && matchRefiller && matchDate;
    });
  }, [logs, selectedMachine, selectedRefiller, specificDate]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  async function deleteLog(id) {
    if (!confirm("Delete this log? It cannot be recovered.")) return;
    await deleteDoc(doc(db, "refill_logs", id));
  }

  function exportCSV() {
    if (filtered.length === 0) return alert("No records to export for the current filters.");

    // Quote every field so commas/quotes in names don't break the CSV columns
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = "Date,Time,Refiller Email,Machine ID,Machine Name,Duration (mins),Offline Sync\n";
    const rows = filtered
      .map((l) =>
        [
          formatDate(l.createdAt),
          formatTime(l.createdAt),
          l.userEmail || "-",
          l.machineId || "-",
          getMachineName(l) || "-",
          l.durationMinutes || "0",
          l.offline ? "Yes" : "No"
        ].map(esc).join(",")
      )
      .join("\n");

    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Refiller_Tracking_${orgId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <div style={{ padding: 40, color: "#64748b" }}>Loading Refiller Tracking Data...</div>;

  return (
    <div style={{ width: "100%" }}>
      <style>{`
        .rl-table tbody tr:nth-child(even) { background: #f8fafb; }
        .rl-table tbody tr:hover { background: #e9f3f5; transition: background 0.15s; }
      `}</style>

      <div style={headerBar}>
        <h1 style={{ margin: 0, color: "#fff", fontSize: 21, letterSpacing: "-0.5px" }}>📍 Refiller Tracking Ledger</h1>
        <p style={{ color: "rgba(255,255,255,0.88)", margin: "3px 0 0 0", fontSize: 13 }}>Track exactly who refilled which machines on specific dates.</p>
      </div>

      {loadError && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", padding: "12px 16px", borderRadius: 10, marginBottom: 20, fontSize: 14 }}>
          ⚠️ {loadError}
        </div>
      )}

      <div style={card}>
        {/* FILTERS */}
        <div style={filterBar}>
          <label style={label}>
            🔍 Filter by Machine
            <select value={selectedMachine} onChange={(e) => { setSelectedMachine(e.target.value); setPage(1); }} style={{...input, minWidth: 220}}>
              <option value="all">All Machines</option>
              {machinesList.map(m => (
                <option key={m.id} value={m.id}>[{m.id}] {m.name}</option>
              ))}
            </select>
          </label>

          <label style={label}>
            👤 Filter by Refiller
            <select value={selectedRefiller} onChange={(e) => { setSelectedRefiller(e.target.value); setPage(1); }} style={{...input, minWidth: 220}}>
              <option value="all">All Refillers</option>
              {uniqueRefillers.map(email => (
                <option key={email} value={email}>{email}</option>
              ))}
            </select>
          </label>

          <label style={label}>
            📅 Specific Date
            <input type="date" value={specificDate} onChange={(e) => { setSpecificDate(e.target.value); setPage(1); }} style={{...input, minWidth: 150}} />
          </label>

          <button onClick={exportCSV} className="fx-btn-primary" style={{...btnPrimary, marginLeft: "auto"}}>⬇ Export CSV Report</button>
        </div>

        {/* TABLE */}
        <div style={tableWrapper}>
          <table className="rl-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead style={theadStyle}>
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
                    <div style={{fontWeight: 600, color: "#0f172a"}}>{formatDate(l.createdAt)}</div>
                    <div style={{fontSize: 12, color: "#64748b"}}>{formatTime(l.createdAt)}</div>
                  </td>
                  <td style={{...td, fontWeight: 600, color: "#0ea5e9"}}>{l.userEmail || "-"}</td>
                  <td style={td}>
                    <div style={{fontWeight: 600, color: "#0f172a"}}>{getMachineName(l) || "Unknown"}</div>
                    <span style={skuChip}>{l.machineId}</span>
                  </td>
                  <td style={td}>
                    <span style={{background: "#f1f5f9", border: "1px solid #e2e8f0", padding: "4px 10px", borderRadius: 999, fontWeight: 700, fontSize: 12, color: "#475569"}}>
                      {l.durationMinutes || "0"} mins
                    </span>
                  </td>
                  <td style={td}>
                    {l.offline ? (
                      <span style={{ background: "#fff3e0", color: "#ef6c00", border: "1px solid #fed7aa", padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>📴 OFFLINE</span>
                    ) : (
                      <span style={{ background: "#dcfce7", color: "#166534", border: "1px solid #86efac", padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>🟢 LIVE</span>
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
            <div style={{ padding: 30, textAlign: "center", color: "#94a3b8" }}>
              {logs.length === 0
                ? "No refill logs recorded yet. Entries will appear here once a refiller completes a machine refill."
                : "No records found for this filter."}
            </div>
          )}
        </div>

        {/* PAGINATION */}
        <div style={paginationRow}>
          <span style={{ fontSize: 13, color: "#64748b" }}>Showing <b style={{color: "#334155"}}>{paged.length}</b> of <b style={{color: "#334155"}}>{filtered.length}</b> records</span>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <label style={{ fontSize: 13, color: "#64748b", display: "flex", alignItems: "center", gap: 6 }}>
              Rows per page
              <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} style={perPageSelect}>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </label>
            <span style={{ fontSize: 13, color: "#64748b" }}>Page <b style={{color: "#334155"}}>{page}</b> of <b style={{color: "#334155"}}>{Math.max(1, Math.ceil(filtered.length / pageSize))}</b></span>
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} style={{...btnPage, opacity: page === 1 ? 0.5 : 1}}>← Previous</button>
            <button disabled={page * pageSize >= filtered.length} onClick={() => setPage((p) => p + 1)} style={{...btnPage, opacity: page * pageSize >= filtered.length ? 0.5 : 1}}>Next →</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Styles (matched to Warehouse Data Sheets page)
const headerBar = { background: "var(--fx-teal)", padding: "16px 20px", borderRadius: 8, marginBottom: 20, boxShadow: "0 2px 6px rgba(16,54,61,0.18)" };
const card = { background: "#fff", padding: 20, borderRadius: 10, boxShadow: "0 1px 3px rgba(16,24,40,0.06)", border: "1px solid var(--fx-border)" };
const label = { display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: "bold", color: "#475569" };
const input = { padding: "10px 12px", borderRadius: 6, border: "1px solid #ced4da", outline: "none", background: "#fff", fontSize: 14, color: "#334155" };
const btnPrimary = { padding: "10px 22px", background: "var(--fx-slate)", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: "bold", boxShadow: "0 1px 3px rgba(35,58,79,0.3)", transition: "background 0.15s" };
const tableWrapper = { border: "1px solid var(--fx-border)", borderRadius: 8, overflow: "hidden" };
const theadStyle = { background: "#f1f3f5", color: "#23292f", fontSize: 13 };
const th = { padding: "13px 16px", textAlign: "left", fontWeight: 700, whiteSpace: "nowrap", borderBottom: "1px solid var(--fx-border)" };
const filterBar = { display: "flex", gap: 15, marginBottom: 18, flexWrap: "wrap", alignItems: "flex-end", background: "#f8f9fa", border: "1px solid #e9ecef", borderRadius: 8, padding: "16px 18px" };
const perPageSelect = { padding: "7px 10px", borderRadius: 6, border: "1px solid #b7d4da", background: "#fff", color: "#357683", fontWeight: "bold", cursor: "pointer", outline: "none" };
const td = { padding: "14px 16px", color: "#334155" };
const skuChip = { fontFamily: "monospace", background: "#f1f5f9", border: "1px solid #e2e8f0", padding: "3px 9px", borderRadius: 6, fontSize: 12.5, color: "#475569", fontWeight: 600 };
const paginationRow = { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 15 };
const btnPage = { padding: "7px 14px", background: "#eaf3f5", border: "1px solid #b7d4da", borderRadius: 6, cursor: "pointer", fontWeight: "bold", color: "#357683" };
const btnDel = { background: "#fef2f2", color: "#ef4444", border: "1px solid #fecaca", padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontWeight: "bold", fontSize: 12 };
