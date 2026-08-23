import React, { useState } from "react";
import {
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db } from "../../firebaseClient";
import { useAdmin } from "../../contexts/AdminContext";

function Field({ label, error, ...props }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
        {label}
      </label>
      <input
        {...props}
        style={{
          width: "100%",
          padding: "12px",
          borderRadius: 6,
          boxSizing: "border-box",
          border: error ? "1px solid #e53935" : "1px solid #ccc",
          fontSize: 15
        }}
      />
      {error && <div style={{ color: "#e53935", fontSize: 13, marginTop: 4 }}>{error}</div>}
    </div>
  );
}

export default function SuperAdminLocationCreate() {
  const navigate = useNavigate();
  const { user } = useAdmin();

  const [form, setForm] = useState({ name: "", address: "", type: "" });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  function updateField(e) {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  }

  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = "Location name is required";
    if (!form.address.trim()) e.address = "Address is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function createLocation(e) {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    setErrors({});

    try {
      const payload = {
        name: form.name.trim(),
        address: form.address.trim(),
        type: form.type.trim(),
        status: "active",
        deleted: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const ref = await addDoc(collection(db, "locations"), payload);

      await addDoc(collection(db, "admin_actions"), {
        action: "LOCATION_CREATED",
        entityType: "location",
        entityId: ref.id,
        entityName: form.name.trim(),
        performedBy: user?.email || "unknown",
        createdAt: serverTimestamp(),
      });

      alert(`✅ Location '${form.name}' created!`);
      navigate("/super/locations");
    } catch (err) {
      console.error(err);
      setErrors({ global: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 520, padding: 24 }}>
      <h1 style={{ marginBottom: 20 }}>Add Location</h1>
      {errors.global && <div style={{ color: "#e53935", marginBottom: 16, background: "#fee2e2", padding: 10, borderRadius: 6 }}>{errors.global}</div>}

      <form onSubmit={createLocation} style={{ background: "#fff", padding: 24, borderRadius: 12, boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
        <Field
          label="Location Name"
          name="name"
          value={form.name}
          onChange={updateField}
          placeholder="e.g. Hyderabad Warehouse"
          error={errors.name}
        />

        <Field
          label="Address"
          name="address"
          value={form.address}
          onChange={updateField}
          placeholder="e.g. Plot 12, Industrial Area, Hyderabad"
          error={errors.address}
        />

        <Field
          label="Type (optional)"
          name="type"
          value={form.type}
          onChange={updateField}
          placeholder="e.g. Warehouse, Branch, Office"
        />

        <div style={{ marginTop: 30, display: "flex", gap: 12 }}>
          <button type="submit" disabled={saving} style={saving ? btnDisabled : btnPrimary}>
            {saving ? "Creating…" : "Add Location"}
          </button>

          <button type="button" disabled={saving} onClick={() => navigate("/super/locations")} style={btnSecondary}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

const btnPrimary = { flex: 1, padding: "12px", background: "#1e88e5", color: "#fff", border: "none", borderRadius: 6, fontWeight: "bold", fontSize: 15, cursor: "pointer" };
const btnDisabled = { flex: 1, padding: "12px", background: "#90caf9", color: "#fff", border: "none", borderRadius: 6, fontWeight: "bold", fontSize: 15, cursor: "not-allowed" };
const btnSecondary = { padding: "12px 24px", background: "#e0e0e0", color: "#333", border: "none", borderRadius: 6, fontWeight: "bold", fontSize: 15, cursor: "pointer" };
