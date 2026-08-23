// frontend/src/pages/admin/AdminAssignMachines.jsx
import React, { useEffect, useState } from "react";
import {
  collection,
  updateDoc,
  doc,
  onSnapshot,
  query,
  where,
  addDoc,
  serverTimestamp,
  deleteField
} from "firebase/firestore";
import { db } from "../../firebaseClient";
import { useAdmin } from "../../contexts/AdminContext";

export default function AdminAssignMachines() {
  const { user, orgId } = useAdmin(); 
  const [refillers, setRefillers] = useState([]);
  const [machines, setMachines] = useState([]);

  const [selectedRefiller, setSelectedRefiller] = useState("");
  const [assigning, setAssigning] = useState(false);

  // 🟢 SECURE LIVE: load all refillers for THIS ORG ONLY
  useEffect(() => {
    if (!orgId) return;
    const q = query(
      collection(db, "users"), 
      where("role", "==", "refiller"),
      where("orgId", "==", orgId),
      where("deleted", "==", false)
    );

    const unsub = onSnapshot(q, (snap) => {
      setRefillers(snap.docs.map((d) => ({ uid: d.id, ...d.data() })));
    });

    return () => unsub();
  }, [orgId]);

  // 🟢 SECURE LIVE: load all machines for THIS ORG ONLY
  useEffect(() => {
    if (!orgId) return;
    const q = query(
        collection(db, "machines"),
        where("orgId", "==", orgId),
        where("deleted", "==", false)
    );

    const unsub = onSnapshot(q, (snap) => {
      setMachines(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => unsub();
  }, [orgId]);

  // 🟢 Updated filters to check for 'refillerId'
  const unassignedMachines = machines.filter((m) => !m.refillerId);
  const assignedMachines = machines.filter((m) => m.refillerId);

  // ASSIGN MACHINE
  async function assignMachine(machineId, machineName) {
    if (!selectedRefiller) {
      alert("Please select a refiller from the dropdown first.");
      return;
    }

    try {
      setAssigning(true);
      const refiller = refillers.find(r => r.uid === selectedRefiller);

      // 🟢 FIXED: Using 'refillerId' to match the Refiller Dashboard query
      await updateDoc(doc(db, "machines", machineId), {
        refillerId: selectedRefiller,
        assignedEmail: refiller?.email || "",
        assignedAt: serverTimestamp(),
        assignedTo: selectedRefiller, // Kept for legacy support, but refillerId is the primary
        assignedAdmin: user.email // Admin who performed this assignment
      });

      // Audit Log
      await addDoc(collection(db, "admin_actions"), {
        actionType: "machine_assigned",
        machineId,
        machineName,
        assignedToUid: selectedRefiller,
        assignedToEmail: refiller?.email,
        actorEmail: user.email,
        orgId: orgId,
        createdAt: serverTimestamp()
      });

    } catch (err) {
      console.error("Failed to assign machine:", err);
      alert("Failed to assign machine.");
    } finally {
      setAssigning(false);
    }
  }

  // REMOVE ASSIGNMENT
  async function unassignMachine(machineId, machineName, currentRefillerUid) {
    if(!window.confirm(`Unassign this machine?`)) return;
    try {
      // 🟢 FIXED: Clearing 'refillerId'
      await updateDoc(doc(db, "machines", machineId), {
        refillerId: null,
        assignedTo: null,
        assignedEmail: null,
        assignedAdmin: null,
        assignedAt: serverTimestamp()
      });

      // Audit Log
      await addDoc(collection(db, "admin_actions"), {
        actionType: "machine_unassigned",
        machineId,
        machineName,
        removedFromUid: currentRefillerUid,
        actorEmail: user.email,
        orgId: orgId,
        createdAt: serverTimestamp()
      });

    } catch (err) {
      console.error(err);
      alert("Failed to unassign.");
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ marginBottom: 20 }}>Assign Route (Machines)</h1>

      <div style={card}>
        <label style={{ fontWeight: 600, fontSize: 16, display: "block", marginBottom: 10 }}>
          1. Select a Refiller
        </label>
        <select
          value={selectedRefiller}
          onChange={(e) => setSelectedRefiller(e.target.value)}
          style={selectStyle}
        >
          <option value="">-- Choose a refiller --</option>
          {refillers.map((r) => (
            <option key={r.uid} value={r.uid}>
              {r.displayName || "No Name"} ({r.email})
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 24 }}>
        
        {/* LEFT COL: UNASSIGNED MACHINES */}
        <div>
            <h2 style={{ fontSize: 18, marginBottom: 15, color: "#e65100" }}>⚠️ Unassigned Machines ({unassignedMachines.length})</h2>
            
            {unassignedMachines.length === 0 && (
                <div style={emptyBox}>All machines are assigned!</div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {unassignedMachines.map((m) => (
                    <div key={m.id} style={machineCard}>
                        <div>
                            <div style={{ fontWeight: "bold", fontSize: 15 }}>{m.name || m.id}</div>
                            <div style={{ fontSize: 13, color: "#666" }}>📍 {m.location || "No location"}</div>
                        </div>
                        <button
                            disabled={assigning || !selectedRefiller}
                            style={selectedRefiller ? btnGreen : btnDisabled}
                            onClick={() => assignMachine(m.id, m.name)}
                        >
                            Assign →
                        </button>
                    </div>
                ))}
            </div>
        </div>

        {/* RIGHT COL: ASSIGNED MACHINES */}
        <div>
            <h2 style={{ fontSize: 18, marginBottom: 15, color: "#2e7d32" }}>✅ Assigned Machines ({assignedMachines.length})</h2>
            
            {assignedMachines.length === 0 && (
                <div style={emptyBox}>No machines assigned yet.</div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {assignedMachines.map((m) => {
                    const assignedUser = refillers.find(r => r.uid === m.refillerId);
                    return (
                        <div key={m.id} style={machineCard}>
                            <div>
                                <div style={{ fontWeight: "bold", fontSize: 15 }}>{m.name || m.id}</div>
                                <div style={{ fontSize: 13, color: "#1976d2", fontWeight: "bold", marginTop: 4 }}>
                                    👤 {assignedUser?.displayName || m.assignedEmail || "Assigned"}
                                </div>
                                {m.assignedAdmin && (
                                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                                        🛡️ Assigned by {m.assignedAdmin}
                                    </div>
                                )}
                            </div>
                            <button
                                style={btnDanger}
                                onClick={() => unassignMachine(m.id, m.name, m.refillerId)}
                            >
                                Unassign
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
      </div>
    </div>
  );
}

/* Styles */
const card = { background: "#fff", padding: 20, borderRadius: 12, border: "1px solid #e2e8f0" };
const machineCard = { background: "#fff", border: "1px solid #e2e8f0", padding: 15, borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" };
const emptyBox = { background: "#f8fafc", padding: 30, textAlign: "center", borderRadius: 8, color: "#64748b", border: "1px dashed #cbd5e1" };
const selectStyle = { width: "100%", maxWidth: "400px", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "15px" };

const btnGreen = { padding: "8px 16px", background: "#10b981", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: "bold" };
const btnDisabled = { padding: "8px 16px", background: "#e2e8f0", color: "#94a3b8", border: "none", borderRadius: 6, cursor: "not-allowed", fontWeight: "bold" };
const btnDanger = { padding: "8px 16px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: "bold" };