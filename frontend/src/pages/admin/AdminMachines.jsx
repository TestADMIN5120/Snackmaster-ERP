import React, { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../firebaseClient";
import { useAdmin } from "../../contexts/AdminContext";
import { useNavigate } from "react-router-dom";

export default function AdminMachines() {
  const { orgId } = useAdmin();
  const navigate = useNavigate();
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;
    const q = query(collection(db, "machines"), where("orgId", "==", orgId), where("deleted", "==", false));
    const unsub = onSnapshot(q, (snap) => {
      setMachines(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [orgId]);

  const getStatusColor = (status) => {
    switch (status) {
      case "active": return "#10b981";
      case "issue_reported": return "#ef4444";
      case "kit_prepared": 
      case "pending_acceptance": return "#f59e0b"; 
      default: return "#64748b";
    }
  };

  if (loading) return <div style={{ padding: 20 }}>Loading machines...</div>;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 25 }}>
        <h1 style={{ margin: 0 }}>Vending Machines</h1>
        <div style={{ fontSize: 14, color: "#64748b" }}>Total: {machines.length}</div>
      </div>

      <div style={grid}>
        {machines.map(m => (
          <div key={m.id} style={card} onClick={() => navigate(`/admin/machines/${m.id}/slots`)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <h3 style={{ margin: 0, color: "#1e293b" }}>{m.name || "Unnamed Machine"}</h3>
              <span style={{ 
                padding: "4px 8px", borderRadius: 6, fontSize: 11, fontWeight: "bold", 
                background: `${getStatusColor(m.status)}20`, color: getStatusColor(m.status) 
              }}>
                {m.status?.toUpperCase().replace("_", " ")}
              </span>
            </div>
            
            <div style={{ fontSize: 13, color: "#64748b", fontFamily: "monospace" }}>ID: {m.id}</div>
            
            {/* 🟢 UPDATED: Location with Google Maps Button */}
            <div style={{ marginTop: 15, fontSize: 14, color: "#475569", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>📍 {m.location || "No location set"}</span>
              {m.googleMapsUrl && (
                <a 
                  href={m.googleMapsUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  onClick={(e) => e.stopPropagation()} 
                  style={mapBtn}
                >
                  🗺️ Map
                </a>
              )}
            </div>
            
            <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
               <span style={{ fontSize: 12, color: "#94a3b8" }}>Refiller:</span>
               <span style={{ fontSize: 12, fontWeight: "600" }}>{m.assignedEmail || "Unassigned"}</span>
            </div>

            <div style={{ marginTop: 15, paddingTop: 15, borderTop: "1px solid #f1f5f9", display: "flex", gap: 10 }}>
                <button 
                  onClick={(e) => { e.stopPropagation(); navigate(`/admin/machines/${m.id}/make-kit`); }}
                  style={{ flex: 1, padding: "8px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: 6, fontWeight: "bold", cursor: "pointer" }}
                >
                  📦 Prepare Kit
                </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 };
const card = { background: "#fff", padding: 20, borderRadius: 12, border: "1px solid #e2e8f0", cursor: "pointer", transition: "transform 0.2s", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" };
const mapBtn = { color: "#3b82f6", textDecoration: "none", fontSize: 12, fontWeight: "bold", background: "#eff6ff", padding: "4px 8px", borderRadius: 4, display: "inline-block" };