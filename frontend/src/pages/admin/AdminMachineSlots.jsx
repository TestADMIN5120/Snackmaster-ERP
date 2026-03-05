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
  query,
  where
} from "firebase/firestore";
import { db } from "../../firebaseClient";
import { useAdmin } from "../../contexts/AdminContext";
import { generateMachineSlotPDF } from "../../utils/pdfGenerator"; 

export default function AdminMachineSlots() {
  const { machineId } = useParams();
  const nav = useNavigate();
  const { orgId } = useAdmin();

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
      const m = await getDoc(doc(db, "machines", machineId));
      if (!m.exists() || m.data().orgId !== orgId) {
          alert("Access Denied: Machine not found or belongs to another organization.");
          nav("/admin/machines");
          return;
      }
      setMachine({ id: m.id, ...m.data() });

      const snapSlots = await getDocs(collection(db, "machines", machineId, "slots"));
      setSlots(snapSlots.docs.map((d) => ({ id: d.id, ...d.data() })));

      const masterQ = query(
        collection(db, "master_products"), 
        where("orgId", "==", orgId)
      );
      const snapMaster = await getDocs(masterQ);
      const masterList = snapMaster.docs.map((d) => ({ id: d.id, ...d.data() }));
      
      masterList.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setProducts(masterList);

    } catch (e) {
      console.error("Failed to load machine/slots", e);
    } finally {
      setLoading(false);
    }
  }

  // --- HELPER FUNCTIONS ---
  function traysFromSlots() {
    const set = new Set();
    slots.forEach((s) => { if (s.tray != null) set.add(s.tray); });
    return Array.from(set).sort((a, b) => a - b);
  }

  function slotsForTray(tray) {
    return slots.filter((s) => s.tray === tray && !s.merged_into).sort((a, b) => (a.slot_number || 0) - (b.slot_number || 0));
  }

  // 🟢 UPDATED: This math now converts 1-10 into 0-9 for the display (e.g., 110-119)
  function displayCodeForSlot(slot) {
    if (!slot.tray || !slot.slot_number) return slot.id;
    const code = 110 + (Number(slot.tray) - 1) * 10 + (Number(slot.slot_number) - 1);
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
    const skuPart = p.sku ? `[${p.sku}] ` : "";
    return `${skuPart}${p.name || "Unnamed Product"}`;
  }

  function getSelectedProductId(slot) {
    if (slot.product_id) return slot.product_id;
    if (slot.product_name) {
      const match = products.find((p) => p.name === slot.product_name);
      if (match) return match.id;
    }
    return "";
  }

  const downloadSlotAudit = () => {
    if (!machine || slots.length === 0) return alert("No data to download");
    generateMachineSlotPDF(machine, slots);
  };

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
    setEditingSlot((prev) => {
      if (!prev) return prev;
      
      let parsedValue = value === "" ? "" : Number(value);

      if (typeof parsedValue === "number" && parsedValue < 0) parsedValue = 0;

      if (field === "current_qty" && typeof parsedValue === "number") {
        const cap = Number(prev.capacity) || 0;
        if (parsedValue > cap) parsedValue = cap;
      }

      return {
        ...prev,
        [field]: parsedValue,
      };
    });
  }

  async function saveEditingSlot() {
    if (!editingSlot) return;
    setSavingSlot(true);
    try {
      const { id, capacity, current_qty, product_id } = editingSlot;
      const product = products.find((p) => p.id === product_id);

      await updateDoc(doc(db, "machines", machineId, "slots", id), {
        capacity: Number(capacity) || 0,
        current_qty: Number(current_qty) || 0,
        product_id: product ? product.id : null,
        product_name: product ? product.name : "",
        updatedAt: serverTimestamp(),
      });
      await loadAll();
      closeSlotEditor();
    } catch (e) { alert("Error updating slot"); } finally { setSavingSlot(false); }
  }

  // --- SLOT GENERATION ACTIONS ---
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

  // 🟢 FIXED: Added missing handleAddSlot function
  async function handleAddSlot(tray) {
    const traySlots = slotsForTray(tray);
    const maxSlot = traySlots.length > 0 ? Math.max(...traySlots.map(s => s.slot_number)) : 0;
    
    try {
      await addDoc(collection(db, "machines", machineId, "slots"), {
        tray: tray,
        slot_number: maxSlot + 1,
        capacity: 10,
        current_qty: 0,
        product_id: null,
        product_name: "",
        merged_into: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await loadAll();
    } catch (err) {
      alert("Error adding slot");
    }
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

  if (loading || !machine) return <div style={{ padding: 24 }}>Loading machine configuration...</div>;
  const trays = traysFromSlots();

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <button onClick={() => nav(-1)} style={btnBack}>← Back</button>
        <div style={{ textAlign: "center" }}>
          <h2 style={{ margin: 0 }}>Configure Slots – {machine.name || machine.id}</h2>
          <div style={{ display: "flex", justifyContent: "center", gap: 12, margin: "10px 0" }}>
            <button style={btnRed} onClick={() => deleteAllSlots(false)}>Delete All Slots</button>
            <button style={btnBlue} onClick={regenerateSlotsPrompt}>Regenerate Grid</button>
            <button style={btnGreen} onClick={downloadSlotAudit}>📥 Download Slot Data</button>
          </div>
        </div>
        <div style={{ textAlign: "right", fontSize: 13, background: "#fff", padding: 10, borderRadius: 8, border: "1px solid #eee" }}>
          <div><b>Trays:</b> {trays.length || "-"}</div>
          <div><b>Total slots:</b> {slots.length}</div>
        </div>
      </div>

      {trays.length === 0 ? (
        <div style={card}><p>No slots found. Please regenerate the grid.</p></div>
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
                        <div style={{ fontSize: 11, color: "#64748b", marginTop: 4, display: "flex", justifyContent: "space-between" }}>
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
              <label style={{fontWeight: 'bold', fontSize: 13, marginBottom: 5}}>Product (from Master Catalog)</label>
              <select style={inputSelect} value={editingSlot.product_id || ""} onChange={(e) => handleEditingFieldChange("product_id", e.target.value)}>
                <option value="">-- Empty slot --</option>
                {products.map((p) => <option key={p.id} value={p.id}>{labelForProduct(p)}</option>)}
              </select>
            </div>
            
            <div style={field}>
              <label style={{fontWeight: 'bold', fontSize: 13, marginBottom: 5}}>Capacity</label>
              <input 
                type="number" 
                min="0"
                style={inputNumber} 
                value={editingSlot.capacity} 
                onChange={(e) => handleEditingFieldChange("capacity", e.target.value)} 
                onFocus={(e) => e.target.select()} 
              />
            </div>
            <div style={field}>
              <label style={{fontWeight: 'bold', fontSize: 13, marginBottom: 5}}>Current Qty</label>
              <input 
                type="number" 
                min="0" 
                max={editingSlot.capacity || 0}
                style={inputNumber} 
                value={editingSlot.current_qty} 
                onChange={(e) => handleEditingFieldChange("current_qty", e.target.value)} 
                onFocus={(e) => e.target.select()} 
              />
            </div>
            
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" style={btnTinyGhost} onClick={handleMergeRight} disabled={mergeBusy}>Merge Right →</button>
                <button type="button" style={btnTinyGhost} onClick={handleDemerge} disabled={mergeBusy}>Demerge</button>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={closeSlotEditor} style={btnCancel}>Cancel</button>
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
const btnGreen = { padding: "8px 16px", background: "#10b981", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: "bold" }; 
const btnTinyAdd = { padding: "6px 10px", fontSize: 12, borderRadius: 6, border: "1px dashed #cbd5e1", background: "#fff", color: "#64748b", cursor: "pointer", fontWeight: "bold" };

const modalBackdrop = { position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999 };
const modalBox = { background: "#fff", padding: 24, borderRadius: 16, width: 440, boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)" };
const field = { marginBottom: 15, display: "flex", flexDirection: "column", gap: 6 };
const inputSelect = { width: "100%", padding: "10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14 };
const inputNumber = { width: "100%", padding: "10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14 };
const btnCancel = { padding: "8px 16px", background: "#f1f5f9", border: "none", borderRadius: 8, color: "#64748b", cursor: "pointer", fontWeight: "bold" };
const btnSave = { padding: "8px 16px", background: "#10b981", border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", fontWeight: "bold" };
const btnTinyGhost = { padding: "6px 10px", fontSize: 12, borderRadius: 6, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#475569", cursor: "pointer", fontWeight: "bold" };