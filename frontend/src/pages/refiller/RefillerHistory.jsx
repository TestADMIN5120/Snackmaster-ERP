import React, { useEffect, useState } from "react";
import { collection, query, where, orderBy, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../../firebaseClient";
import { useAdmin } from "../../contexts/AdminContext";
import { useNavigate } from "react-router-dom";
import { generateKitPDF } from "../../utils/pdfGenerator"; // 🟢 ADDED PDF IMPORT

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
      const q = query(
        collection(db, "refill_logs"),
        where("refillerId", "==", user.uid),
        orderBy("completedAt", "desc")
      );

      const snap = await getDocs(q);
      setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("❌ Failed loading refill history", err);
    } finally {
      setLoading(false);
    }
  }

  // 🟢 Download Logic: Fetch the actual kit doc to get the line-items
  async function handleDownload(kitId) {
      if (!kitId) return alert("No Kit associated with this refill.");
      try {
          const kitSnap = await getDoc(doc(db, "kits", kitId));
          if(kitSnap.exists()) {
              generateKitPDF({ id: kitSnap.id, ...kitSnap.data() });
          } else {
              alert("Kit details not found.");
          }
      } catch (e) {
          console.error(e);
          alert("Error downloading PDF.");
      }
  }

  // 🟢 Security Rule Check: Only show download if < 24 hours old
  function isWithin24Hours(timestamp) {
      if (!timestamp) return false;
      const logDate = timestamp.seconds ? timestamp.seconds * 1000 : timestamp;
      const hoursDifference = (Date.now() - logDate) / (1000 * 60 * 60);
      return hoursDifference <= 24;
  }

  if (loading) return <div style={{ padding: 24, textAlign: "center", color: "#64748b" }}>Loading history...</div>;

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto" }}>
      
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20}}>
        <h1 style={{ margin: 0, fontSize:24, color: "#1e293b" }}>Refill History</h1>
      </div>

      {logs.length === 0 && (
        <div style={emptyState}>
          <div style={{fontSize: 40, marginBottom: 10}}>🏜️</div>
          <h3 style={{margin: "0 0 5px 0", color: "#334155"}}>No refills completed yet.</h3>
          <p style={{margin: 0}}>Complete a refill job on your route to see it listed here.</p>
        </div>
      )}

      {logs.length > 0 && (
        <div style={tableCard}>
          {logs.map((log) => (
            <div key={log.id} style={mobileCard}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: "bold", fontSize: 16, color: "#0f172a" }}>{log.machineName || "Unknown Machine"}</div>
                  <div style={{ fontSize: 12, color: "#64748b", fontFamily: "monospace" }}>{log.machineId}</div>
                </div>
                <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
                  {log.offline ? (
                    <span style={badgeWarning}>🟡 Pending Sync</span>
                  ) : (
                    <span style={badgeSuccess}>🟢 Synced</span>
                  )}
                  
                  {/* 🟢 CONDITIONAL PDF BUTTON */}
                  {log.kitId && isWithin24Hours(log.completedAt) && (
                      <button onClick={() => handleDownload(log.kitId)} style={btnDownloadGhost}>
                          📄 Get PDF
                      </button>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#475569", background: "#f8fafc", padding: 10, borderRadius: 8 }}>
                <div>
                   📅 {log.completedAt?.toDate ? log.completedAt.toDate().toLocaleDateString("en-IN") : "—"}
                </div>
                <div>
                   ⏱️ {log.durationMinutes !== undefined ? `${log.durationMinutes} min` : log.durationSeconds ? `${Math.floor(log.durationSeconds / 60)} min` : "—"}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* Styles */
const emptyState = { textAlign: "center", padding: "50px 20px", color: "#64748b", background:'#fff', borderRadius: 12, border: "1px dashed #cbd5e1" };
const tableCard = { display: "flex", flexDirection: "column", gap: 15 };
const mobileCard = { background: "#fff", padding: 16, borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.04)", border: "1px solid #e2e8f0" };
const badgeSuccess = { background: "#e8f5e9", color: "#2e7d32", padding: "4px 8px", borderRadius: 12, fontSize: 11, fontWeight: "bold" };
const badgeWarning = { background: "#fff3e0", color: "#ef6c00", padding: "4px 8px", borderRadius: 12, fontSize: 11, fontWeight: "bold" };
const btnDownloadGhost = { background: "#f0f9ff", color: "#0284c7", border: "1px solid #bae6fd", padding: "4px 8px", borderRadius: 6, fontSize: 11, fontWeight: "bold", cursor: "pointer" };