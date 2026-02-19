// frontend/src/pages/admin/AdminMachineSlots.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  updateDoc,
  serverTimestamp,
  deleteDoc,
  addDoc,
} from "firebase/firestore";
import { db } from "../../firebaseClient";
import { useAdmin } from "../../contexts/AdminContext"; // 🟢 SECURE

console.log("ACTIVE SLOT PAGE VERSION = FINAL BASE SECURE");

export default function AdminMachineSlots() {
  const { machineId } = useParams();
  const nav = useNavigate();
  const { orgId } = useAdmin(); // 🟢 SECURE

  const [machine, setMachine] = useState(null);
  const [slots, setSlots] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [editingSlot, setEditingSlot] = useState(null);
  const [savingSlot, setSavingSlot] = useState(false);
  const [mergeBusy, setMergeBusy] = useState(false);

  useEffect(() => {
    if (!machineId || !orgId) return;
    loadAll();
  }, [machineId, orgId]);

  async function loadAll() {
    setLoading(true);
    try {
      // 1) Load & Verify Machine Ownership
      const m = await getDoc(doc(db, "machines", machineId));
      if (!m.exists() || m.data().orgId !== orgId) {
          alert("Access Denied: Machine not found or does not belong to your organization.");
          nav("/admin/machines");
          return;
      }
      setMachine({ id: m.id, ...m.data() });

      // 2) slots
      const snapSlots = await getDocs(collection(db, "machines", machineId, "slots"));
      setSlots(snapSlots.docs.map((d) => ({ id: d.id, ...d.data() })));

      // 3) products (Assuming products are global for now)
      const snapProducts = await getDocs(collection(db, "products"));
      setProducts(snapProducts.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error("Failed to load machine/slots", e);
    } finally {
      setLoading(false);
    }
  }

  // ... [KEEP ALL YOUR EXISTING HELPER FUNCTIONS EXACTLY THE SAME] ...
  function traysFromSlots() {
    const set = new Set();
    slots.forEach((s) => { if (s.tray != null) set.add(s.tray); });
    return Array.from(set).sort((a, b) => a - b);
  }

  function slotsForTray(tray) {
    return slots.filter((s) => s.tray === tray && !s.merged_into).sort((a, b) => (a.slot_number || 0) - (b.slot_number || 0));
  }

  function displayCodeForSlot(slot) {
    if (!slot.tray || !slot.slot_number) return slot.id;
    const code = 110 + (Number(slot.tray) - 1) * 10 + Number(slot.slot_number);
    return String(code);
  }

  function groupForRootSlot(rootSlot) {
    const children = slots.filter((s) => s.merged_into === rootSlot.id);
    return [rootSlot, ...children];
  }

  function displayCodeRange(rootSlot) {
    const group = groupForRootSlot(rootSlot);
    if (group.length === 1) return displayCodeForSlot(rootSlot);
    const codes = group.map((s) => parseInt(displayCodeForSlot(s), 10));
    return `${Math.min(...codes)}-${Math.max(...codes)}`;
  }

  function labelForProduct(p) {
    return p.name ? `${p.name} ${p.sku ? `(${p.sku})` : ''}` : "Unnamed";
  }

  function getSelectedProductId(slot) {
    if (slot.product_id) return slot.product_id;
    if (slot.product_name) {
      const match = products.find((p) => p.name === slot.product_name);
      if (match) return match.id;
    }
    return "";
  }

  function openSlotEditor(slot) {
    setEditingSlot({
      ...slot,
      capacity: slot.capacity ?? "",
      current_qty: slot.current_qty ?? "",
      product_id: getSelectedProductId(slot),
    });
  }

  function closeSlotEditor() { setEditingSlot(null); }

  function handleEditingFieldChange(field, value) {
    setEditingSlot((prev) => prev ? {
        ...prev,
        [field]: (field === "capacity" || field === "current_qty") 
                 ? (value === "" ? "" : Number(value)) : value,
    } : prev);
  }

  // --- ACTIONS --- 
  // (These are exactly your logic, just kept safe inside the component)

  async function saveEditingSlot() {
    if (!editingSlot) return;
    setSavingSlot(true);
    try {
      const { id, tray, slot_number, capacity, current_qty, product_id } = editingSlot;
      const product = products.find((p) => p.id === product_id);

      await updateDoc(doc(db, "machines", machineId, "slots", id), {
        capacity: Number(capacity) || 0,
        current_qty: Number(current_qty) || 0,
        product_id: product ? product.id : product_id || null,
        product_name: product ? product.name : editingSlot.product_name || "",
        updatedAt: serverTimestamp(),
      });
      await loadAll();
      closeSlotEditor();
    } catch (e) { alert("Error updating slot"); } finally { setSavingSlot(false); }
  }

  async function deleteAllSlots(skipConfirm = false) {
    if (!skipConfirm && !window.confirm("Delete ALL slots?")) return;
    const snap = await getDocs(collection(db, "machines", machineId, "slots"));
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
    await loadAll();
  }

  async function regenerateSlotsPrompt() {
    if (!window.confirm("This will DELETE all existing slots. Continue?")) return;
    let traysNum = Number(window.prompt("Number of trays (1–7)?", "3"));
    let slotsNum = Number(window.prompt("Slots per tray (1–10)?", "10"));
    let defaultCap = Number(window.prompt("Default capacity per slot?", "10"));
    if (!traysNum || !slotsNum || !defaultCap) return alert("Invalid inputs.");

    try {
      await deleteAllSlots(true);
      const tasks = [];
      for (let t = 1; t <= traysNum; t++) {
        for (let s = 1; s <= slotsNum; s++) {
          tasks.push(addDoc(collection(db, "machines", machineId, "slots"), {
            tray: t, slot_number: s, capacity: defaultCap, current_qty: 0,
            product_id: null, product_name: "", merged_into: null,
            createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
          }));
        }
      }
      await Promise.all(tasks);
      await loadAll();
    } catch (e) { alert("Error regenerating slots."); }
  }

  async function renumberTray(trayNumber) {
    const snap = await getDocs(collection(db, "machines", machineId, "slots"));
    const traySlots = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((s) => s.tray === trayNumber).sort((a, b) => (a.slot_number || 0) - (b.slot_number || 0));
    let next = 1;
    const updates = [];
    for (const s of traySlots) {
      if (s.slot_number !== next) updates.push(updateDoc(doc(db, "machines", machineId, "slots", s.id), { slot_number: next }));
      next++;
    }
    if (updates.length) await Promise.all(updates);
  }

  async function deleteSingleSlot(slot) {
    if (!window.confirm("Delete slot permanently?")) return;
    await deleteDoc(doc(db, "machines", machineId, "slots", slot.id));
    await renumberTray(slot.tray);
    await loadAll();
    closeSlotEditor();
  }

  async function handleAddSlot(tray) {
    const maxSlotNumber = slots.filter((s) => s.tray === tray).reduce((max, s) => Math.max(max, Number(s.slot_number) || 0), 0);
    if (maxSlotNumber >= 10) return alert("Max 10 slots per tray.");
    await addDoc(collection(db, "machines", machineId, "slots"), {
      tray, slot_number: maxSlotNumber + 1, capacity: 10, current_qty: 0, product_id: null, product_name: "", merged_into: null
    });
    await loadAll();
  }

  async function handleMergeRight() {
    if (editingSlot.merged_into) return alert("Already merged.");
    const root = slots.find((s) => s.id === editingSlot.id);
    const neighbor = slots.find((s) => s.tray === root.tray && s.slot_number === root.slot_number + 1 && !s.merged_into);
    if (!neighbor) return alert("No right neighbor available.");
    
    setMergeBusy(true);
    try {
      await Promise.all([
        updateDoc(doc(db, "machines", machineId, "slots", root.id), { capacity: (Number(root.capacity)||0) + (Number(neighbor.capacity)||0) }),
        updateDoc(doc(db, "machines", machineId, "slots", neighbor.id), { merged_into: root.id, capacity: 0, current_qty: 0, product_id: null, product_name: "" })
      ]);
      await loadAll();
      closeSlotEditor();
    } finally { setMergeBusy(false); }
  }

  async function handleDemerge() {
    if (editingSlot.merged_into) return alert("Open the base slot to demerge.");
    const root = slots.find((s) => s.id === editingSlot.id);
    const children = slots.filter((s) => s.merged_into === root.id);
    if (children.length === 0) return alert("Not merged.");

    setMergeBusy(true);
    try {
      const eachCap = Math.max(1, Math.floor((Number(root.capacity) || 0) / (children.length + 1)));
      const updates = [updateDoc(doc(db, "machines", machineId, "slots", root.id), { capacity: eachCap })];
      children.forEach((child) => updates.push(updateDoc(doc(db, "machines", machineId, "slots", child.id), { merged_into: null, capacity: eachCap, current_qty: 0, product_id: null, product_name: "" })));
      await Promise.all(updates);
      await loadAll();
      closeSlotEditor();
    } finally { setMergeBusy(false); }
  }

  // --- RENDER ---
  if (loading || !machine) return <div style={{ padding: 24 }}>Loading slots...</div>;
  const trays = traysFromSlots();

  // Return your exact JSX below (no visual changes, just secure data)
  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <button onClick={() => nav(-1)} style={btnBack}>← Back</button>
        <div style={{ textAlign: "center" }}>
          <h2 style={{ margin: 0 }}>Configure Slots – {machine.id}</h2>
          <div style={{ display: "flex", justifyContent: "center", gap: 12, margin: "10px 0" }}>
            <button style={btnRed} onClick={() => deleteAllSlots(false)}>Delete All Slots</button>
            <button style={btnBlue} onClick={regenerateSlotsPrompt}>Regenerate Grid</button>
          </div>
        </div>
        <div style={{ textAlign: "right", fontSize: 13, background: "#fff", padding: 10, borderRadius: 8, border: "1px solid #eee" }}>
          <div><b>Trays:</b> {trays.length || "-"}</div>
          <div><b>Total slots:</b> {slots.length}</div>
        </div>
      </div>

      {trays.length === 0 ? (
        <div style={card}><p>No slots found. Generate a grid.</p></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {trays.map((tray) => {
            const traySlots = slotsForTray(tray);
            return (
              <div key={tray} style={trayRow}>
                <div style={trayLeft}>
                  <div style={trayLabel}>Tray {tray}</div>
                  <button type="button" style={btnTinyAdd} onClick={() => handleAddSlot(tray)}>+ Add Slot</button>
                </div>
                <div style={slotsRow}>
                  {traySlots.map((slot) => {
                    const group = groupForRootSlot(slot);
                    const label = displayCodeRange(slot);
                    const isMerged = group.length > 1;
                    return (
                      <div key={slot.id} style={{...slotPill, border: isMerged ? "2px solid #3b82f6" : "1px solid #dde3f0"}} onClick={() => openSlotEditor(slot)}>
                        <div style={slotCodeText}>{label}</div>
                        <div style={{ fontSize: 12, color: slot.product_name ? "#222" : "#999", fontWeight: slot.product_name ? 600 : 400, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", maxWidth: 80 }}>
                          {slot.product_name || "Empty"}
                        </div>
                        <div style={{ fontSize: 11, color: "#666", marginTop: 4, display: "flex", justifyContent: "space-between" }}>
                          <span>{slot.current_qty ?? 0}/{slot.capacity ?? 0}</span>
                          {isMerged && <span style={{color:"#3b82f6"}}>🔗</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SLOT EDIT MODAL */}
      {editingSlot && (
        <div style={modalBackdrop}>
          <div style={modalBox}>
            <h3 style={{ marginTop: 0 }}>Edit Slot {displayCodeRange(editingSlot)}</h3>
            <div style={field}>
              <label>Product</label>
              <select style={inputSelect} value={editingSlot.product_id || ""} onChange={(e) => handleEditingFieldChange("product_id", e.target.value)}>
                <option value="">-- Empty slot --</option>
                {products.map((p) => <option key={p.id} value={p.id}>{labelForProduct(p)}</option>)}
              </select>
            </div>
            <div style={field}><label>Capacity</label><input type="number" style={inputNumber} value={editingSlot.capacity} onChange={(e) => handleEditingFieldChange("capacity", e.target.value)} /></div>
            <div style={field}><label>Current Qty</label><input type="number" style={inputNumber} value={editingSlot.current_qty} onChange={(e) => handleEditingFieldChange("current_qty", e.target.value)} /></div>
            
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" style={btnTinyGhost} onClick={handleMergeRight} disabled={mergeBusy}>Merge Right →</button>
                <button type="button" style={btnTinyGhost} onClick={handleDemerge} disabled={mergeBusy}>Demerge</button>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={closeSlotEditor} style={btnCancel}>Cancel</button>
                <button type="button" onClick={() => deleteSingleSlot(editingSlot)} style={btnDanger}>Delete</button>
                <button type="button" onClick={saveEditingSlot} style={btnSave}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// STYLES
const card = { background: "#fff", padding: 16, borderRadius: 12, boxShadow: "0 4px 16px rgba(0,0,0,0.04)", border: "1px solid #eee" };
const trayRow = { ...card, display: "flex", alignItems: "flex-start", gap: 20 };
const trayLeft = { minWidth: 90, display: "flex", flexDirection: "column", gap: 8 };
const trayLabel = { fontWeight: 800, fontSize: 16, color: "#1e293b" };
const slotsRow = { display: "flex", flexWrap: "wrap", gap: 10 };
const slotPill = { width: 100, padding: "10px", borderRadius: 10, background: "#f8fafc", cursor: "pointer", transition: "all 0.1s" };
const slotCodeText = { fontWeight: 800, fontSize: 16, color: "#0f172a", marginBottom: 2 };
const btnBack = { padding: "8px 16px", border: "none", borderRadius: 8, background: "#f1f5f9", color: "#475569", cursor: "pointer", fontWeight: "bold" };
const btnRed = { padding: "8px 16px", background: "#fee2e2", color: "#ef4444", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: "bold" };
const btnBlue = { padding: "8px 16px", background: "#e0f2fe", color: "#3b82f6", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: "bold" };
const btnTinyAdd = { padding: "6px 10px", fontSize: 12, borderRadius: 6, border: "1px dashed #cbd5e1", background: "#fff", color: "#64748b", cursor: "pointer", fontWeight: "bold" };

// Modal Styles
const modalBackdrop = { position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999 };
const modalBox = { background: "#fff", padding: 24, borderRadius: 16, width: 440, boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)" };
const field = { marginBottom: 15, display: "flex", flexDirection: "column", gap: 6 };
const inputSelect = { width: "100%", padding: "10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14 };
const inputNumber = { width: "100%", padding: "10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14 };
const btnCancel = { padding: "8px 16px", background: "#f1f5f9", border: "none", borderRadius: 8, color: "#64748b", cursor: "pointer", fontWeight: "bold" };
const btnSave = { padding: "8px 16px", background: "#10b981", border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", fontWeight: "bold" };
const btnDanger = { padding: "8px 16px", background: "#ef4444", border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", fontWeight: "bold" };
const btnTinyGhost = { padding: "6px 10px", fontSize: 12, borderRadius: 6, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#475569", cursor: "pointer", fontWeight: "bold" };