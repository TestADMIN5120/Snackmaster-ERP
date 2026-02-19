import React, { useEffect, useState } from "react";
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp
} from "firebase/firestore";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../../firebaseClient";
import { useAdmin } from "../../contexts/AdminContext";
import axios from "axios"; // 🟢 Added for Centralized Backend Logic

export default function RefillerMachinePage() {
  const { machineId } = useParams();
  const navigate = useNavigate();
  const { user } = useAdmin();

  const [machine, setMachine] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // 🟢 UX State Controls
  const [refillStartedAt, setRefillStartedAt] = useState(null);
  const [checkSlots, setCheckSlots] = useState(false);
  const [checkDoor, setCheckDoor] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // 🟢 Post-Refill Success State
  const [successData, setSuccessData] = useState(null);

  useEffect(() => {
    loadData();
  }, [machineId]);

  async function loadData() {
    setLoading(true);
    try {
      const mSnap = await getDoc(doc(db, "machines", machineId));
      if (!mSnap.exists()) {
        alert("Machine not found");
        navigate("/refiller");
        return;
      }
      setMachine({ id: mSnap.id, ...mSnap.data() });
    } catch (err) {
      console.error("Error loading machine data:", err);
    } finally {
      setLoading(false);
    }
  }

  // --- ACTIONS ---

  function handleMakeKitClick() {
    navigate(`/refiller/machines/${machineId}/make-kit`);
  }

  function startRefill() {
    setRefillStartedAt(Date.now());
    // Locally trigger the state in Firestore so Admins see it's being worked on
    updateDoc(doc(db, "machines", machineId), {
      status: "refill_in_progress",
      lastRefillStartedAt: serverTimestamp()
    });
  }

  async function completeRefill() {
    // 🔒 UX Safety Lock (Same as your current code)
    if (!checkSlots || !checkDoor) return; 
    
    setSaving(true);
    const durationSeconds = Math.floor((Date.now() - refillStartedAt) / 1000);
    const durationMinutes = Math.floor(durationSeconds / 60);

    try {
      // 🟢 PRODUCTION FIX: Use centralized Express Backend instead of raw addDoc
      // This ensures Kit closure, Machine update, and Logs happen in one atomic transaction
      const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:5001";
      
      const response = await axios.post(`${backendUrl}/api/confirm-refill`, {
        machineId: machineId,
        orgId: machine.orgId, 
        refillerId: user.uid,
        userEmail: user.email,
        kitId: machine.activeKitId || null,
        products: [] // Optional: send items if you want detailed line-item logging
      });

      if (response.data.ok) {
        // 🟢 Show Success Screen (Preserved from your code)
        setSuccessData({
          duration: durationMinutes < 1 ? "< 1 min" : `${durationMinutes} mins`,
          syncStatus: navigator.onLine ? "🟢 Synced to Server successfully." : "🟡 Saved locally (Offline Sync Mode)."
        });
      }

    } catch (err) {
      console.error("Refill processing error:", err);
      alert("Failed to confirm refill. Please check your backend connection.");
    } finally {
      setSaving(false);
    }
  }

  // --- RENDER ---

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#666' }}>Loading machine details...</div>;
  if (!machine) return <div style={{ padding: 40, textAlign: 'center' }}>Machine not found</div>;
  
  const isRefilling = !!refillStartedAt;
  const isIssue = machine.status === "issue_reported";

  // 🟢 1. SUCCESS SCREEN (Exact UX from your code)
  if (successData) {
    return (
      <div style={{ padding: "20px", maxWidth: "600px", margin: "40px auto", textAlign: "center" }}>
        <div style={{ background: "#e8f5e9", padding: "40px 20px", borderRadius: "12px", border: "2px solid #4caf50", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
          <h1 style={{ fontSize: "50px", margin: "0 0 10px 0" }}>✅</h1>
          <h2 style={{ color: "#2e7d32", margin: "0 0 20px 0" }}>Refill Completed!</h2>
          
          <div style={{ background: "#fff", padding: "15px", borderRadius: "8px", marginBottom: "20px", display: "inline-block", textAlign: "left", border: "1px solid #c8e6c9" }}>
            <p style={{ margin: "5px 0", fontSize: "16px" }}>⏱️ <strong>Time Taken:</strong> {successData.duration}</p>
            <p style={{ margin: "5px 0", fontSize: "16px" }}>📡 <strong>Status:</strong> {successData.syncStatus}</p>
          </div>

          <button onClick={() => navigate("/refiller")} style={btnPrimary}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // 🟢 2. NORMAL FLOW SCREEN (Exact features from your code)
  return (
    <div style={{ padding: "20px", maxWidth: "800px", margin: "0 auto", paddingBottom: 100 }}>
      
      <button onClick={() => navigate("/refiller")} style={btnBack}>← Dashboard</button>
      
      <div style={headerCard}>
        <h1 style={{ margin: 0, color: "#1e293b" }}>{machine.name}</h1>
        <p style={{ color: "#64748b", fontFamily: "monospace", margin: "5px 0" }}>{machine.id}</p>
        
        {isIssue ? (
           <div style={{ marginTop: 15, padding: "12px", background: "#fee2e2", color: "#991b1b", borderRadius: 8, fontWeight: "bold", border: "1px solid #fecaca", textAlign: 'center' }}>
             🔴 Machine is Down (Issue Reported)
           </div>
        ) : (
           <div style={{ marginTop: 10, fontSize: 14 }}>Status: <strong style={{ color: "#1976d2" }}>{machine.status?.toUpperCase().replace("_", " ")}</strong></div>
        )}
      </div>

      {/* 🔴 IF ISSUE REPORTED, DISABLE REFILL WORKFLOW */}
      {isIssue ? (
        <div style={section}>
          <p style={{ color: "#666", fontSize: "16px", lineHeight: "1.5", textAlign: 'center' }}>
            You cannot refill this machine until an Admin resolves the reported issue.
          </p>
        </div>
      ) : (
        <>
          {/* PHASE 1: PREPARATION */}
          {!isRefilling && (
            <div style={section}>
              <h3 style={{ marginTop: 0, color: '#334155' }}>1. Warehouse Prep</h3>
              <div style={actionRow}>
                <button 
                  onClick={handleMakeKitClick} 
                  style={machine.activeKitId ? btnDisabled : btnPrimary}
                  disabled={!!machine.activeKitId}
                >
                  {machine.activeKitId ? "✅ Kit Prepared (CSV)" : "⚡ Auto-Calculate Kit (CSV)"}
                </button>
              </div>
            </div>
          )}

          {/* PHASE 2: AT MACHINE */}
          {!isRefilling && (
            <div style={section}>
              <h3 style={{ marginTop: 0, color: '#334155' }}>2. At Machine</h3>
              <div style={actionRow}>
                <button 
                  onClick={startRefill}
                  style={machine.kitStatus === "prepared" ? btnGreen : btnLocked}
                  disabled={machine.kitStatus !== "prepared"}
                >
                  🚀 Start Refill Timer
                </button>
                <button onClick={() => navigate(`/refiller/machines/${machineId}/report-issue`)} style={btnDanger}>
                  ⚠️ Report Issue
                </button>
              </div>
            </div>
          )}

          {/* PHASE 3: ACTIVE REFILL (THE LOCKDOWN UX) */}
          {isRefilling && (
            <div style={activeRefillBox}>
              <h2 style={{ marginTop: 0, color: "#d84315" }}>🔥 Refill in Progress</h2>
              <p style={{ color: "#555", marginBottom: 20 }}>Timer is running. Please verify the following before finishing:</p>
              
              <label style={checkboxLabel}>
                <input type="checkbox" checked={checkSlots} onChange={e => setCheckSlots(e.target.checked)} style={checkbox} />
                <span style={{ fontSize: 18, fontWeight: "500" }}>🍫 All required slots are filled</span>
              </label>

              <label style={checkboxLabel}>
                <input type="checkbox" checked={checkDoor} onChange={e => setCheckDoor(e.target.checked)} style={checkbox} />
                <span style={{ fontSize: 18, fontWeight: "500" }}>🚪 Machine door is securely locked</span>
              </label>

              <button 
                onClick={completeRefill} 
                style={checkSlots && checkDoor ? btnFinish : btnFinishDisabled}
                disabled={!checkSlots || !checkDoor || saving}
              >
                {saving ? "Processing..." : "✅ Complete Refill"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Styles
const headerCard = { background: "#fff", padding: 20, borderRadius: 12, boxShadow: "0 2px 5px rgba(0,0,0,0.05)", marginBottom: 20, border: "1px solid #e2e8f0" };
const section = { marginBottom: 25, background: "#fff", padding: 20, borderRadius: 12, border: "1px solid #e2e8f0" };
const actionRow = { display: "flex", gap: 10 };
const activeRefillBox = { background: "#fff3e0", padding: 25, borderRadius: 12, border: "2px solid #ffb74d", boxShadow: "0 4px 12px rgba(255, 183, 77, 0.3)" };
const btnBack = { border: "none", background: "none", color: "#1976d2", cursor: "pointer", marginBottom: 15, fontWeight: "bold", fontSize: 16, padding: 0 };
const btnPrimary = { flex: 1, padding: 15, background: "#1976d2", color: "#fff", border: "none", borderRadius: 8, fontWeight: "bold", cursor: "pointer", fontSize: 16 };
const btnDanger = { flex: 1, padding: 15, background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, fontWeight: "bold", cursor: "pointer", fontSize: 16 };
const btnGreen = { flex: 1, padding: 15, background: "#2e7d32", color: "#fff", border: "none", borderRadius: 8, fontWeight: "bold", cursor: "pointer", fontSize: 16 };
const btnFinish = { width: "100%", padding: 18, background: "#d84315", color: "#fff", border: "none", borderRadius: 8, fontWeight: "bold", cursor: "pointer", marginTop: 20, fontSize: 18, boxShadow: "0 4px 10px rgba(216, 67, 21, 0.3)" };
const btnFinishDisabled = { width: "100%", padding: 18, background: "#ffccbc", color: "#fff", border: "none", borderRadius: 8, fontWeight: "bold", cursor: "not-allowed", marginTop: 20, fontSize: 18 };
const btnDisabled = { flex: 1, padding: 15, background: "#e2e8f0", color: "#64748b", border: "1px solid #cbd5e1", borderRadius: 8, cursor: "not-allowed", fontSize: 16, fontWeight: "bold" };
const btnLocked = { flex: 1, padding: 15, background: "#f1f5f9", color: "#94a3b8", border: "1px dashed #cbd5e1", borderRadius: 8, cursor: "not-allowed", fontSize: 16, fontWeight: "bold" };

const checkboxLabel = { display: 'flex', alignItems: 'center', gap: 15, padding: "15px", background: "#fff", borderRadius: "8px", marginBottom: "10px", border: "1px solid #ffccbc", cursor: "pointer", userSelect: "none" };
const checkbox = { width: "24px", height: "24px", cursor: "pointer" };