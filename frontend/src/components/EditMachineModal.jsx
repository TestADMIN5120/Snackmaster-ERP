import React, { useState } from "react";
import { db } from "../firebaseClient";
import { doc, updateDoc, serverTimestamp, addDoc, collection } from "firebase/firestore";

export default function EditMachineModal({ machine, onClose }) {
  const [name, setName] = useState(machine.name || "");
  const [location, setLocation] = useState(machine.location || "");
  const [capacity, setCapacity] = useState(machine.capacity || "");
  const [machineType, setMachineType] = useState(machine.machineType || "");
  const [status, setStatus] = useState(machine.status || "active");
  const [saving, setSaving] = useState(false);

  async function saveChanges() {
    if (!machine.id) return alert("Machine ID missing.");

    setSaving(true);
    try {
      await updateDoc(doc(db, "machines", machine.id), {
        name: name.trim(),
        location: location.trim(),
        capacity: Number(capacity),
        machineType: machineType || null,
        status,
        updatedAt: serverTimestamp()
      });

      const user = JSON.parse(localStorage.getItem("sm_user") || "{}");
      await addDoc(collection(db, "admin_actions"), {
        actorEmail: user.email || "unknown",
        actionType: "edit_machine",
        machineId: machine.id,
        orgId: machine.orgId || "unknown", // 🟢 Critical Multi-Tenant Fix
        changes: { name, location, capacity, machineType, status },
        createdAt: serverTimestamp()
      });

      alert("Machine updated successfully!");
      onClose();
    } catch (error) {
      console.error(error);
      alert("Error updating machine.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={backdrop}>
      <div style={modal}>
        <h2 style={{ marginTop: 0 }}>Edit Machine Details</h2>
        <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>Machine ID: <b style={{color: "#000"}}>{machine.id}</b></p>

        <div style={field}>
          <label style={label}>Name</label>
          <input style={input} value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div style={field}>
          <label style={label}>Machine Type</label>
          <select style={input} value={machineType} onChange={(e) => setMachineType(e.target.value)}>
            <option value="">-- Select Type --</option>
            <option value="Coffee Vending">Coffee Vending</option>
            <option value="Snacks Combo Vending">Snacks Combo Vending</option>
          </select>
        </div>

        <div style={field}>
          <label style={label}>Location</label>
          <input style={input} value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>

        <div style={field}>
          <label style={label}>Capacity (Total Items)</label>
          <input style={input} type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
        </div>

        <div style={field}>
          <label style={label}>Status</label>
          <select style={input} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="service-down">Service Down</option>
          </select>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={btnCancel} disabled={saving}>Cancel</button>
          <button onClick={saveChanges} style={btnSave} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</button>
        </div>
      </div>
    </div>
  );
}

const backdrop = { position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "rgba(15, 23, 42, 0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999 };
const modal = { background: "#fff", padding: 24, borderRadius: 12, width: "420px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" };
const field = { marginBottom: 15, display: "flex", flexDirection: "column", gap: 6 };
const label = { fontWeight: "bold", fontSize: 13, color: "#475569" };
const input = { padding: "10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14 };
const btnCancel = { padding: "10px 16px", background: "#f1f5f9", border: "none", borderRadius: 8, color: "#475569", cursor: "pointer", fontWeight: "bold" };
const btnSave = { padding: "10px 16px", background: "#3b82f6", border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", fontWeight: "bold" };