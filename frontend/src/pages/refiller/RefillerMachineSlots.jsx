import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  updateDoc,
  addDoc,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../firebaseClient";
import { useAdmin } from "../../contexts/AdminContext";

export default function RefillerMachineSlots() {
  const { machineId } = useParams();
  const nav = useNavigate();
  const { user } = useAdmin();

  const [machine, setMachine] = useState(null);
  const [slots, setSlots] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [editingSlot, setEditingSlot] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!machineId || !user) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [machineId, user]);

  async function loadAll() {
    setLoading(true);
    try {
      // 1) Machine Doc
      const mSnap = await getDoc(doc(db, "machines", machineId));
      if (!mSnap.exists()) {
        alert("Machine not found");
        nav("/refiller");
        return;
      }
      const m = { id: mSnap.id, ...mSnap.data() };

      if (!m.assignedTo || m.assignedTo !== user.uid) {
        alert("You are not assigned to this machine.");
        nav("/refiller");
        return;
      }
      setMachine(m);

      // 2) Slots
      const snapSlots = await getDocs(
        collection(db, "machines", machineId, "slots")
      );
      const slotsList = snapSlots.docs.map((d) => ({ id: d.id, ...d.data() }));
      setSlots(slotsList);

      // 3) Products (With Sorting)
      const qProducts = query(
        collection(db, "products"), 
        where("deleted", "==", false)
      );
      const snapProducts = await getDocs(qProducts);
      
      const prodList = snapProducts.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      // 🟢 SORTING LOGIC: SKU Ascending
      prodList.sort((a, b) => {
        const skuA = (a.sku || "").toString().toLowerCase();
        const skuB = (b.sku || "").toString().toLowerCase();
        return skuA.localeCompare(skuB, undefined, { numeric: true });
      });

      setProducts(prodList);

    } catch (e) {
      console.error("Failed to load refiller slots", e);
      alert("Error loading data. Check console permissions.");
    } finally {
      setLoading(false);
    }
  }

  // --- Helpers ---
  function traysFromSlots() {
    const setT = new Set();
    slots.forEach((s) => { if (s.tray != null) setT.add(s.tray); });
    return Array.from(setT).sort((a, b) => a - b);
  }

  function slotsForTray(tray) {
    return slots
      .filter((s) => s.tray === tray && !s.merged_into)
      .sort((a, b) => (a.slot_number || 0) - (b.slot_number || 0));
  }

  function displayCodeForSlot(slot) {
    if (!slot.tray || !slot.slot_number) return slot.id;
    const tray = Number(slot.tray);
    const s = Number(slot.slot_number);
    const code = 110 + (tray - 1) * 10 + s;
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

  // --- Editor Logic ---
  function openSlotEditor(slot) {
    const clone = {
      ...slot,
      capacity: slot.capacity == null ? "" : slot.capacity,
      current_qty: slot.current_qty == null ? "" : slot.current_qty,
      product_id: slot.product_id || "",
    };
    setEditingSlot(clone);
  }

  function closeSlotEditor() { setEditingSlot(null); }

  async function saveEditingSlot() {
    if (!editingSlot) return;
    const { id, capacity, current_qty, product_id } = editingSlot;

    if (Number(current_qty) > Number(capacity)) {
      alert("Current quantity cannot exceed capacity.");
      return;
    }

    setSaving(true);
    try {
      const product = products.find((p) => p.id === product_id);
      const payload = {
        capacity: Number(capacity) || 0,
        current_qty: Number(current_qty) || 0,
        product_id: product ? product.id : null,
        product_name: product ? product.name : "",
        updatedAt: serverTimestamp(),
      };

      await updateDoc(doc(db, "machines", machineId, "slots", id), payload);

      await addDoc(collection(db, "refiller_actions"), {
        actorUid: user.uid,
        actorEmail: user.email,
        machineId,
        slotId: id,
        action: "UPDATE_SLOT",
        changes: payload,
        createdAt: serverTimestamp(),
      });

      await loadAll();
      closeSlotEditor();
      alert("Slot updated successfully.");
    } catch (e) {
      console.error("Failed to save slot", e);
      alert("Error saving slot.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div style={{ padding: 24 }}>Loading inventory...</div>;

  const trays = traysFromSlots();

  return (
    <div style={{ padding: 24 }}>
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
        <button onClick={() => nav(`/refiller/machines/${machineId}`)} style={btnBack}>
          ← Back to Machine
        </button>
        <div><h2 style={{margin:0}}>Inventory: {machine?.name}</h2></div>
        <div />
      </div>

      {/* TRAYS GRID */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {trays.map((tray) => (
          <div key={tray} style={trayRow}>
            <div style={trayLabel}>Tray {tray}</div>
            <div style={slotsRow}>
              {slotsForTray(tray).map((slot) => {
                const label = displayCodeRange(slot);
                const prodName = slot.product_name || "Empty";
                return (
                  <div key={slot.id} style={slotPill} onClick={() => openSlotEditor(slot)}>
                    <div style={{ fontWeight: "bold" }}>{label}</div>
                    <div style={{ fontSize: 12 }}>{prodName}</div>
                    <div style={{ fontSize: 11, color: "#666" }}>
                      {slot.current_qty || 0} / {slot.capacity || 0}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* EDITOR MODAL */}
      {editingSlot && (
        <div style={modalBackdrop}>
          <div style={modalBox}>
            <h3>Edit Slot</h3>
            <label style={labelStyle}>Product</label>
            <select
              style={inputStyle}
              value={editingSlot.product_id}
              onChange={(e) => setEditingSlot({ ...editingSlot, product_id: e.target.value })}
            >
              <option value="">-- Empty --</option>
              {products.map((p) => (
                // 🟢 DISPLAY: [SKU] Product Name
                <option key={p.id} value={p.id}>
                   {p.sku ? `[${p.sku}] ` : ""} {p.name}
                </option>
              ))}
            </select>

            <label style={labelStyle}>Capacity</label>
            <input
              type="number"
              style={inputStyle}
              value={editingSlot.capacity}
              onChange={(e) => setEditingSlot({ ...editingSlot, capacity: e.target.value })}
            />

            <label style={labelStyle}>Current Quantity</label>
            <input
              type="number"
              style={inputStyle}
              value={editingSlot.current_qty}
              onChange={(e) => setEditingSlot({ ...editingSlot, current_qty: e.target.value })}
            />

            <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={closeSlotEditor} style={btnCancel}>Cancel</button>
              <button onClick={saveEditingSlot} disabled={saving} style={btnSave}>
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Styles (Kept exactly as requested)
const btnBack = { background: "#eee", border: "none", padding: "8px 12px", borderRadius: 4, cursor: "pointer" };
const trayRow = { background: "#fff", padding: 16, borderRadius: 8, boxShadow: "0 2px 4px rgba(0,0,0,0.1)" };
const trayLabel = { fontWeight: "bold", marginBottom: 8, color: "#555" };
const slotsRow = { display: "flex", flexWrap: "wrap", gap: 10 };
const slotPill = { border: "1px solid #ddd", borderRadius: 8, padding: "8px", minWidth: 80, textAlign: "center", cursor: "pointer", background: "#fafafa" };
const modalBackdrop = { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 };
const modalBox = { background: "#fff", padding: 24, borderRadius: 8, width: 400 };
const labelStyle = { display: "block", marginTop: 12, marginBottom: 4, fontWeight: 500 };
const inputStyle = { width: "100%", padding: 8, borderRadius: 4, border: "1px solid #ccc", boxSizing: "border-box" };
const btnCancel = { background: "#999", color: "#fff", border: "none", padding: "10px 16px", borderRadius: 4, cursor: "pointer" };
const btnSave = { background: "#1e88e5", color: "#fff", border: "none", padding: "10px 16px", borderRadius: 4, cursor: "pointer" };