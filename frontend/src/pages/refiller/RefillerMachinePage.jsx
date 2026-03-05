import React, { useEffect, useState } from "react";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  increment
} from "firebase/firestore";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../../firebaseClient";
import { useAdmin } from "../../contexts/AdminContext";
import axios from "axios";
import { generateKitPDF, generateBulkReportPDF } from "../../utils/pdfGenerator";

export default function RefillerMachinePage() {
  const { machineId } = useParams();
  const navigate = useNavigate();
  const { user } = useAdmin();

  const [machine, setMachine] = useState(null);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isRefilling, setIsRefilling] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [auditCounts, setAuditCounts] = useState({});

  const [activeKitData, setActiveKitData] = useState(null);

  const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5001/api";

  useEffect(() => {
    if (!machineId) return;
    setLoading(true);

    const unsubMachine = onSnapshot(doc(db, "machines", machineId), async (mSnap) => {
      if (!mSnap.exists()) {
        navigate("/refiller");
        return;
      }
      const mData = { id: mSnap.id, ...mSnap.data() };
      setMachine(mData);

      if (mData.activeKitId && mData.kitStatus === "pending_acceptance") {
        const kitSnap = await getDoc(doc(db, "kits", mData.activeKitId));
        if (kitSnap.exists()) setActiveKitData({ id: kitSnap.id, ...kitSnap.data() });
      } else {
        setActiveKitData(null);
      }
    });

    const unsubSlots = onSnapshot(
      collection(db, "machines", machineId, "slots"),
      (snap) => {
        setSlots(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      }
    );

    return () => {
      unsubMachine();
      unsubSlots();
    };
  }, [machineId, navigate]);

  function traysFromSlots() {
    const set = new Set();
    slots.forEach((s) => {
      if (s.tray != null) set.add(s.tray);
    });
    return Array.from(set).sort((a, b) => a - b);
  }

  function slotsForTray(tray) {
    return slots
      .filter((s) => s.tray === tray && !s.merged_into)
      .sort((a, b) => (a.slot_number || 0) - (b.slot_number || 0));
  }

  function groupForRootSlot(rootSlot) {
    return [rootSlot, ...slots.filter((s) => s.merged_into === rootSlot.id)];
  }

  // 🟢 UPDATED: Math changed to display 0-9 format (110-119 instead of 111-120)
  function displayCodeRange(rootSlot) {
    const group = groupForRootSlot(rootSlot);
    const codes = group.map(
      (s) => 110 + (Number(s.tray) - 1) * 10 + (Number(s.slot_number) - 1)
    );
    return group.length === 1
      ? String(codes[0])
      : `${Math.min(...codes)}-${Math.max(...codes)}`;
  }

  async function handleAcceptKit() {
    if (!window.confirm("Accept this kit? Items will be deducted from warehouse."))
      return;

    setSaving(true);
    try {
      const batch = writeBatch(db);

      activeKitData.products.forEach((p) => {
        if (!p.productId) return;

        const prodRef = doc(db, "products", p.productId);
        batch.update(prodRef, {
          warehouseStock: increment(-p.requiredQty),
        });

        const movRef = doc(collection(db, "warehouse_movements"));
        batch.set(movRef, {
          type: "OUTWARD_KIT",
          productId: p.productId,
          productName: p.name,
          quantity: p.requiredQty,
          referenceId: activeKitData.id,
          orgId: machine.orgId,
          performedBy: user.email,
          createdAt: serverTimestamp(),
        });
      });

      batch.update(doc(db, "kits", activeKitData.id), {
        status: "issued",
        acceptedAt: serverTimestamp(),
        acceptedBy: user.email,
      });

      batch.update(doc(db, "machines", machineId), {
        kitStatus: "issued",
        updatedAt: serverTimestamp(),
      });

      await batch.commit();
      alert("✅ Kit Accepted!");
    } catch {
      alert("Failed to accept kit.");
    } finally {
      setSaving(false);
    }
  }

  function startRefill() {
    setIsRefilling(true);
    updateDoc(doc(db, "machines", machineId), {
      status: "refill_in_progress",
      lastRefillStartedAt: serverTimestamp(),
    });
  }

  const handleSlotQtyChange = (slot, newVal) => {
    let parsedVal = newVal === "" ? "" : Number(newVal);

    if (typeof parsedVal === "number" && parsedVal < 0) {
      parsedVal = 0;
    }

    const cap = Number(slot.capacity) || 0;
    if (typeof parsedVal === "number" && parsedVal > cap) {
      parsedVal = cap;
    }

    setAuditCounts((prev) => ({ ...prev, [slot.id]: parsedVal }));
  };

  async function completeRefill() {
    setSaving(true);
    try {
      const activeSlots = slots.filter((s) => !s.merged_into);

      const syncTasks = activeSlots.map((s) => {
        const finalQty =
          auditCounts[s.id] !== undefined
            ? auditCounts[s.id]
            : s.current_qty || 0;

        return updateDoc(
          doc(db, "machines", machineId, "slots", s.id),
          {
            current_qty: finalQty,
            updatedAt: serverTimestamp(),
          }
        );
      });

      await Promise.all(syncTasks);

      const response = await axios.post(`${API_URL}/confirm-refill`, {
        machineId,
        orgId: machine.orgId,
        refillerId: user.uid,
        userEmail: user.email,
        kitId: machine.activeKitId || null,
        products: activeSlots.map((s) => {
          const finalQty =
            auditCounts[s.id] !== undefined
              ? auditCounts[s.id]
              : s.current_qty || 0;
          return {
            name: s.product_name,
            qty: finalQty,
            slot: displayCodeRange(s),
          };
        }),
      });

      if (response.data.ok) {
        setSuccessData({ date: new Date().toLocaleString() });
      }
    } catch {
      alert("Error confirming refill. Ensure backend is live.");
    } finally {
      setSaving(false);
    }
  }

  const downloadRefillSummary = () => {
    const cols = ["Slot", "Product Item", "Final Machine Qty"];
    const rows = slots
      .filter((s) => !s.merged_into)
      .map((s) => {
        const finalQty =
          auditCounts[s.id] !== undefined
            ? auditCounts[s.id]
            : s.current_qty || 0;
        return [displayCodeRange(s), s.product_name || "Empty", finalQty];
      });

    generateBulkReportPDF(
      `Refill_Summary_${machine.name}`,
      cols,
      rows,
      machine.orgId
    );
  };

  if (loading)
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        Syncing Machine Layout...
      </div>
    );

  const trays = traysFromSlots();

  if (successData)
    return (
      <div style={{ padding: "20px", maxWidth: "600px", margin: "40px auto" }}>
        <div style={successCard}>
          <h1 style={{ fontSize: 50 }}>✅</h1>
          <h2 style={{ color: "#2e7d32" }}>Refill Successfully Synced</h2>
          <button onClick={downloadRefillSummary} style={btnSecondary}>
            📥 Download PDF Summary
          </button>
          <button
            onClick={() => navigate("/refiller")}
            style={btnPrimary}
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );

  return (
    <div style={{ padding: 20, maxWidth: 900, margin: "0 auto", paddingBottom: 100 }}>
      <button onClick={() => navigate("/refiller")} style={btnBack}>← Back to Route</button>
      
      <div style={headerCard}>
        <h1 style={{ margin: 0 }}>{machine.name}</h1>
        <div style={{ marginTop: 10 }}>Status: <strong style={{ color: "#1976d2" }}>{machine.status?.toUpperCase().replace("_", " ")}</strong></div>
      </div>

      {!isRefilling ? (
        <>
          <div style={section}>
            <h3>1. Preparation & Acceptance</h3>
            {machine.kitStatus === "pending_acceptance" && activeKitData ? (
              <div style={kitContainer}>
                 <div style={kitHeader}>
                    <div>
                        <h4 style={{margin: "0 0 5px 0", color: "#b45309"}}>📦 Kit Sent from Admin</h4>
                        <div style={{fontSize: 12, color: "#92400e"}}>Total Items: {activeKitData.products.length}</div>
                    </div>
                    <button onClick={() => generateKitPDF(activeKitData)} style={btnManifest}>📥 Download Manifest</button>
                 </div>
                 <div style={{padding: 15, maxHeight: 200, overflowY: "auto"}}>
                    <table style={kitTable}>
                        <thead>
                            <tr style={{color: '#64748b', borderBottom: '1px solid #e2e8f0'}}>
                                <th style={{paddingBottom: 8}}>Slot</th>
                                <th style={{paddingBottom: 8}}>Product</th>
                                <th style={{paddingBottom: 8}}>Qty</th>
                            </tr>
                        </thead>
                        <tbody>
                            {activeKitData.products.map((p, i) => (
                                <tr key={i} style={{borderBottom: '1px solid #f1f5f9'}}>
                                    <td style={{padding: "8px 0"}}><b>{p.slotId}</b></td>
                                    <td style={{padding: "8px 0"}}>{p.name}</td>
                                    <td style={{padding: "8px 0", color: "#16a34a", fontWeight: "bold"}}>{p.requiredQty}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                 </div>
                 <div style={kitFooter}>
                     <button onClick={handleAcceptKit} disabled={saving} style={{...btnPrimary, background: "#f59e0b"}}>
                        {saving ? "Processing..." : "✔️ Accept Kit & Deduct Stock"}
                     </button>
                 </div>
              </div>
            ) : machine.kitStatus === "issued" ? (
               <div style={kitSuccess}>✅ Kit Accepted. Proceed to Refill.</div>
            ) : (
               <div style={kitWaiting}>⏳ Waiting for Admin Kit.</div>
            )}
          </div>

          <div style={section}>
            <h3>2. Physical Refill</h3>
            <div style={actionRow}>
              <button onClick={startRefill} style={machine.kitStatus === "issued" ? btnGreen : btnLocked} disabled={machine.kitStatus !== "issued"}>
                🚀 Start Physical Refill Grid
              </button>
              <button onClick={() => navigate(`/refiller/machines/${machineId}/report-issue`)} style={btnDanger}>⚠️ Report Issue</button>
            </div>
          </div>
        </>
      ) : (
        <div style={activeRefillBox}>
           <h2 style={{ marginTop: 0, color: "#d84315" }}>🛠️ Live Machine Audit</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {trays.map((tray) => {
              const traySlots = slotsForTray(tray);
              return (
                <div key={tray} style={trayRow}>
                  <div style={trayLeft}><div style={trayLabel}>Tray {tray}</div></div>
                  <div style={slotsRow}>
                    {traySlots.map((slot) => {
                      const isMerged = groupForRootSlot(slot).length > 1;
                      const currentQtyVal = auditCounts[slot.id] !== undefined ? auditCounts[slot.id] : (slot.current_qty || 0);
                      return (
                        <div key={slot.id} style={{...slotItem, border: isMerged ? "2px solid #3b82f6" : "1px solid #e2e8f0"}}>
                          <div style={{fontWeight:'bold', fontSize: 15}}>{displayCodeRange(slot)}</div>
                          <div style={prodText}>{slot.product_name || "Empty"}</div>
                          
                          <input 
                            type="number" 
                            min="0" 
                            max={slot.capacity || 0}
                            value={currentQtyVal} 
                            onChange={(e) => handleSlotQtyChange(slot, e.target.value)} 
                            onFocus={(e) => e.target.select()}
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
          <button onClick={completeRefill} disabled={saving} style={btnFinish}>{saving ? "Updating..." : "🏁 Complete Refill & Sync"}</button>
        </div>
      )}
    </div>
  );
}

// STYLES
const headerCard = { background: "#fff", padding: 25, borderRadius: 12, border: "1px solid #e2e8f0", marginBottom: 20 };
const section = { marginBottom: 25, background: "#fff", padding: 25, borderRadius: 12, border: "1px solid #e2e8f0" };
const actionRow = { display: "flex", gap: 10 };
const activeRefillBox = { background: "#fff", padding: 25, borderRadius: 12, border: "2px solid #fbbf24" };
const btnBack = { border: "none", background: "none", color: "#3b82f6", cursor: "pointer", marginBottom: 15, fontWeight: "bold" };
const btnPrimary = { width: '100%', padding: 15, background: "#1976d2", color: "#fff", border: "none", borderRadius: 8, fontWeight: "bold", cursor: "pointer", marginBottom: 10 };
const btnSecondary = { width: '100%', padding: 15, background: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1", borderRadius: 8, fontWeight: "bold", cursor: "pointer", marginBottom: 10 };
const btnDanger = { flex: 1, padding: 15, background: "#ef4444", color: "#fff", border: "none", borderRadius: 8, fontWeight: "bold", cursor: "pointer" };
const btnGreen = { flex: 2, padding: 15, background: "#10b981", color: "#fff", border: "none", borderRadius: 8, fontWeight: "bold", cursor: "pointer" };
const btnFinish = { width: "100%", padding: 20, background: "#d84315", color: "#fff", border: "none", borderRadius: 8, fontWeight: "bold", cursor: "pointer", fontSize: 18, marginTop: 20 };
const btnLocked = { flex: 2, padding: 15, background: "#f1f5f9", color: "#94a3b8", border: "1px dashed #cbd5e1", borderRadius: 8, cursor: "not-allowed" };
const trayRow = { background: "#f8fafc", padding: 15, borderRadius: 12, border: "1px solid #e2e8f0", display: "flex", gap: 15, alignItems: "center", overflowX: "auto" };
const trayLeft = { minWidth: 60 };
const trayLabel = { fontWeight: 800, fontSize: 15, color: "#475569" };
const slotsRow = { display: "flex", flexWrap: "wrap", gap: 10 };
const slotItem = { padding: 12, background: "#fff", borderRadius: 10, textAlign: 'center', width: 100 };
const inputSmall = { width: "80%", padding: "8px", borderRadius: 6, border: "1px solid #3b82f6", textAlign: 'center', fontWeight: 'bold', fontSize: 18, outline: 'none', marginTop: 5 };
const prodText = { fontSize: 11, color: '#475569', margin: '4px 0', height: 28, overflow:'hidden', lineHeight: '1.2' };
const successCard = { background: "#e8f5e9", padding: "40px", borderRadius: "16px", border: "2px solid #4caf50" };
const kitContainer = {background: "#fff", border: "2px solid #fcd34d", borderRadius: 8, overflow: 'hidden', marginBottom: 15};
const kitHeader = {background: "#fffbeb", padding: 15, display: 'flex', justifyContent: 'space-between', alignItems: 'center'};
const btnManifest = {background: "#b45309", color: "#fff", border: "none", padding: "8px 12px", borderRadius: 6, fontWeight: "bold", fontSize: 12, cursor: "pointer"};
const kitTable = {width: '100%', fontSize: 13, textAlign: 'left', borderCollapse: 'collapse'};
const kitFooter = {padding: 15, borderTop: "1px solid #e2e8f0", background: "#f8fafc"};
const kitSuccess = {padding: 15, background: "#dcfce7", color: "#166534", borderRadius: 8, fontWeight: "bold"};
const kitWaiting = {padding: 15, background: "#f1f5f9", color: "#64748b", borderRadius: 8};