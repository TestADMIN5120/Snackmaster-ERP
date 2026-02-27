import React, { useEffect, useState } from "react";
import { collection, query, where, orderBy, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../../firebaseClient";
import { useAdmin } from "../../contexts/AdminContext";
import { useNavigate } from "react-router-dom";
import { generateKitPDF } from "../../utils/pdfGenerator"; 

export default function RefillerHistory() {
  const { user } = useAdmin();
  const navigate = useNavigate();

  const [logs, setLogs] = useState([]);
  const [kits, setKits] = useState([]); // 🟢 NEW: State for kits
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("history"); // 🟢 NEW: Tab control

  useEffect(() => {
    if (user?.uid) {
      loadLogs();
      loadKits(); // 🟢 NEW: Fetch kits on load
    }
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

  // 🟢 NEW: Load all kits accepted by this refiller
  async function loadKits() {
    try {
      const q = query(
        collection(db, "kits"),
        where("acceptedBy", "==", user.email),
        orderBy("acceptedAt", "desc")
      );
      const snap = await getDocs(q);
      setKits(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("❌ Failed loading kit history", err);
    }
  }

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

  // 🟢 Download directly from the Kit object
  function downloadDirectKit(kitData) {
      generateKitPDF(kitData);
  }

  if (loading) return <div style={{ padding: 24, textAlign: "center", color: "#64748b" }}>Loading data...</div>;

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", paddingBottom: 60 }}>
      
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20}}>
        <button onClick={() => navigate("/refiller")} style={btnBack}>← Back</button>
        <h1 style={{ margin: 0, fontSize:24, color: "#1e293b" }}>My Records</h1>
      </div>

      {/* 🟢 NEW: Tab Navigation */}
      <div style={tabContainer}>
        <button 
          style={activeTab === "history" ? tabActive : tabInactive} 
          onClick={() => setActiveTab("history")}
        >
          Refill History
        </button>
        <button 
          style={activeTab === "kits" ? tabActive : tabInactive} 
          onClick={() => setActiveTab("kits")}
        >
          Accepted Kits ({kits.length})
        </button>
      </div>

      {/* 🟢 REFILL HISTORY TAB */}
      {activeTab === "history" && (
        <>
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
                      
                      {log.kitId && (
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
        </>
      )}

      {/* 🟢 ACCEPTED KITS TAB */}
      {activeTab === "kits" && (
        <>
          {kits.length === 0 && (
            <div style={emptyState}>
              <div style={{fontSize: 40, marginBottom: 10}}>📦</div>
              <h3 style={{margin: "0 0 5px 0", color: "#334155"}}>No kits accepted yet.</h3>
              <p style={{margin: 0}}>When you accept a kit for a machine, it will appear here.</p>
            </div>
          )}

          {kits.length > 0 && (
            <div style={tableCard}>
              {kits.map((kit) => (
                <div key={kit.id} style={{...mobileCard, borderLeft: "4px solid #f59e0b"}}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: "bold", fontSize: 16, color: "#0f172a" }}>Kit for: {kit.machineName}</div>
                      <div style={{ fontSize: 12, color: "#64748b", fontFamily: "monospace" }}>{kit.id}</div>
                    </div>
                    <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
                      <span style={{...badgeSuccess, background: kit.status === "completed" ? "#e8f5e9" : "#fffbeb", color: kit.status === "completed" ? "#2e7d32" : "#b45309"}}>
                        {kit.status === "completed" ? "✅ Completed" : "🚚 Issued / Active"}
                      </span>
                      <button onClick={() => downloadDirectKit(kit)} style={{...btnDownloadGhost, background: "#fffbeb", borderColor: "#fde68a", color: "#b45309"}}>
                          📥 Download Manifest
                      </button>
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#475569", background: "#f8fafc", padding: 10, borderRadius: 8 }}>
                    <div>
                        📅 Accepted: {kit.acceptedAt?.toDate ? kit.acceptedAt.toDate().toLocaleString("en-IN", {month: "short", day: "numeric", hour: "2-digit", minute:"2-digit"}) : "—"}
                    </div>
                    <div style={{fontWeight: "bold"}}>
                        📦 {kit.products?.length || 0} Items
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

    </div>
  );
}

/* Styles */
const btnBack = { border: "none", background: "none", color: "#3b82f6", cursor: "pointer", fontWeight: "bold", padding: 0 };
const tabContainer = { display: "flex", gap: 10, marginBottom: 20, borderBottom: "2px solid #e2e8f0", paddingBottom: 10 };
const tabActive = { padding: "8px 16px", background: "#0ea5e9", color: "#fff", border: "none", borderRadius: 20, fontWeight: "bold", cursor: "pointer" };
const tabInactive = { padding: "8px 16px", background: "none", color: "#64748b", border: "none", fontWeight: "bold", cursor: "pointer" };
const emptyState = { textAlign: "center", padding: "50px 20px", color: "#64748b", background:'#fff', borderRadius: 12, border: "1px dashed #cbd5e1" };
const tableCard = { display: "flex", flexDirection: "column", gap: 15 };
const mobileCard = { background: "#fff", padding: 16, borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.04)", border: "1px solid #e2e8f0" };
const badgeSuccess = { background: "#e8f5e9", color: "#2e7d32", padding: "4px 8px", borderRadius: 12, fontSize: 11, fontWeight: "bold" };
const badgeWarning = { background: "#fff3e0", color: "#ef6c00", padding: "4px 8px", borderRadius: 12, fontSize: 11, fontWeight: "bold" };
const btnDownloadGhost = { background: "#f0f9ff", color: "#0284c7", border: "1px solid #bae6fd", padding: "4px 8px", borderRadius: 6, fontSize: 11, fontWeight: "bold", cursor: "pointer" };