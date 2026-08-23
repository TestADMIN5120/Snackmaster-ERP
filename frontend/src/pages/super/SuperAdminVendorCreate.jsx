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

export default function SuperAdminVendorCreate() {
  const navigate = useNavigate();
  const { user } = useAdmin();

  const [form, setForm] = useState({ name: "", contactPerson: "", phone: "", email: "" });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  function updateField(e) {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  }

  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = "Vendor name is required";
    if (!form.contactPerson.trim()) e.contactPerson = "Contact person is required";
    if (!form.phone.trim()) {
      e.phone = "Phone number is required";
    } else if (!/^[0-9+\-\s]{7,15}$/.test(form.phone.trim())) {
      e.phone = "Enter a valid phone number";
    }
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      e.email = "Enter a valid email address";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function createVendor(e) {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    setErrors({});

    try {
      const payload = {
        name: form.name.trim(),
        contactPerson: form.contactPerson.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        status: "active",
        deleted: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const ref = await addDoc(collection(db, "vendors"), payload);

      await addDoc(collection(db, "admin_actions"), {
        action: "VENDOR_CREATED",
        entityType: "vendor",
        entityId: ref.id,
        entityName: form.name.trim(),
        performedBy: user?.email || "unknown",
        createdAt: serverTimestamp(),
      });

      alert(`✅ Vendor '${form.name}' created!`);
      navigate("/super/vendors");
    } catch (err) {
      console.error(err);
      setErrors({ global: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 520, padding: 24 }}>
      <h1 style={{ marginBottom: 20 }}>Add Vendor</h1>
      {errors.global && <div style={{ color: "#e53935", marginBottom: 16, background: "#fee2e2", padding: 10, borderRadius: 6 }}>{errors.global}</div>}

      <form onSubmit={createVendor} style={{ background: "#fff", padding: 24, borderRadius: 12, boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
        <Field
          label="Vendor Name"
          name="name"
          value={form.name}
          onChange={updateField}
          placeholder="e.g. VDS Distributors"
          error={errors.name}
        />

        <Field
          label="Contact Person"
          name="contactPerson"
          value={form.contactPerson}
          onChange={updateField}
          placeholder="e.g. Ramesh Kumar"
          error={errors.contactPerson}
        />

        <Field
          label="Phone"
          name="phone"
          value={form.phone}
          onChange={updateField}
          placeholder="e.g. 9876543210"
          error={errors.phone}
        />

        <Field
          label="Email (optional)"
          name="email"
          type="email"
          value={form.email}
          onChange={updateField}
          placeholder="e.g. vendor@example.com"
          error={errors.email}
        />

        <div style={{ marginTop: 30, display: "flex", gap: 12 }}>
          <button type="submit" disabled={saving} style={saving ? btnDisabled : btnPrimary}>
            {saving ? "Creating…" : "Add Vendor"}
          </button>

          <button type="button" disabled={saving} onClick={() => navigate("/super/vendors")} style={btnSecondary}>
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
