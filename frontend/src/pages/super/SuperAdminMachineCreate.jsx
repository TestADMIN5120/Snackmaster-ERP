// src/pages/super/SuperAdminMachineCreate.jsx
import React, { useState, useEffect } from "react";
import {
  doc,
  setDoc,
  serverTimestamp,
  addDoc,
  collection,
  getDocs,
  query,
  where
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db } from "../../firebaseClient";
import { useAdmin } from "../../contexts/AdminContext";

function Field({ label, ...props }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>
        {label}
      </label>
      <input {...props} style={input} />
    </div>
  );
}

export default function SuperAdminMachineCreate() {
  console.log("🔥 SuperAdminMachineCreate MOUNTED");

  const navigate = useNavigate();
  const { user } = useAdmin();

  const [orgs, setOrgs] = useState([]);
  const [form, setForm] = useState({
    id: "",
    name: "",
    location: "",
    googleMapsUrl: "",
    capacity: "",
    orgId: "",
    machineType: "",
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadOrgs() {
      try {
        const q = query(collection(db, "organisations"), where("deleted", "==", false));
        const snap = await getDocs(q);
        setOrgs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Failed to load organizations", err);
      }
    }
    loadOrgs();
  }, []);

  function updateField(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function createMachine(e) {
    e.preventDefault();

    if (!form.id || !form.name) {
      alert("Machine ID and name required");
      return;
    }

    setSaving(true);

    try {
      await setDoc(doc(db, "machines", form.id), {
        id: form.id,
        name: form.name,
        location: form.location || null,
        googleMapsUrl: form.googleMapsUrl || null,
        machineType: form.machineType || null,
        capacity: Number(form.capacity) || null,
        orgId: form.orgId || null,
        assigned: !!form.orgId,
        status: form.orgId ? "active" : "unassigned",
        deleted: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await addDoc(collection(db, "admin_actions"), {
        action: "MACHINE_CREATED",
        machineId: form.id,
        machineName: form.name,
        assignedToOrg: form.orgId || "unassigned",
        performedBy: user?.email || "unknown",
        createdAt: serverTimestamp(),
      });

      navigate("/super/machines");
    } catch (err) {
      console.error("❌ Machine creation failed", err);
      alert("Failed to create machine.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 520, padding: 24 }}>
      <h1>Create Machine</h1>

      <form onSubmit={createMachine}>
        <Field
          label="Machine ID (Hardware ID)"
          name="id"
          value={form.id}
          onChange={updateField}
          placeholder="e.g. SNACK-BLR-001"
          required
        />

        <Field
          label="Machine Name"
          name="name"
          value={form.name}
          onChange={updateField}
          placeholder="e.g. Bangalore Lobby Block A"
          required
        />

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>
            Machine Type
          </label>
          <select name="machineType" value={form.machineType} onChange={updateField} style={input}>
            <option value="">-- Select Type --</option>
            <option value="Coffee Vending">Coffee Vending</option>
            <option value="Snacks Combo Vending">Snacks Combo Vending</option>
          </select>
        </div>

        <Field
          label="Location Text (optional)"
          name="location"
          value={form.location}
          onChange={updateField}
          placeholder="e.g. Ground Floor Lobby"
        />

        {/* 🟢 NEW INPUT FIELD */}
        <Field
          label="Google Maps URL (optional)"
          name="googleMapsUrl"
          value={form.googleMapsUrl}
          onChange={updateField}
          placeholder="https://maps.app.goo.gl/..."
          type="url"
        />

        <Field
          label="Capacity (optional)"
          name="capacity"
          type="number"
          value={form.capacity}
          onChange={updateField}
        />

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>
            Assign to Organization
          </label>
          <select name="orgId" value={form.orgId} onChange={updateField} style={input}>
            <option value="">-- Leave Unassigned --</option>
            {orgs.map(org => (
              <option key={org.id} value={org.id}>{org.name}</option>
            ))}
          </select>
        </div>

        <div style={{ marginTop: 24 }}>
          <button type="submit" disabled={saving} style={btnPrimary}>
            {saving ? "Creating…" : "Create & Assign Machine"}
          </button>
          <button type="button" onClick={() => navigate("/super/machines")} style={btnSecondary}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

const input = { width: "100%", padding: "10px", borderRadius: 6, border: "1px solid #ccc" };
const btnPrimary = { padding: "10px 16px", background: "#1e88e5", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: "bold" };
const btnSecondary = { marginLeft: 12, padding: "10px 16px", background: "#e0e0e0", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: "bold" };