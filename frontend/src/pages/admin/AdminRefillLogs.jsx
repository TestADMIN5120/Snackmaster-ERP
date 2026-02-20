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
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  // 🟢 Standardized Query for all refillers in the Org
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
        console.log(`AdminLogs: ${data.length} logs found for org ${orgId}`);
        setLogs(data);
      },
      (err) => {
        console.error("AdminLogs Error:", err);
      }
    );

    return () => unsub();
  }, [orgId]);

  function formatDate(ts) {
    if (!ts || !ts.seconds) return "-";
    return new Date(ts.seconds * 1000).toLocaleString("en-IN");
  }

  function isWithinFilter(log) {
    if (!log.createdAt) return false;

    const logDate = new Date(log.createdAt.seconds * 1000);
    const today = new Date();

    if (filter === "today") {
      return logDate.toDateString() === today.toDateString();
    }
    if (filter === "7d") {
      const diff = today - logDate;
      return diff / (1000 * 60 * 60 * 24) <= 7;
    }
    if (filter === "month") {
      return (
        logDate.getMonth() === today.getMonth() &&
        logDate.getFullYear() === today.getFullYear()
      );
    }
    return true;
  }

  const filtered = useMemo(() => {
    const txt = search.toLowerCase().trim();
    return logs.filter((l) => {
      const matchSearch =
        (l.userEmail || "").toLowerCase().includes(txt) ||
        (l.machineId || "").toLowerCase().includes(txt) ||
        (l.machineName || "").toLowerCase().includes(txt);

      return matchSearch && isWithinFilter(l);
    });
  }, [logs, search, filter]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  async function deleteLog(id) {
    if (!confirm("Delete this log? It cannot be recovered.")) return;
    await deleteDoc(doc(db, "refill_logs", id));
  }

  function exportCSV() {
    const header =
      "Refiller Email,Machine ID,Machine Name,Duration (mins),Date,Offline Sync\n";

    const rows = filtered
      .map(
        (l) =>
          `${l.userEmail || "-"},${l.machineId || "-"},${
            l.machineName || "-"
          },${l.durationMinutes || "0"},${formatDate(l.createdAt)},${
            l.offline ? "Yes" : "No"
          }`
      )
      .join("\n");

    const blob = new Blob([header + rows], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `refill_logs_${orgId}.csv`;
    link.click();
  }

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ marginBottom: 20 }}>Refiller Activity Logs</h1>

      {/* Filters */}
      <div
        style={{
          display: "flex",
          gap: 15,
          marginBottom: 20,
          background: "#fff",
          padding: 15,
          borderRadius: 10,
          border: "1px solid #e2e8f0"
        }}
      >
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search refiller email, machine name..."
          style={inputStyle}
        />

        <select
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setPage(1);
          }}
          style={inputStyle}
        >
          <option value="all">All Time</option>
          <option value="today">Today</option>
          <option value="7d">Last 7 Days</option>
          <option value="month">This Month</option>
        </select>

        <button onClick={exportCSV} style={exportBtn}>
          ⬇ Export CSV
        </button>
      </div>

      {/* Table */}
      <div
        style={{
          background: "#fff",
          borderRadius: 10,
          border: "1px solid #e2e8f0",
          overflow: "hidden"
        }}
      >
        <table style={table}>
          <thead style={{ background: "#f8fafc" }}>
            <tr>
              <th style={th}>Refiller</th>
              <th style={th}>Machine</th>
              <th style={th}>Duration</th>
              <th style={th}>Timestamp</th>
              <th style={th}>Status</th>
              <th style={th}>Delete</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((l) => (
              <tr key={l.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={td}>
                  <b>{l.userEmail || "-"}</b>
                </td>
                <td style={td}>
                  <div>{l.machineName || "Unknown"}</div>
                  <div style={{ fontSize: 12, color: "#666" }}>
                    {l.machineId}
                  </div>
                </td>
                <td style={td}>{l.durationMinutes || "0"} mins</td>
                <td style={td}>{formatDate(l.createdAt)}</td>
                <td style={td}>
                  {l.offline ? (
                    <span
                      style={{
                        background: "#fff3e0",
                        color: "#ef6c00",
                        padding: "4px 8px",
                        borderRadius: 10,
                        fontSize: 11,
                        fontWeight: "bold"
                      }}
                    >
                      📴 OFFLINE SYNC
                    </span>
                  ) : (
                    <span
                      style={{
                        background: "#e8f5e9",
                        color: "#2e7d32",
                        padding: "4px 8px",
                        borderRadius: 10,
                        fontSize: 11,
                        fontWeight: "bold"
                      }}
                    >
                      🟢 SYNCED
                    </span>
                  )}
                </td>
                <td style={td}>
                  <button onClick={() => deleteLog(l.id)} style={btnDel}>
                    X
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {paged.length === 0 && (
          <div
            style={{
              padding: 40,
              textAlign: "center",
              color: "#94a3b8"
            }}
          >
            No refill logs match your criteria.
          </div>
        )}
      </div>

      {/* Pagination */}
      <div
        style={{
          marginTop: 20,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}
      >
        <div style={{ color: "#64748b" }}>
          Rows per page:
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            style={{ marginLeft: 10, padding: 4, borderRadius: 4 }}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            style={btnPage(page === 1)}
          >
            Prev
          </button>
          <button
            disabled={page * pageSize >= filtered.length}
            onClick={() => setPage((p) => p + 1)}
            style={btnPage(page * pageSize >= filtered.length)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

// Styles
const inputStyle = {
  flex: 1,
  padding: "10px",
  borderRadius: 6,
  border: "1px solid #cbd5e1",
  fontSize: 14
};
const exportBtn = {
  background: "#10b981",
  color: "#fff",
  padding: "10px 16px",
  borderRadius: 6,
  border: "none",
  cursor: "pointer",
  fontWeight: "bold"
};
const table = { width: "100%", borderCollapse: "collapse" };
const th = {
  textAlign: "left",
  padding: 15,
  fontWeight: "bold",
  fontSize: 13,
  color: "#64748b",
  textTransform: "uppercase"
};
const td = { padding: 15, fontSize: 14 };
const btnDel = {
  background: "#e74c3c",
  color: "#fff",
  border: "none",
  padding: "6px 10px",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: "bold"
};
const btnPage = (disabled) => ({
  padding: "8px 16px",
  background: disabled ? "#e2e8f0" : "#1e88e5",
  color: disabled ? "#94a3b8" : "#fff",
  border: "none",
  borderRadius: 6,
  cursor: disabled ? "not-allowed" : "pointer",
  fontWeight: "bold"
});