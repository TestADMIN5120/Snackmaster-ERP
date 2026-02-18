import React, { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
} from "firebase/firestore";
import { db } from "../../firebaseClient";
import { useAdmin } from "../../contexts/AdminContext";
import { useNavigate } from "react-router-dom";

export default function RefillerHistory() {
  const { user } = useAdmin();
  const navigate = useNavigate();

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.uid) loadLogs();
  }, [user]);

  async function loadLogs() {
    try {
      // 🟢 Query: Only logs for THIS refiller, sorted by Date
      const q = query(
        collection(db, "refill_logs"),
        where("refillerId", "==", user.uid),
        orderBy("completedAt", "desc")
      );

      const snap = await getDocs(q);

      setLogs(
        snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }))
      );
    } catch (err) {
      console.error("❌ Failed loading refill history", err);
    } finally {
      setLoading(false);
    }
  }

  // --- Render ---

  if (loading) {
    return <div style={{ padding: 24 }}>Loading history...</div>;
  }

  return (
    <div style={{ padding: "24px", maxWidth: "800px", margin: "0 auto" }}>
      
      {/* Header */}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20}}>
        <button onClick={() => navigate("/refiller")} style={btnBack}>← Back to Dashboard</button>
        <h1 style={{ margin: 0, fontSize:24 }}>Refill History</h1>
        <div style={{width: 100}} /> {/* Spacer */}
      </div>

      {logs.length === 0 && (
        <div style={emptyState}>
          <h3>No refills completed yet.</h3>
          <p>Complete a refill job to see it listed here.</p>
        </div>
      )}

      {/* Table Card */}
      {logs.length > 0 && (
        <div style={tableCard}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={thead}>
                <th style={th}>Machine</th>
                <th style={th}>Date</th>
                <th style={th}>Duration</th>
                <th style={th}>Status</th>
              </tr>
            </thead>

            <tbody>
              {logs.map((log) => (
                <tr key={log.id} style={row}>
                  <td style={td}>
                    <strong>{log.machineName || log.machineId}</strong>
                    <div style={{fontSize:11, color:'#888'}}>{log.machineId}</div>
                  </td>

                  <td style={td}>
                    {log.completedAt?.toDate
                      ? log.completedAt.toDate().toLocaleString()
                      : "—"}
                  </td>

                  <td style={td}>
                    {log.durationMinutes !== undefined
                      ? `${log.durationMinutes} min`
                      : log.durationSeconds
                      ? `${Math.floor(log.durationSeconds / 60)} min`
                      : "—"}
                  </td>

                  <td style={td}>
                    {log.offline ? (
                      <span style={badgeWarning}>🟡 Pending Sync</span>
                    ) : (
                      <span style={badgeSuccess}>🟢 Synced</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* Styles */
const btnBack = { background: "none", border: "none", color: "#1976d2", cursor: "pointer", fontSize:14 };
const emptyState = { textAlign: "center", padding: 40, color: "#777", background:'#f5f5f5', borderRadius:8 };
const tableCard = { background: "#fff", borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.05)", overflow: "hidden" };
const thead = { background: "#f9fafb", borderBottom: "2px solid #eee" };
const th = { padding: "12px 16px", textAlign: "left", fontSize: 13, color: "#555", fontWeight: 600 };
const row = { borderBottom: "1px solid #f0f0f0" };
const td = { padding: "12px 16px", fontSize: 14, color: "#333" };
const badgeSuccess = { background: "#e8f5e9", color: "#2e7d32", padding: "4px 8px", borderRadius: 12, fontSize: 11, fontWeight: "bold" };
const badgeWarning = { background: "#fff3e0", color: "#ef6c00", padding: "4px 8px", borderRadius: 12, fontSize: 11, fontWeight: "bold" };