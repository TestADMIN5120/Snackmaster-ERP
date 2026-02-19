import React, { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../firebaseClient";
import { useAdmin } from "../../contexts/AdminContext";
import { useNavigate } from "react-router-dom";

export default function RefillerDashboard() {
  const { user } = useAdmin();
  const navigate = useNavigate();
  
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // 📡 Real-time Online/Offline tracking
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // 📥 Fetch Machines
  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, "machines"),
      where("assignedTo", "==", user.uid),
      where("deleted", "==", false)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      setMachines(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // ⏱️ Helper: Convert Timestamp to "2h ago"
  function timeAgo(date) {
    if (!date) return "Never";
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  // 🧠 Helper: Map Status to Strict UI Rules
  function getMachineConfig(status) {
    switch (status) {
      case "active":
      case "ready":
        return { 
          badgeBg: "#dcfce7", badgeCol: "#166534", badgeText: "🟢 Ready", 
          btnBg: "#1976d2", btnText: "📦 Create Kit", disabled: false 
        };
      case "kit_prepared":
        return { 
          badgeBg: "#fef08a", badgeCol: "#854d0e", badgeText: "🟡 Kit Prepared", 
          btnBg: "#16a34a", btnText: "🚀 Let's Refill Now", disabled: false 
        };
      case "refill_in_progress":
      case "refill_pending":
        return { 
          badgeBg: "#dbeafe", badgeCol: "#1e40af", badgeText: "🔵 Refill Pending", 
          btnBg: "#94a3b8", btnText: "⏳ Syncing / Pending", disabled: true 
        };
      case "issue_reported":
        return { 
          badgeBg: "#fee2e2", badgeCol: "#991b1b", badgeText: "🔴 Issue Reported", 
          btnBg: "#dc2626", btnText: "👀 View Issue", disabled: false 
        };
      default:
        return { 
          badgeBg: "#f1f5f9", badgeCol: "#475569", badgeText: status || "Unknown", 
          btnBg: "#64748b", btnText: "Manage", disabled: false 
        };
    }
  }

  return (
    <div style={{ padding: 20, maxWidth: 1000, margin: "0 auto", paddingBottom: 100 }}>
      
      {/* 👤 REFILLER PROFILE & NETWORK STATUS */}
      <div style={topBar}>
        <div>
          <div style={{ fontSize: 14, color: "#666" }}>Logged in as</div>
          <div style={{ fontWeight: "bold", fontSize: 18 }}>{user?.displayName || user?.email}</div>
        </div>
        <div style={{ ...networkBadge, background: isOnline ? "#e8f5e9" : "#fff3e0", color: isOnline ? "#2e7d32" : "#ef6c00" }}>
          {isOnline ? "🟢 Online & Synced" : "🟡 Offline (Will Sync Later)"}
        </div>
      </div>

      {/* 🟢 HEADER WITH HISTORY BUTTON */}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20}}>
        <h1 style={{ margin:0, color: "#333" }}>My Route</h1>
        <button 
          onClick={() => navigate("/refiller/history")}
          style={{padding:'10px 16px', background:'#546e7a', color:'white', border:'none', borderRadius:6, cursor:'pointer', fontWeight: "bold"}}
        >
          📜 View History
        </button>
      </div>

      {loading && <p>Loading machines...</p>}

      {(!loading && machines.length === 0) && (
        <div style={{ padding: 40, textAlign: "center", background: "#fff", borderRadius: 12, color: "#666" }}>
          You have no machines assigned to you right now.
        </div>
      )}

      {/* 📦 MACHINE GRID */}
      <div style={grid}>
        {machines.map((m) => {
          const config = getMachineConfig(m.status);
          const lastRefillDate = m.lastRefillCompletedAt?.toDate ? m.lastRefillCompletedAt.toDate() : null;

          return (
            <div key={m.id} style={card}>
              
              {/* Card Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 15 }}>
                <div>
                  <h3 style={{ margin: "0 0 4px 0", fontSize: 18 }}>{m.name || "Unnamed Machine"}</h3>
                  <span style={{ fontSize: 12, color: "#888", fontFamily: "monospace" }}>{m.id}</span>
                </div>
                <div style={{ 
                  background: config.badgeBg, color: config.badgeCol, 
                  padding: "4px 8px", borderRadius: 8, fontSize: 12, fontWeight: "bold" 
                }}>
                  {config.badgeText}
                </div>
              </div>
              
              {/* Card Details */}
              <div style={{ marginBottom: 20, fontSize: 14, color: "#444" }}>
                <div style={{ marginBottom: 6 }}>📍 {m.location || "Location not set"}</div>
                <div>🕒 Last Refill: <strong>{timeAgo(lastRefillDate)}</strong></div>
              </div>

              {/* Contextual Action Button */}
              <button
                onClick={() => navigate(`/refiller/machines/${m.id}`)}
                disabled={config.disabled}
                style={{ 
                  ...actionBtn, 
                  background: config.btnBg,
                  cursor: config.disabled ? "not-allowed" : "pointer",
                  opacity: config.disabled ? 0.7 : 1
                }}
              >
                {config.btnText}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Styles
const topBar = { background: "#fff", padding: "15px 20px", borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 25, boxShadow: "0 2px 5px rgba(0,0,0,0.04)" };
const networkBadge = { padding: "6px 12px", borderRadius: 20, fontSize: 12, fontWeight: "bold" };
const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 };
const card = { background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", border: "1px solid #eaeaea", display: "flex", flexDirection: "column" };
const actionBtn = { marginTop: "auto", width: "100%", padding: 14, color: "#fff", border: "none", borderRadius: 8, fontWeight: "bold", fontSize: 15, transition: "background 0.2s" };