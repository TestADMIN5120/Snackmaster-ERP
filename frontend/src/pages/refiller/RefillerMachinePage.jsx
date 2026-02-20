import React, { useEffect, useState } from "react";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
  serverTimestamp
} from "firebase/firestore";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../../firebaseClient";
import { useAdmin } from "../../contexts/AdminContext";
import axios from "axios";
import { generateBulkReportPDF } from "../../utils/pdfGenerator";

export default function RefillerMachinePage() {
  const { machineId } = useParams();
  const navigate = useNavigate();
  const { user } = useAdmin();

  const [machine, setMachine] = useState(null);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // UX State Controls
  const [isRefilling, setIsRefilling] = useState(false); // 🟢 FIXED: Defined this state
  const [saving, setSaving] = useState(false);
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

      const snapSlots = await getDocs(collection(db, "machines", machineId, "slots"));
      const sList = snapSlots.docs.map(d => ({ id: d.id, ...d.data() }));
      sList.sort((a, b) => (Number(a.tray) * 10 + Number(a.slot_number)) - (Number(b.tray) * 10 + Number(b.slot_number)));
      setSlots(sList);
    } catch (err) {
      console.error("Error loading machine data:", err);
    } finally {
      setLoading(false);
    }
  }

  function startRefill() {
    setIsRefilling(true); // 🟢 Triggers the Grid View
    updateDoc(doc(db, "machines", machineId), {
      status: "refill_in_progress",
      lastRefillStartedAt: serverTimestamp()
    });
  }

  const handleSlotQtyChange = (id, newVal) => {
    setSlots(prev => prev.map(s => s.id === id ? { ...s, current_qty: Number(newVal) } : s));
  };

  async function completeRefill() {
    setSaving(true);
    try {
      // 🟢 FIXED URL: Ensures we don't get /api/api/
      const rawUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:5001";
      const backendUrl = rawUrl.replace(/\/api$/, ""); // Remove /api if it exists at the end
      
      // 1. Sync slot counts to Firestore (Updates Admin Panel instantly)
      const syncTasks = slots.map(s => 
        updateDoc(doc(db, "machines", machineId, "slots", s.id), {
          current_qty: s.current_qty,
          updatedAt: serverTimestamp()
        })
      );
      await Promise.all(syncTasks);

      // 2. Trigger Backend logic
      const response = await axios.post(`${backendUrl}/api/confirm-refill`, {
        machineId,
        orgId: machine.orgId, 
        refillerId: user.uid,
        userEmail: user.email,
        kitId: machine.activeKitId || null,
        products: slots.map(s => ({ 
            name: s.product_name, 
            qty: s.current_qty, 
            slot: `${s.tray}${s.slot_number}` 
        })) 
      });

      if (response.data.ok) {
        setSuccessData({ date: new Date().toLocaleString() });
      }

    } catch (err) {
      console.error("Refill processing error:", err);
      alert("Error confirming refill. Please ensure the Backend is running on port 5001.");
    } finally {
      setSaving(false);
    }
  }

  const downloadRefillSummary = () => {
    const cols = ["Slot", "Product Item", "Final Machine Qty"];
    const rows = slots.map(s => [`${s.tray}${s.slot_number}`, s.product_name || "Empty", s.current_qty]);
    generateBulkReportPDF(`Refill_Summary_${machine.name}`, cols, rows, machine.orgId);
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Syncing Machine Layout...</div>;
  
  if (successData) {
    return (
      <div style={{ padding: "20px", maxWidth: "600px", margin: "40px auto", textAlign: "center" }}>
        <div style={successCard}>
          <h1 style={{ fontSize: "50px", margin: "0" }}>✅</h1>
          <h2 style={{ color: "#2e7d32" }}>Refill Successfully Synced</h2>
          <div style={{display:'flex', gap: 12, flexDirection: 'column', marginTop: 20}}>
            <button onClick={downloadRefillSummary} style={btnSecondary}>📥 Download PDF Summary</button>
            <button onClick={() => navigate("/refiller")} style={btnPrimary}>Return to Dashboard</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px", maxWidth: "900px", margin: "0 auto", paddingBottom: 100 }}>
      <button onClick={() => navigate("/refiller")} style={btnBack}>← Back to Route</button>
      
      <div style={headerCard}>
        <h1 style={{ margin: 0 }}>{machine.name}</h1>
        <div style={{ marginTop: 10 }}>Status: <strong style={{ color: "#1976d2" }}>{machine.status?.toUpperCase()}</strong></div>
      </div>

      {!isRefilling ? (
        <>
          <div style={section}>
            <h3>1. Preparation</h3>
            <button onClick={() => navigate(`/refiller/machines/${machineId}/make-kit`)} style={machine.activeKitId ? btnDisabled : btnPrimary} disabled={!!machine.activeKitId}>
              {machine.activeKitId ? "✅ Warehouse Kit Prepared" : "📦 Auto-Generate Kit (CSV)"}
            </button>
          </div>

          <div style={section}>
            <h3>2. Physical Refill</h3>
            <div style={actionRow}>
              <button onClick={startRefill} style={machine.kitStatus === "issued" ? btnGreen : btnLocked} disabled={machine.kitStatus !== "issued"}>
                🚀 Start Physical Refill Grid
              </button>
              <button onClick={() => navigate(`/refiller/machines/${machineId}/report-issue`)} style={btnDanger}>⚠️ Report Issue</button>
            </div>
            {machine.kitStatus !== "issued" && <p style={{color: '#ef4444', fontSize: 13, marginTop: 10, fontWeight:'bold'}}>LOCKED: Admin must "Issue Kit" from Warehouse first.</p>}
          </div>
        </>
      ) : (
        <div style={activeRefillBox}>
          <h2 style={{ marginTop: 0, color: "#d84315" }}>🛠️ Live Machine Audit</h2>
          <p style={{ color: "#64748b", marginBottom: 20 }}>Update final quantity for each slot.</p>
          <div style={slotGrid}>
            {slots.map(s => (
              <div key={s.id} style={slotItem}>
                <div style={{fontWeight:'bold'}}>Slot {s.tray}{s.slot_number}</div>
                <div style={prodText}>{s.product_name || "Empty"}</div>
                <input type="number" value={s.current_qty} onChange={e => handleSlotQtyChange(s.id, e.target.value)} style={inputSmall} />
                <div style={{fontSize: 10, color: '#94a3b8', marginTop: 5}}>Cap: {s.capacity}</div>
              </div>
            ))}
          </div>
          <button onClick={completeRefill} disabled={saving} style={btnFinish}>{saving ? "Updating Inventory..." : "🏁 Complete Refill & Sync"}</button>
        </div>
      )}
    </div>
  );
}

// Styles
const headerCard = { background: "#fff", padding: 25, borderRadius: 12, border: "1px solid #e2e8f0", marginBottom: 20 };
const section = { marginBottom: 25, background: "#fff", padding: 25, borderRadius: 12, border: "1px solid #e2e8f0" };
const actionRow = { display: "flex", gap: 10 };
const activeRefillBox = { background: "#fff", padding: 25, borderRadius: 12, border: "2px solid #fbbf24", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)" };
const btnBack = { border: "none", background: "none", color: "#3b82f6", cursor: "pointer", marginBottom: 15, fontWeight: "bold" };
const btnPrimary = { width: '100%', padding: 15, background: "#1976d2", color: "#fff", border: "none", borderRadius: 8, fontWeight: "bold", cursor: "pointer" };
const btnSecondary = { width: '100%', padding: 15, background: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1", borderRadius: 8, fontWeight: "bold", cursor: "pointer" };
const btnDanger = { flex: 1, padding: 15, background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, fontWeight: "bold", cursor: "pointer" };
const btnGreen = { flex: 2, padding: 15, background: "#10b981", color: "#fff", border: "none", borderRadius: 8, fontWeight: "bold", cursor: "pointer" };
const btnFinish = { width: "100%", padding: 20, background: "#d84315", color: "#fff", border: "none", borderRadius: 8, fontWeight: "bold", cursor: "pointer", fontSize: 18, marginTop: 20 };
const btnDisabled = { width: '100%', padding: 15, background: "#e2e8f0", color: "#64748b", borderRadius: 8, cursor: "not-allowed" };
const btnLocked = { flex: 2, padding: 15, background: "#f1f5f9", color: "#94a3b8", border: "1px dashed #cbd5e1", borderRadius: 8, cursor: "not-allowed" };
const slotGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 12 };
const slotItem = { padding: 12, background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0", textAlign: 'center' };
const inputSmall = { width: "70%", padding: "8px", borderRadius: 6, border: "1px solid #3b82f6", textAlign: 'center', fontWeight: 'bold', fontSize: 18, outline: 'none' };
const prodText = { fontSize: 12, color: '#475569', margin: '6px 0', height: 32, overflow:'hidden', lineHeight: '1.2' };
const successCard = { background: "#e8f5e9", padding: "40px", borderRadius: "16px", border: "2px solid #4caf50" };