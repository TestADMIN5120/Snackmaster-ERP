import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, onSnapshot, collection, updateDoc, serverTimestamp, query } from "firebase/firestore";
import { db } from "../../firebaseClient";
import { useAdmin } from "../../contexts/AdminContext";

export default function RefillerMachineSlots() {
  const { machineId } = useParams();
  const nav = useNavigate();
  const { orgId } = useAdmin();

  const [machine, setMachine] = useState(null);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingSlot, setEditingSlot] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!machineId || !orgId) return;

    const unsubMachine = onSnapshot(doc(db, "machines", machineId), (doc) => {
      if (doc.exists()) setMachine({ id: doc.id, ...doc.data() });
    });

    const q = query(collection(db, "machines", machineId, "slots"));
    const unsubSlots = onSnapshot(q, (snap) => {
      const sList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setSlots(sList);
      setLoading(false);
    });

    return () => { unsubMachine(); unsubSlots(); };
  }, [machineId, orgId]);

  const traysFromSlots = () => {
    const set = new Set();
    slots.forEach((s) => { if (s.tray != null) set.add(s.tray); });
    return Array.from(set).sort((a, b) => a - b);
  };

  const slotsForTray = (tray) => {
    return slots.filter((s) => s.tray === tray && !s.merged_into).sort((a, b) => (a.slot_number || 0) - (b.slot_number || 0));
  };

  const groupForRootSlot = (rootSlot) => {
    const children = slots.filter((s) => s.merged_into === rootSlot.id);
    return [rootSlot, ...children];
  };

  // 🟢 UPDATED: Math changed to display 0-9 format (110-119 instead of 111-120)
  const displayCodeRange = (rootSlot) => {
    const group = groupForRootSlot(rootSlot);
    const codes = group.map((s) => 110 + (Number(s.tray) - 1) * 10 + (Number(s.slot_number) - 1));
    return group.length === 1 ? String(codes[0]) : `${Math.min(...codes)}-${Math.max(...codes)}`;
  };

  async function updateStock() {
    if (!editingSlot) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "machines", machineId, "slots", editingSlot.id), {
        current_qty: Math.max(0, Number(editingSlot.current_qty) || 0), // 🟢 Ensure no negative saves
        updatedAt: serverTimestamp(),
      });
      setEditingSlot(null);
    } catch (e) {
      alert("Error syncing count.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div style={{ padding: 24 }}>Connecting to Machine Live Feed...</div>;

  return (
    <div style={{ padding: 24 }}>
      <button onClick={() => nav(-1)} style={btnBack}>← Back</button>
      <h2 style={{color: '#1e293b'}}>Inventory: {machine?.name}</h2>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {traysFromSlots().map((tray) => (
          <div key={tray} style={trayRow}>
            <div style={trayLabel}>Tray {tray}</div>
            <div style={slotsRow}>
              {slotsForTray(tray).map((slot) => {
                const isMerged = groupForRootSlot(slot).length > 1;
                return (
                  <div key={slot.id} style={{...slotPill, border: isMerged ? "2px solid #3b82f6" : "1px solid #ddd"}} onClick={() => setEditingSlot(slot)}>
                    <div style={{ fontWeight: "bold", fontSize: 16 }}>{displayCodeRange(slot)}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>{slot.product_name || "Empty"}</div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>{slot.current_qty || 0} / {slot.capacity || 0}</div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {editingSlot && (
        <div style={modalBackdrop}>
          <div style={modalBox}>
            <h3 style={{marginTop: 0}}>Refill Slot {displayCodeRange(editingSlot)}</h3>
            <p style={{fontSize: 14}}>Product: <b>{editingSlot.product_name}</b></p>
            <div style={{marginTop: 15}}>
              <label style={{display:'block', marginBottom: 5, fontSize: 12, fontWeight: 'bold'}}>Current Physical Count</label>
              <input 
                type="number" 
                min="0"
                style={inputStyle} 
                value={editingSlot.current_qty} 
                // 🟢 Prevent negative entry
                onChange={e => {
                  let val = Number(e.target.value);
                  if (val < 0) val = 0;
                  setEditingSlot({...editingSlot, current_qty: val})
                }} 
              />
            </div>
            <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => setEditingSlot(null)} style={btnCancel}>Cancel</button>
              <button onClick={updateStock} disabled={saving} style={btnSave}>{saving ? "Saving..." : "Update Machine"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const btnBack = { background: "#f1f5f9", border: "none", padding: "8px 16px", borderRadius: 8, cursor: "pointer", marginBottom: 20, fontWeight: 'bold' };
const trayRow = { background: "#fff", padding: 20, borderRadius: 12, border: "1px solid #e2e8f0", display:'flex', gap: 20, alignItems: 'center' };
const trayLabel = { fontWeight: "800", minWidth: 60, fontSize: 14, color: '#64748b' };
const slotsRow = { display: "flex", flexWrap: "wrap", gap: 12 };
const slotPill = { padding: "12px", borderRadius: 10, minWidth: 100, textAlign: "center", cursor: "pointer", background: "#f8fafc", transition: '0.2s' };
const modalBackdrop = { position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 };
const modalBox = { background: "#fff", padding: 24, borderRadius: 16, width: 350, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' };
const inputStyle = { width: "100%", padding: 12, borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 16 };
const btnCancel = { padding: "10px 16px", background: "#f1f5f9", color: "#475569", border: "none", borderRadius: 8, fontWeight: 'bold' };
const btnSave = { padding: "10px 16px", background: "#10b981", color: "#fff", border: "none", borderRadius: 8, fontWeight: 'bold' };