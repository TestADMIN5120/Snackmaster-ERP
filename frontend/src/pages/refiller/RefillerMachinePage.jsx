import React, { useEffect, useState } from "react";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  onSnapshot, // 🟢 Added for real-time Mirroring
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
  const [isRefilling, setIsRefilling] = useState(false); 
  const [saving, setSaving] = useState(false);
  const [successData, setSuccessData] = useState(null);

  // 🟢 NEW: Stores Refiller's typed quantities locally during the live audit
  const [auditCounts, setAuditCounts] = useState({});

  useEffect(() => {
    if (!machineId) return;

    setLoading(true);

    // 🟢 REAL-TIME LISTENER: Machine Document
    const unsubMachine = onSnapshot(doc(db, "machines", machineId), (mSnap) => {
      if (!mSnap.exists()) {
        alert("Machine not found");
        navigate("/refiller");
        return;
      }
      setMachine({ id: mSnap.id, ...mSnap.data() });
    });

    // 🟢 REAL-TIME LISTENER: Slots Collection (Mirroring Admin Changes Live)
    const unsubSlots = onSnapshot(collection(db, "machines", machineId, "slots"), (snap) => {
      const sList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setSlots(sList);
      setLoading(false);
    });

    return () => {
      unsubMachine();
      unsubSlots();
    };
  }, [machineId, navigate]);

  // --- ADMIN MIRROR LOGIC FOR TRAYS & MERGES ---
  function traysFromSlots() {
    const set = new Set();
    slots.forEach((s) => { if (s.tray != null) set.add(s.tray); });
    return Array.from(set).sort((a, b) => a - b);
  }

  function slotsForTray(tray) {
    return slots.filter((s) => s.tray === tray && !s.merged_into).sort((a, b) => (a.slot_number || 0) - (b.slot_number || 0));
  }

  function groupForRootSlot(rootSlot) {
    const children = slots.filter((s) => s.merged_into === rootSlot.id);
    return [rootSlot, ...children];
  }

  function displayCodeRange(rootSlot) {
    const group = groupForRootSlot(rootSlot);
    const codes = group.map((s) => 110 + (Number(s.tray) - 1) * 10 + Number(s.slot_number));
    return group.length === 1 ? String(codes[0]) : `${Math.min(...codes)}-${Math.max(...codes)}`;
  }

  // --- ACTIONS ---

  function startRefill() {
    setIsRefilling(true);
    updateDoc(doc(db, "machines", machineId), {
      status: "refill_in_progress",
      lastRefillStartedAt: serverTimestamp()
    });
  }

  const handleSlotQtyChange = (id, newVal) => {
    // 🟢 Save to local audit state so real-time updates don't wipe out typing
    setAuditCounts(prev => ({ ...prev, [id]: Number(newVal) }));
  };

  async function completeRefill() {
    setSaving(true);
    try {
      const rawUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:5001";
      const backendUrl = rawUrl.replace(/\/api$/, ""); 
      
      // 1. Sync slot counts back to Firestore based on Audit Data
      const activeSlots = slots.filter(s => !s.merged_into);
      
      const syncTasks = activeSlots.map(s => {
        const finalQty = auditCounts[s.id] !== undefined ? auditCounts[s.id] : (s.current_qty || 0);
        return updateDoc(doc(db, "machines", machineId, "slots", s.id), {
          current_qty: finalQty,
          updatedAt: serverTimestamp()
        });
      });
      await Promise.all(syncTasks);

      // 2. Trigger Backend logic for Inventory logging
      const response = await axios.post(`${backendUrl}/api/confirm-refill`, {
        machineId,
        orgId: machine.orgId, 
        refillerId: user.uid,
        userEmail: user.email,
        kitId: machine.activeKitId || null,
        products: activeSlots.map(s => {
            const finalQty = auditCounts[s.id] !== undefined ? auditCounts[s.id] : (s.current_qty || 0);
            return { 
                name: s.product_name, 
                qty: finalQty, 
                slot: displayCodeRange(s) 
            };
        }) 
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
    const rows = slots.filter(s => !s.merged_into).map(s => {
      const finalQty = auditCounts[s.id] !== undefined ? auditCounts[s.id] : (s.current_qty || 0);
      return [displayCodeRange(s), s.product_name || "Empty", finalQty];
    });
    generateBulkReportPDF(`Refill_Summary_${machine.name}`, cols, rows, machine.orgId);
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Syncing Machine Layout...</div>;
  
  const trays = traysFromSlots();

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
        <div style={{ marginTop: 10 }}>Status: <strong style={{ color: "#1976d2" }}>{machine.status?.toUpperCase().replace("_", " ")}</strong></div>
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
          <p style={{ color: "#64748b", marginBottom: 20 }}>Update final quantity for each slot. Mirrors Admin layout exactly.</p>
          
          {/* 🟢 EXACT ADMIN TRAY MIRROR VIEW */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {trays.map((tray) => {
              const traySlots = slotsForTray(tray);
              return (
                <div key={tray} style={trayRow}>
                  <div style={trayLeft}>
                    <div style={trayLabel}>Tray {tray}</div>
                  </div>
                  <div style={slotsRow}>
                    {traySlots.map((slot) => {
                      const isMerged = groupForRootSlot(slot).length > 1;
                      const label = displayCodeRange(slot);
                      // Fallback to slot.current_qty if Refiller hasn't typed anything yet
                      const currentQtyVal = auditCounts[slot.id] !== undefined ? auditCounts[slot.id] : (slot.current_qty || 0);

                      return (
                        <div key={slot.id} style={{...slotItem, border: isMerged ? "2px solid #3b82f6" : "1px solid #e2e8f0"}}>
                          <div style={{fontWeight:'bold', fontSize: 15}}>{label}</div>
                          <div style={prodText}>{slot.product_name || "Empty"}</div>
                          
                          <input 
                            type="number" 
                            value={currentQtyVal} 
                            onChange={e => handleSlotQtyChange(slot.id, e.target.value)} 
                            style={inputSmall} 
                          />
                          
                          <div style={{fontSize: 10, color: '#94a3b8', marginTop: 5}}>Cap: {slot.capacity}</div>
                          {isMerged && <div style={{ fontSize: 10, color: "#3b82f6", marginTop: 2, fontWeight: "bold" }}>🔗 Merged</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <button onClick={completeRefill} disabled={saving} style={btnFinish}>{saving ? "Updating Inventory..." : "🏁 Complete Refill & Sync"}</button>
        </div>
      )}
    </div>
  );
}

// 🟢 STYLES - Updated to match Admin UI structure
const headerCard = { background: "#fff", padding: 25, borderRadius: 12, border: "1px solid #e2e8f0", marginBottom: 20 };
const section = { marginBottom: 25, background: "#fff", padding: 25, borderRadius: 12, border: "1px solid #e2e8f0" };
const actionRow = { display: "flex", gap: 10 };
const activeRefillBox = { background: "#fff", padding: 25, borderRadius: 12, border: "2px solid #fbbf24", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)" };
const btnBack = { border: "none", background: "none", color: "#3b82f6", cursor: "pointer", marginBottom: 15, fontWeight: "bold" };
const btnPrimary = { width: '100%', padding: 15, background: "#1976d2", color: "#fff", border: "none", borderRadius: 8, fontWeight: "bold", cursor: "pointer" };
const btnSecondary = { width: '100%', padding: 15, background: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1", borderRadius: 8, fontWeight: "bold", cursor: "pointer" };
const btnDanger = { flex: 1, padding: 15, background: "#ef4444", color: "#fff", border: "none", borderRadius: 8, fontWeight: "bold", cursor: "pointer" };
const btnGreen = { flex: 2, padding: 15, background: "#10b981", color: "#fff", border: "none", borderRadius: 8, fontWeight: "bold", cursor: "pointer" };
const btnFinish = { width: "100%", padding: 20, background: "#d84315", color: "#fff", border: "none", borderRadius: 8, fontWeight: "bold", cursor: "pointer", fontSize: 18, marginTop: 20 };
const btnDisabled = { width: '100%', padding: 15, background: "#e2e8f0", color: "#64748b", borderRadius: 8, cursor: "not-allowed" };
const btnLocked = { flex: 2, padding: 15, background: "#f1f5f9", color: "#94a3b8", border: "1px dashed #cbd5e1", borderRadius: 8, cursor: "not-allowed" };

// TRAY LAYOUT STYLES (Mirrors Admin)
const trayRow = { background: "#f8fafc", padding: 15, borderRadius: 12, border: "1px solid #e2e8f0", display: "flex", gap: 15, alignItems: "center" };
const trayLeft = { minWidth: 60, display: "flex", flexDirection: "column", gap: 8 };
const trayLabel = { fontWeight: 800, fontSize: 15, color: "#475569" };
const slotsRow = { display: "flex", flexWrap: "wrap", gap: 10 };
const slotItem = { padding: 12, background: "#fff", borderRadius: 10, textAlign: 'center', width: 100, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" };

const inputSmall = { width: "80%", padding: "8px", borderRadius: 6, border: "1px solid #3b82f6", textAlign: 'center', fontWeight: 'bold', fontSize: 18, outline: 'none', marginTop: 5 };
const prodText = { fontSize: 11, color: '#475569', margin: '4px 0', height: 28, overflow:'hidden', lineHeight: '1.2' };
const successCard = { background: "#e8f5e9", padding: "40px", borderRadius: "16px", border: "2px solid #4caf50" };