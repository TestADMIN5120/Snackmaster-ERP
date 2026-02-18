import React, { useEffect, useState } from "react";
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  addDoc,
  collection
} from "firebase/firestore";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../../firebaseClient";
import { useAdmin } from "../../contexts/AdminContext";

export default function RefillerMachinePage() {
  const { machineId } = useParams();
  const navigate = useNavigate();
  const { user } = useAdmin();

  const [machine, setMachine] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refillStartedAt, setRefillStartedAt] = useState(null);
  const [checklistDone, setChecklistDone] = useState(false);

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
      console.error(err);
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
    updateDoc(doc(db, "machines", machineId), {
      status: "refill_in_progress",
      lastRefillStartedAt: serverTimestamp()
    });
  }

  async function completeRefill() {
    if (!checklistDone) return alert("Please verify all slots are filled.");
    
    setLoading(true);
    const durationSeconds = Math.floor((Date.now() - refillStartedAt) / 1000);
    const durationMinutes = Math.floor(durationSeconds / 60);

    try {
      // 1. Create Log with Org ID
      await addDoc(collection(db, "refill_logs"), {
        machineId,
        machineName: machine.name,
        orgId: machine.orgId, // 🟢 SECURITY FIX
        refillerId: user.uid,
        userEmail: user.email,
        kitId: machine.activeKitId || null,
        startedAtLocal: new Date(refillStartedAt),
        completedAt: serverTimestamp(),
        durationSeconds,
        durationMinutes,
        offline: !navigator.onLine,
        createdAt: serverTimestamp()
      });

      // 2. Update Machine
      await updateDoc(doc(db, "machines", machineId), {
        status: "active",
        activeKitId: null,
        kitStatus: null,
        lastRefillCompletedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 3. Close Kit (if exists)
      if (machine.activeKitId) {
        await updateDoc(doc(db, "kits", machine.activeKitId), {
          status: "completed",
          completedAt: serverTimestamp(),
        });
      }

      alert(`Refill Complete! Time: ${durationMinutes}m`);
      navigate("/refiller/history");
    } catch (err) {
      console.error(err);
      alert("Error saving log.");
      setLoading(false);
    }
  }

  // --- RENDER ---

  if (loading) return <div style={{ padding: 20 }}>Loading...</div>;
  if (!machine) return <div style={{ padding: 20 }}>Machine not found</div>;
  
  const isRefilling = !!refillStartedAt;

  return (
    <div style={{ padding: "20px", maxWidth: "800px", margin: "0 auto", paddingBottom: 100 }}>
      
      <button onClick={() => navigate("/refiller")} style={btnBack}>← Dashboard</button>
      
      <div style={headerCard}>
        <h1 style={{ margin: 0 }}>{machine.name}</h1>
        <p style={{ color: "#666" }}>{machine.id}</p>
        <div style={{ marginTop: 10 }}>Status: <strong>{machine.status}</strong></div>
      </div>

      {/* PHASE 1: PREPARATION */}
      {!isRefilling && machine.status !== "issue_reported" && (
        <div style={section}>
          <h3>1. Warehouse Prep</h3>
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

      {/* PHASE 2: EXECUTION */}
      {!isRefilling && (
        <div style={section}>
          <h3>2. At Machine</h3>
          <div style={actionRow}>
            <button 
              onClick={startRefill}
              style={machine.kitStatus === "prepared" ? btnGreen : btnLocked}
              disabled={machine.kitStatus !== "prepared"}
            >
              🚀 Start Refill Timer
            </button>
            <button onClick={() => navigate(`/refiller/machines/${machineId}/slots`)} style={btnSecondary}>
              📊 Edit Slots
            </button>
          </div>
        </div>
      )}

      {/* PHASE 3: ACTIVE */}
      {isRefilling && (
        <div style={activeRefillBox}>
          <h2>🔥 Refill Active</h2>
          <label style={{display:'flex', gap:10, padding:10}}>
            <input type="checkbox" checked={checklistDone} onChange={e=>setChecklistDone(e.target.checked)}/>
            All slots filled
          </label>
          <button onClick={completeRefill} style={btnFinish}>Finish</button>
        </div>
      )}
    </div>
  );
}

// Styles
const headerCard = { background: "#fff", padding: 20, borderRadius: 12, boxShadow: "0 2px 5px rgba(0,0,0,0.05)", marginBottom: 20 };
const section = { marginBottom: 25 };
const actionRow = { display: "flex", gap: 10 };
const activeRefillBox = { background: "#ffe0b2", padding: 20, borderRadius: 12, border: "2px solid #ffb74d" };
const btnBack = { border: "none", background: "none", color: "#1976d2", cursor: "pointer", marginBottom: 15 };
const btnPrimary = { flex: 1, padding: 15, background: "#1976d2", color: "#fff", border: "none", borderRadius: 8, fontWeight: "bold", cursor: "pointer" };
const btnSecondary = { flex: 1, padding: 15, background: "#546e7a", color: "#fff", border: "none", borderRadius: 8, fontWeight: "bold", cursor: "pointer" };
const btnGreen = { flex: 1, padding: 15, background: "#2e7d32", color: "#fff", border: "none", borderRadius: 8, fontWeight: "bold", cursor: "pointer" };
const btnFinish = { width: "100%", padding: 15, background: "#d84315", color: "#fff", border: "none", borderRadius: 8, fontWeight: "bold", cursor: "pointer", marginTop: 10 };
const btnDisabled = { flex: 1, padding: 15, background: "#e0e0e0", color: "#999", border: "none", borderRadius: 8, cursor: "not-allowed" };
const btnLocked = { flex: 1, padding: 15, background: "#eceff1", color: "#b0bec5", border: "1px dashed #cfd8dc", borderRadius: 8, cursor: "not-allowed" };